import type { ExecutionRequest, ExecutionResult, Executor } from "../shared/types.js";
import { logger } from "../shared/logger.js";
import { PromptBuilder } from "./prompt-builder.js";
import type { LLMProvider } from "./providers/llm-provider.js";

import { detectActionIntent } from "./action-intent-detector.js";

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
  private readonly promptBuilder = new PromptBuilder();

  public constructor(args: LlmExecutorArgs) {
    this.model = args.model;
    this.fallbackModel = args.fallbackModel?.trim() || undefined;
    this.primaryProvider = args.primaryProvider;
    this.fallbackProvider = args.fallbackProvider;
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const prompt = this.promptBuilder.build(request);
    logger.info("llm_prompt_built", {
      module: "LlmExecutor",
      action: "execute",
      model: this.model,
      inputPreview: request.userMessage.slice(0, 120),
      promptLength: prompt.length,
      error: null
    });
    const candidates: Array<{ provider: LLMProvider; model: string; isFallback: boolean }> = [];

    if (this.primaryProvider.isConfigured()) {
      candidates.push({ provider: this.primaryProvider, model: this.model, isFallback: false });
    }

    if (this.fallbackModel && this.fallbackModel !== this.model && this.primaryProvider.isConfigured()) {
      candidates.push({
        provider: this.primaryProvider,
        model: this.fallbackModel,
        isFallback: true
      });
    }

    if (this.fallbackProvider && this.fallbackProvider.name !== this.primaryProvider.name && this.fallbackProvider.isConfigured()) {
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

    if (candidates.length === 0) {
      return {
        replyText: "Nenhum provedor de IA configurado corretamente no sistema. Verifique suas chaves de API.",
        shouldPersistMemory: false,
        shouldCreateNote: false
      };
    }

    for (const candidate of candidates) {
      const startedAt = Date.now();
      try {
        let result = await candidate.provider.generateResponse({
          request,
          prompt,
          model: candidate.model
        });

        // --- ENFORCEMENT DE TOOL USE ---
        const intent = detectActionIntent(result.replyText);
        const missingTool = intent.hasIntent && (!result.toolCalls || result.toolCalls.length === 0);

        if (missingTool) {
          logger.warn("tool_enforcement_triggered", {
            module: "LlmExecutor",
            action: "execute",
            intentType: intent.type,
            textPreview: result.replyText.slice(0, 100)
          });

          // Retry único com instrução de choque
          result = await candidate.provider.generateResponse({
            request: {
              ...request,
              userMessage: `${request.userMessage}\n\n[ERRO DE EXECUÇÃO]: Você disse que iria agir mas não usou ferramentas. NÃO descreva ações em texto. Use o campo 'toolCalls' agora para executar o que prometeu.`
            },
            prompt,
            model: candidate.model
          });
        }

        const candidateContext = {
          module: "LlmExecutor",
          action: "provider_response",
          provider: candidate.provider.name,
          model: candidate.model,
          usedFallback: candidate.isFallback,
          latencyMs: Date.now() - startedAt,
          error: null
        };
        if (candidate.isFallback) {
          logger.warn("provider_used", {
            ...candidateContext,
            fallback_from: `${this.primaryProvider.name}:${this.model}`
          });
        } else {
          logger.info("provider_used", candidateContext);
        }
        logger.info("provider_latency", candidateContext);

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
          module: "LlmExecutor",
          action: "execute",
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

}
