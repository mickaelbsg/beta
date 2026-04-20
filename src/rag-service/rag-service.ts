import type { MemoryRecord, MemoryRepository } from "../shared/types.js";
import { EmbeddingService } from "./embedding-service.js";
import { RagReranker } from "./rag-reranker.js";

interface SaveMemoryInput {
  text: string;
  source: "chat" | "obsidian";
  chatId?: string;
  metadata?: Record<string, unknown>;
}

function createShortMemoryId(): string {
  return `mem_${Math.random().toString(36).slice(2, 6)}`;
}

export class RagService {
  private readonly reranker = new RagReranker();
  private readonly recentSaveByChatAndHash = new Map<string, number>();

  public constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly memoryRepository: MemoryRepository,
    private readonly minRelevanceScore: number,
    private readonly semanticDuplicateScore: number,
    private readonly frequencyWindowMs: number
  ) {}

  public async retrieveRelevantMemories(query: string, topK: number): Promise<MemoryRecord[]> {
    try {
      const embedding = await this.embeddingService.generateEmbedding(query);
      if (!embedding.length) {
        return [];
      }

      const records = await this.memoryRepository.searchMemories(embedding, topK);
      const reranked = this.reranker.rerank(query, records);
      const filtered = reranked.filter((record) => (record.score ?? 0) >= this.minRelevanceScore);

      const seen = new Set<string>();
      return filtered.filter((record) => {
        const key =
          (record.metadata?.contentHash as string | undefined) ?? record.text.toLowerCase().trim();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    } catch {
      return [];
    }
  }

  public async saveMemory(input: SaveMemoryInput): Promise<MemoryRecord | null> {
    if (!input.text.trim()) {
      return null;
    }
    const embedding = await this.embeddingService.generateEmbedding(input.text);
    const now = new Date().toISOString();
    const hashKey = `${input.chatId ?? "global"}:${this.hashText(input.text)}`;
    const lastSavedAt = this.recentSaveByChatAndHash.get(hashKey);
    if (lastSavedAt && Date.now() - lastSavedAt < this.frequencyWindowMs) {
      return null;
    }

    const hashDuplicate = await this.memoryRepository.findNearDuplicate(input.text);
    if (hashDuplicate) {
      return hashDuplicate;
    }

    const semanticallyClose = await this.memoryRepository.searchMemories(embedding, 1);
    if ((semanticallyClose[0]?.score ?? 0) >= this.semanticDuplicateScore) {
      return semanticallyClose[0] ?? null;
    }

    const saved = await this.memoryRepository.saveMemory({
      text: input.text,
      source: input.source,
      timestamp: now,
      vector: embedding,
      metadata: {
        shortId: String(input.metadata?.shortId ?? createShortMemoryId()),
        ...(input.metadata ?? {})
      }
    });
    this.recentSaveByChatAndHash.set(hashKey, Date.now());
    return saved;
  }

  public formatContext(memories: MemoryRecord[]): string {
    if (!memories.length) {
      return "Sem memorias relevantes no RAG.";
    }
    return memories
      .map((memory, idx) => {
        return `${idx + 1}. [${memory.source}] (${memory.timestamp}) ${memory.text}`;
      })
      .join("\n");
  }

  private hashText(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return String(hash);
  }

  public async listMemories(limit: number): Promise<MemoryRecord[]> {
    const items = await this.memoryRepository.listMemories(limit);
    const seen = new Set<string>();
    return items.filter((item) => {
      const key =
        String(item.metadata?.shortId ?? "") ||
        String(item.metadata?.contentHash ?? "") ||
        item.text.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  public async deleteMemoryByShortId(shortId: string): Promise<boolean> {
    return this.memoryRepository.deleteMemoryByShortId(shortId);
  }

  public async getMemoryByShortId(shortId: string): Promise<MemoryRecord | null> {
    return this.memoryRepository.getMemoryByShortId(shortId);
  }
}
