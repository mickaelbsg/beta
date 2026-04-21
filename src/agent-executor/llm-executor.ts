import type { ExecutionRequest, ExecutionResult, Executor } from "../shared/types.js";
import { logger } from "../shared/logger.js";
import { PromptBuilder } from "./prompt-builder.js";
import type { LLMProvider } from "./providers/llm-provider.js";
import { OpenAIProvider } from "./providers/openai-provider.js";
import { OmniRouteProvider } from "./providers/omniroute-provider.js";
import { DynamicConfigService } from "../config/dynamic-config-service.js";

import { detectActionIntent } from "./action-intent-detector.js";

export class LlmExecutor implements Executor {
  private readonly promptBuilder = new PromptBuilder();
  private providersCache: Map<string, LLMProvider> = new Map();

  public constructor(private readonly configService: DynamicConfigService) {
    // Limpa cache se a config mudar
    this.configService.onChange(() => {
      this.providersCache.clear();
      logger.info("llm_executor_cache_invalidated", { reason: "config_change" });
    });
  }

  private getProvider(providerId: string): LLMProvider | undefined {
    const cached = this.providersCache.get(providerId);
    if (cached) return cached;

    const config = this.configService.getConfig();
    const providerConfig = config.providers.find(p => p.id === providerId);
    if (!providerConfig || !providerConfig.enabled) return undefined;

    let provider: LLMProvider;
    if (providerConfig.type === "openai") {
      provider = new OpenAIProvider(providerConfig.apiKey);
    } else if (providerConfig.type === "omniroute") {
      provider = new OmniRouteProvider(providerConfig.baseUrl || "http://localhost:20128/v1", providerConfig.apiKey);
    } else {
      return undefined;
    }

    this.providersCache.set(providerId, provider);
    return provider;
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const config = this.configService.getConfig();
    const sortedModels = [...config.models].sort((a, b) => a.priority - b.priority);

    const prompt = this.promptBuilder.build(request);
    logger.info("llm_prompt_built", {
      module: "LlmExecutor",
      action: "execute",
      inputPreview: request.userMessage.slice(0, 120),
      promptLength: prompt.length,
      error: null
    });

    const candidates: Array<{ provider: LLMProvider; model: string; isFallback: boolean }> = [];

    for (const modelConfig of sortedModels) {
      const provider = this.getProvider(modelConfig.providerId);
      if (provider && provider.isConfigured()) {
        candidates.push({
          provider,
          model: modelConfig.name,
          isFallback: modelConfig.isFallback
        });
      }
    }

    if (candidates.length === 0) {
      return {
        replyText: "Nenhum provedor de IA configurado ou habilitado corretamente no sistema Dashboard.",
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

        /* --- ENFORCEMENT DE TOOL USE DESATIVADO TEMPORARIAMENTE --- */

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
            ...candidateContext
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
      replyText: "Falha temporaria em todos os modelos configurados no Dashboard. Pode repetir em uma frase curta?",
      shouldPersistMemory: false,
      shouldCreateNote: false
    };
  }
}
