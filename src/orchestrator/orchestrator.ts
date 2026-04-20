import crypto from "node:crypto";
import type {
  ConversationMessage,
  HistoryRepository,
  InboundMessage,
  InteractionObserver,
  IntentClassifier,
  WebSearchService
} from "../shared/types.js";
import { RagService } from "../rag-service/rag-service.js";
import { ObsidianService } from "../obsidian-service/obsidian-service.js";
import { logger } from "../shared/logger.js";
import { ContextBuilder } from "./context-builder.js";
import { MemoryScorer } from "./memory-scorer.js";
import { ExecutorRouter } from "./executor-router.js";
import { RuntimeConfigService } from "../config/runtime-config-service.js";
import { ExecutionInsightsStore } from "./execution-insights-store.js";
import { SoulPromptService } from "../prompt/soul-prompt-service.js";
import { PendingMemoryConfirmationService } from "./pending-memory-confirmation-service.js";
import { WebAgentService } from "../web-search/web-agent-service.js";
import { ToolAwarenessService } from "../tools/tool-awareness-service.js";
import { DebugModeService } from "../debug/debug-mode-service.js";
import { SelfOptimizationService } from "../optimization/self-optimization-service.js";
import type { AgentLogEntryV2 } from "../optimization/agent-log-service.js";
import { UserProfileService } from "../optimization/user-profile-service.js";

interface OrchestratorDeps {
  historyRepository: HistoryRepository;
  ragService: RagService;
  obsidianService: ObsidianService;
  intentClassifier: IntentClassifier;
  executorRouter: ExecutorRouter;
  webSearchService: WebSearchService;
  ragTopK: number;
  memorySaveThreshold: number;
  runtimeConfigService: RuntimeConfigService;
  executionInsightsStore: ExecutionInsightsStore;
  soulPromptService: SoulPromptService;
  pendingMemoryConfirmationService: PendingMemoryConfirmationService;
  webAgentService?: WebAgentService;
  toolAwarenessService: ToolAwarenessService;
  debugModeService: DebugModeService;
  selfOptimizationService: SelfOptimizationService;
  userProfileService: UserProfileService;
}

export interface OrchestratorResponse {
  text: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function summarizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, 80) || "Nota";
}

function extractNoteContent(input: string): string {
  return input
    .replace(/^anota(r)?\s+/i, "")
    .replace(/^salva(r)?\s+/i, "")
    .replace(/^lembra(r)?\s+(de\s+)?/i, "")
    .trim();
}

function buildIntentInstruction(intent: string): string {
  if (intent === "NOTE") {
    return "Confirme a anotacao de forma curta.";
  }
  if (intent === "QUERY") {
    return "Responda com base em memoria e historico relevantes.";
  }
  if (intent === "STUDY") {
    return "Explique em partes, com foco pratico e objetivo.";
  }
  if (intent === "SEARCH") {
    return "Sintetize os resultados de busca de forma util.";
  }
  return "Responda de forma simples e util.";
}

function normalizeChoice(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isMemoryLocationQuestion(input: string): boolean {
  const normalized = normalizeChoice(input);
  const hasWhere = normalized.includes("onde") || normalized.includes("local");
  const hasMemoryTerm =
    normalized.includes("memoria") ||
    normalized.includes("anotac") ||
    normalized.includes("obsidian") ||
    normalized.includes("wiki") ||
    normalized.includes("vault");
  return hasWhere && hasMemoryTerm;
}

function formatMemorySavedFeedback(text: string, shortId: string): string {
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 140);
  return ['💾 Memoria salva:', '', `"${preview}"`, '', `ID: ${shortId}`].join("\n");
}

