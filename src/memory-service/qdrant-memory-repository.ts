import crypto from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import type { MemoryRecord, MemoryRepository } from "../shared/types.js";

interface QdrantMemoryRepositoryArgs {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize: number;
}

function hashText(input: string): string {
  return crypto.createHash("sha256").update(input.trim()).digest("hex");
}

export class QdrantMemoryRepository implements MemoryRepository {
  private readonly client: QdrantClient;

  public constructor(private readonly args: QdrantMemoryRepositoryArgs) {
    this.client = new QdrantClient({
      url: args.url,
      apiKey: args.apiKey
    });
  }

  public async init(): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some((c) => c.name === this.args.collectionName);
    if (!exists) {
      await this.client.createCollection(this.args.collectionName, {
        vectors: {
          size: this.args.vectorSize,
          distance: "Cosine"
        }
      });
    }
  }

  public async saveMemory(
    record: Omit<MemoryRecord, "id"> & { id?: string; vector: number[] }
  ): Promise<MemoryRecord> {
    const existing = await this.findNearDuplicate(record.text);
    if (existing) {
      return existing;
    }

    const id = record.id ?? crypto.randomUUID();
    const payload = {
      text: record.text,
      source: record.source,
      createdAt: record.timestamp,
      contentHash: hashText(record.text),
      ...(record.metadata ?? {})
    };

    await this.client.upsert(this.args.collectionName, {
      wait: true,
      points: [
        {
          id,
          vector: record.vector,
          payload
        }
      ]
    });

    return {
      id,
      text: record.text,
      source: record.source,
      timestamp: record.timestamp,
      metadata: record.metadata
    };
  }

  public async searchMemories(queryEmbedding: number[], topK: number): Promise<MemoryRecord[]> {
    const results = await this.client.search(this.args.collectionName, {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true
    });

    return results.map((result) => {
      const payload = result.payload as Record<string, unknown>;
      return {
        id: String(result.id),
        text: String(payload.text ?? ""),
        source: (payload.source as "chat" | "obsidian") ?? "chat",
        timestamp: String(payload.createdAt ?? new Date().toISOString()),
        score: result.score ?? undefined,
        metadata: payload
      };
    });
  }

  public async findNearDuplicate(text: string): Promise<MemoryRecord | null> {
    const contentHash = hashText(text);
    const result = await this.client.scroll(this.args.collectionName, {
      limit: 1,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          {
            key: "contentHash",
            match: {
              value: contentHash
            }
          }
        ]
      }
    });

    const point = result.points[0];
    if (!point) {
      return null;
    }

    const payload = point.payload as Record<string, unknown>;
    return {
      id: String(point.id),
      text: String(payload.text ?? ""),
      source: (payload.source as "chat" | "obsidian") ?? "chat",
      timestamp: String(payload.createdAt ?? new Date().toISOString()),
      metadata: payload
    };
  }
}

