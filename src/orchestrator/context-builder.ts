import type { ConversationMessage, MemoryRecord } from "../shared/types.js";

function compactWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function clip(input: string, maxLen: number): string {
  return input.length <= maxLen ? input : `${input.slice(0, maxLen - 3)}...`;
}

function relevanceScore(text: string, query: string): number {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!q.length) {
    return 0;
  }
  const hay = text.toLowerCase();
  let hit = 0;
  for (const token of q) {
    if (hay.includes(token)) {
      hit += 1;
    }
  }
  return hit / q.length;
}

export class ContextBuilder {
  public buildHistory(history: ConversationMessage[], userInput: string, maxTurns = 5): ConversationMessage[] {
    const scored = history.map((item) => ({
      item,
      score: relevanceScore(item.content, userInput)
    }));
    const selected = scored
      .sort((a, b) => b.score - a.score || a.item.timestamp.localeCompare(b.item.timestamp))
      .slice(0, maxTurns)
      .sort((a, b) => a.item.timestamp.localeCompare(b.item.timestamp))
      .map(({ item }) => ({
        ...item,
        content: clip(compactWhitespace(item.content), 220)
      }));
    return selected;
  }

  public buildMemoryFacts(memories: MemoryRecord[], maxFacts = 5): MemoryRecord[] {
    return memories.slice(0, maxFacts).map((memory) => ({
      ...memory,
      text: clip(compactWhitespace(memory.text), 220)
    }));
  }
}

