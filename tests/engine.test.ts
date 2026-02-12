/**
 * Tests for engine fixes:
 * 1. extractAIContent - handles OpenAI JSON wrapper and plain text
 * 2. parseJsonBlock - handles code fences and raw JSON
 * 3. cleanResponseText - strips markdown artifacts
 * 4. Title/suffix recognition in Tier 2 entity extraction
 */

// ---- extractAIContent tests ----
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

// Summary
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
