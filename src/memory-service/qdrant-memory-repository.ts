import crypto from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../shared/logger.js";
import type { MemoryRecord, MemoryRepository } from "../shared/types.js";

interface QdrantMemoryRepositoryArgs {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize: number;
}

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim().toLowerCase();
}

function hashText(input: string): string {
  return crypto.createHash("sha256").update(normalizeText(input)).digest("hex");
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
    try {
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
      logger.info("qdrant_collection_ready", {
        module: "QdrantMemoryRepository",
        action: "init",
        collectionName: this.args.collectionName,
        vectorSize: this.args.vectorSize,
        error: null
      });
    } catch (error) {
      logger.error("qdrant_init_failed", {
        module: "QdrantMemoryRepository",
        action: "init",
        collectionName: this.args.collectionName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async saveMemory(
    record: Omit<MemoryRecord, "id"> & { id?: string; vector: number[] }
  ): Promise<MemoryRecord> {
    try {
      const existing = await this.findNearDuplicate(record.text);
      if (existing) {
        logger.info("qdrant_memory_duplicate", {
          module: "QdrantMemoryRepository",
          action: "saveMemory",
          textPreview: record.text.slice(0, 80),
          duplicateId: existing.id,
          error: null
        });
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

      logger.info("qdrant_memory_saved", {
        module: "QdrantMemoryRepository",
        action: "saveMemory",
        textPreview: record.text.slice(0, 80),
        id,
        shortId: payload.shortId,
        error: null
      });

      return {
        id,
        text: record.text,
        source: record.source,
        timestamp: record.timestamp,
        metadata: payload
      };
    } catch (error) {
      logger.error("qdrant_save_failed", {
        module: "QdrantMemoryRepository",
        action: "saveMemory",
        textPreview: record.text.slice(0, 80),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async searchMemories(queryEmbedding: number[], topK: number): Promise<MemoryRecord[]> {
    try {
      const results = await this.client.search(this.args.collectionName, {
        vector: queryEmbedding,
        limit: topK,
        with_payload: true
      });
      const mapped = results.map((result) => {
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
      logger.info("qdrant_search_completed", {
        module: "QdrantMemoryRepository",
        action: "searchMemories",
        collectionName: this.args.collectionName,
        topK,
        resultCount: mapped.length,
        error: null
      });
      return mapped;
    } catch (error) {
      logger.error("qdrant_search_failed", {
        module: "QdrantMemoryRepository",
        action: "searchMemories",
        collectionName: this.args.collectionName,
        topK,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async findNearDuplicate(text: string): Promise<MemoryRecord | null> {
    try {
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
      const memory = {
        id: String(point.id),
        text: String(payload.text ?? ""),
        source: (payload.source as "chat" | "obsidian") ?? "chat",
        timestamp: String(payload.createdAt ?? new Date().toISOString()),
        metadata: payload
      };
      logger.info("qdrant_near_duplicate_found", {
        module: "QdrantMemoryRepository",
        action: "findNearDuplicate",
        shortId: payload.shortId,
        error: null
      });
      return memory;
    } catch (error) {
      logger.error("qdrant_find_duplicate_failed", {
        module: "QdrantMemoryRepository",
        action: "findNearDuplicate",
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
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
      const mapped = sorted.map((point) => {
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
      logger.info("qdrant_list_memories_completed", {
        module: "QdrantMemoryRepository",
        action: "listMemories",
        limit,
        resultCount: mapped.length,
        error: null
      });
      return mapped;
    } catch (error) {
      logger.error("qdrant_list_memories_failed", {
        module: "QdrantMemoryRepository",
        action: "listMemories",
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async deleteMemoryByShortId(shortId: string): Promise<boolean> {
    try {
      const point = await this.findPointByShortId(shortId);
      if (!point) {
        logger.info("qdrant_delete_memory_not_found", {
          module: "QdrantMemoryRepository",
          action: "deleteMemoryByShortId",
          shortId,
          error: null
        });
        return false;
      }
      await this.client.delete(this.args.collectionName, {
        wait: true,
        points: [point.id]
      });
      logger.info("qdrant_delete_memory_completed", {
        module: "QdrantMemoryRepository",
        action: "deleteMemoryByShortId",
        shortId,
        error: null
      });
      return true;
    } catch (error) {
      logger.error("qdrant_delete_memory_failed", {
        module: "QdrantMemoryRepository",
        action: "deleteMemoryByShortId",
        shortId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async getMemoryByShortId(shortId: string): Promise<MemoryRecord | null> {
    try {
      const point = await this.findPointByShortId(shortId);
      if (!point) {
        logger.info("qdrant_get_memory_not_found", {
          module: "QdrantMemoryRepository",
          action: "getMemoryByShortId",
          shortId,
          error: null
        });
        return null;
      }
      const payload = point.payload as Record<string, unknown>;
      const id = String(point.id);
      const memory = {
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
      logger.info("qdrant_get_memory_completed", {
        module: "QdrantMemoryRepository",
        action: "getMemoryByShortId",
        shortId,
        error: null
      });
      return memory;
    } catch (error) {
      logger.error("qdrant_get_memory_failed", {
        module: "QdrantMemoryRepository",
        action: "getMemoryByShortId",
        shortId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
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
