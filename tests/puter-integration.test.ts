/**
 * Integration test: "What is math" query through the full pipeline.
 * Mocks window.puter.ai.chat to simulate Puter.js responses,
 * then verifies the SearchResult has all fields needed by the UI.
 */

// ---- Setup browser globals before any imports ----

const MOCK_RESEARCH_RESPONSE = `- Mathematics is the study of numbers, quantities, shapes, and patterns.
- It includes arithmetic, algebra, geometry, calculus, and statistics.
- Math is foundational to science, engineering, and technology.
- The word "mathematics" comes from the Greek word "mathema" meaning learning.`;

const MOCK_EVAL_RESPONSE = JSON.stringify({
    correctness: 0.92,
    misconception: 0.05,
    entity: "Mathematics",
    equation: "define(math) = study_of_abstract_structures",
    response: "Mathematics is the study of numbers, quantity, structure, space, and change. It uses rigorous logical reasoning and abstraction to discover patterns and formulate conjectures. From basic arithmetic to advanced calculus, mathematics provides the foundational language for science, engineering, and technology.",
    synonyms: ["arithmetic", "computation", "calculus", "algebra", "geometry"],
    antonyms: ["chaos", "disorder", "randomness", "imprecision"],
    action: "RESPOND"
});

let puterCallCount = 0;

// Mock window.puter
(globalThis as any).window = {
    puter: {
        ai: {
            chat: async (messages: any[], options?: { model?: string }) => {
                puterCallCount++;
                const model = options?.model ?? 'unknown';
                console.log(`  [Puter mock] Call #${puterCallCount} → model: ${model}`);

                // First call is research, second is evaluation
                const content = puterCallCount === 1 ? MOCK_RESEARCH_RESPONSE : MOCK_EVAL_RESPONSE;

                // Simulate Claude-style array response for claude models
                if (model.includes('claude')) {
                    return { message: { content: [{ text: content }] } };
                }
                // OpenAI-style string response
                return { message: { content } };
            }
        }
    }
};

// Mock fetch (for pollinations fallback — should NOT be called if Puter works)
(globalThis as any).fetch = async (url: string) => {
    console.log(`  [fetch mock] Called with: ${url.slice(0, 80)}...`);
    throw new Error('Pollinations mock: should not reach here when Puter works');
};

// ---- Now import the engine ----

import { AdaEngine } from '../services/adaEngine';

// ---- Test runner ----

async function runTest() {
    console.log('\n=== Integration Test: "What is math" ===\n');

    const engine = new AdaEngine();
    const query = "What is math";

    console.log(`Query: "${query}"`);
    console.log('Running engine.process()...\n');

    const result = await engine.process(query, [], 'STANDARD');

    console.log('\n--- SearchResult ---');
    console.log(`tier:        ${result.tier}`);
    console.log(`method:      ${result.method}`);
    console.log(`entity:      ${result.entity}`);
    console.log(`equation:    ${result.shape}`);
    console.log(`confidence:  ${result.confidence}`);
    console.log(`state:       ${result.csv.state}`);
    console.log(`constraint:  ${result.constraint.status} (ratio: ${result.constraint.ratio.toFixed(2)})`);
    console.log(`action:      ${result.action}`);
    console.log(`isClosed:    ${result.isClosed}`);
    console.log(`error:       ${result.error ?? 'none'}`);
    console.log(`trajectory:  ${result.trajectoryPoints.length} points`);
    console.log(`\ninsight (first 200 chars):\n  "${result.insight.slice(0, 200)}..."`);

    if (result.lexical) {
        console.log(`\nsynonyms:    [${result.lexical.synonyms.join(', ')}]`);
        console.log(`antonyms:    [${result.lexical.antonyms.join(', ')}]`);
        console.log(`equation:    ${result.lexical.equation}`);
    }

    // ---- Assertions ----
    console.log('\n--- Assertions ---');
    let passed = 0;
    let failed = 0;

    const assert = (label: string, condition: boolean) => {
        if (condition) {
            console.log(`  PASS: ${label}`);
            passed++;
        } else {
            console.log(`  FAIL: ${label}`);
            failed++;
        }
    };

    // Core fields exist
    assert('tier is 3', result.tier === 3);
    assert('entity is set', result.entity.length > 0);
    assert('insight is non-empty', result.insight.length > 10);
    assert('confidence is 0-1', result.confidence >= 0 && result.confidence <= 1);
    assert('correctness is 0-1', result.csv.c >= 0 && result.csv.c <= 1);
    assert('misconception is 0-1', result.csv.m >= 0 && result.csv.m <= 1);

    // UI-critical fields
    assert('equation/shape exists', result.shape.length > 0);
    assert('lexical synonyms exist', (result.lexical?.synonyms?.length ?? 0) > 0);
    assert('lexical antonyms exist', (result.lexical?.antonyms?.length ?? 0) > 0);
    assert('lexical equation exists', (result.lexical?.equation?.length ?? 0) > 0);
    assert('constraint status is valid', ['GREEN', 'YELLOW', 'RED', 'FINFR'].includes(result.constraint.status));
    assert('cognitive state is valid', ['CORRECT', 'PARTIAL', 'MISCONCEPTION', 'FOG'].includes(result.csv.state));
    assert('action is valid', ['RESPOND', 'ABSTAIN', 'CLARIFY', 'DEFER', 'ESCALATE'].includes(result.action));
    assert('trajectory has points', result.trajectoryPoints.length > 5);
    assert('no error field (AI succeeded)', result.error === undefined);

    // Puter was actually used (not pollinations)
    assert('Puter was called (not pollinations)', puterCallCount >= 2);

    // Response quality
    assert('insight mentions math/mathematics', /math/i.test(result.insight));
    assert('entity relates to query', /math/i.test(result.entity));

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
});
