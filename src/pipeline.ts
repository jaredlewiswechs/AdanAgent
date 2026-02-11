import { Lexicon } from './lexicon/lexicon';
import lexiconData from '../data/lexicon.sample.json' assert { type: 'json' };
import { buildSimpleMorphFST } from './fst/fst';
import { reorderSVOtoSOV, Token } from './transfer/rules';

export type NullState = { stage: string; reason: string };

export class Pipeline {
  lex: Lexicon;
  morph: ReturnType<typeof buildSimpleMorphFST>;

  constructor() {
    this.lex = new Lexicon();
    this.lex.load(lexiconData);
    this.morph = buildSimpleMorphFST();
  }

  analyzeTokens(tokens: string[]): (Token | NullState)[] {
    const out: (Token | NullState)[] = [];
    for (const t of tokens) {
      const entry = this.lex.lookup(t);
      if (!entry) {
        return [{ stage: 'lexicon', reason: 'missing_entry' }];
      }
      // Deterministic: pick first sense
      const sense = entry[0].senses[0];
      out.push({ word: t, pos: entry[0].pos, role: undefined });
    }
    return out;
  }

  transfer(tokens: Token[]): Token[] | NullState {
    // Simple demonstration: if roles S V O present, reorder
    const hasRoles = tokens.some((t) => t.role !== undefined);
    if (!hasRoles) {
      return { stage: 'transfer', reason: 'no_roles' };
    }
    const out = reorderSVOtoSOV(tokens);
    if (out.length === 0) return { stage: 'transfer', reason: 'rule_not_applicable' };
    return out;
  }
}
