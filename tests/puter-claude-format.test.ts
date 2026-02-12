/**
 * Test: Verify Claude-style array response format works through the pipeline.
 * Also tests the fallback scenario when gpt-4o-mini fails and claude-3-5-haiku picks up.
 */

const MOCK_EVAL_RESPONSE = JSON.stringify({
    correctness: 0.88,
    misconception: 0.08,
    entity: "Mathematics",
    equation: "define(math) = abstract_logic_system",
    response: "Mathematics is a formal system of abstract reasoning about quantity, structure, space, and change.",
    synonyms: ["arithmetic", "algebra"],
    antonyms: ["chaos", "disorder"],
    action: "RESPOND"
});

let callCount = 0;

(globalThis as any).window = {
    puter: {
        ai: {
            chat: async (_messages: any[], options?: { model?: string }) => {
                callCount++;
                const model = options?.model ?? 'unknown';
                console.log(`  [Puter mock] Call #${callCount} → model: ${model}`);

                // Simulate: gpt-4o-mini fails, claude-3-5-haiku succeeds
                if (model === 'gpt-4o-mini') {
                    throw new Error('Simulated gpt-4o-mini failure');
                }

                // Claude returns array-style content
                const content = callCount <= 2
                    ? "Facts about math: foundational discipline."
                    : MOCK_EVAL_RESPONSE;

                return { message: { content: [{ text: content }] } };
            }
        }
    }
};

(globalThis as any).fetch = async () => {
    throw new Error('Should not reach Pollinations');
};

import { AdaEngine } from '../services/adaEngine';

async function runTest() {
    console.log('\n=== Test: Claude array format + model fallback ===\n');

    const engine = new AdaEngine();
    const result = await engine.process("What is math", [], 'STANDARD');

    console.log(`entity:     ${result.entity}`);
    console.log(`insight:    ${result.insight.slice(0, 120)}...`);
    console.log(`error:      ${result.error ?? 'none'}`);
    console.log(`calls made: ${callCount}`);

    const checks = [
        ['Entity populated', result.entity.length > 0],
        ['Insight populated', result.insight.length > 10],
        ['No error', result.error === undefined],
        ['Claude model was used (gpt-4o-mini failed)', callCount >= 3],
    ] as const;

    let ok = true;
    for (const [label, pass] of checks) {
        console.log(`  ${pass ? 'PASS' : 'FAIL'}: ${label}`);
        if (!pass) ok = false;
    }

    console.log(ok ? '\n=== All checks passed ===\n' : '\n=== SOME CHECKS FAILED ===\n');
    if (!ok) process.exit(1);
}

runTest().catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
});
