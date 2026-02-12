
import { 
    Scalar, Vector, CognitiveState, ConstraintStatus, Action, 
    SearchResult, PhysicalProperty, GroundingSource, ChatMessage
} from '../types';
import { WordMechanics } from './kinematicEngine';

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

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const parseJsonBlock = <T>(raw: string): T | null => {
    const cleaned = raw.trim();
    try {
        return JSON.parse(cleaned) as T;
    } catch {
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
    const cleaned = raw.trim();
    if (!cleaned) return null;

    const responseMatch = cleaned.match(/"response"\s*:\s*"([\s\S]*?)"/i);
    const entityMatch = cleaned.match(/"entity"\s*:\s*"([\s\S]*?)"/i);
    const equationMatch = cleaned.match(/"equation"\s*:\s*"([\s\S]*?)"/i);

    const hasJsonKeys = /"correctness"|"misconception"|"response"|"entity"/i.test(cleaned);

    if (hasJsonKeys) {
        return {
            response: responseMatch?.[1]?.replace(/\\n/g, '\n').trim() || cleaned,
            entity: entityMatch?.[1]?.trim(),
            equation: equationMatch?.[1]?.trim()
        };
    }

    return {
        response: cleaned
    };
};

const deterministicCapitalMap: Record<string, string> = {
    texas: 'Austin',
    california: 'Sacramento',
    florida: 'Tallahassee',
    france: 'Paris',
    germany: 'Berlin',
    japan: 'Tokyo',
    canada: 'Ottawa',
    india: 'New Delhi',
    australia: 'Canberra'
};

const buildDeterministicAnswer = (query: string): string => {
    const cleaned = query.trim();
    const lower = cleaned.toLowerCase();

    const capitalMatch = lower.match(/capital of ([a-z\s]+)/i);
    if (capitalMatch) {
        const place = capitalMatch[1].replace(/[^a-z\s]/gi, '').trim();
        const capital = deterministicCapitalMap[place];
        if (capital) {
            return `The capital of ${place.replace(/\b\w/g, c => c.toUpperCase())} is ${capital}.`;
        }
    }

    const arithmeticMatch = cleaned.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)/);
    if (arithmeticMatch) {
        const a = Number(arithmeticMatch[1]);
        const op = arithmeticMatch[2];
        const b = Number(arithmeticMatch[3]);
        const value = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : (b === 0 ? null : a / b);
        if (value !== null && Number.isFinite(value)) {
            return `${a} ${op} ${b} = ${value}.`;
        }
    }

    return `I interpreted your request as: "${cleaned}". I can provide a fuller answer when upstream model output is available.`;
};


const stripProviderNoise = (text: string): string => {
    return text
        .replace(/⚠️\s*\*\*IMPORTANT NOTICE\*\*[\s\S]*/gi, '')
        .replace(/pollinations legacy text api is being deprecated[\s\S]*/gi, '')
        .trim();
};

const resolveResponseText = (response: unknown, query: string): string => {
    const raw = typeof response === 'string' ? stripProviderNoise(response) : '';
    if (!raw) return buildDeterministicAnswer(query);

    const lower = raw.toLowerCase();
    if (lower.includes('important notice') || lower.includes('deprecated') || lower.includes('migrate to')) {
        return buildDeterministicAnswer(query);
    }

    return raw;
};

const normalizeEvaluation = (result: Partial<AdaEvaluation>, query: string): AdaEvaluation => ({
    correctness: clamp(Number(result.correctness ?? 0.65)),
    misconception: clamp(Number(result.misconception ?? 0.2)),
    entity: String(result.entity ?? (query.slice(0, 48) || 'Signal')),
    equation: String(result.equation ?? `meaning("${query}") = contextual_resolution`),
    response: resolveResponseText(result.response, query),
    synonyms: Array.isArray(result.synonyms) ? result.synonyms.slice(0, 8).map(String) : [],
    antonyms: Array.isArray(result.antonyms) ? result.antonyms.slice(0, 8).map(String) : [],
    action: String(result.action ?? 'RESPOND')
});


const unwrapProviderEnvelope = (raw: string): string => {
    const cleaned = raw.trim();
    const parsed = parseJsonBlock<any>(cleaned);
    if (!parsed || typeof parsed !== 'object') return cleaned;

    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();

    const direct = parsed?.response ?? parsed?.output_text ?? parsed?.text;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    return cleaned;
};

const callFreeAI = async (messages: { role: 'system' | 'user'; content: string }[]): Promise<string> => {
    const response = await fetch(POLLINATIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'openai',
            messages,
            temperature: 0.2,
            private: false
        })
    });

    if (!response.ok) {
        throw new Error(`Free AI request failed: ${response.status}`);
    }

    return response.text();
};

const Vec = {
    add: (v1: Vector, v2: Vector): Vector => v1.map((val, i) => val + (v2[i] || 0)),
    scale: (v: Vector, s: Scalar): Vector => v.map(val => val * s),
    equals: (v1: Vector, v2: Vector, tolerance = 0.05): boolean => 
        v1.every((val, i) => Math.abs(val - (v2[i] || 0)) < tolerance),
};

