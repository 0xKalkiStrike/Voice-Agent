/**
 * Offline keyword retrieval over the bundled demo documents.
 *
 * PRD 4.4 / acceptance #5: demo-data must be searchable with zero uploads in
 * keyword mode. This is a real TF-weighted token scorer running locally in
 * the browser; the LocalAMD lane can swap in `/embed` cosine later behind the
 * same shape. Every hit carries its source doc + snippet so answers can cite.
 */

import demoData from "../data/demo-data.json";

export interface SearchHit {
  docId: string;
  title: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
  matched: string[];
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "for",
  "in",
  "on",
  "with",
  "from",
  "is",
  "are",
  "was",
  "were",
  "it",
  "its",
  "this",
  "that",
  "what",
  "which",
  "who",
  "how",
  "do",
  "does",
  "did",
  "my",
  "your",
  "me",
  "you",
  "i",
  "about",
  "over",
  "into",
  "as",
  "by",
  "at",
  "has",
  "have",
  "had",
  "will",
  "can",
  "could",
  "should",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

interface ChunkIndex {
  docId: string;
  title: string;
  chunkIndex: number;
  text: string;
}

/** Documents are enumerated once at module load; the demo set is tiny. */
const CHUNKS: ChunkIndex[] = demoData.documents.flatMap((doc) =>
  (doc.chunks ?? []).map((text, chunkIndex) => ({
    docId: doc.id,
    title: doc.title,
    chunkIndex,
    text,
  })),
);

function score(queryTokens: string[], text: string): { score: number; matched: string[] } {
  const lowered = text.toLowerCase();
  const matched: string[] = [];
  let score = 0;
  for (const token of queryTokens) {
    // Count every occurrence — rewards a chunk that mentions the term often.
    const count = lowered.split(token).length - 1;
    if (count > 0) {
      matched.push(token);
      score += count;
    }
  }
  // Light length normalization so long chunks aren't unfairly favored.
  const norm = Math.max(1, Math.sqrt(text.length / 40));
  return { score: score / norm, matched };
}

export function searchDocuments(query: string, limit = 3): SearchHit[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const hits = CHUNKS.map((chunk) => {
    // NOTE: destructuring `score` from the return shadows the function in TDZ —
    // alias it as `s` so the RHS call resolves.
    const { score: s, matched } = score(queryTokens, chunk.text);
    return s > 0
      ? {
          docId: chunk.docId,
          title: chunk.title,
          chunkIndex: chunk.chunkIndex,
          excerpt: chunk.text,
          score: s,
          matched,
        }
      : null;
  }).filter((h): h is SearchHit => h !== null);
  hits.sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex);
  return hits.slice(0, limit);
}