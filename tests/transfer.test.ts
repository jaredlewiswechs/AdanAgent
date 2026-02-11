import { describe, it, expect } from 'vitest';
import { reorderSVOtoSOV } from '../src/transfer/rules';

describe('Transfer rules', () => {
  it('reorders S V O to S O V deterministically', () => {
    const tokens = [
      { word: 'Alice', role: 'S' },
      { word: 'eats', role: 'V' },
      { word: 'apple', role: 'O' }
    ];
    const out = reorderSVOtoSOV(tokens as any);
    expect(out[0].word).toBe('Alice');
    expect(out[1].word).toBe('apple');
    expect(out[2].word).toBe('eats');
  });

  it('returns empty array (Null) when roles missing', () => {
    const tokens = [{ word: 'Alice' }, { word: 'eats' }, { word: 'apple' }];
    const out = reorderSVOtoSOV(tokens as any);
    expect(out.length).toBe(0);
  });
});
