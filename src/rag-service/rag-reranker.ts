import type { MemoryRecord } from "../shared/types.js";

function keywordOverlap(text: string, query: string): number {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2);
  if (!tokens.length) {
    return 0;
  }
  const source = text.toLowerCase();
  const hits = tokens.filter((token) => source.includes(token)).length;
  return hits / tokens.length;
}

function recencyBoost(timestamp: string): number {
  const created = Date.parse(timestamp);
  if (Number.isNaN(created)) {
    return 0;
  }
  const ageMs = Date.now() - created;
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, 1 - Math.min(ageMs / oneWeek, 1));
}

function semanticSimilarity(score: number | undefined): number {
  const normalized = score ?? 0;
  return Math.max(0, Math.min(1, normalized));
}

export class RagReranker {
  public rerank(query: string, results: MemoryRecord[]): MemoryRecord[] {
    return [...results]
      .map((record) => {
        const semantic = semanticSimilarity(record.score) * 0.7;
        const recency = recencyBoost(record.timestamp) * 0.2;
        const keyword = keywordOverlap(record.text, query) * 0.1;
        const finalScore = semantic + recency + keyword;
        return {
          ...record,
          score: finalScore
        };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
}

