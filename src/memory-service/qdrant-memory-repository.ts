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

function shortIdFrom(rawId: string): string {
  return `mem_${rawId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toLowerCase()}`;
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
      shortId: String(record.metadata?.shortId ?? shortIdFrom(id)),
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
      metadata: payload
    };
  }

  public async searchMemories(queryEmbedding: number[], topK: number): Promise<MemoryRecord[]> {
    let results;
    try {
      results = await this.client.search(this.args.collectionName, {
        vector: queryEmbedding,
        limit: topK,
        with_payload: true
      });
    } catch {
      return [];
    }

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
    let result;
    try {
      result = await this.client.scroll(this.args.collectionName, {
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
    } catch {
      return null;
    }

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

  public async listMemories(limit: number): Promise<MemoryRecord[]> {
    try {
      const result = await this.client.scroll(this.args.collectionName, {
        limit,
        with_payload: true,
        with_vector: false
      });
      const sorted = [...result.points].sort((a, b) => {
        const aTs = String((a.payload as Record<string, unknown>)?.createdAt ?? "");
        const bTs = String((b.payload as Record<string, unknown>)?.createdAt ?? "");
        return bTs.localeCompare(aTs);
      });
      return sorted.map((point) => {
        const payload = point.payload as Record<string, unknown>;
        const id = String(point.id);
        const shortId = String(payload.shortId ?? shortIdFrom(id));
        return {
          id,
          text: String(payload.text ?? ""),
          source: (payload.source as "chat" | "obsidian") ?? "chat",
          timestamp: String(payload.createdAt ?? new Date().toISOString()),
          metadata: {
            ...payload,
            shortId
          }
        };
      });
    } catch {
      return [];
    }
  }

  public async deleteMemoryByShortId(shortId: string): Promise<boolean> {
    try {
      const point = await this.findPointByShortId(shortId);
      if (!point) {
        return false;
      }
      await this.client.delete(this.args.collectionName, {
        wait: true,
        points: [point.id]
      });
      return true;
    } catch {
      return false;
    }
  }

  public async getMemoryByShortId(shortId: string): Promise<MemoryRecord | null> {
    try {
      const point = await this.findPointByShortId(shortId);
      if (!point) {
        return null;
      }
      const payload = point.payload as Record<string, unknown>;
      const id = String(point.id);
      return {
        id,
        text: String(payload.text ?? ""),
        source: (payload.source as "chat" | "obsidian") ?? "chat",
        timestamp: String(payload.createdAt ?? new Date().toISOString()),
        score: typeof payload.memoryScore === "number" ? payload.memoryScore : undefined,
        metadata: {
          ...payload,
          shortId: String(payload.shortId ?? shortIdFrom(id))
        }
      };
    } catch {
      return null;
    }
  }

  private async findPointByShortId(shortId: string) {
    const found = await this.client.scroll(this.args.collectionName, {
      limit: 1,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          {
            key: "shortId",
            match: {
              value: shortId
            }
          }
        ]
      }
    });
    return found.points[0] ?? null;
  }
}
