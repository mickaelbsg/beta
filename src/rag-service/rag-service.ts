import crypto from "node:crypto";
import type { MemoryRecord, MemoryRepository } from "../shared/types.js";
import { logger } from "../shared/logger.js";
import { EmbeddingService } from "./embedding-service.js";
import { RagReranker } from "./rag-reranker.js";
import type { ObsidianWriterService } from "../obsidian-service/obsidian-writer-service.js";

interface SaveMemoryInput {
  text: string;
  source: "chat" | "obsidian";
  chatId?: string;
  metadata?: Record<string, unknown>;
}

function createShortMemoryId(): string {
  return `mem_${crypto.randomUUID()}`;
}

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeHashText(input: string): string {
  return crypto.createHash("sha256").update(normalizeText(input)).digest("hex");
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
    const context = {
      module: "RagService",
      action: "retrieveRelevantMemories",
      query,
      topK,
      resultCount: 0,
      error: null as string | null
    };

    const embedding = await this.embeddingService.generateEmbedding(query);
    if (!embedding.length) {
      logger.warn("rag_embedding_empty", { ...context, error: "empty_embedding" });
      return [];
    }

    const records = await this.memoryRepository.searchMemories(embedding, Math.max(topK, 20));
    const refined = this.reranker.rerank(query, records).slice(0, Math.min(8, records.length));
    const filtered = refined.filter((record) => (record.score ?? 0) >= this.minRelevanceScore);

    const unique: MemoryRecord[] = [];
    const seen = new Set<string>();
    for (const record of filtered) {
      const key =
        String(record.metadata?.shortId ?? record.metadata?.contentHash ?? record.text.toLowerCase().trim());
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(record);
    }

    context.resultCount = unique.length;
    logger.info("rag_retrieve_completed", context);
    return unique;
  }

  public async saveMemory(input: SaveMemoryInput): Promise<MemoryRecord | null> {
    const context = {
      module: "RagService",
      action: "saveMemory",
      source: input.source,
      chatId: input.chatId,
      resultId: null as string | null,
      error: null as string | null
    };

    if (!input.text.trim()) {
      logger.warn("rag_save_empty_text", { ...context, error: "empty_text" });
      return null;
    }

    const normalizedText = normalizeText(input.text);
    const embedding = await this.embeddingService.generateEmbedding(normalizedText);
    const now = new Date().toISOString();
    const hashKey = `${input.chatId ?? "global"}:${normalizeHashText(normalizedText)}`;
    const lastSavedAt = this.recentSaveByChatAndHash.get(hashKey);
    if (lastSavedAt && Date.now() - lastSavedAt < this.frequencyWindowMs) {
      logger.info("rag_save_skipped_frequency", { ...context, error: "frequency_limit" });
      return null;
    }

    const hashDuplicate = await this.memoryRepository.findNearDuplicate(normalizedText);
    if (hashDuplicate) {
      logger.info("rag_save_duplicate_hash", {
        ...context,
        resultId: hashDuplicate.id,
        error: null
      });
      return hashDuplicate;
    }

    const semanticallyClose = await this.memoryRepository.searchMemories(embedding, 1);
    const closest = semanticallyClose[0];
    if ((closest?.score ?? 0) >= this.semanticDuplicateScore) {
      const sameContext = String(closest.metadata?.chatId ?? "") === String(input.chatId ?? "");
      logger.info("rag_save_duplicate_semantic", {
        ...context,
        resultId: closest?.id ?? null,
        score: closest?.score ?? null,
        sameContext,
        error: null
      });
      if (sameContext && closest && closest.text !== normalizedText) {
        const mergedText = `${closest.text}\n${normalizedText}`.trim();
        const mergedEmbedding = await this.embeddingService.generateEmbedding(mergedText);
        const updated = await this.memoryRepository.saveMemory({
          id: closest.id,
          text: mergedText,
          source: input.source,
          timestamp: now,
          vector: mergedEmbedding,
          metadata: {
            ...closest.metadata,
            shortId: String(closest.metadata?.shortId ?? createShortMemoryId()),
            chatId: input.chatId,
            memoryType: input.metadata?.memoryType ?? closest.metadata?.memoryType,
            memoryCategory: input.metadata?.memoryCategory ?? closest.metadata?.memoryCategory,
            originalText: `${closest.metadata?.originalText ?? closest.text}\n${input.text}`
          }
        });
        return updated;
      }
      return closest ?? null;
    }

    const saved = await this.memoryRepository.saveMemory({
      text: normalizedText,
      source: input.source,
      timestamp: now,
      vector: embedding,
      metadata: {
        shortId: String(input.metadata?.shortId ?? createShortMemoryId()),
        chatId: input.chatId,
        originalText: input.text,
        ...input.metadata
      }
    });

    context.resultId = saved.id;
    logger.info("rag_save_completed", { ...context });
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
    return normalizeHashText(input);
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
