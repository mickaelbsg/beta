import { ExecutorRouter } from "../orchestrator/executor-router.js";
import type { ExecutionRequest, InteractionObserver, SearchResult, WebSearchService } from "../shared/types.js";
import { WebBrowserService } from "./web-browser-service.js";

interface WebAgentServiceArgs {
  webSearchService: WebSearchService;
  executorRouter: ExecutorRouter;
  browserService: WebBrowserService;
  timeoutMs: number;
  enableBrowser: boolean;
  maxFetchedPages: number;
}

interface WebAgentRunInput {
  query: string;
  preferredExecutor: "llm" | "opencode";
}

export interface WebAgentResult {
  text: string;
  sources: SearchResult[];
}

function buildSources(results: SearchResult[]): string {
  if (!results.length) {
    return "- Nenhuma fonte disponivel.";
  }
  return results
    .slice(0, 5)
    .map((item) => `- ${item.title}: ${item.url}`)
    .join("\n");
}

function fallbackSummary(results: SearchResult[]): string {
  if (!results.length) {
    return "Nao encontrei resultados externos relevantes no momento.";
  }
  const top = results.slice(0, 3).map((item) => `${item.title} — ${item.snippet}`);
  return top.join("\n");
}

export class WebAgentService {
  public constructor(private readonly args: WebAgentServiceArgs) {}

  public async run(input: WebAgentRunInput, observer?: InteractionObserver): Promise<WebAgentResult> {
    await observer?.report("Buscando resultados na web");
    const searchResults = await this.args.webSearchService.search(input.query);
    if (!searchResults.length) {
      return {
        text: "🌐 Resultado:\n\nNao encontrei resultados externos relevantes agora.\n\nFontes:\n- Nenhuma",
        sources: []
      };
    }

    const snippets: string[] = [];
    snippets.push(
      ...searchResults.slice(0, 5).map((item, idx) => {
        return `Resultado ${idx + 1}\nTitulo: ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet}`;
      })
    );

    if (this.args.enableBrowser && this.args.maxFetchedPages > 0) {
      const candidates = searchResults.slice(0, this.args.maxFetchedPages);
      for (const item of candidates) {
        await observer?.report(`Extraindo conteudo de ${item.url}`);
        const yt = await this.args.browserService.fetchYouTubeMetadata(item.url, this.args.timeoutMs);
        if (yt) {
          snippets.push(
            `Conteudo YouTube\nTitulo: ${yt.title}\nDescricao: ${yt.description}\nURL: ${item.url}`
          );
          continue;
        }
        const page = await this.args.browserService.fetchMainContent(item.url, this.args.timeoutMs);
        if (page?.text) {
          snippets.push(`Conteudo pagina\nTitulo: ${page.title}\nURL: ${page.url}\nTexto: ${page.text}`);
        }
      }
    }

    const request: ExecutionRequest = {
      intent: "SEARCH",
      userMessage: `Consulta do usuario: ${input.query}\n\nContexto coletado:\n${snippets.join("\n\n")}`,
      recentHistory: [],
      retrievedMemories: [],
      preferredExecutor: "llm",
      systemRules:
        "Resuma informacoes externas de forma objetiva e atual. Cite limites de confianca quando necessario."
    };

    await observer?.report("Resumindo conteudo coletado");
    const result = await this.args.executorRouter.execute(request);

    const summary = result.replyText?.trim() || fallbackSummary(searchResults);
    return {
      text: `🌐 Resultado:\n\n${summary}\n\nFontes:\n${buildSources(searchResults)}`,
      sources: searchResults
    };
  }
}
