import { describe, it, expect } from 'vitest';
import { Lexicon } from '../src/lexicon/lexicon';
import data from '../data/lexicon.sample.json';

describe('Lexicon', () => {
  it('loads entries and looks up tokens deterministically', () => {
    const lex = new Lexicon();
    lex.load(data);
    const bank = lex.lookup('bank');
    expect(bank).not.toBe(null);
    const sense = lex.selectSense('bank', ['finance']);
    expect(sense?.id).toBe('bank_financial');
  });

  it('returns null for missing tokens', () => {
    const lex = new Lexicon();
    lex.load(data);
    expect(lex.lookup('nonexistent')).toBeNull();
  });
});
