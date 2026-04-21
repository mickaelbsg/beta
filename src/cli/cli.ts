#!/usr/bin/env node
import { argv } from "node:process";
import { loadConfig } from "../shared/config.js";
import { ObsidianService } from "../obsidian-service/obsidian-service.js";
import { ObsidianWriterService } from "../obsidian-service/obsidian-writer-service.js";
import { EmbeddingService } from "../rag-service/embedding-service.js";
import { QdrantMemoryRepository } from "../memory-service/qdrant-memory-repository.js";
import { RagService } from "../rag-service/rag-service.js";
import { logger } from "../shared/logger.js";

function parseArgs(args: string[]) {
  const [command, ...rest] = args;
  return { command, payload: rest.join(" ") };
}

async function buildMemoryRepository(qdrantUrl: string, qdrantApiKey: string | undefined, collectionName: string, vectorSize: number) {
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
    logger.warn("cli_qdrant_unavailable", {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function run() {
  const config = loadConfig();
  const obsidian = new ObsidianService(config.OBSIDIAN_VAULT_PATH);
  await obsidian.init();
  const writer = new ObsidianWriterService(obsidian);

  const { command, payload } = parseArgs(argv.slice(2));
  if (!command) {
    console.log("Usage: aizn <note|build|analyze|search> <text>");
    process.exit(1);
  }

  if (command === "note") {
    const note = await writer.writeStructuredNote({
      title: payload.slice(0, 60) || "Nota de conhecimento",
      content: payload,
      type: "knowledge",
      tags: ["auto"],
      metadata: { source: "cli" }
    });

    const embeddingService = new EmbeddingService(config.OPENAI_API_KEY, config.OPENAI_EMBEDDING_MODEL);
    const sampleEmbedding = await embeddingService.generateEmbedding(payload);
    const memoryRepository = await buildMemoryRepository(
      config.QDRANT_URL,
      config.QDRANT_API_KEY,
      config.QDRANT_COLLECTION_NAME,
      sampleEmbedding.length || 1536
    );
    if (memoryRepository) {
      const rag = new RagService(
        embeddingService,
        memoryRepository,
        Number(config.RAG_MIN_RELEVANCE_SCORE),
        Number(config.MEMORY_SEMANTIC_DUPLICATE_SCORE),
        Number(config.MEMORY_FREQUENCY_WINDOW_MS)
      );
      await rag.saveMemory({
        text: payload,
        source: "obsidian",
        metadata: {
          notePath: note.filePath,
          memoryType: "note",
          source: "cli"
        }
      });
    }
    console.log(`saved: ${note.filePath}`);
    return;
  }

  if (command === "search") {
    const results = await obsidian.searchNotes(payload);
    console.log(results.join("\n"));
    return;
  }

  if (command === "build") {
    console.log("build not implemented yet");
    return;
  }

  if (command === "analyze") {
    console.log("analyze not implemented yet");
    return;
  }

  console.log(`unknown command: ${command}`);
  process.exit(1);
}

run().catch((error) => {
  logger.error("cli_error", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