async function safeAppendLog(
  selfOptimizationService: SelfOptimizationService,
  entry: AgentLogEntryV2
): Promise<void> {
  try {
    await selfOptimizationService.appendAgentLog(entry);
  } catch (error) {
    logger.warn("agent_log_append_failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

interface OrchestratorDebugContext {
  intent: string;
  confidence: number;
  ragFound: number;
  ragUsed: number;
  ragFiltered: number;
  historyUsed: number;
  historyCompressionRatio: number;
  contextEstimatedTokens: number;
  toolsAvailable: string[];
  toolsUsed: string[];
  executor: string;
  provider: string;
  model: string;
  providerLatencyMs: number;
  memoryScore?: number;
  memorySaved: boolean;
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function formatDebugModeBlock(ctx: OrchestratorDebugContext): string {
  const toolsAvailable = ctx.toolsAvailable.length ? ctx.toolsAvailable.join(", ") : "nenhuma";
  const toolsUsed = ctx.toolsUsed.length ? ctx.toolsUsed.join(", ") : "nenhuma";
  const confidence = Number.isFinite(ctx.confidence) ? ctx.confidence.toFixed(2) : "n/a";
  const memoryScore = typeof ctx.memoryScore === "number" ? ctx.memoryScore.toFixed(2) : "n/a";
  const compression = Number.isFinite(ctx.historyCompressionRatio)
    ? `${Math.round(ctx.historyCompressionRatio * 100)}%`
    : "n/a";

  return [
    "🧠 DEBUG MODE",
    "",
    `Intent: ${ctx.intent} (confidence ${confidence})`,
    `RAG: found ${ctx.ragFound} | used ${ctx.ragUsed} | filtered ${ctx.ragFiltered}`,
    `Contexto: ~${ctx.contextEstimatedTokens} tokens | compressao historico ${compression}`,
    `Historico usado: ${ctx.historyUsed} mensagens`,
    `Tools disponiveis: ${toolsAvailable}`,
    `Tools usadas: ${toolsUsed}`,
    `Executor: ${ctx.executor} | provider ${ctx.provider} | model ${ctx.model} | latency ${ctx.providerLatencyMs}ms`,
    `Memoria: score ${memoryScore} | salva ${ctx.memorySaved ? "sim" : "nao"}`
  ].join("\n");
}

export class Orchestrator {
  private readonly contextBuilder = new ContextBuilder();
  private readonly memoryScorer = new MemoryScorer();

  public constructor(private readonly deps: OrchestratorDeps) {}

  public async handleMessage(
    message: InboundMessage,
    observer?: InteractionObserver
  ): Promise<OrchestratorResponse> {
    const startedAt = Date.now();
    const sessionId = `${message.chatId}:${new Date().toISOString().slice(0, 10)}`;
    let pipelineError: string | undefined;
    const debugEnabled = this.deps.debugModeService.isEnabled(message.userId);
    const debugContext: OrchestratorDebugContext = {
      intent: "UNCLASSIFIED",
      confidence: 0,
      ragFound: 0,
      ragUsed: 0,
      ragFiltered: 0,
      historyUsed: 0,
      historyCompressionRatio: 1,
      contextEstimatedTokens: 0,
      toolsAvailable: [],
      toolsUsed: [],
      executor: "llm",
      provider: "n/a",
      model: "n/a",
      providerLatencyMs: 0,
      memorySaved: false
    };
    const choice = normalizeChoice(message.text);
    const pending = this.deps.pendingMemoryConfirmationService.get(message.chatId);
    if (pending && (choice === "sim" || choice === "s" || choice === "nao" || choice === "não" || choice === "n")) {
      this.deps.pendingMemoryConfirmationService.clear(message.chatId);
      if (choice === "sim" || choice === "s") {
        const saved = await this.deps.ragService.saveMemory({
          text: pending.text,
          source: "chat",
          chatId: message.chatId,
          metadata: {
            chatId: message.chatId,
            memoryScore: pending.score,
            memoryType: pending.memoryType,
            ...(pending.metadata ?? {})
          }
        });
        const shortId = String(saved?.metadata?.shortId ?? "n/a");
        const baseText = formatMemorySavedFeedback(pending.text, shortId);
        debugContext.intent = "MEMORY_CONFIRMATION";
        debugContext.memorySaved = true;
        debugContext.memoryScore = pending.score;
        await safeAppendLog(this.deps.selfOptimizationService, {
          timestamp: new Date().toISOString(),
          session_id: sessionId,
          user_id: message.userId,
          intent: "MEMORY_CONFIRMATION",
          latency_ms: Date.now() - startedAt,
          input_length: message.text.length,
          output_length: baseText.length,
          rag: { found: 0, used: 0, filtered: 0 },
          memory: { score: pending.score, saved: true },
          tools: { available: [], used: ["save_memory"], latency_ms: 0, success: true },
          executor: { provider: "none", model: "none", latency_ms: 0 },
          errors: null
        });
        return {
          text: debugEnabled ? `${baseText}\n\n${formatDebugModeBlock(debugContext)}` : baseText
        };
      }
      const declined = "Beleza, nao vou salvar isso na memoria.";
      debugContext.intent = "MEMORY_CONFIRMATION";
      debugContext.memorySaved = false;
      debugContext.memoryScore = pending.score;
      await safeAppendLog(this.deps.selfOptimizationService, {
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        user_id: message.userId,
        intent: "MEMORY_CONFIRMATION",
        latency_ms: Date.now() - startedAt,
        input_length: message.text.length,
        output_length: declined.length,
        rag: { found: 0, used: 0, filtered: 0 },
        memory: { score: pending.score, saved: false },
        tools: { available: [], used: [], latency_ms: 0, success: true },
        executor: { provider: "none", model: "none", latency_ms: 0 },
        errors: null
      });
      return {
        text: debugEnabled ? `${declined}\n\n${formatDebugModeBlock(debugContext)}` : declined
      };
    }

    await observer?.report("Analisando mensagem recebida");
    const userMessage: ConversationMessage = {
      id: message.messageId,
      chatId: message.chatId,
      role: "user",
      content: message.text,
      timestamp: message.timestamp,
      intent: "UNCLASSIFIED"
    };
    await this.deps.historyRepository.saveMessage(userMessage);
    await observer?.report("Mensagem salva no historico");

    if (isMemoryLocationQuestion(message.text)) {
      const vault = await this.deps.obsidianService.getVaultStatus();
      const directText = vault.exists
        ? `Caminho configurado do Obsidian: ${vault.path}`
        : `Caminho configurado do Obsidian: ${vault.path}\nAviso: essa pasta ainda nao existe no sistema.`;
      const assistantMessage: ConversationMessage = {
        id: generateId("assistant"),
        chatId: message.chatId,
        role: "assistant",
        content: directText,
        timestamp: new Date().toISOString(),
        intent: "QUERY"
      };
      await this.deps.historyRepository.saveMessage(assistantMessage);
      await safeAppendLog(this.deps.selfOptimizationService, {
        timestamp: new Date().toISOString(),
        session_id: `${message.chatId}:${new Date().toISOString().slice(0, 10)}`,
        user_id: message.userId,
        intent: "QUERY",
        latency_ms: Date.now() - startedAt,
        input_length: message.text.length,
        output_length: directText.length,
        rag: { found: 0, used: 0, filtered: 0 },
        memory: { score: 0, saved: false },
        tools: { available: [], used: [], latency_ms: 0, success: true },
        executor: { provider: "deterministic", model: "n/a", latency_ms: 0 },
        errors: null
      });
      return { text: directText };
    }

    const classification = await this.deps.intentClassifier.detect(message.text);
    await observer?.report(`Intent detectada: ${classification.intent}`);
    debugContext.intent = classification.intent;
    debugContext.confidence = classification.confidence;
    logger.info("intent_detected", {
      chatId: message.chatId,
      intent: classification.intent,
      confidence: classification.confidence,
      source: classification.source
    });

    const rawHistory = await this.deps.historyRepository.getRecentMessages(message.chatId, 12);
    const historyLimit = Math.min(
      Math.max(this.deps.runtimeConfigService.getNumber("context_history_limit", 5), 3),
      8
    );
    const compressedHistory = this.contextBuilder.buildHistory(rawHistory, message.text, historyLimit);
    debugContext.historyUsed = compressedHistory.length;
    const rawHistoryChars = rawHistory.reduce((sum, item) => sum + item.content.length, 0);
    const compressedHistoryChars = compressedHistory.reduce((sum, item) => sum + item.content.length, 0);
    debugContext.historyCompressionRatio =
      rawHistoryChars > 0 ? compressedHistoryChars / rawHistoryChars : 1;
    await observer?.report("Historico relevante comprimido");

    const ragTopK = this.deps.runtimeConfigService.getNumber("rag_top_k", this.deps.ragTopK);
    if (classification.intent === "QUERY" || classification.intent === "NOTE") {
      await observer?.report(`Consultando memoria vetorial (top-k=${ragTopK})`);
    }
    const retrievedMemories =
      classification.intent === "QUERY" || classification.intent === "NOTE"
        ? await this.deps.ragService.retrieveRelevantMemories(message.text, ragTopK)
        : [];
    const compactMemories = this.contextBuilder.buildMemoryFacts(retrievedMemories, 5);
    debugContext.ragFound = retrievedMemories.length;
    debugContext.ragUsed = compactMemories.length;
    debugContext.ragFiltered = Math.max(0, retrievedMemories.length - compactMemories.length);
    debugContext.toolsUsed =
      classification.intent === "QUERY" || classification.intent === "NOTE" ? ["search_memory"] : [];

    logger.info("rag_results_count", {
      chatId: message.chatId,
      count: classification.intent === "QUERY" || classification.intent === "NOTE" ? retrievedMemories.length : 0
    });
    logger.info("rag_filtered_count", {
      chatId: message.chatId,
      count: compactMemories.length
    });

    let webSearchResults: Awaited<ReturnType<WebSearchService["search"]>> = [];
    let webAgentText: string | null = null;
    if (classification.intent === "SEARCH") {
      if (this.deps.webAgentService) {
        try {
          const webAgent = await this.deps.webAgentService.run(
            {
              query: message.text,
              preferredExecutor:
                this.deps.runtimeConfigService.get("executor") === "opencode" ? "opencode" : "llm"
            },
            observer
          );
          webAgentText = webAgent.text;
          webSearchResults = webAgent.sources;
        } catch {
          await observer?.report("Web Agent falhou, aplicando fallback de busca");
          pipelineError = "web_agent_failed";
        }
      }

      if (!webSearchResults.length) {
        try {
          await observer?.report("Executando busca na web");
          webSearchResults = await this.deps.webSearchService.search(message.text);
        } catch {
          await observer?.report("Busca web falhou, seguindo sem resultados");
          webSearchResults = [];
          pipelineError = "web_search_failed";
        }
      }
      if (!webSearchResults.length && pipelineError === "web_search_failed") {
        webAgentText =
          "🌐 Resultado:\n\nBusca web indisponivel no momento. Nao consegui acessar resultados externos agora.\n\nFontes:\n- Nenhuma";
      }
    }

    const preferredExecutor: "llm" | "opencode" =
      this.deps.runtimeConfigService.get("executor") === "opencode" ? "opencode" : "llm";
    const soulPrompt = await this.deps.soulPromptService.buildSystemPrompt(classification.intent);
    const availableTools = await this.deps.toolAwarenessService.listTools();
    debugContext.toolsAvailable = availableTools.map((item) => item.name);
    const forceToolRule =
      classification.intent === "SEARCH"
        ? "\nFORCE TOOL: Use web_search results for this response. Do not answer from guesswork."
        : "";
    const responseStyle = this.deps.userProfileService.getResponseStyle(message.userId);
    const profileInstruction =
      responseStyle === "detailed"
        ? "\nResposta em modo detalhado, com contexto e exemplos curtos."
        : "\nResposta em modo curto, direta e objetiva.";
    const executionRequest = {
      intent: classification.intent,
      userMessage: message.text,
      recentHistory: compressedHistory,
      retrievedMemories: compactMemories,
      preferredExecutor,
      availableTools,
      systemRules: `${soulPrompt}\n${buildIntentInstruction(classification.intent)}${forceToolRule}${profileInstruction}\nObsidian vault path configured: ${this.deps.obsidianService.getVaultPath()}.`,
      toolHints: {
        webSearchResults
      }
    };

    const selection = this.deps.executorRouter.pick(executionRequest);
    debugContext.executor = selection.executorUsed;
    await observer?.report(
      `Executando resposta via ${selection.executorUsed.toUpperCase()}`
    );
    logger.info("executor_used", {
      chatId: message.chatId,
      executor_used: selection.executorUsed,
      reason: selection.reason
    });

    let executionResult;
    try {
      executionResult = webAgentText
        ? {
            replyText: webAgentText,
            shouldPersistMemory: false,
            shouldCreateNote: false
          }
        : await this.deps.executorRouter.execute(executionRequest);
    } catch {
      await observer?.report("Executor falhou, aplicando fallback seguro");
      pipelineError = "executor_failed";
      executionResult = {
        replyText: "Nao consegui responder com confianca agora. Pode reformular em uma frase curta?",
        shouldPersistMemory: false,
        shouldCreateNote: false
      };
    }
    debugContext.provider = executionResult.debug?.provider ?? selection.executorUsed;
    debugContext.model = executionResult.debug?.model ?? "n/a";
    debugContext.providerLatencyMs = executionResult.debug?.latencyMs ?? 0;

    let finalText = executionResult.replyText;
    let memorySaved = false;
    let savedMemoryId = "";
    let savedMemoryText = "";
    if (classification.intent === "NOTE") {
      await observer?.report("Criando nota no Obsidian");
      const fallbackContent = extractNoteContent(message.text) || message.text;
      const noteTitle = executionResult.noteTitle ?? summarizeText(fallbackContent);
      const noteContent = executionResult.noteContent ?? fallbackContent;
      const note = await this.deps.obsidianService.createNote({
        title: noteTitle,
        content: noteContent
      });
      await observer?.report("Salvando nota na memoria vetorial");
      const saved = await this.deps.ragService.saveMemory({
        text: noteContent,
        source: "obsidian",
        chatId: message.chatId,
        metadata: {
          notePath: note.filePath,
          chatId: message.chatId,
          memoryType: "note",
          memoryScore: 1
        }
      });
      memorySaved = Boolean(saved);
      debugContext.memoryScore = 1;
      savedMemoryId = String(saved?.metadata?.shortId ?? "");
      savedMemoryText = noteContent;
      finalText = note.duplicated
        ? `Nota ja existente em ${note.filePath}.`
        : executionResult.replyText || `Nota criada em ${note.filePath}.`;
      debugContext.toolsUsed = [...new Set([...debugContext.toolsUsed, "create_note", "save_memory"])];
    } else {
      const candidate = executionResult.memoryText ?? message.text;
      const scored = this.memoryScorer.score(candidate);
      debugContext.memoryScore = scored.score;
      const shouldAutoSave = executionResult.shouldPersistMemory && scored.score >= this.deps.memorySaveThreshold;
      const borderline =
        executionResult.shouldPersistMemory &&
        scored.score >= 0.6 &&
        scored.score < this.deps.memorySaveThreshold;
      if (shouldAutoSave) {
        await observer?.report("Salvando memoria relevante");
        const saved = await this.deps.ragService.saveMemory({
          text: candidate,
          source: "chat",
          chatId: message.chatId,
          metadata: {
            chatId: message.chatId,
            memoryScore: scored.score,
            memoryCategory: scored.category,
            memoryType: scored.memoryType
          }
        });
        memorySaved = Boolean(saved);
        savedMemoryId = String(saved?.metadata?.shortId ?? "");
        savedMemoryText = candidate;
        debugContext.toolsUsed = [...new Set([...debugContext.toolsUsed, "save_memory"])];
      } else if (borderline) {
        this.deps.pendingMemoryConfirmationService.set(message.chatId, {
          text: candidate,
          score: scored.score,
          memoryType: scored.memoryType,
          metadata: {
            memoryCategory: scored.category
          }
        });
        finalText = `Isso parece importante (score ${scored.score.toFixed(2)}). Deseja salvar?\nResponda: sim ou nao`;
      }
    }
    logger.info("memory_saved", {
      chatId: message.chatId,
      memory_saved: memorySaved
    });

    if (memorySaved && savedMemoryId) {
      finalText = `${finalText}\n\n${formatMemorySavedFeedback(savedMemoryText || finalText, savedMemoryId)}`;
    }
    debugContext.memorySaved = memorySaved;
    if ((classification.intent === "SEARCH" && webSearchResults.length > 0) || webAgentText) {
      debugContext.toolsUsed = [...new Set([...debugContext.toolsUsed, "web_search"])];
    }
    const contextText =
      executionRequest.systemRules +
      executionRequest.userMessage +
      executionRequest.recentHistory.map((item) => item.content).join("\n") +
      executionRequest.retrievedMemories.map((item) => item.text).join("\n") +
      (executionRequest.toolHints?.webSearchResults ?? [])
        .map((item) => `${item.title} ${item.snippet}`)
        .join("\n");
    debugContext.contextEstimatedTokens = estimateTokens(contextText);
    if (debugEnabled) {
      finalText = `${finalText}\n\n${formatDebugModeBlock(debugContext)}`;
    }

    const assistantMessage: ConversationMessage = {
      id: generateId("assistant"),
      chatId: message.chatId,
      role: "assistant",
      content: finalText,
      timestamp: new Date().toISOString(),
      intent: classification.intent
    };
    await this.deps.historyRepository.saveMessage(assistantMessage);
    await observer?.report("Resposta final enviada");

    logger.info("execution_time", {
      chatId: message.chatId,
      ms: Date.now() - startedAt
    });

    this.deps.executionInsightsStore.record({
      timestamp: new Date().toISOString(),
      intent: classification.intent,
      memoriesUsed: compactMemories.length,
      memorySaved,
      executor: selection.executorUsed,
      elapsedMs: Date.now() - startedAt
    });
    const toolLatency = webSearchResults.length > 0 ? this.deps.runtimeConfigService.getNumber("web_search_timeout_ms", 0) : 0;
    await safeAppendLog(this.deps.selfOptimizationService, {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      user_id: message.userId,
      intent: classification.intent,
      latency_ms: Date.now() - startedAt,
      input_length: message.text.length,
      output_length: finalText.length,
      rag: {
        found: retrievedMemories.length,
        used: compactMemories.length,
        filtered: Math.max(0, retrievedMemories.length - compactMemories.length)
      },
      memory: {
        score: debugContext.memoryScore ?? 0,
        saved: memorySaved
      },
      tools: {
        available: availableTools.map((item) => item.name),
        used: debugContext.toolsUsed,
        latency_ms: toolLatency,
        success: !pipelineError
      },
      executor: {
        provider: debugContext.provider,
        model: debugContext.model,
        latency_ms: debugContext.providerLatencyMs
      },
      errors: pipelineError ?? null
    });

    return { text: finalText };
  }
}
