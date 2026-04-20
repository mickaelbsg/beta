import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CommandRouter } from "../src/command-router/command-router.js";
import { RuntimeConfigService } from "../src/config/runtime-config-service.js";
import { ExecutionInsightsStore } from "../src/orchestrator/execution-insights-store.js";
import { ExecutorRouter } from "../src/orchestrator/executor-router.js";
import { ToolAwarenessService } from "../src/tools/tool-awareness-service.js";
import { DebugModeService } from "../src/debug/debug-mode-service.js";
import { SelfOptimizationService } from "../src/optimization/self-optimization-service.js";
import { FeedbackService } from "../src/optimization/feedback-service.js";
import { UserProfileService } from "../src/optimization/user-profile-service.js";
import { FileSystemService } from "../src/filesystem/filesystem-service.js";
import type {
  ConversationMessage,
  ExecutionRequest,
  ExecutionResult,
  Executor,
  HistoryRepository
} from "../src/shared/types.js";
import type { RagService } from "../src/rag-service/rag-service.js";
import type { ObsidianService } from "../src/obsidian-service/obsidian-service.js";
import type { WebSearchService } from "../src/shared/types.js";

class FakeExecutor implements Executor {
  public async execute(_request: ExecutionRequest): Promise<ExecutionResult> {
    return {
      replyText: "resposta estudo",
      shouldPersistMemory: false,
      shouldCreateNote: false
    };
  }
}

class FakeHistory implements HistoryRepository {
  public clearedChats: string[] = [];

  public async init(): Promise<void> {
    return;
  }
  public async saveMessage(_message: ConversationMessage): Promise<void> {
    return;
  }
  public async getRecentMessages(_chatId: string, _limit: number): Promise<ConversationMessage[]> {
    return [];
  }
  public async clearChatHistory(chatId: string): Promise<number> {
    this.clearedChats.push(chatId);
    return 3;
  }
}

class FakeRagService {
  public async saveMemory(): Promise<{ metadata: { shortId: string } }> {
    return { metadata: { shortId: "mem_1a2b" } };
  }
  public async listMemories(): Promise<
    Array<{ id: string; text: string; metadata: Record<string, unknown> }>
  > {
    return [
      { id: "1", text: "Estudar redes", metadata: { shortId: "mem_1a2b" } },
      { id: "2", text: "Curso TCP/IP salvo", metadata: { shortId: "mem_9x8y" } }
    ];
  }
  public async retrieveRelevantMemories(): Promise<
    Array<{ id: string; text: string; metadata: Record<string, unknown> }>
  > {
    return [{ id: "1", text: "Estudar redes", metadata: { shortId: "mem_1a2b" } }];
  }
  public async deleteMemoryByShortId(id: string): Promise<boolean> {
    return id === "mem_1a2b";
  }
}

class FakeObsidianService {
  public async createNote(): Promise<{ filePath: string; duplicated: boolean }> {
    return { filePath: "/tmp/nota.md", duplicated: false };
  }
}

class FakeWebSearch implements WebSearchService {
  public async search(): Promise<Array<{ title: string; url: string; snippet: string }>> {
    return [{ title: "R1", url: "https://example.com", snippet: "Resumo" }];
  }
}

class FakeToolAwarenessService {
  public async listTools(): Promise<Array<{ name: string; description: string }>> {
    return [{ name: "web_search", description: "Busca na web" }];
  }

  public async searchTools(query: string): Promise<Array<{ name: string; description: string }>> {
    if (!query) {
      return this.listTools();
    }
    return [{ name: "web_search", description: "Busca na web" }];
  }
}

class FakeDebugModeService {
  private readonly state = new Map<string, boolean>();

  public isEnabled(userId: string): boolean {
    return Boolean(this.state.get(userId));
  }

  public async setEnabled(userId: string, enabled: boolean): Promise<void> {
    this.state.set(userId, enabled);
  }
}

class FakeSelfOptimizationService {
  public async appendAgentLog(): Promise<void> {
    return;
  }

  public async getMetrics(): Promise<{
    avgLatencyMs: number;
    p95LatencyMs: number;
    ragPrecision: number;
    memorySaveRate: number;
    toolUsageRate: number;
    toolSuccessRate: number;
    tokensPerResponse: number;
  }> {
    return {
      avgLatencyMs: 700,
      p95LatencyMs: 1200,
      ragPrecision: 0.5,
      memorySaveRate: 0.2,
      toolUsageRate: 0.8,
      toolSuccessRate: 1,
      tokensPerResponse: 90
    };
  }

  public buildMetricsReport(): string {
    return "📊 Sistema:\n\nLatencia media: 700ms";
  }

  public async buildHealthReport(): Promise<string> {
    return "🟢 Sistema saudavel";
  }