export class BezierPrimitive {
    constructor(public P0: Vector, public P1: Vector, public P2: Vector, public P3: Vector) {}

    public evaluate(t: number): Vector {
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
        return Vec.equals(finalPoint, this.P3);
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

        const researchPrompt = `Research task for Ada Engine:\nQuery: "${query}"\nDate Context: ${currentDateString}\nSummarize relevant up-to-date facts in 3-5 bullet points.`;
        let researchSummary = 'No direct research results. Relying on internal 2026-projection manifolds.';
        try {
            researchSummary = await callFreeAI([
                {
                    role: 'system',
                    content: 'You are the grounding module. Provide concise factual context. Do not output markdown headings.'
                },
                { role: 'user', content: researchPrompt }
            ]);
        } catch (error) {
            console.warn('Grounding request failed, continuing with local context.', error);
        }

        // STEP 2: EPISTEMIC GOVERNANCE & FLUID RESOLUTION
        const prompt = `
            TEMPORAL CONTEXT: ${currentDateString} (Simulated Year: 2026).
            COMPLEXITY LEVEL: ${complexity}.
            RESEARCH DATA: ${researchSummary}
            SESSION HISTORY: ${JSON.stringify(history)}
            
            USER INPUT: "${query}"
            
            GOVERNANCE PROTOCOL:
            1. Evaluate the input for "Signal Dissonance" (Misconceptions).
            2. If Misconception Probability is high, DO NOT stop or abstain. 
            3. BRIDGE THE GAP: Address the user's premise, explain the shift to the current 2026 reality, and solve the underlying semantic equation.
            4. If the user asks for synonyms or antonyms, or follows up on a previous point, use the SESSION HISTORY for context.
            5. For ELI5: Use simple, warm metaphors and clear language.
            6. For TECHNICAL: Use precise terminology and kinematic references.
            
            RESPONSE FORMAT (JSON):
            {
                "correctness": [0-1],
                "misconception": [0-1],
                "entity": "Primary entity being discussed",
                "equation": "e.g. capital(France) = Paris",
                "response": "Your full response here, addressing misconceptions and solving the query.",
                "synonyms": ["list", "of", "relevant", "synonyms"],
                "antonyms": ["list", "of", "relevant", "antonyms"],
                "action": "RESPOND"
            }
        `;

        let evalData: AdaEvaluation = normalizeEvaluation({}, query);
        try {
            const evaluationResponse = await callFreeAI([
                {
                    role: 'system',
                    content: 'You are Ada. Return strict JSON only, no code fences. Keep values concise and grounded.'
                },
                { role: 'user', content: prompt }
            ]);
            const unwrappedResponse = unwrapProviderEnvelope(evaluationResponse);
            const parsed = parseJsonBlock<Partial<AdaEvaluation>>(unwrappedResponse);
            const looselyParsed = parseLooselyStructuredResponse(unwrappedResponse);
            evalData = normalizeEvaluation(parsed ?? looselyParsed ?? {}, query);
        } catch (error) {
            console.warn('Evaluation request failed, using deterministic fallback.', error);
            const fallbackMisconception = /who is|capital|president|prime minister|ceo|latest|current/i.test(query) ? 0.35 : 0.15;
            evalData = normalizeEvaluation({
                correctness: 0.62,
                misconception: fallbackMisconception,
                entity: query.split(' ').slice(0, 3).join(' ') || 'Signal',
                equation: `interpret("${query}") = practical_answer`,
                response: `I could not reach the free AI service right now. ${buildDeterministicAnswer(query)}`,
                action: 'RESPOND',
                synonyms: [],
                antonyms: []
            }, query);
        }
        const c = evalData.correctness;
        const m = evalData.misconception;
        const k = Math.max(c, m);
        const f = 1 - k;

        // NEWTON GOVERNANCE CALCULATIONS
        let state = CognitiveState.PARTIAL;
        if (m > c && m > 0.4) state = CognitiveState.MISCONCEPTION;
        else if (f > 0.5) state = CognitiveState.FOG;
        else if (c > 0.7) state = CognitiveState.CORRECT;

        const ground = Math.max(0.01, 1.0 - m);
        const ratio = c / ground;
        let status = ConstraintStatus.GREEN;
        if (ground <= 0.05) status = ConstraintStatus.FINFR;
        else if (ratio > 1.2) status = ConstraintStatus.RED;
        else if (ratio >= 0.8) status = ConstraintStatus.YELLOW;

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
        for (let i = 0; i <= 20; i++) trajectoryPoints.push(bezier.evaluate(i / 20));

        return {
            tier: 3,
            method: "Ada Fluid-Manifold Governance",
            shape: evalData.equation,
            entity: evalData.entity,
            confidence: c,
            details: `Epistemic Resolution: ${state}. Complexity: ${complexity}.`,
            geminiInsight: evalData.response,
            lexical: {
                synonyms: evalData.synonyms,
                antonyms: evalData.antonyms,
                equation: evalData.equation
            },
            csv: { c, m, f, k, state },
            constraint: { status, ratio },
            action: evalData.action as Action,
            trajectoryPoints,
            isClosed: bezier.checkClosure(),
            groundingSources: groundingSources.length > 0 ? groundingSources : undefined
        };
    }
}
