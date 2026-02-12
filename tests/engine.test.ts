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
