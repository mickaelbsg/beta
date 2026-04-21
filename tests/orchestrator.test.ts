import { describe, expect, it } from "vitest";
import { Orchestrator } from "../src/orchestrator/orchestrator.js";
import { ExecutorRouter } from "../src/orchestrator/executor-router.js";
import { ExecutionInsightsStore } from "../src/orchestrator/execution-insights-store.js";
import type {
  ConversationMessage,
  ExecutionRequest,
  ExecutionResult,
  Executor,
  HistoryRepository,
  IntentClassification,
  IntentClassifier,
  MemoryRecord,
  SearchResult,
  WebSearchService
} from "../src/shared/types.js";
import type { RagService } from "../src/rag-service/rag-service.js";
import type { ObsidianService } from "../src/obsidian-service/obsidian-service.js";
import { RuntimeConfigService } from "../src/config/runtime-config-service.js";
import { SoulPromptService } from "../src/prompt/soul-prompt-service.js";
import { PendingMemoryConfirmationService } from "../src/orchestrator/pending-memory-confirmation-service.js";
import { ToolAwarenessService } from "../src/tools/tool-awareness-service.js";
import { DebugModeService } from "../src/debug/debug-mode-service.js";
import { SelfOptimizationService } from "../src/optimization/self-optimization-service.js";
import { UserProfileService } from "../src/optimization/user-profile-service.js";
import { ConversationMemoryService } from "../src/orchestrator/conversation-memory-service.js";

class InMemoryHistoryRepository implements HistoryRepository {
  public messages: ConversationMessage[] = [];

  public async init(): Promise<void> {
    return;
  }

  public async saveMessage(message: ConversationMessage): Promise<void> {
    if (this.messages.find((item) => item.id === message.id)) {
      return;
    }
    this.messages.push(message);
  }

  public async getRecentMessages(chatId: string, limit: number): Promise<ConversationMessage[]> {
    return this.messages.filter((m) => m.chatId === chatId).slice(-limit);
  }

  public async clearChatHistory(chatId: string): Promise<number> {
    const before = this.messages.length;
    this.messages = this.messages.filter((m) => m.chatId !== chatId);
    return before - this.messages.length;
  }
}

class FakeExecutor implements Executor {
  public constructor(private readonly result: ExecutionResult) {}
  public requests: ExecutionRequest[] = [];

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    this.requests.push(request);
    return this.result;
  }
}

class FakeRagService {
  public memories: MemoryRecord[] = [];
  public saved: string[] = [];

  public async retrieveRelevantMemories(_query: string): Promise<MemoryRecord[]> {
    return this.memories;
  }

  public async saveMemory(input: { text: string }): Promise<MemoryRecord> {
    this.saved.push(input.text);
    return {
      id: "1",
      text: input.text,
      source: "chat",
      timestamp: new Date().toISOString()
    };
  }
}

class FakeObsidianService {
  public createdTitles: string[] = [];

  public getVaultPath(): string {
    return "/tmp/vault";
  }

  public async createNote(input: { title: string; content: string }): Promise<{
    filePath: string;
    title: string;
    content: string;
    duplicated: boolean;
  }> {
    this.createdTitles.push(input.title);
    return {
      filePath: "/tmp/test.md",
      title: input.title,
      content: input.content,
      duplicated: false
    };
  }
}

class FakeWebSearchService implements WebSearchService {
  public async search(_query: string): Promise<SearchResult[]> {
    return [{ title: "x", url: "https://example.com", snippet: "y" }];
  }
}

class FakeIntentClassifier implements IntentClassifier {
  public constructor(private readonly classification: IntentClassification) {}

  public async detect(_message: string): Promise<IntentClassification> {
    return this.classification;
  }
}

class FakeRuntimeConfigService {
  public get(_key: string): string | undefined {
    return "llm";
  }
  public getNumber(_key: string, fallback: number): number {
    return fallback;
  }
}

class FakeSoulPromptService {
  public async buildSystemPrompt(intent: string): Promise<string> {
    return `SOUL_PROMPT_INTENT=${intent}`;
  }
}

class FakeToolAwarenessService {
  public async listTools(): Promise<Array<{ name: string; description: string }>> {
    return [{ name: "web_search", description: "Busca na web" }];
  }
}

class FakeDebugModeService {
  public constructor(private readonly enabled = false) {}

  public isEnabled(_userId: string): boolean {
    return this.enabled;
  }
}

class FakeSelfOptimizationService {
  public logs: Array<{ intent: string }> = [];

  public async appendAgentLog(entry: { intent: string }): Promise<void> {
    this.logs.push(entry);
  }
}

class FakeUserProfileService {
  public getResponseStyle(): "short" | "detailed" {
    return "short";
  }
}

