/**
 * Tests for engine fixes:
 * 1. extractAIContent - handles OpenAI JSON wrapper and plain text
 * 2. parseJsonBlock - handles code fences and raw JSON
 * 3. cleanResponseText - strips markdown artifacts
 * 4. Title/suffix recognition in Tier 2 entity extraction
 * 5. QueryCache - in-memory LRU with TTL
 * 6. Config thresholds - validate config values
 * 7. Misconception pattern detection - expanded heuristic coverage
 */

// ---- extractAIContent tests (mirrors shared aiClient.ts) ----
const extractTextFromUnknown = (value: unknown): string => {
    if (typeof value === 'string') return value;

    if (Array.isArray(value)) {
        return value
            .map(item => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object') {
                    const textCandidate = (item as { text?: unknown; content?: unknown }).text
                        ?? (item as { text?: unknown; content?: unknown }).content;
                    return extractTextFromUnknown(textCandidate);
                }
                return '';
            })
            .filter(Boolean)
            .join('\n')
            .trim();
    }

    if (value && typeof value === 'object') {
        const candidate = value as {
            text?: unknown;
            content?: unknown;
            message?: { content?: unknown; text?: unknown };
            choices?: Array<{ message?: { content?: unknown; text?: unknown }; text?: unknown }>;
        };

        if (candidate.choices?.[0]) {
            const choice = candidate.choices[0];
            return extractTextFromUnknown(choice.message?.content ?? choice.message?.text ?? choice.text);
        }

        return extractTextFromUnknown(candidate.message?.content ?? candidate.message?.text ?? candidate.content ?? candidate.text);
    }

    return '';
};

const extractAIContent = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            const extracted = extractTextFromUnknown(parsed).trim();
            if (extracted) return extracted;
        } catch { /* not JSON wrapper */ }
    }

    return trimmed;
};

// ---- cleanResponseText tests ----
const cleanResponseText = (text: string): string => {
    if (!text) return text;
    let cleaned = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .replace(/^\s*[-*]\s+/gm, '- ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return cleaned;
};

// ---- stripCodeFences tests ----
const stripCodeFences = (raw: string): string => {
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    return fenceMatch ? fenceMatch[1].trim() : raw.trim();
};

// ---- QueryCache (mirrors shared aiClient.ts) ----
class QueryCache {
    private cache = new Map<string, { value: string; timestamp: number }>();
    private maxSize: number;
    private ttlMs: number;

    constructor(maxSize = 64, ttlMs = 5 * 60 * 1000) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }

    get(key: string): string | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key: string, value: string): void {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) this.cache.delete(oldestKey);
        }
        this.cache.set(key, { value, timestamp: Date.now() });
    }

    makeKey(messages: { role: string; content: string }[]): string {
        return messages.map(m => `${m.role}:${m.content}`).join('|');
    }

    get size(): number { return this.cache.size; }
}

