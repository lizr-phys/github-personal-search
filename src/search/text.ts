const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "with",
  "in",
  "on",
  "适合",
  "一个",
  "支持",
  "用于",
  "项目",
  "工具",
]);

export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}+#.\-/\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  const latin = normalized.match(/[a-z0-9][a-z0-9+#.\-/]*/g) ?? [];
  const chineseChunks = normalized.match(/[\p{Script=Han}]+/gu) ?? [];
  const chinese = chineseChunks.flatMap((chunk) => {
    if (chunk.length <= 2) return [chunk];
    const grams = [chunk];
    for (let size = 2; size <= Math.min(4, chunk.length); size += 1) {
      for (let index = 0; index <= chunk.length - size; index += 1) {
        grams.push(chunk.slice(index, index + size));
      }
    }
    return grams;
  });
  return [
    ...new Set(
      [...latin, ...chinese].filter(
        (token) => token.length > 1 && !STOP_WORDS.has(token),
      ),
    ),
  ];
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

export function overlapScore(
  queryTerms: string[],
  documentTerms: string[],
): number {
  if (!queryTerms.length) return 0;
  const document = new Set(documentTerms);
  const matches = queryTerms.filter((term) => document.has(term)).length;
  return clamp(matches / Math.max(1, Math.min(queryTerms.length, 12)));
}

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (
    Math.abs(left.length - right.length) > 1 ||
    Math.min(left.length, right.length) < 4
  )
    return false;
  let edits = 0;
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  return (
    edits + Number(leftIndex < left.length || rightIndex < right.length) <= 1
  );
}

export function fuzzyOverlapScore(
  queryTerms: string[],
  documentTerms: string[],
): number {
  if (!queryTerms.length) return 0;
  const document = new Set(documentTerms);
  const searchable = documentTerms.filter(
    (term) => term.length >= 4 && term.length <= 32,
  );
  let score = 0;
  for (const term of queryTerms.slice(0, 40)) {
    if (document.has(term)) score += 1;
    else if (
      term.length >= 4 &&
      searchable.some(
        (candidate) => candidate.startsWith(term) || term.startsWith(candidate),
      )
    )
      score += 0.72;
    else if (
      term.length >= 5 &&
      searchable.some((candidate) => editDistanceAtMostOne(term, candidate))
    )
      score += 0.55;
  }
  return clamp(score / Math.max(1, Math.min(queryTerms.length, 12)));
}