describe("Orchestrator", () => {
  it("creates obsidian note and stores memory for NOTE intent", async () => {
    const history = new InMemoryHistoryRepository();
    const executor = new FakeExecutor({
      replyText: "Nota criada.",
      shouldPersistMemory: true,
      memoryText: "Preciso revisar SQL",
      shouldCreateNote: true,
      noteTitle: "Minha nota",
      noteContent: "Conteudo importante"
    });
    const router = new ExecutorRouter(executor);
    const rag = new FakeRagService();
    const obsidian = new FakeObsidianService();

    const orchestrator = new Orchestrator({
      historyRepository: history,
      ragService: rag as unknown as RagService,
      obsidianService: obsidian as unknown as ObsidianService,
      intentClassifier: new FakeIntentClassifier({
        intent: "NOTE",
        confidence: 1,
        source: "keyword"
      }),
      executorRouter: router,
      webSearchService: new FakeWebSearchService(),
      ragTopK: 5,
      memorySaveThreshold: 0.7,
      runtimeConfigService: new FakeRuntimeConfigService() as unknown as RuntimeConfigService,
      executionInsightsStore: new ExecutionInsightsStore(),
      soulPromptService: new FakeSoulPromptService() as unknown as SoulPromptService,
      pendingMemoryConfirmationService: new PendingMemoryConfirmationService(),
      toolAwarenessService: new FakeToolAwarenessService() as unknown as ToolAwarenessService,
      debugModeService: new FakeDebugModeService() as unknown as DebugModeService,
      selfOptimizationService: new FakeSelfOptimizationService() as unknown as SelfOptimizationService,
      userProfileService: new FakeUserProfileService() as unknown as UserProfileService,
      conversationMemoryService: new ConversationMemoryService()
    });

    const result = await orchestrator.handleMessage({
      platform: "telegram",
      chatId: "1",
      userId: "1",
      messageId: "m1",
      text: "anota que preciso revisar SQL",
      timestamp: new Date().toISOString()
    });

    expect(result.text).toContain("Nota");
    expect(obsidian.createdTitles.length).toBe(1);
    expect(rag.saved.length).toBe(1);
    expect(history.messages.length).toBe(2);
  });

  it("does not persist memory by default for SEARCH", async () => {
    const history = new InMemoryHistoryRepository();
    const executor = new FakeExecutor({
      replyText: "Resumo pronto",
      shouldPersistMemory: false,
      shouldCreateNote: false
    });
    const router = new ExecutorRouter(executor);
    const rag = new FakeRagService();
    const obsidian = new FakeObsidianService();

    const orchestrator = new Orchestrator({
      historyRepository: history,
      ragService: rag as unknown as RagService,
      obsidianService: obsidian as unknown as ObsidianService,
      intentClassifier: new FakeIntentClassifier({
        intent: "SEARCH",
        confidence: 1,
        source: "keyword"
      }),
      executorRouter: router,
      webSearchService: new FakeWebSearchService(),
      ragTopK: 5,
      memorySaveThreshold: 0.7,
      runtimeConfigService: new FakeRuntimeConfigService() as unknown as RuntimeConfigService,
      executionInsightsStore: new ExecutionInsightsStore(),
      soulPromptService: new FakeSoulPromptService() as unknown as SoulPromptService,
      pendingMemoryConfirmationService: new PendingMemoryConfirmationService(),
      toolAwarenessService: new FakeToolAwarenessService() as unknown as ToolAwarenessService,
      debugModeService: new FakeDebugModeService() as unknown as DebugModeService,
      selfOptimizationService: new FakeSelfOptimizationService() as unknown as SelfOptimizationService,
      userProfileService: new FakeUserProfileService() as unknown as UserProfileService,
      conversationMemoryService: new ConversationMemoryService()
    });

    await orchestrator.handleMessage({
      platform: "telegram",
      chatId: "1",
      userId: "1",
      messageId: "m2",
      text: "busca novidades em llm",
      timestamp: new Date().toISOString()
    });

    expect(rag.saved.length).toBe(0);
    expect(history.messages.length).toBe(2);
  });

  it("appends debug block when debug mode is enabled for user", async () => {
    const history = new InMemoryHistoryRepository();
    const executor = new FakeExecutor({
      replyText: "Resposta normal",
      shouldPersistMemory: false,
      shouldCreateNote: false
    });
    const router = new ExecutorRouter(executor);

    const orchestrator = new Orchestrator({
      historyRepository: history,
      ragService: new FakeRagService() as unknown as RagService,
      obsidianService: new FakeObsidianService() as unknown as ObsidianService,
      intentClassifier: new FakeIntentClassifier({
        intent: "CHAT",
        confidence: 0.88,
        source: "llm"
      }),
      executorRouter: router,
      webSearchService: new FakeWebSearchService(),
      ragTopK: 5,
      memorySaveThreshold: 0.7,
      runtimeConfigService: new FakeRuntimeConfigService() as unknown as RuntimeConfigService,
      executionInsightsStore: new ExecutionInsightsStore(),
      soulPromptService: new FakeSoulPromptService() as unknown as SoulPromptService,
      pendingMemoryConfirmationService: new PendingMemoryConfirmationService(),
      toolAwarenessService: new FakeToolAwarenessService() as unknown as ToolAwarenessService,
      debugModeService: new FakeDebugModeService(true) as unknown as DebugModeService,
      selfOptimizationService: new FakeSelfOptimizationService() as unknown as SelfOptimizationService,
      userProfileService: new FakeUserProfileService() as unknown as UserProfileService,
      conversationMemoryService: new ConversationMemoryService()
    });

    const result = await orchestrator.handleMessage({
      platform: "telegram",
      chatId: "1",
      userId: "1",
      messageId: "m3",
      text: "oi",
      timestamp: new Date().toISOString()
    });

    expect(result.text).toContain("🧠 DEBUG MODE");
    expect(result.text).toContain("Intent: CHAT");
  });
});
