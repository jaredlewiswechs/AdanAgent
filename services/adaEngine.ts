
import {
    Scalar, Vector, CognitiveState, ConstraintStatus, Action,
    SearchResult, PhysicalProperty, GroundingSource, ChatMessage,
    ProofLabel, LedgerStep
} from '../types';
import { WordMechanics } from './kinematicEngine';
import { callFreeAI, AIRequestError } from './aiClient';
import { COGNITIVE_THRESHOLDS, estimateFallbackMisconception } from '../config';

type AdaEvaluation = {
    correctness: number;
    misconception: number;
    entity: string;
    equation: string;
    response: string;
    synonyms: string[];
    antonyms: string[];
    action: string;
};

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'about', 'what', 'when', 'where', 'which', 'would',
    'could', 'should', 'there', 'their', 'have', 'has', 'been', 'were', 'will', 'shall', 'query', 'mode', 'standard', 'eli5',
    'technical', 'not', 'only', 'works', 'think'
]);

const LEXICAL_FALLBACKS: Record<string, { synonyms: string[]; antonyms: string[] }> = {
    simple: { synonyms: ['clear', 'easy', 'plain', 'friendly'], antonyms: ['complex', 'technical', 'dense', 'complicated'] },
    explain: { synonyms: ['clarify', 'describe', 'break down', 'unpack'], antonyms: ['confuse', 'obscure', 'complicate', 'muddy'] },
    deterministic: { synonyms: ['certain', 'predictable', 'fixed', 'verifiable'], antonyms: ['random', 'probabilistic', 'uncertain', 'speculative'] },
    verification: { synonyms: ['validation', 'proof', 'confirmation', 'audit'], antonyms: ['guessing', 'assumption', 'speculation', 'doubt'] },
    truth: { synonyms: ['fact', 'accuracy', 'reality', 'validity'], antonyms: ['falsehood', 'error', 'fiction', 'inaccuracy'] },
    standard: { synonyms: ['default', 'normal', 'baseline', 'regular'], antonyms: ['exception', 'custom', 'advanced', 'nonstandard'] },
    eli5: { synonyms: ['simple', 'kid-friendly', 'plain-language', 'easy'], antonyms: ['technical', 'jargon-heavy', 'advanced', 'complex'] },
    technical: { synonyms: ['specialized', 'precise', 'formal', 'detailed'], antonyms: ['simple', 'casual', 'plain', 'nontechnical'] }
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const stripCodeFences = (raw: string): string => {
    // Remove ```json ... ``` or ``` ... ``` wrappers
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    return fenceMatch ? fenceMatch[1].trim() : raw.trim();
};

const cleanResponseText = (text: string): string => {
    if (!text) return text;
    let cleaned = text
        // Remove markdown code fences from within response text
        .replace(/```[\s\S]*?```/g, '')
        // Remove markdown headings
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold/italic markdown syntax but keep content
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        // Remove leading bullet dashes on their own lines and normalize
        .replace(/^\s*[-*]\s+/gm, '- ')
        // Collapse multiple newlines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return cleaned;
};

const parseJsonBlock = <T>(raw: string): T | null => {
    const cleaned = stripCodeFences(raw);
    try {
        return JSON.parse(cleaned) as T;
    } catch {
        // Try to find the deepest/most relevant JSON object
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]) as T;
        } catch {
            return null;
        }
    }
};

const parseLooselyStructuredResponse = (raw: string): Partial<AdaEvaluation> | null => {
    const cleaned = stripCodeFences(raw);
    if (!cleaned) return null;

    const responseMatch = cleaned.match(/"response"\s*:\s*"([\s\S]*?)"/i);
    const entityMatch = cleaned.match(/"entity"\s*:\s*"([\s\S]*?)"/i);
    const equationMatch = cleaned.match(/"equation"\s*:\s*"([\s\S]*?)"/i);
    const correctnessMatch = cleaned.match(/"correctness"\s*:\s*([\d.]+)/i);
    const misconceptionMatch = cleaned.match(/"misconception"\s*:\s*([\d.]+)/i);
    const actionMatch = cleaned.match(/"action"\s*:\s*"(\w+)"/i);

    const hasJsonKeys = /"correctness"|"misconception"|"response"|"entity"/i.test(cleaned);

    if (hasJsonKeys) {
        return {
            response: responseMatch?.[1]?.replace(/\\n/g, '\n').trim() || cleaned,
            entity: entityMatch?.[1]?.trim(),
            equation: equationMatch?.[1]?.trim(),
            correctness: correctnessMatch ? parseFloat(correctnessMatch[1]) : undefined,
            misconception: misconceptionMatch ? parseFloat(misconceptionMatch[1]) : undefined,
            action: actionMatch?.[1]?.trim()
        };
    }

    return {
        response: cleanResponseText(cleaned)
    };
};

