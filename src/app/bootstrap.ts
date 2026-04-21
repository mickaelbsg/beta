import { loadConfig } from "../shared/config.js";
import { logger } from "../shared/logger.js";
import { SqliteHistoryRepository } from "../memory-service/sqlite-history-repository.js";
import { QdrantMemoryRepository } from "../memory-service/qdrant-memory-repository.js";
import { NullMemoryRepository } from "../memory-service/null-memory-repository.js";
import { EmbeddingService } from "../rag-service/embedding-service.js";
import { RagService } from "../rag-service/rag-service.js";
import { ConversationMemoryService } from "../orchestrator/conversation-memory-service.js";
import { ObsidianService } from "../obsidian-service/obsidian-service.js";
import { ObsidianWriterService } from "../obsidian-service/obsidian-writer-service.js";
import { LlmExecutor } from "../agent-executor/llm-executor.js";
import { OpenCodeExecutor } from "../agent-executor/opencode-executor.js";
import { OmniRouteProvider } from "../agent-executor/providers/omniroute-provider.js";
import { OpenAIProvider } from "../agent-executor/providers/openai-provider.js";
import { ResilientWebSearchService } from "../web-search/web-search-service.js";
import { WebBrowserService } from "../web-search/web-browser-service.js";
import { WebAgentService } from "../web-search/web-agent-service.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { TelegramMessageHandler } from "../message-handler/telegram-bot.js";
import type { Executor, MemoryRepository } from "../shared/types.js";
import { HybridIntentClassifier } from "../orchestrator/intent-classifier.js";
import { ExecutorRouter } from "../orchestrator/executor-router.js";
import { RuntimeConfigService } from "../config/runtime-config-service.js";
import { ExecutionInsightsStore } from "../orchestrator/execution-insights-store.js";
import { CommandRouter } from "../command-router/command-router.js";
import { SkillRegistry } from "../skills/skill-registry.js";
import { SoulPromptService } from "../prompt/soul-prompt-service.js";
import { PendingMemoryConfirmationService } from "../orchestrator/pending-memory-confirmation-service.js";
import { ToolAwarenessService } from "../tools/tool-awareness-service.js";
import { DebugModeService } from "../debug/debug-mode-service.js";
import { AgentLogService } from "../optimization/agent-log-service.js";
import { SelfOptimizationService } from "../optimization/self-optimization-service.js";
import { AlertService } from "../optimization/alert-service.js";
import { LlmSuggestionService } from "../optimization/llm-suggestion-service.js";
import { FeedbackService } from "../optimization/feedback-service.js";
import { UserProfileService } from "../optimization/user-profile-service.js";
import { FileSystemService } from "../filesystem/filesystem-service.js";
import { ShellSessionService } from "../shell/shell-session-service.js";
import { DynamicConfigService } from "../config/dynamic-config-service.js";
import { AdminApiServer } from "../api/admin-server.js";
import { spawnSync } from "node:child_process";

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
    logger.warn("qdrant_unavailable_using_null_memory", {
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
  const dynamicConfigService = new DynamicConfigService(cfg.RUNTIME_CONFIG_PATH.replace("runtime-config.json", "dynamic-config.json"));
  await dynamicConfigService.init();
  const runtimeConfigService = new RuntimeConfigService(cfg.RUNTIME_CONFIG_PATH);
  await runtimeConfigService.init();
  const agentLogService = new AgentLogService(cfg.AGENT_LOG_PATH);
  await agentLogService.init();
  const alertService = new AlertService(
    cfg.ALERT_STATE_PATH,
    cfg.ALERTS_ENABLED,
    cfg.ALERT_COOLDOWN_MS
  );
  await alertService.init();
  const llmSuggestionService = new LlmSuggestionService({
    enabled: cfg.LLM_ANALYZER_ENABLED,
    provider: cfg.LLM_PROVIDER,
    model: cfg.OPENAI_MODEL,
    apiKey: cfg.OPENAI_API_KEY,
    omnirouteBaseUrl: cfg.OMNIROUTE_BASE_URL,
    omnirouteApiKey: cfg.OMNIROUTE_API_KEY
  });
  const feedbackService = new FeedbackService(cfg.FEEDBACK_STORE_PATH);
  await feedbackService.init();
  const userProfileService = new UserProfileService(cfg.USER_PROFILE_STORE_PATH);
  await userProfileService.init();
  const selfOptimizationService = new SelfOptimizationService({
    runtimeConfigService,
    agentLogService,
    alertService,
    llmAnalyzer: llmSuggestionService.isEnabled() ? llmSuggestionService : undefined,
    windowSize: cfg.OPTIMIZER_WINDOW_SIZE,
    toolUsageMinRate: cfg.TOOL_USAGE_MIN_RATE,
    fastModel: cfg.FAST_MODEL
  });
  const soulPromptService = new SoulPromptService(cfg.SOUL_PROMPT_PATH);
  const executionInsightsStore = new ExecutionInsightsStore();
  const pendingMemoryConfirmationService = new PendingMemoryConfirmationService();
  const conversationMemoryService = new ConversationMemoryService();
  const debugModeService = new DebugModeService(cfg.DEBUG_MODE_STORE_PATH);
  await debugModeService.init();
  const toolAwarenessService = new ToolAwarenessService({
    specPath: cfg.TOOLS_SPEC_PATH,
    toolsDir: cfg.TOOLS_REGISTRY_DIR
  });
  const fileSystemService = new FileSystemService({
    enabled: cfg.FILESYSTEM_ENABLED,
    allowedRoots: cfg.FILESYSTEM_ALLOWED_ROOTS
  });
  const shellSessionService = new ShellSessionService(cfg.FILESYSTEM_ALLOWED_ROOTS);
  const skillRegistry = new SkillRegistry();
  void skillRegistry;

  const embeddingService = new EmbeddingService(cfg.OPENAI_API_KEY, cfg.OPENAI_EMBEDDING_MODEL);
  let vectorSize = 1536;
  try {
    const sampleEmbedding = await embeddingService.generateEmbedding("dimension probe");
    vectorSize = sampleEmbedding.length || 1536;
  } catch {
    logger.warn("embedding_probe_failed_using_default_dimension", {
      vectorSize
    });
  }
  const memoryRepository = await buildMemoryRepository(
    cfg.QDRANT_URL,
    cfg.QDRANT_API_KEY,
    cfg.QDRANT_COLLECTION_NAME,
    vectorSize
  );
  const ragService = new RagService(
    embeddingService,
    memoryRepository,
    cfg.RAG_MIN_RELEVANCE_SCORE,
    cfg.MEMORY_SEMANTIC_DUPLICATE_SCORE,
    cfg.MEMORY_FREQUENCY_WINDOW_MS
  );

  const obsidianService = new ObsidianService(cfg.OBSIDIAN_VAULT_PATH);
  await obsidianService.init();

  const llmExecutor = new LlmExecutor(dynamicConfigService);
  const openCodeExecutor: Executor | undefined =
    cfg.EXECUTOR_MODE === "opencode"
      ? (() => {
          // Verifica disponibilidade do Claude Code CLI antes de instanciar
          try {
            const check = spawnSync("claude", ["--version"]);
            if (typeof check.status === "number" && check.status === 0) {
              return new OpenCodeExecutor(null, llmExecutor);
            }
            logger.warn("claude_cli_not_found_opencode_disabled", {
              status: check.status,
              stderr: check.stderr ? check.stderr.toString().slice(0, 200) : null
            });
          } catch (err) {
            logger.warn("claude_cli_check_failed_opencode_disabled", {
              error: err instanceof Error ? err.message : String(err)
            });
          }
          return undefined;
        })()
      : undefined;
  const executorRouter = new ExecutorRouter(llmExecutor, openCodeExecutor);

  const webSearch = new ResilientWebSearchService({
    provider: cfg.WEB_SEARCH_PROVIDER,
    timeoutMs: cfg.WEB_SEARCH_TIMEOUT_MS,
    tavilyApiKey: cfg.TAVILY_API_KEY,
    serpApiKey: cfg.SERPAPI_API_KEY
  });
  const webBrowser = new WebBrowserService();
  const webAgentService = new WebAgentService({
    webSearchService: webSearch,
    executorRouter,
    browserService: webBrowser,
    timeoutMs: cfg.WEB_AGENT_TIMEOUT_MS,
    enableBrowser: cfg.WEB_AGENT_ENABLE_BROWSER,
    maxFetchedPages: cfg.WEB_AGENT_BROWSER_TOP_PAGES
  });
  const intentClassifier = new HybridIntentClassifier(
    cfg.OPENAI_API_KEY,
    cfg.OPENAI_MODEL,
    cfg.INTENT_LLM_FALLBACK_THRESHOLD
  );

  const obsidianWriterService = new ObsidianWriterService(obsidianService);

  const orchestrator = new Orchestrator({
    historyRepository,
    ragService,
    obsidianService,
    obsidianWriterService,
    intentClassifier,
    executorRouter,
    webSearchService: webSearch,
    ragTopK: cfg.RAG_TOP_K,
    memorySaveThreshold: cfg.MEMORY_SAVE_THRESHOLD,
    runtimeConfigService,
    executionInsightsStore,
    soulPromptService,
    pendingMemoryConfirmationService,
    webAgentService,
    toolAwarenessService,
    debugModeService,
    selfOptimizationService,
    userProfileService,
    conversationMemoryService
  });

  const commandRouter = new CommandRouter({
    ragService,
    obsidianService,
    webSearchService: webSearch,
    executorRouter,
    runtimeConfigService,
    executionInsightsStore,
    soulPromptService,
    historyRepository,
    toolAwarenessService,
    debugModeService,
    selfOptimizationService,
    feedbackService,
    userProfileService,
    fileSystemService,
    shellSessionService
  });

  const telegram = new TelegramMessageHandler({
    botToken: cfg.TELEGRAM_BOT_TOKEN,
    allowedUserId: cfg.ALLOWED_TELEGRAM_USER_ID,
    orchestrator,
    commandRouter,
    selfOptimizationService,
    debugModeService
  });
  telegram.start();

  const adminServer = new AdminApiServer({
    port: cfg.ADMIN_SERVER_PORT,
    adminToken: cfg.ADMIN_API_PASSWORD,
    dynamicConfigService,
    agentLogService,
    historyRepository,
    obsidianService
  });
  adminServer.start();
}

main().catch((error: unknown) => {
  logger.error("fatal_startup_error", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