// ---- Misconception pattern detection (mirrors config.ts) ----
const MISCONCEPTION_PATTERNS: [RegExp, number][] = [
    [/who is (?:the )?(?:current |present )?(?:president|prime minister|king|queen|emperor|chancellor|leader|ruler|ceo|chairman|director)/i, 0.40],
    [/(?:capital|currency|language) of/i, 0.30],
    [/(?:latest|current|newest|recent) /i, 0.40],
    [/(?:is it true|is it correct|do people|does everyone|isn't it)/i, 0.45],
    [/(?:always|never|everyone knows|obviously|clearly|of course)/i, 0.40],
    [/(?:how many|what percentage|what number|how much)/i, 0.30],
    [/(?:cause|causes|caused by|reason for|why does|why do|why is)/i, 0.35],
    [/(?:difference between|compare|versus|vs\.?)/i, 0.25],
    [/(?:in \d{4}|since \d{4}|after \d{4}|before \d{4}|year|decade|century)/i, 0.35],
    [/(?:still|anymore|used to|no longer|nowadays)/i, 0.35],
    [/(?:healthy|unhealthy|safe|dangerous|toxic|cure|treatment)/i, 0.40],
    [/(?:flat earth|moon landing|vaccine|conspiracy|myth|debunk)/i, 0.50],
];

const estimateFallbackMisconception = (query: string): number => {
    let maxProb = 0.15; // fallbackMisconceptionLow
    for (const [pattern, prob] of MISCONCEPTION_PATTERNS) {
        if (pattern.test(query)) {
            maxProb = Math.max(maxProb, prob);
        }
    }
    return maxProb;
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
    if (condition) {
        console.log(`  PASS: ${name}`);
        passed++;
    } else {
        console.error(`  FAIL: ${name}`);
        failed++;
    }
}

// Test extractAIContent
console.log('\n--- extractAIContent ---');

assert(
    extractAIContent('{"choices":[{"message":{"content":"Hello world"}}]}') === 'Hello world',
    'Extracts content from OpenAI JSON wrapper'
);

assert(
    extractAIContent('{"choices":[{"message":{"content":"{\\"correctness\\":0.9,\\"response\\":\\"Paris\\"}"}}]}') === '{"correctness":0.9,"response":"Paris"}',
    'Extracts nested JSON from OpenAI wrapper'
);

assert(
    extractAIContent('Plain text response') === 'Plain text response',
    'Passes plain text through unchanged'
);

assert(
    extractAIContent('{"content":"Direct content"}') === 'Direct content',
    'Handles direct content field'
);

assert(
    extractAIContent('') === '',
    'Handles empty string'
);

assert(
    extractAIContent('  {"choices":[{"message":{"content":"trimmed"}}]}  ') === 'trimmed',
    'Trims whitespace around JSON'
);

assert(
    extractAIContent('{"choices":[{"message":{"content":[{"text":"From array block"}]}}]}') === 'From array block',
    'Extracts text from content arrays'
);

assert(
    extractAIContent('{"content":[{"text":"Line one"},{"text":"Line two"}]}') === 'Line one\nLine two',
    'Extracts and joins multiple text blocks'
);

// Test cleanResponseText
console.log('\n--- cleanResponseText ---');

assert(
    cleanResponseText('## Heading\nContent') === 'Heading\nContent',
    'Strips markdown headings'
);

assert(
    cleanResponseText('**bold** and *italic*') === 'bold and italic',
    'Strips bold/italic markdown'
);

assert(
    cleanResponseText('Text\n\n\n\nMore text') === 'Text\n\nMore text',
    'Collapses multiple newlines'
);

assert(
    cleanResponseText('```json\n{"a":1}\n```\nPlain text') === 'Plain text',
    'Removes code fences from response text'
);

// Test stripCodeFences
console.log('\n--- stripCodeFences ---');

assert(
    stripCodeFences('```json\n{"correctness":0.8}\n```') === '{"correctness":0.8}',
    'Strips json code fences'
);

assert(
    stripCodeFences('```\n{"correctness":0.8}\n```') === '{"correctness":0.8}',
    'Strips plain code fences'
);

assert(
    stripCodeFences('{"correctness":0.8}') === '{"correctness":0.8}',
    'Passes raw JSON through unchanged'
);

// Test title/suffix preservation in entity extraction (simulating Tier 2 logic)
console.log('\n--- Entity Extraction (Title/Suffix) ---');

const NOISE_WORDS = new Set(["what", "does", "from", "the", "who", "is", "are", "was", "were", "of", "a", "an", "in", "on", "at", "to", "for"]);
const FOUNDER_CLUSTER = new Set(["founder", "found", "founded", "create", "created", "start", "started", "build", "built", "establish", "established", "originate", "originated", "begin", "began", "commence", "launched", "creator", "father", "cofounder"]);

function extractEntity(query: string, cluster: Set<string>): string {
    const originalTokens = query.split(/\s+/).filter(w => w.length > 0);
    const entityTokens = originalTokens.filter(token => {
        const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, '');
        return !cluster.has(normalized) && !NOISE_WORDS.has(normalized) && normalized.length > 0;
    });
    return entityTokens.join(" ") || "Unknown";
}

assert(
    extractEntity("who founded Tesla, Inc.", FOUNDER_CLUSTER) === 'Tesla, Inc.',
    'Preserves company suffixes like Inc.'
);

assert(
    extractEntity("who created the Lewis-Clark expedition", FOUNDER_CLUSTER) === 'Lewis-Clark expedition',
    'Preserves hyphenated names'
);

assert(
    extractEntity("who founded SpaceX", FOUNDER_CLUSTER) === 'SpaceX',
    'Simple entity extraction'
);

assert(
    extractEntity("who is the founder of Dr. Pepper", FOUNDER_CLUSTER).includes('Dr.'),
    'Preserves title prefixes like Dr.'
);

// Test new semantic cluster coverage
console.log('\n--- Expanded Cluster Coverage ---');

const LEADER_CLUSTER = new Set(["president", "prime", "minister", "king", "queen", "emperor", "chancellor", "leader", "ruler", "monarch", "sultan", "dictator", "ceo", "chairman", "director", "head", "chief", "governor", "mayor", "senator", "secretary", "premier"]);
const HISTORY_CLUSTER = new Set(["history", "historical", "war", "battle", "revolution", "empire", "dynasty", "era", "period", "ancient", "medieval", "colonial", "independence", "treaty", "conquest", "civilization", "reign", "century", "decade", "year", "event", "happened", "occur", "occurred"]);
const LOCATION_CLUSTER = new Set(["located", "location", "where", "continent", "region", "country", "border", "neighboring", "geography", "geographical", "latitude", "longitude", "north", "south", "east", "west", "ocean", "sea", "river", "mountain", "lake", "island", "peninsula", "desert"]);
const BIOLOGY_CLUSTER = new Set(["species", "organism", "cell", "gene", "genetic", "dna", "rna", "protein", "enzyme", "bacteria", "virus", "evolution", "taxonomy", "kingdom", "phylum", "genus", "mammal", "reptile", "amphibian", "photosynthesis", "mitosis", "ecosystem", "habitat", "organ", "anatomy", "biology", "biological"]);
const MATH_CLUSTER = new Set(["calculate", "calculation", "formula", "theorem", "proof", "algebra", "calculus", "geometry", "trigonometry", "integral", "derivative", "matrix", "vector", "polynomial", "logarithm", "factorial", "prime", "fibonacci", "arithmetic", "mathematical", "math", "mathematics", "sum", "product", "quotient"]);
const DEFINITION_CLUSTER = new Set(["define", "definition", "meaning", "means", "meant", "term", "concept", "describe", "description", "explain", "explanation", "refer", "refers", "denote", "denotes", "signify", "signifies", "synonym", "antonym", "etymology"]);
const INVENTION_CLUSTER = new Set(["invent", "invented", "inventor", "invention", "patent", "discover", "discovered", "discovery", "discoverer", "devised", "designed", "designer", "pioneer", "pioneered", "innovator", "innovation", "breakthrough"]);
const LANGUAGE_CLUSTER = new Set(["language", "speak", "spoken", "tongue", "dialect", "linguistic", "official", "native", "bilingual", "multilingual"]);
const CURRENCY_CLUSTER = new Set(["currency", "money", "monetary", "coin", "banknote", "denomination", "exchange", "tender", "dollar", "euro", "yen", "pound"]);
const COMPOSER_CLUSTER = new Set(["compose", "composed", "composer", "composition", "symphony", "concerto", "sonata", "opera", "wrote", "written", "author", "authored", "playwright", "novelist", "poet", "songwriter", "directed", "director", "film", "movie", "painted", "painter", "sculpted", "sculptor", "artist"]);

// Helper: simulate Tier 2 cluster overlap scoring
function clusterScore(query: string, cluster: Set<string>): number {
    const words = query.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(w => w.length > 2);
    return words.filter(w => cluster.has(w)).length;
}

// LEADER cluster
assert(
    clusterScore("who is the president of France", LEADER_CLUSTER) >= 1,
    'LEADER cluster matches "president of France"'
);
assert(
    extractEntity("who is the king of Spain", LEADER_CLUSTER) === 'Spain',
    'LEADER entity extracts "Spain" from king query'
);

// HISTORY cluster
assert(
    clusterScore("what happened during the French Revolution", HISTORY_CLUSTER) >= 2,
    'HISTORY cluster matches revolution + happened'
);
assert(
    extractEntity("history of the Roman Empire", HISTORY_CLUSTER).includes('Roman'),
    'HISTORY entity preserves "Roman"'
);

// LOCATION cluster
assert(
    clusterScore("where is the Sahara desert located", LOCATION_CLUSTER) >= 2,
    'LOCATION cluster matches where + desert + located'
);
assert(
    extractEntity("where is Mount Everest located", LOCATION_CLUSTER).includes('Everest'),
    'LOCATION entity preserves "Mount Everest"'
);

// BIOLOGY cluster
assert(
    clusterScore("what species is a mammal with gene mutations", BIOLOGY_CLUSTER) >= 3,
    'BIOLOGY cluster matches species + mammal + gene'
);

// MATH cluster
assert(
    clusterScore("prove the Pythagorean theorem using geometry", MATH_CLUSTER) >= 2,
    'MATH cluster matches theorem + geometry'
);

// DEFINITION cluster
assert(
    clusterScore("define the meaning of entropy", DEFINITION_CLUSTER) >= 2,
    'DEFINITION cluster matches define + meaning'
);
assert(
    extractEntity("what does epistemology mean", DEFINITION_CLUSTER).includes('epistemology'),
    'DEFINITION entity preserves "epistemology"'
);

// INVENTION cluster
assert(
    clusterScore("who invented the telephone", INVENTION_CLUSTER) >= 1,
    'INVENTION cluster matches invented'
);
assert(
    extractEntity("who discovered penicillin", INVENTION_CLUSTER) === 'penicillin',
    'INVENTION entity extracts "penicillin"'
);

// LANGUAGE cluster
assert(
    clusterScore("what language is spoken in Brazil", LANGUAGE_CLUSTER) >= 2,
    'LANGUAGE cluster matches language + spoken'
);

// CURRENCY cluster
assert(
    clusterScore("what is the currency of Japan", CURRENCY_CLUSTER) >= 1,
    'CURRENCY cluster matches currency'
);

// COMPOSER cluster
assert(
    clusterScore("who composed the Moonlight Sonata", COMPOSER_CLUSTER) >= 2,
    'COMPOSER cluster matches composed + sonata'
);
assert(
    extractEntity("who wrote War and Peace", COMPOSER_CLUSTER) === 'War and Peace',
    'COMPOSER entity preserves full title "War and Peace"'
);

// Cross-domain: verify no false positives across unrelated clusters
assert(
    clusterScore("what is the capital of Japan", BIOLOGY_CLUSTER) === 0,
    'BIOLOGY cluster does NOT match capital query (no false positive)'
);
assert(
    clusterScore("who founded SpaceX", MATH_CLUSTER) === 0,
    'MATH cluster does NOT match founder query (no false positive)'
);

// Test parseLooselyStructuredResponse numeric extraction
console.log('\n--- Loose JSON Numeric Parsing ---');

const testLoose = `{"correctness": 0.85, "misconception": 0.1, "response": "Test response", "entity": "Test Entity", "action": "RESPOND"}`;
const correctnessMatch = testLoose.match(/"correctness"\s*:\s*([\d.]+)/i);
const misconceptionMatch = testLoose.match(/"misconception"\s*:\s*([\d.]+)/i);

assert(
    correctnessMatch !== null && parseFloat(correctnessMatch[1]) === 0.85,
    'Extracts correctness from loose JSON'
);

assert(
    misconceptionMatch !== null && parseFloat(misconceptionMatch[1]) === 0.1,
    'Extracts misconception from loose JSON'
);

// ---- NEW: QueryCache tests ----
console.log('\n--- QueryCache ---');

const cache = new QueryCache(3, 100); // max 3 entries, 100ms TTL

cache.set('key1', 'value1');
assert(cache.get('key1') === 'value1', 'Cache stores and retrieves values');

cache.set('key2', 'value2');
cache.set('key3', 'value3');
assert(cache.size === 3, 'Cache tracks size correctly');

// Eviction: adding 4th should evict oldest (key1)
cache.set('key4', 'value4');
assert(cache.get('key1') === null, 'LRU eviction removes oldest entry');
assert(cache.get('key4') === 'value4', 'New entry accessible after eviction');

// TTL expiry
const ttlCache = new QueryCache(10, 1); // 1ms TTL
ttlCache.set('expires', 'soon');
// Small delay to let TTL expire
const start = Date.now();
while (Date.now() - start < 5) { /* busy wait 5ms */ }
assert(ttlCache.get('expires') === null, 'Expired entries return null');

// makeKey
const testCache = new QueryCache();
const key = testCache.makeKey([
    { role: 'system', content: 'You are Ada.' },
    { role: 'user', content: 'What is the capital of France?' }
]);
assert(key.includes('system:You are Ada.'), 'makeKey includes role and content');
assert(key.includes('user:What is the capital of France?'), 'makeKey includes all messages');

// ---- NEW: Misconception pattern detection tests ----
console.log('\n--- Misconception Pattern Detection ---');

// High misconception: factual recall with temporal risk
assert(
    estimateFallbackMisconception("who is the current president of the United States") >= 0.40,
    'Detects high misconception for current leader query'
);

assert(
    estimateFallbackMisconception("who is the CEO of Apple") >= 0.40,
    'Detects high misconception for CEO query'
);

// Medium misconception: factual but less volatile
assert(
    estimateFallbackMisconception("capital of France") >= 0.30,
    'Detects medium misconception for capital query'
);

assert(
    estimateFallbackMisconception("how many planets are in the solar system") >= 0.30,
    'Detects medium misconception for "how many" query'
);

// Myth-prone domains: highest risk
assert(
    estimateFallbackMisconception("is the flat earth theory true") >= 0.50,
    'Detects very high misconception for conspiracy query'
);

assert(
    estimateFallbackMisconception("is this treatment safe and healthy") >= 0.40,
    'Detects high misconception for health claim query'
);

// Low misconception: neutral/benign
assert(
    estimateFallbackMisconception("what color is the sky") === 0.15,
    'Returns low default for neutral query with no pattern match'
);

assert(
    estimateFallbackMisconception("tell me about dogs") === 0.15,
    'Returns low default for simple informational query'
);

// Temporal risk queries
assert(
    estimateFallbackMisconception("what was the population in 2020") >= 0.35,
    'Detects misconception risk for year-specific query'
);

assert(
    estimateFallbackMisconception("do people still use fax machines") >= 0.35,
    'Detects misconception risk for "still" temporal query'
);

// Comparison queries (moderate risk)
assert(
    estimateFallbackMisconception("difference between RNA and DNA") >= 0.25,
    'Detects moderate misconception for comparison query'
);

// ---- NEW: Config threshold validation ----
console.log('\n--- Config Thresholds ---');

// Validate thresholds are in sensible ranges
const THRESHOLDS = {
    misconceptionHigh: 0.4,
    fogHigh: 0.5,
    correctHigh: 0.7,
    ratioYellowMin: 0.8,
    ratioRedMin: 1.2,
    groundFloor: 0.05,
    fallbackCorrectness: 0.62,
    fallbackMisconceptionHigh: 0.35,
    fallbackMisconceptionLow: 0.15,
    trajectorySamples: 20,
    closureTolerance: 0.05,
};

assert(
    THRESHOLDS.misconceptionHigh > 0 && THRESHOLDS.misconceptionHigh < 1,
    'misconceptionHigh is between 0 and 1'
);
assert(
    THRESHOLDS.fogHigh > THRESHOLDS.misconceptionHigh,
    'fogHigh is greater than misconceptionHigh'
);
assert(
    THRESHOLDS.correctHigh > THRESHOLDS.fogHigh,
    'correctHigh is greater than fogHigh'
);
assert(
    THRESHOLDS.ratioRedMin > THRESHOLDS.ratioYellowMin,
    'ratioRedMin is greater than ratioYellowMin'
);
assert(
    THRESHOLDS.groundFloor > 0 && THRESHOLDS.groundFloor < 0.1,
    'groundFloor is a small positive value'
);
assert(
    THRESHOLDS.trajectorySamples >= 10 && THRESHOLDS.trajectorySamples <= 100,
    'trajectorySamples is in reasonable range'
);
assert(
    THRESHOLDS.fallbackMisconceptionLow < THRESHOLDS.fallbackMisconceptionHigh,
    'fallbackMisconceptionLow < fallbackMisconceptionHigh'
);

// Summary
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