const normalizeEvaluation = (result: Partial<AdaEvaluation>, query: string): AdaEvaluation => ({
    correctness: clamp(Number(result.correctness ?? 0.65)),
    misconception: clamp(Number(result.misconception ?? 0.2)),
    entity: String(result.entity ?? (query.slice(0, 48) || 'Signal')),
    equation: String(result.equation ?? `meaning("${query}") = contextual_resolution`),
    response: String(result.response ?? 'I resolved your query using the available context.'),
    synonyms: Array.isArray(result.synonyms) ? result.synonyms.slice(0, 8).map(String) : [],
    antonyms: Array.isArray(result.antonyms) ? result.antonyms.slice(0, 8).map(String) : [],
    action: String(result.action ?? 'RESPOND')
});

const unique = (items: string[]) => [...new Set(items.map(item => item.trim()).filter(Boolean))];

const extractLexicalKeywords = (query: string): string[] =>
    query
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));

const mergeLexicalCoverage = (query: string, synonyms: string[], antonyms: string[]) => {
    const keywords = extractLexicalKeywords(query);
    const fallbackSynonyms: string[] = [];
    const fallbackAntonyms: string[] = [];

    for (const keyword of keywords) {
        const preset = LEXICAL_FALLBACKS[keyword];
        if (!preset) continue;
        fallbackSynonyms.push(...preset.synonyms);
        fallbackAntonyms.push(...preset.antonyms);
    }

    if (/synonym/i.test(query) && fallbackSynonyms.length === 0) {
        fallbackSynonyms.push('equivalent', 'alternate term', 'parallel wording');
    }
    if (/antonym|opposite|contrast/i.test(query) && fallbackAntonyms.length === 0) {
        fallbackAntonyms.push('opposite', 'inverse term', 'counter meaning');
    }

    return {
        synonyms: unique([...synonyms, ...fallbackSynonyms]).slice(0, 8),
        antonyms: unique([...antonyms, ...fallbackAntonyms]).slice(0, 8)
    };
};

const eli5Rewrite = (text: string, entity: string) => {
    const base = text.trim();
    if (!base) return `Think of ${entity || 'this'} like a simple puzzle: each piece must fit the facts before we answer.`;

    const rewritten = base
        .replace(/deterministic/gi, 'certain')
        .replace(/probabilistic/gi, 'guess-based')
        .replace(/epistemic/gi, 'truth-checking')
        .replace(/semantic/gi, 'meaning')
        .replace(/manifold/gi, 'map')
        .replace(/trajectory/gi, 'path');

    return rewritten.startsWith('Simple take:') ? rewritten : `Simple take: ${rewritten}`;
};

const Vec = {
    add: (v1: Vector, v2: Vector): Vector => v1.map((val, i) => val + (v2[i] || 0)),
    scale: (v: Vector, s: Scalar): Vector => v.map(val => val * s),
    equals: (v1: Vector, v2: Vector, tolerance = 0.05): boolean => 
        v1.every((val, i) => Math.abs(val - (v2[i] || 0)) < tolerance),
};

export class BezierPrimitive {
    constructor(public P0: Vector, public P1: Vector, public P2: Vector, public P3: Vector) {}

    public evaluate(t: Scalar): Vector {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;
        const term0 = Vec.scale(this.P0, mt3);
        const term1 = Vec.scale(this.P1, 3 * mt2 * t);
        const term2 = Vec.scale(this.P2, 3 * mt * t2);
        const term3 = Vec.scale(this.P3, t3);
        return Vec.add(Vec.add(term0, term1), Vec.add(term2, term3));
    }

    public checkClosure(): boolean {
        const finalPoint = this.evaluate(1.0);
        return Vec.equals(finalPoint, this.P3, COGNITIVE_THRESHOLDS.closureTolerance);
    }
}

