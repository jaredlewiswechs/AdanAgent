
import { 
    Glyph, AnalysisResult, MechanicalStats, 
    SearchResult, QueryShape, PhysicalProperty,
    CognitiveState, ConstraintStatus, Action, Vector
} from '../types';
import { GLYPH_DB, SEMANTIC_CLUSTERS } from '../constants';

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';

const extractAIContent = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.choices?.[0]?.message?.content) {
                return parsed.choices[0].message.content;
            }
            if (typeof parsed.content === 'string') return parsed.content;
            if (typeof parsed.text === 'string') return parsed.text;
        } catch { /* not JSON wrapper, return as-is */ }
    }
    return trimmed;
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

    const raw = await response.text();
    return extractAIContent(raw);
};

export class WordMechanics {
    static analyze(word: string): AnalysisResult {
        const cleanWord = word.toUpperCase().replace(/[^A-Z]/g, '');
        // Fix: Explicitly define type as Glyph[] and cast physics to PhysicalProperty to avoid type widening to 'string'
        const glyphs: Glyph[] = cleanWord.split('').map(c => GLYPH_DB[c] || { 
            char: c, 
            role: 'UNK', 
            physics: 'UNKNOWN' as PhysicalProperty, 
            vector: 'Unknown' 
        });

        const stats: MechanicalStats = {
            stability: 0, containment: 0, energy: 0, 
            flow: 0, stop: 0, alignment: 0
        };

        glyphs.forEach(g => {
            if (g.physics !== 'UNKNOWN') {
                const key = g.physics.toLowerCase() as keyof MechanicalStats;
                stats[key]++;
            }
        });

        let profile = "AMORPHOUS";
        if (stats.stop > 0 && stats.stability > 0) profile = "ARCHITECTURAL (Static)";
        if (stats.energy > 0 && stats.containment > 0) profile = "DYNAMIC (Engine)";
        if (stats.containment > 0 && stats.stop === 0) profile = "VESSEL (Holding)";
        if (stats.flow > 0 && stats.energy > 0) profile = "FLUID DYNAMIC";
        if (stats.stop > 0 && stats.energy > 0 && stats.alignment > 0) profile = "TOOL / WEAPON";

        const loadPath = glyphs.map(g => g.role).join(' -> ');

        return { word, glyphs, stats, profile, loadPath };
    }
}

export class KinematicEngine {
    // KinematicEngine no longer maintains 'ai' instance to avoid state issues

