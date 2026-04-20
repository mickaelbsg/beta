import type { ExecutionRequest, ExecutionResult, Executor } from "../shared/types.js";
import { logger } from "../shared/logger.js";
import { commandDefinitions } from "../command-router/command-definitions.js";
import type { LLMProvider } from "./providers/llm-provider.js";

interface LlmExecutorArgs {
  model: string;
  fallbackModel?: string;
  primaryProvider: LLMProvider;
  fallbackProvider?: LLMProvider;
}

export class LlmExecutor implements Executor {
  private readonly model: string;
  private readonly fallbackModel?: string;
  private readonly primaryProvider: LLMProvider;
  private readonly fallbackProvider?: LLMProvider;

  public constructor(args: LlmExecutorArgs) {
    this.model = args.model;
    this.fallbackModel = args.fallbackModel?.trim() || undefined;
    this.primaryProvider = args.primaryProvider;
    this.fallbackProvider = args.fallbackProvider;
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const prompt = this.buildPrompt(request);
    const candidates: Array<{ provider: LLMProvider; model: string; isFallback: boolean }> = [
      { provider: this.primaryProvider, model: this.model, isFallback: false }
    ];

    if (this.fallbackModel && this.fallbackModel !== this.model) {
      candidates.push({
        provider: this.primaryProvider,
        model: this.fallbackModel,
        isFallback: true
      });
    }

    if (this.fallbackProvider && this.fallbackProvider.name !== this.primaryProvider.name) {
      candidates.push({
        provider: this.fallbackProvider,
        model: this.model,
        isFallback: true
      });
      if (this.fallbackModel && this.fallbackModel !== this.model) {
        candidates.push({
          provider: this.fallbackProvider,
          model: this.fallbackModel,
          isFallback: true
        });
      }
    }

    for (const candidate of candidates) {
      const startedAt = Date.now();
      try {
        const result = await candidate.provider.generateResponse({
          request,
          prompt,
          model: candidate.model
        });

        if (candidate.isFallback) {
          logger.warn("provider_used", {
            provider: candidate.provider.name,
            model: candidate.model,
            fallback_from: `${this.primaryProvider.name}:${this.model}`
          });
        } else {
          logger.info("provider_used", {
            provider: candidate.provider.name,
            model: candidate.model
          });
        }
        logger.info("provider_latency", {
          provider: candidate.provider.name,
          model: candidate.model,
          ms: Date.now() - startedAt
        });

        return {
          ...result,
          debug: {
            provider: candidate.provider.name,
            model: candidate.model,
            latencyMs: Date.now() - startedAt,
            usedFallback: candidate.isFallback
          }
        };
      } catch (error) {
        logger.error("provider_error", {
          provider: candidate.provider.name,
          model: candidate.model,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      replyText: "Falha temporaria no modelo. Pode repetir em uma frase curta?",
      shouldPersistMemory: false,
      shouldCreateNote: false
    };
  }

  private buildPrompt(request: ExecutionRequest): string {
    const history = request.recentHistory.map((m) => `- [${m.role}] ${m.content}`).join("\n");
    const memories = request.retrievedMemories.map((m) => `- ${m.text}`).join("\n");
    const webSearch = request.toolHints?.webSearchResults
      ?.map((r) => `${r.title} | ${r.url} | ${r.snippet}`)
      .join("\n");
    const searchPolicy =
      request.intent === "SEARCH"
        ? [
            "SEARCH POLICY:",
            "- web_search usage is mandatory for SEARCH intent.",
            "- If no results are available, say that no relevant results were found right now.",
            "- Never claim that you cannot access the web."
          ].join("\n")
        : "";
    const availableTools =
      request.availableTools?.map((tool) => {
        const input = tool.inputSchema
          ? ` input: { ${Object.entries(tool.inputSchema)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")} }`
          : "";
        const when = tool.whenToUse?.length ? ` when: ${tool.whenToUse.join("; ")}` : "";
        return `- ${tool.name} -> ${tool.description}${input}${when}`;
      }).join("\n") ||
      "- web_search -> use for real-time or unknown information";

    const localCommandList = commandDefinitions
      .map((command) => `- ${command.name}: ${command.description}`)
      .join("\n");

    return [
      "### SYSTEM RULES",
      request.systemRules,
      "",
      "PRIORITY ORDER:",
      "1. Memory (RAG)",
      "2. Conversation history",
      "3. Current message",
      "",
      "### INTENT",
      request.intent,
      "",
      "### MEMORY (RAG)",
      memories || "- Sem memorias relevantes.",
      "",
      "### HISTORY",
      history || "- Sem historico relevante.",
      "",
      "### WEB SEARCH",
      webSearch || "- Sem resultados de busca.",
      "",
      "### AVAILABLE TOOLS",
      "You have access to:",
      availableTools,
      "",
      "### LOCAL COMMANDS",
      localCommandList,
      "",
      "Rules:",
      "- Always use tools when needed.",
      "- Never claim you cannot access the web.",
      "- Prefer tool output over guessing.",
      "",
      searchPolicy,
      "### USER INPUT",
      request.userMessage,
      "",
      "Responda objetivamente. Se nao houver dados suficientes, diga isso claramente."
    ].join("\n");
  }
}
