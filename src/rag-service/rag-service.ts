import type { MemoryRecord, MemoryRepository } from "../shared/types.js";
import { EmbeddingService } from "./embedding-service.js";

interface SaveMemoryInput {
  text: string;
  source: "chat" | "obsidian";
  metadata?: Record<string, unknown>;
}

export class RagService {
  public constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly memoryRepository: MemoryRepository
  ) {}

  public async retrieveRelevantMemories(query: string, topK: number): Promise<MemoryRecord[]> {
    const embedding = await this.embeddingService.generateEmbedding(query);
    if (!embedding.length) {
      return [];
    }

    const records = await this.memoryRepository.searchMemories(embedding, topK);

    const seen = new Set<string>();
    return records.filter((record) => {
      const key = (record.metadata?.contentHash as string | undefined) ?? record.text.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  public async saveMemory(input: SaveMemoryInput): Promise<MemoryRecord> {
    const embedding = await this.embeddingService.generateEmbedding(input.text);
    const now = new Date().toISOString();
    return this.memoryRepository.saveMemory({
      text: input.text,
      source: input.source,
      timestamp: now,
      vector: embedding,
      metadata: input.metadata
    });
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
}

