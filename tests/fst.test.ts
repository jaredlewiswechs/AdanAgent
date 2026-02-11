import { describe, it, expect } from 'vitest';
import { buildSimpleMorphFST } from '../src/fst/fst';

describe('FST Morphology', () => {
  it('matches suffixes deterministically', () => {
    const fst = buildSimpleMorphFST();
    expect(fst.run('s').matched).toBe(true);
    expect((fst.run('s').output as any).number).toBe('plural');
    expect(fst.run('ed').matched).toBe(true);
    expect((fst.run('ed').output as any).tense).toBe('past');
    expect(fst.run('xyz').matched).toBe(false);
  });
});