    private matchTier1(query: string): SearchResult | null {
        const patterns = [
            { regex: /capital of (.+)/i, shape: QueryShape.CAPITAL_OF },
            { regex: /who founded (.+)/i, shape: QueryShape.FOUNDER_OF },
            { regex: /population of (.+)/i, shape: QueryShape.POPULATION_OF },
            { regex: /atomic number of (.+)/i, shape: QueryShape.ATOMIC_NUMBER },
            { regex: /(.+?)('s)? law/i, shape: QueryShape.PHYSICS_LAW }
        ];

        for (const p of patterns) {
            const match = query.match(p.regex);
            if (match) {
                const entity = match[1].trim().replace(/[?]+$/, '').trim();
                // Fix: Added missing required SearchResult properties
                return {
                    tier: 1,
                    method: "Rigid Pattern Match",
                    shape: p.shape,
                    entity: entity,
                    confidence: 1.0,
                    details: "Exact regex match found. Signal clarity: 100%.",
                    insight: `Rigid resolution complete for ${entity}. Mapping to ${p.shape} schema.`,
                    csv: { c: 1, m: 0, f: 0, k: 1, state: CognitiveState.CORRECT },
                    constraint: { status: ConstraintStatus.GREEN, ratio: 1.0 },
                    action: Action.RESPOND,
                    trajectoryPoints: [[0, 0], [1, 1]],
                    isClosed: true
                };
            }
        }
        return null;
    }

    private matchTier2(query: string): SearchResult | null {
        // Normalize for cluster matching but preserve original tokens for entity extraction
        const NOISE_WORDS = new Set(["what", "does", "from", "the", "who", "is", "are", "was", "were", "of", "a", "an", "in", "on", "at", "to", "for"]);
        const normalizedWords = query.toLowerCase()
            .replace(/[^a-z0-9 ]/g, "")
            .split(" ")
            .filter(w => w.length > 2);
        // Keep original tokens (preserving hyphens, periods, commas for titles/suffixes)
        const originalTokens = query.split(/\s+/).filter(w => w.length > 0);

        let bestMatch = { shape: QueryShape.UNKNOWN, score: 0, clusterName: "" };

        const checkCluster = (clusterName: string, targetShape: QueryShape) => {
            const cluster = SEMANTIC_CLUSTERS[clusterName];
            let overlapCount = 0;
            normalizedWords.forEach(w => {
                if (cluster.has(w)) overlapCount++;
            });
            if (overlapCount > bestMatch.score) {
                bestMatch = { shape: targetShape, score: overlapCount, clusterName };
            }
        };

        checkCluster("CAPITAL", QueryShape.CAPITAL_OF);
        checkCluster("FOUNDER", QueryShape.FOUNDER_OF);
        checkCluster("POPULATION", QueryShape.POPULATION_OF);
        checkCluster("PHYSICS", QueryShape.PHYSICS_LAW);
        checkCluster("ELEMENT", QueryShape.ATOMIC_NUMBER);

        if (bestMatch.score >= 1) {
            const cluster = SEMANTIC_CLUSTERS[bestMatch.clusterName];
            // Use original tokens for entity, filtering out cluster words and noise
            const entityTokens = originalTokens.filter(token => {
                const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, '');
                return !cluster.has(normalized) && !NOISE_WORDS.has(normalized) && normalized.length > 0;
            });
            const entity = entityTokens.join(" ") || "Unknown";

            // Fix: Added missing required SearchResult properties
            return {
                tier: 2,
                method: "Semantic Cluster Resonance",
                shape: bestMatch.shape,
                entity: entity || "Unknown",
                confidence: Math.min(0.95, 0.7 + (bestMatch.score * 0.1)),
                details: `Resonated with [${bestMatch.clusterName}] cluster. Overlap score: ${bestMatch.score}.`,
                insight: `Heuristic match suggests ${entity || "Unknown"} correlates with ${bestMatch.shape}.`,
                csv: { c: 0.85, m: 0.05, f: 0.1, k: 0.85, state: CognitiveState.PARTIAL },
                constraint: { status: ConstraintStatus.YELLOW, ratio: 0.9 },
                action: Action.RESPOND,
                trajectoryPoints: [[0, 0], [0.5, 0.5], [1, 1]],
                isClosed: true
            };
        }
        return null;
    }

    private async matchTier3(query: string): Promise<SearchResult> {
        try {
            const text = await callFreeAI([
                {
                    role: 'system',
                    content: 'You are a Kinematic Semantics expert. Keep responses brief and concrete.'
                },
                {
                    role: 'user',
                    content: `Analyze this query using Kinematic Semantics: "${query}". Extract the primary entity and query shape, then provide a short kinematic insight.`
                }
            ]);
            
            // Fix: Added missing required SearchResult properties
            return {
                tier: 3,
                method: "Free-AI Latent Resonance",
                shape: QueryShape.UNKNOWN,
                entity: "Resolved via LLM",
                confidence: 0.85,
                details: "High-entropy signal resolved via deep latent space mapping.",
                insight: text,
                csv: { c: 0.75, m: 0.1, f: 0.15, k: 0.75, state: CognitiveState.PARTIAL },
                constraint: { status: ConstraintStatus.GREEN, ratio: 1.0 },
                action: Action.RESPOND,
                trajectoryPoints: [[0, 0], [0.2, 0.8], [1, 1]],
                isClosed: true
            };
        } catch (e) {
            // Fix: Added missing required SearchResult properties
            return {
                tier: 3,
                method: "Failed Vector Search",
                shape: QueryShape.UNKNOWN,
                entity: "System Error",
                confidence: 0,
                details: "Connection to latent manifold severed.",
                insight: "Manifold structural collapse: Unable to resolve semantic signal.",
                csv: { c: 0, m: 0, f: 1.0, k: 0, state: CognitiveState.FOG },
                constraint: { status: ConstraintStatus.RED, ratio: 0 },
                action: Action.ABSTAIN,
                trajectoryPoints: [[0, 0]],
                isClosed: false
            };
        }
    }

    public async process(query: string): Promise<SearchResult> {
        let result = this.matchTier1(query);
        if (result) return result;

        result = this.matchTier2(query);
        if (result) return result;

        return await this.matchTier3(query);
    }
}