  public async optimize(): Promise<{
    metrics: object;
    issues: string[];
    adjustments: Array<{ key: string; from: string; to: string }>;
    suggestions: string[];
  }> {
    return {
      metrics: {},
      issues: [],
      adjustments: [],
      suggestions: []
    };
  }

  public buildTelegramReport(): string {
    return "🧠 Diagnostico:\n\n- Nenhum problema critico detectado";
  }
}

class FakeFeedbackService {
  public entries: Array<{ userId: string; chatId: string; value: string }> = [];
  public async addFeedback(userId: string, chatId: string, value: "up" | "down"): Promise<void> {
    this.entries.push({ userId, chatId, value });
  }
}

class FakeUserProfileService {
  private style = "short";
  public getResponseStyle(): "short" | "detailed" {
    return this.style as "short" | "detailed";
  }
  public async setResponseStyle(_userId: string, style: "short" | "detailed"): Promise<void> {
    this.style = style;
  }
}

class FakeFileSystemService {
  public listAllowedRoots(): string[] {
    return ["/home/pc/projetos/obsidian"];
  }

  public async listDirectory(): Promise<string[]> {
    return ["[file] nota.md", "[dir] projetos"];
  }

  public async readFile(): Promise<string> {
    return "conteudo da nota";
  }

  public async writeFile(): Promise<string> {
    return "/home/pc/projetos/obsidian/nota.md";
  }

  public async appendFile(): Promise<string> {
    return "/home/pc/projetos/obsidian/nota.md";
  }
}

describe("CommandRouter", () => {
  it("handles /help and /set deterministically", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "assistant-cmd-"));
    const cfg = new RuntimeConfigService(path.join(tmpDir, "runtime.json"));
    await cfg.init();
    const history = new FakeHistory();
    const router = new CommandRouter({
      ragService: new FakeRagService() as unknown as RagService,
      obsidianService: new FakeObsidianService() as unknown as ObsidianService,
      webSearchService: new FakeWebSearch(),
      executorRouter: new ExecutorRouter(new FakeExecutor()),
      runtimeConfigService: cfg,
      executionInsightsStore: new ExecutionInsightsStore(),
      historyRepository: history,
      toolAwarenessService: new FakeToolAwarenessService() as unknown as ToolAwarenessService,
      debugModeService: new FakeDebugModeService() as unknown as DebugModeService,
      selfOptimizationService: new FakeSelfOptimizationService() as unknown as SelfOptimizationService,
      feedbackService: new FakeFeedbackService() as unknown as FeedbackService,
      userProfileService: new FakeUserProfileService() as unknown as UserProfileService,
      fileSystemService: new FakeFileSystemService() as unknown as FileSystemService
    });

    const help = await router.handle("/help");
    expect(help).toContain("/memories");

    const setResult = await router.handle("/set rag_top_k=7");
    expect(setResult).toContain("rag_top_k=7");

    const tools = await router.handle("/tools");
    expect(tools).toContain("web_search");

    const toolSearch = await router.handle("/tool_search web");
    expect(toolSearch).toContain("web_search");

    const debugOn = await router.handle("/debug on", { chatId: "1", userId: "1" });
    expect(debugOn).toContain("ativado");

    const optimize = await router.handle("/optimize");
    expect(optimize).toContain("Diagnostico");
    const metrics = await router.handle("/metrics");
    expect(metrics).toContain("Sistema");
    const health = await router.handle("/health");
    expect(health).toContain("saudavel");
    const feedback = await router.handle("/feedback up", { chatId: "chat-1", userId: "1" });
    expect(feedback).toContain("positivo");
    const profile = await router.handle("/profile detailed", { chatId: "chat-1", userId: "1" });
    expect(profile).toContain("detailed");
    const fsLs = await router.handle("/fs_ls /home/pc/projetos/obsidian", { chatId: "chat-1", userId: "1" });
    expect(fsLs).toContain("Arquivos");
    const fsRead = await router.handle("/fs_read /home/pc/projetos/obsidian/nota.md", { chatId: "chat-1", userId: "1" });
    expect(fsRead).toContain("conteudo da nota");
    const fsWrite = await router.handle("/fs_write /home/pc/projetos/obsidian/nota.md teste", { chatId: "chat-1", userId: "1" });
    expect(fsWrite).toContain("Arquivo atualizado");
    const fsAppend = await router.handle("/fs_append /home/pc/projetos/obsidian/nota.md extra", { chatId: "chat-1", userId: "1" });
    expect(fsAppend).toContain("Conteudo anexado");

    const reset = await router.handle("/reset_session", { chatId: "chat-1", userId: "1" });
    expect(reset).toContain("Sessao resetada");
    expect(history.clearedChats).toEqual(["chat-1"]);
  });
});
