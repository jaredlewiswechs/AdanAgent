export type Sense = {
  id: string;
  tags: string[];
};

export type LexiconEntry = {
  id: string;
  orth: string;
  lemma: string;
  pos: string;
  senses: Sense[];
  features?: Record<string, any>;
};

export class Lexicon {
  private table: Map<string, LexiconEntry[]> = new Map();

  load(entries: LexiconEntry[]) {
    for (const e of entries) {
      const key = e.orth.toLowerCase();
      const arr = this.table.get(key) ?? [];
      arr.push(e);
      this.table.set(key, arr);
    }
  }

  lookup(token: string): LexiconEntry[] | null {
    const key = token.toLowerCase();
    const r = this.table.get(key) ?? null;
    return r;
  }

  // Deterministic sense selection: pick first matching sense that satisfies tags
  selectSense(token: string, preferredTags: string[] = []): Sense | null {
    const entries = this.lookup(token);
    if (!entries) return null;
    // Flatten senses in deterministic order
    for (const tag of preferredTags) {
      for (const e of entries) {
        for (const s of e.senses) {
          if (s.tags.includes(tag)) return s;
        }
      }
    }
    // Fallback: first sense of first entry
    return entries[0].senses[0] ?? null;
  }
}
