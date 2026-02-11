export type Token = { word: string; pos?: string; role?: string };

export function reorderSVOtoSOV(tokens: Token[]): Token[] {
  // deterministically transform S V O -> S O V
  // Strategy: find indexes of S, V, O by role labels
  const sIdx = tokens.findIndex((t) => t.role === 'S');
  const vIdx = tokens.findIndex((t) => t.role === 'V');
  const oIdx = tokens.findIndex((t) => t.role === 'O');
  if (sIdx === -1 || vIdx === -1 || oIdx === -1) return []; // Null state
  const out: Token[] = [];
  // push S
  out.push(tokens[sIdx]);
  // push O
  out.push(tokens[oIdx]);
  // push V
  out.push(tokens[vIdx]);
  // Append remaining tokens in original order if they are not S/V/O
  for (let i = 0; i < tokens.length; i++) {
    if (i === sIdx || i === vIdx || i === oIdx) continue;
    out.push(tokens[i]);
  }
  return out;
}
