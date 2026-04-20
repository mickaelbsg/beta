import { describe, expect, it } from "vitest";
import { Orchestrator } from "../src/orchestrator/orchestrator.js";
import type {
  ConversationMessage,
  ExecutionRequest,
  ExecutionResult,
  Executor,
  HistoryRepository,
  MemoryRecord,
  SearchResult,
  WebSearchService
} from "../src/shared/types.js";
import type { RagService } from "../src/rag-service/rag-service.js";
import type { ObsidianService } from "../src/obsidian-service/obsidian-service.js";

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

describe("Orchestrator", () => {
  it("creates obsidian note and stores memory for NOTE intent", async () => {
    const history = new InMemoryHistoryRepository();
    const executor = new FakeExecutor({
      replyText: "Nota criada.",
      shouldPersistMemory: false,
      shouldCreateNote: true,
      noteTitle: "Minha nota",
      noteContent: "Conteudo importante"
    });
    const rag = new FakeRagService();
    const obsidian = new FakeObsidianService();

    const orchestrator = new Orchestrator({
      historyRepository: history,
      ragService: rag as unknown as RagService,
      obsidianService: obsidian as unknown as ObsidianService,
      executor,
      webSearchService: new FakeWebSearchService(),
      ragTopK: 5
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
    const rag = new FakeRagService();
    const obsidian = new FakeObsidianService();

    const orchestrator = new Orchestrator({
      historyRepository: history,
      ragService: rag as unknown as RagService,
      obsidianService: obsidian as unknown as ObsidianService,
      executor,
      webSearchService: new FakeWebSearchService(),
      ragTopK: 5
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
});

