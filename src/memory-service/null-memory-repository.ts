import type { MemoryRecord, MemoryRepository } from "../shared/types.js";

export class NullMemoryRepository implements MemoryRepository {
  public async init(): Promise<void> {
    return;
  }

  public async saveMemory(
    record: Omit<MemoryRecord, "id"> & { id?: string; vector: number[] }
  ): Promise<MemoryRecord> {
    return {
      id: record.id ?? "null-memory",
      text: record.text,
      source: record.source,
      timestamp: record.timestamp,
      metadata: record.metadata
    };
  }

  public async searchMemories(_queryEmbedding: number[], _topK: number): Promise<MemoryRecord[]> {
    return [];
  }

  public async findNearDuplicate(_text: string): Promise<MemoryRecord | null> {
    return null;
  }
}

