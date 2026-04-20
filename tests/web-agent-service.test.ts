import { describe, expect, it } from "vitest";
import type { ExecutionRequest, ExecutionResult, Executor, SearchResult, WebSearchService } from "../src/shared/types.js";
import { ExecutorRouter } from "../src/orchestrator/executor-router.js";
import { WebAgentService } from "../src/web-search/web-agent-service.js";
import { WebBrowserService } from "../src/web-search/web-browser-service.js";

class FakeExecutor implements Executor {
  public async execute(_request: ExecutionRequest): Promise<ExecutionResult> {
    return {
      replyText: "Resumo sintetizado",
      shouldPersistMemory: false,
      shouldCreateNote: false
    };
  }
}

class FakeSearch implements WebSearchService {
  public async search(_query: string): Promise<SearchResult[]> {
    return [
      {
        title: "Fonte 1",
        url: "https://example.com/1",
        snippet: "Snippet 1"
      },
      {
        title: "Fonte 2",
        url: "https://example.com/2",
        snippet: "Snippet 2"
      }
    ];
  }
}

class FakeBrowser extends WebBrowserService {
  public override async fetchMainContent(
    url: string,
    _timeoutMs: number
  ): Promise<{ url: string; title: string; text: string } | null> {
    return {
      url,
      title: "Titulo pagina",
      text: "Conteudo extraido da pagina"
    };
  }
}

describe("WebAgentService", () => {
  it("returns summarized result with sources", async () => {
    const service = new WebAgentService({
      webSearchService: new FakeSearch(),
      executorRouter: new ExecutorRouter(new FakeExecutor()),
      browserService: new FakeBrowser(),
      timeoutMs: 5000,
      enableBrowser: true,
      maxFetchedPages: 1
    });

    const result = await service.run({
      query: "novidades ia",
      preferredExecutor: "llm"
    });

    expect(result.text).toContain("🌐 Resultado:");
    expect(result.text).toContain("Fontes:");
    expect(result.sources.length).toBe(2);
  });
});