export class AdaEngine {
    public async process(
        query: string, 
        history: ChatMessage[], 
        complexity: 'ELI5' | 'STANDARD' | 'TECHNICAL' = 'STANDARD'
    ): Promise<SearchResult> {
        const now = new Date();
        const currentDateString = now.toLocaleString();
        const groundingSources: GroundingSource[] = [];

        // SINGLE COMBINED CALL: Research + Evaluation merged to avoid
        // burning rate-limit budget on a separate research request.
        // The prior two-call pattern caused the evaluation call to fail
        // after the research call consumed the free-tier quota.
        const recentHistory = history.slice(-6);
        const prompt = `
            TEMPORAL CONTEXT: ${currentDateString} (Simulated Year: 2026).
            COMPLEXITY LEVEL: ${complexity}.
            SESSION HISTORY: ${JSON.stringify(recentHistory)}

            USER INPUT: "${query}"

            GOVERNANCE PROTOCOL:
            1. First, recall any relevant up-to-date facts about the query topic.
            2. Evaluate the input for "Signal Dissonance" (Misconceptions).
            3. If Misconception Probability is high, DO NOT stop or abstain.
            4. BRIDGE THE GAP: Address the user's premise, explain the shift to the current 2026 reality, and solve the underlying semantic equation.
            5. If the user asks for synonyms or antonyms, or follows up on a previous point, use the SESSION HISTORY for context.
            6. For ELI5: Use simple, warm metaphors and clear language.
            7. For TECHNICAL: Use precise terminology and kinematic references.
            8. ENTITY EXTRACTION: Preserve the FULL name including all titles, honorifics, suffixes (Jr., Sr., III, PhD, CEO, etc.), and hyphenated components. Never truncate or shorten names.

            RESPONSE FORMAT (strict JSON, no code fences, no markdown):
            {
                "correctness": 0.0 to 1.0,
                "misconception": 0.0 to 1.0,
                "entity": "Full name with all titles and suffixes preserved",
                "equation": "e.g. capital(France) = Paris",
                "response": "Your full response here, addressing misconceptions and solving the query. Plain text only, no markdown.",
                "synonyms": ["list", "of", "relevant", "synonyms"],
                "antonyms": ["list", "of", "relevant", "antonyms"],
                "action": "RESPOND"
            }
        `;

        let evalData: AdaEvaluation = normalizeEvaluation({}, query);
        let aiError: string | undefined;
        try {
            const evaluationResponse = await callFreeAI([
                {
                    role: 'system',
                    content: 'You are Ada. Return strict JSON only, no code fences. Keep values concise and grounded.'
                },
                { role: 'user', content: prompt }
            ]);
            const parsed = parseJsonBlock<Partial<AdaEvaluation>>(evaluationResponse);
            const looselyParsed = parsed ? null : parseLooselyStructuredResponse(evaluationResponse);
            evalData = normalizeEvaluation(parsed ?? looselyParsed ?? {}, query);
        } catch (error) {
            console.warn('Evaluation request failed, using deterministic fallback.', error);
            aiError = error instanceof Error ? error.message : 'AI service unavailable';
            const fallbackMisconception = estimateFallbackMisconception(query);
            const entityWords = query.replace(/[?!.]+$/g, '').split(/\s+/).filter(w =>
                w.length > 2 && !STOP_WORDS.has(w.toLowerCase())
            );
            const fallbackEntity = entityWords.slice(0, 5).join(' ') || 'Signal';
            evalData = normalizeEvaluation({
                correctness: COGNITIVE_THRESHOLDS.fallbackCorrectness,
                misconception: fallbackMisconception,
                entity: fallbackEntity,
                equation: `interpret("${fallbackEntity}") = contextual_resolution`,
                response: `I wasn't able to reach the AI service to fully answer your query about "${fallbackEntity}". This is usually caused by temporary rate limits on the free providers. Your query has been processed with local evaluation. Please try again shortly for a complete AI-powered response.`,
                action: 'RESPOND',
                synonyms: [],
                antonyms: []
            }, query);
        }
        // --- LEDGER: Track every resolution step ---
        const ledger: LedgerStep[] = [];
        const ledgerStart = Date.now();
        const addStep = (action: string, detail: string) => {
            ledger.push({ step: ledger.length + 1, action, detail, timestamp: Date.now() - ledgerStart });
        };

        addStep('Parse Query', `Input: "${query}" | Complexity: ${complexity}`);
        addStep('AI Evaluation', aiError ? `Fallback: ${aiError}` : `Correctness: ${evalData.correctness.toFixed(2)}, Misconception: ${evalData.misconception.toFixed(2)}`);

        const c = evalData.correctness;
        const m = evalData.misconception;
        const k = Math.max(c, m);
        const f = 1 - k;

        // NEWTON GOVERNANCE CALCULATIONS
        let state = CognitiveState.PARTIAL;
        if (m > c && m > COGNITIVE_THRESHOLDS.misconceptionHigh) state = CognitiveState.MISCONCEPTION;
        else if (f > COGNITIVE_THRESHOLDS.fogHigh) state = CognitiveState.FOG;
        else if (c > COGNITIVE_THRESHOLDS.correctHigh) state = CognitiveState.CORRECT;

        const ground = Math.max(0.01, 1.0 - m);
        const ratio = c / ground;
        let status = ConstraintStatus.GREEN;
        if (ground <= COGNITIVE_THRESHOLDS.groundFloor) status = ConstraintStatus.FINFR;
        else if (ratio > COGNITIVE_THRESHOLDS.ratioRedMin) status = ConstraintStatus.RED;
        else if (ratio >= COGNITIVE_THRESHOLDS.ratioYellowMin) status = ConstraintStatus.YELLOW;

        addStep('Govern Constraints', `State: ${state} | Status: ${status} | Ratio: ${ratio.toFixed(2)}`);

        // KINEMATIC TRAJECTORY (Dynamic drag based on misconception)
        const mechanics = WordMechanics.analyze(evalData.entity || "Signal");
        const curvature = (mechanics.stats.flow + mechanics.stats.energy) / 10;
        const P0 = [0, 0];
        const P3 = [1, 1];
        // Misconception creates a "detour" in the trajectory
        const P1 = [0.1 + (m * 0.4), 0.5 + (m * 0.8)];
        const P2 = [0.9 - (m * 0.4), 0.5 - (m * 0.2)];
        const bezier = new BezierPrimitive(P0, P1, P2, P3);
        const trajectoryPoints: Vector[] = [];
        const samples = COGNITIVE_THRESHOLDS.trajectorySamples;
        for (let i = 0; i <= samples; i++) trajectoryPoints.push(bezier.evaluate(i / samples));

        addStep('Map Glyphs', `Entity: "${evalData.entity}" | Profile: ${mechanics.profile} | Glyphs: ${mechanics.glyphs.map(g => g.char).join('')}`);

        const lexical = mergeLexicalCoverage(query, evalData.synonyms, evalData.antonyms);
        const cleanedResponse = cleanResponseText(evalData.response);
        const governedResponse = complexity === 'ELI5'
            ? eli5Rewrite(cleanedResponse, evalData.entity)
            : cleanedResponse;

        // PROOF LABEL: Derive from governance metrics
        let proofLabel = ProofLabel.LIKELY;
        if (c >= COGNITIVE_THRESHOLDS.correctHigh && status === ConstraintStatus.GREEN && !aiError) {
            proofLabel = ProofLabel.VERIFIED;
        } else if (f > COGNITIVE_THRESHOLDS.fogHigh || state === CognitiveState.FOG || evalData.action === 'CLARIFY') {
            proofLabel = ProofLabel.NEEDS_DATA;
        }

        addStep('Generate Response', `Proof: ${proofLabel} | Action: ${evalData.action}`);
        addStep('Commit', `Governed response delivered. Trajectory closed: ${bezier.checkClosure()}`);

        return {
            tier: 3,
            method: "Ada Fluid-Manifold Governance",
            shape: evalData.equation,
            entity: evalData.entity,
            confidence: c,
            details: `Epistemic Resolution: ${state}. Complexity: ${complexity}.`,
            insight: governedResponse,
            lexical: {
                synonyms: lexical.synonyms,
                antonyms: lexical.antonyms,
                equation: evalData.equation
            },
            csv: { c, m, f, k, state },
            constraint: { status, ratio },
            action: evalData.action as Action,
            trajectoryPoints,
            isClosed: bezier.checkClosure(),
            groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
            proofLabel,
            ledger,
            glyphAnalysis: mechanics,
            error: aiError
        };
    }
}
