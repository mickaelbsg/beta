import { loadConfig } from "../shared/config.js";
import { logger } from "../shared/logger.js";
import { SqliteHistoryRepository } from "../memory-service/sqlite-history-repository.js";
import { QdrantMemoryRepository } from "../memory-service/qdrant-memory-repository.js";
import { NullMemoryRepository } from "../memory-service/null-memory-repository.js";
import { EmbeddingService } from "../rag-service/embedding-service.js";
import { RagService } from "../rag-service/rag-service.js";
import { ObsidianService } from "../obsidian-service/obsidian-service.js";
import { LlmExecutor } from "../agent-executor/llm-executor.js";
import { OpenCodeExecutor } from "../agent-executor/opencode-executor.js";
import { MockWebSearchService } from "../web-search/web-search-service.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { TelegramMessageHandler } from "../message-handler/telegram-bot.js";
import type { Executor, MemoryRepository } from "../shared/types.js";

async function buildMemoryRepository(
  qdrantUrl: string,
  qdrantApiKey: string | undefined,
  collectionName: string,
  vectorSize: number
): Promise<MemoryRepository> {
  const qdrant = new QdrantMemoryRepository({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
    collectionName,
    vectorSize
  });
  try {
    await qdrant.init();
    return qdrant;
  } catch (error) {
    logger.warn("Qdrant unavailable; using NullMemoryRepository.", {
      error: error instanceof Error ? error.message : String(error)
    });
    const fallback = new NullMemoryRepository();
    await fallback.init();
    return fallback;
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();

  const historyRepository = new SqliteHistoryRepository(cfg.SQLITE_DB_PATH);
  await historyRepository.init();

  const embeddingService = new EmbeddingService(cfg.OPENAI_API_KEY, cfg.OPENAI_EMBEDDING_MODEL);
  const sampleEmbedding = await embeddingService.generateEmbedding("dimension probe");
  const memoryRepository = await buildMemoryRepository(
    cfg.QDRANT_URL,
    cfg.QDRANT_API_KEY,
    cfg.QDRANT_COLLECTION_NAME,
    sampleEmbedding.length || 1536
  );
  const ragService = new RagService(embeddingService, memoryRepository);

  const obsidianService = new ObsidianService(cfg.OBSIDIAN_VAULT_PATH);
  await obsidianService.init();

  const llmExecutor = new LlmExecutor(cfg.OPENAI_API_KEY, cfg.OPENAI_CHAT_MODEL);
  const executor: Executor =
    cfg.EXECUTOR_MODE === "opencode" ? new OpenCodeExecutor(null, llmExecutor) : llmExecutor;

  const webSearch = new MockWebSearchService();

  const orchestrator = new Orchestrator({
    historyRepository,
    ragService,
    obsidianService,
    executor,
    webSearchService: webSearch,
    ragTopK: cfg.RAG_TOP_K
  });

  const telegram = new TelegramMessageHandler({
    botToken: cfg.TELEGRAM_BOT_TOKEN,
    allowedUserId: cfg.ALLOWED_TELEGRAM_USER_ID,
    orchestrator
  });
  telegram.start();
}

main().catch((error: unknown) => {
  logger.error("Fatal startup error.", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});

