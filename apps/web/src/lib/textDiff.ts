// apps/web/src/lib/textDiff.ts
// Word-level diff for language corrections: "I am agree" → "I agree" marks "am" as removed.

export type DiffPart = { text: string; kind: "same" | "removed" | "added" };

/** Splits into words while keeping the whitespace that follows each word */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

const norm = (token: string) => token.trim().toLowerCase();

/**
 * Longest-common-subsequence diff over words (case-insensitive match, original
 * casing kept). Fine for chat-length texts; long inputs fall back to whole-text replace.
 */
export function diffWords(original: string, corrected: string): DiffPart[] {
  const a = tokenize(original);
  const b = tokenize(corrected);

  if (a.length * b.length > 40_000) {
    return [
      { text: original, kind: "removed" },
      { text: corrected, kind: "added" },
    ];
  }

  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = norm(a[i]) === norm(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (text: string, kind: DiffPart["kind"]) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ text, kind });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (norm(a[i]) === norm(b[j])) {
      push(b[j], "same");
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(a[i++], "removed");
    } else {
      push(b[j++], "added");
    }
  }
  while (i < a.length) push(a[i++], "removed");
  while (j < b.length) push(b[j++], "added");
  return parts;
}
