import { describe, it, expect } from 'vitest';
import { Pipeline } from '../src/pipeline';

describe('Pipeline', () => {
  it('analyzes known tokens', () => {
    const p = new Pipeline();
    const out = p.analyzeTokens(['the', 'bank', 'run']);
    expect(Array.isArray(out)).toBe(true);
    expect((out as any)[0]).toHaveProperty('word');
  });

  it('returns NullState for unknown token', () => {
    const p = new Pipeline();
    const out = p.analyzeTokens(['thisworddoesnotexist']);
    expect((out as any)[0]).toHaveProperty('stage');
    expect((out as any)[0]).toHaveProperty('reason');
  });
});
