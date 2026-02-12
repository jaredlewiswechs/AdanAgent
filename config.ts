
/**
 * Central configuration — all magic numbers and thresholds live here.
 * Tune these without hunting through engine files.
 */

export const AI_CONFIG = {
    /**
     * Primary AI provider: Puter.js (free, no API key, browser-native).
     * Models to try in order of preference.
     */
    puter: {
        enabled: true,
        models: ['gpt-4o-mini', 'claude-3-5-haiku-latest'],
        timeoutMs: 25_000,
    },

    /**
     * Fallback endpoints (Pollinations) — used only when Puter.js is
     * unavailable or all Puter models fail.
     */
    endpoints: [
        {
            url: 'https://text.pollinations.ai/',
            openaiFormat: true,
            models: ['openai', 'mistral', 'openai-large'],
        },
        {
            url: 'https://gen.pollinations.ai/v1/chat/completions',
            openaiFormat: true,
            models: ['openai', 'mistral'],
        },
    ] as const,

    /** Simple GET-based fallback: text.pollinations.ai/{prompt} */
    textFallbackUrl: 'https://text.pollinations.ai/',

    retry: {
        maxRetries: 2,          // 3 total attempts per endpoint (initial + 2 retries)
        baseDelayMs: 800,       // 0.8s, 1.6s backoff
        timeoutMs: 20_000,      // 20s per-request timeout
    },

    cache: {
        maxSize: 64,            // Max cached query→response pairs
        ttlMs: 5 * 60 * 1000,  // 5 minute TTL
    },
} as const;

export const COGNITIVE_THRESHOLDS = {
    /** If misconception > correctness AND misconception > this → MISCONCEPTION state */
    misconceptionHigh: 0.4,
    /** If fog > this → FOG state */
    fogHigh: 0.5,
    /** If correctness > this → CORRECT state */
    correctHigh: 0.7,

    /** Constraint ratio boundaries */
    ratioYellowMin: 0.8,
    ratioRedMin: 1.2,
    /** Ground floor — below this triggers FINFR (epistemic collapse) */
    groundFloor: 0.05,

    /** Default fallback values when AI is unreachable */
    fallbackCorrectness: 0.62,
    fallbackMisconceptionHigh: 0.35,
    fallbackMisconceptionLow: 0.15,

    /** Trajectory sampling resolution */
    trajectorySamples: 20,

    /** Bezier closure tolerance */
    closureTolerance: 0.05,
} as const;

/**
 * Expanded misconception detection patterns.
 * Used as fallback when AI is unreachable.
 * Each entry: [pattern, estimated misconception probability]
 */
export const MISCONCEPTION_PATTERNS: [RegExp, number][] = [
    // Factual recall — moderate misconception risk (outdated info)
    [/who is (?:the )?(?:current |present )?(?:president|prime minister|king|queen|emperor|chancellor|leader|ruler|ceo|chairman|director)/i, 0.40],
    [/(?:capital|currency|language) of/i, 0.30],
    [/(?:latest|current|newest|recent) /i, 0.40],

    // Common knowledge traps — higher misconception risk
    [/(?:is it true|is it correct|do people|does everyone|isn't it)/i, 0.45],
    [/(?:always|never|everyone knows|obviously|clearly|of course)/i, 0.40],

    // Scientific/technical — can carry outdated beliefs
    [/(?:how many|what percentage|what number|how much)/i, 0.30],
    [/(?:cause|causes|caused by|reason for|why does|why do|why is)/i, 0.35],
    [/(?:difference between|compare|versus|vs\.?)/i, 0.25],

    // Temporal queries — stale knowledge risk
    [/(?:in \d{4}|since \d{4}|after \d{4}|before \d{4}|year|decade|century)/i, 0.35],
    [/(?:still|anymore|used to|no longer|nowadays)/i, 0.35],

    // Myth/misconception-prone domains
    [/(?:healthy|unhealthy|safe|dangerous|toxic|cure|treatment)/i, 0.40],
    [/(?:flat earth|moon landing|vaccine|conspiracy|myth|debunk)/i, 0.50],
];

/**
 * Compute fallback misconception probability from patterns.
 * Returns the max matching probability, or a low default.
 */
export const estimateFallbackMisconception = (query: string): number => {
    let maxProb: number = COGNITIVE_THRESHOLDS.fallbackMisconceptionLow;
    for (const [pattern, prob] of MISCONCEPTION_PATTERNS) {
        if (pattern.test(query)) {
            maxProb = Math.max(maxProb, prob);
        }
    }
    return maxProb;
};
