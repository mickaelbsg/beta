import type { MemoryRecord } from "../shared/types.js";

function lexicalOverlap(text: string, query: string): number {
  const q = query
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2);
  if (!q.length) {
    return 0;
  }
  const source = text.toLowerCase();
  const hit = q.filter((token) => source.includes(token)).length;
  return hit / q.length;
}

export class RagReranker {
  public rerank(query: string, results: MemoryRecord[]): MemoryRecord[] {
    return [...results]
      .map((record) => {
        const semantic = record.score ?? 0;
        const lexical = lexicalOverlap(record.text, query);
        const blended = semantic * 0.7 + lexical * 0.3;
        return {
          ...record,
          score: blended
        };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
}

