export type FSTState = {
  transitions: Map<string, number>;
  isFinal?: boolean;
  output?: any;
};

export class FST {
  private states: FSTState[] = [];

  constructor() {
    this.states.push({ transitions: new Map(), isFinal: false });
  }

  private addState(isFinal = false, output?: any) {
    const idx = this.states.length;
    this.states.push({ transitions: new Map(), isFinal, output });
    return idx;
  }

  addPath(input: string, output: any) {
    // simple char-level trie-like FST
    let cur = 0;
    for (const ch of input) {
      const next = this.states[cur].transitions.get(ch);
      if (next === undefined) {
        const ns = this.addState(false);
        this.states[cur].transitions.set(ch, ns);
        cur = ns;
      } else cur = next;
    }
    this.states[cur].isFinal = true;
    this.states[cur].output = output;
  }

  run(input: string): { matched: boolean; output?: any } {
    let cur = 0;
    for (const ch of input) {
      const next = this.states[cur].transitions.get(ch);
      if (next === undefined) return { matched: false };
      cur = next;
    }
    if (this.states[cur].isFinal) return { matched: true, output: this.states[cur].output };
    return { matched: false };
  }
}

// Example morphological analyzer using suffix rules encoded as an FST for generation
export function buildSimpleMorphFST() {
  const fst = new FST();
  // plural 's' -> feature {number: 'plural'} for nouns
  fst.addPath('s', { number: 'plural' });
  // past 'ed' -> tense: past
  fst.addPath('ed', { tense: 'past' });
  return fst;
}
