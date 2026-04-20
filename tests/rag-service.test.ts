import { describe, expect, it } from "vitest";
import { RagService } from "../src/rag-service/rag-service.js";
import type { MemoryRecord, MemoryRepository } from "../src/shared/types.js";
import { EmbeddingService } from "../src/rag-service/embedding-service.js";

class FakeEmbeddingService {
  public async generateEmbedding(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
}

class FakeMemoryRepository implements MemoryRepository {
  public records: MemoryRecord[] = [];
  public async init(): Promise<void> {
    return;
  }
  public async saveMemory(record: Omit<MemoryRecord, "id"> & { id?: string }): Promise<MemoryRecord> {
    const saved: MemoryRecord = {
      id: record.id ?? "id-1",
      text: record.text,
      source: record.source,
      timestamp: record.timestamp,
      metadata: record.metadata
    };
    this.records.push(saved);
    return saved;
  }
  public async searchMemories(_queryEmbedding: number[], _topK: number): Promise<MemoryRecord[]> {
    return [
      {
        id: "1",
        text: "mesmo texto",
        source: "chat",
        timestamp: "2026-01-01T00:00:00.000Z",
        metadata: { contentHash: "h1" }
      },
      {
        id: "2",
        text: "mesmo texto",
        source: "chat",
        timestamp: "2026-01-01T00:00:00.001Z",
        metadata: { contentHash: "h1" }
      }
    ];
  }
  public async findNearDuplicate(_text: string): Promise<MemoryRecord | null> {
    return null;
  }
}

describe("RagService", () => {
  it("deduplicates retrieval results", async () => {
    const rag = new RagService(
      new FakeEmbeddingService() as unknown as EmbeddingService,
      new FakeMemoryRepository()
    );
    const items = await rag.retrieveRelevantMemories("query", 5);
    expect(items.length).toBe(1);
  });
});

