import crypto from "node:crypto";
import type {
  ConversationMessage,
  ExecutionResult,
  HistoryRepository,
  InboundMessage,
  InteractionObserver,
  IntentClassifier,
  WebSearchService
} from "../shared/types.js";
import { RagService } from "../rag-service/rag-service.js";
import path from "node:path";
import { ObsidianService } from "../obsidian-service/obsidian-service.js";
import { ObsidianWriterService } from "../obsidian-service/obsidian-writer-service.js";
import { ConversationMemoryService } from "./conversation-memory-service.js";
import { logger } from "../shared/logger.js";
import { ContextBuilder } from "./context-builder.js";
import { ExecutorRouter } from "./executor-router.js";
import { ToolExecutor } from "./tool-executor.js";
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
import { decideAction } from "./action-decider.js";
import { RuleBasedIntentClassifier } from "./rule-based-intent-classifier.js";

interface OrchestratorDeps {
  historyRepository: HistoryRepository;
  ragService: RagService;
  obsidianService: ObsidianService;
  obsidianWriterService?: ObsidianWriterService;
  conversationMemoryService: ConversationMemoryService;
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

function buildIntentInstruction(intent: string): string {
  if (intent === "NOTE") return "Confirme a anotacao de forma curta.";
  if (intent === "QUERY") return "Responda com base em memoria e historico relevantes.";
  if (intent === "STUDY") return "Explique em partes, com foco pratico e objetivo.";
  if (intent === "SEARCH") return "Sintetize os resultados de busca de forma util.";
  return "Responda de forma simples e util.";
}

function normalizeChoice(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function isMemoryLocationQuestion(input: string): boolean {
  const normalized = normalizeChoice(input);
  return (normalized.includes("onde") || normalized.includes("local")) &&
         (normalized.includes("memoria") || normalized.includes("anotac") || normalized.includes("obsidian") || normalized.includes("wiki") || normalized.includes("vault"));
}

function formatMemorySavedFeedback(_text: string, _shortId: string): string {
  return '💾 Memória salva no Obsidian.';
}

async function safeAppendLog(selfOptimizationService: SelfOptimizationService, entry: AgentLogEntryV2): Promise<void> {
  try {
    await selfOptimizationService.appendAgentLog(entry);
  } catch (error) {
    logger.warn("agent_log_append_failed", { error: error instanceof Error ? error.message : String(error) });
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

function formatDebugModeBlock(ctx: OrchestratorDebugContext): string {
  return [
    "🧠 DEBUG MODE", "",
    `Intent: ${ctx.intent} (confidence ${ctx.confidence.toFixed(2)})`,
    `RAG: used ${ctx.ragUsed}`,
    `Contexto: ~${ctx.contextEstimatedTokens} tokens`,
    `Historico usado: ${ctx.historyUsed} mensagens`,
    `Tools disponiveis: ${ctx.toolsAvailable.join(", ")}`,
    `Tools usadas: ${ctx.toolsUsed.join(", ")}`,
    `Executor: ${ctx.executor} | provider ${ctx.provider} | model ${ctx.model} | latency ${ctx.providerLatencyMs}ms`,
    `Memoria: salva ${ctx.memorySaved ? "sim" : "nao"}`
  ].join("\n");
}

function sanitizeResponse(text: string): string {
  return text
    .replace(/vou (salvar|executar|rodar).*/gi, "")
    .replace(/já (salvei|executei).*/gi, "");
}

export class Orchestrator {
  private readonly contextBuilder = new ContextBuilder();
  private readonly toolExecutor: ToolExecutor;
  private readonly ruleClassifier = new RuleBasedIntentClassifier();

  public constructor(private readonly deps: OrchestratorDeps) {
    if (!deps.obsidianService) {
      throw new Error("Orchestrator requires obsidianService");
    }
    if (!deps.toolAwarenessService) {
      throw new Error("Orchestrator requires toolAwarenessService");
    }

    this.toolExecutor = new ToolExecutor({
      obsidianWriterService: deps.obsidianWriterService,
      webAgentService: deps.webAgentService
    });
  }

  public async handleMessage(message: InboundMessage, observer?: InteractionObserver): Promise<OrchestratorResponse> {
    const startedAt = Date.now();
    const sessionId = `${message.chatId}:${new Date().toISOString().slice(0, 10)}`;
    let pipelineError: string | undefined;
    const debugEnabled = this.deps.debugModeService.isEnabled(message.userId);
    const debugContext: OrchestratorDebugContext = {
      intent: "UNCLASSIFIED", confidence: 0, ragFound: 0, ragUsed: 0, ragFiltered: 0,
      historyUsed: 0, historyCompressionRatio: 1, contextEstimatedTokens: 0,
      toolsAvailable: [], toolsUsed: [], executor: "llm", provider: "n/a", model: "n/a",
      providerLatencyMs: 0, memorySaved: false
    };

    // 1. Persistência de histórico inicial
    const userMessage: ConversationMessage = {
      id: message.messageId, chatId: message.chatId, role: "user", content: message.text,
      timestamp: message.timestamp, intent: "UNCLASSIFIED"
    };
    await this.deps.historyRepository.saveMessage(userMessage);

    // 2. ACTION LAYER DETERMINÍSTICO (Sistema decide e executa ANTES da IA)
    const action = decideAction(message.text);
    let actionResult = "";
    if (action.type !== "NONE") {
      logger.info("orchestrator_action_detected", {
        chatId: message.chatId,
        action: action.type,
        payload: action.type === "RUN_COMMAND" ? action.command : action.type === "SEARCH" ? action.query : ("content" in action ? action.content : null)
      });
      await observer?.report(`Agindo: ${action.type}`);
      if (action.type === "SAVE_MEMORY") {
        const res = await this.deps.obsidianWriterService?.saveMemoryToObsidian({ chatId: message.chatId, content: action.content, source: "telegram" });
        actionResult = res ? `Memória salva no Obsidian: ${path.basename(res.filePath)}` : "Falha ao salvar memória";
      } else if (action.type === "CREATE_NOTE") {
        const note = await this.deps.obsidianService.createNote({ title: action.content.slice(0, 40), content: action.content });
        actionResult = `Nota criada no Obsidian: ${note.filePath}`;
      } else if (action.type === "RUN_COMMAND") {
        const runOutput = await this.toolExecutor.execute({ tool: "run", input: { command: action.command } }, message.chatId);
        actionResult = `Comando executado. Resultado:\n${runOutput}`;
      } else if (action.type === "SEARCH") {
        if (this.deps.webAgentService) {
          const webRes = await this.deps.webAgentService.run({ query: action.query, preferredExecutor: "llm" }, observer);
          actionResult = `Resultados da busca web:\n${webRes.text}`;
        } else {
          actionResult = "WebAgentService indisponível para busca.";
        }
      } else if (action.type === "GENERATE_DIARY") {
        const today = new Date().toISOString().slice(0, 10);
        const entries = await this.deps.historyRepository.getMessagesByDate(message.chatId, today).catch(() => []);
        actionResult = `Diário gerado para ${today}. Registradas ${entries.length} interações.`;
      } else if (action.type === "SHOW_CONFIG") {
        actionResult = `Configurações: ${JSON.stringify(this.deps.runtimeConfigService.list(), null, 2)}`;
      } else if (action.type === "SHOW_HELP") {
        actionResult = "Comandos: /run, /note, /search, /diary, /config, /help, /tools, /claude, /ask, /build";
      } else if (action.type === "SHOW_TOOLS") {
        const tools = await this.deps.toolAwarenessService.listTools();
        actionResult = `Ferramentas IA: ${tools.map(t => t.name).join(", ")}`;
      }
      debugContext.toolsUsed.push(action.type);
    }

    // 3. Memória de Curto Prazo (RAM)
    this.deps.conversationMemoryService.addMessage(message.chatId, { role: "user", content: message.text, timestamp: Date.now() });
    const history = this.deps.conversationMemoryService.getRecentMessages(message.chatId, 10);
    debugContext.historyUsed = history.length;

    // 4. Memória de Longo Prazo (Obsidian Context)
    const obsidianFacts = await this.deps.obsidianWriterService?.searchObsidian(message.text) ?? [];
    const compactMemories = obsidianFacts.map(f => ({ id: "obsidian", text: f, source: "obsidian" as const, timestamp: new Date().toISOString(), metadata: { obsidian: true } }));
    debugContext.ragUsed = compactMemories.length;

    // 5. Intent e Prompt
    // --- CLASSIFICAÇÃO DE INTENT (Prioridade: Regras > IA) ---
    const ruleIntent = this.ruleClassifier.detect(message.text);
    let classification;

    if (ruleIntent && ruleIntent.confidence >= 0.8) {
      classification = ruleIntent;
      logger.info("intent_rule_override", {
        chatId: message.chatId,
        intent: classification.intent,
        source: "rule_based"
      });
    } else {
      classification = await this.deps.intentClassifier.detect(message.text);
    }
    logger.info("intent_classified", {
      chatId: message.chatId,
      text: message.text,
      intent: classification.intent,
      confidence: classification.confidence,
      source: classification.source
    });
    debugContext.intent = classification.intent;
    debugContext.confidence = classification.confidence;
    const systemPrompt = await this.deps.soulPromptService.buildSystemPrompt(classification.intent);

    // 6. Execução LLM (Assistiva)
    const executionRequest = {
      intent: classification.intent, userMessage: message.text,
      recentHistory: history.map(item => ({ id: "", chatId: message.chatId, role: item.role, content: item.content, timestamp: new Date(item.timestamp).toISOString(), intent: "UNCLASSIFIED" as const })),
      retrievedMemories: compactMemories, availableTools: await this.deps.toolAwarenessService.listTools(),
      systemRules: `${systemPrompt}\n${buildIntentInstruction(classification.intent)}\nObsidian vault: ${this.deps.obsidianService.getVaultPath()}. ${actionResult ? `\n\nAção executada pelo sistema: ${actionResult}` : ''}`
    };

    const selection = this.deps.executorRouter.pick(executionRequest);
    debugContext.executor = selection.executorUsed;

    let executionResult: ExecutionResult;
    try {
      executionResult = await this.deps.executorRouter.execute(executionRequest);
    } catch {
      pipelineError = "executor_failed";
      executionResult = { replyText: "Nao consegui responder agora.", shouldPersistMemory: false, shouldCreateNote: false };
    }

    debugContext.provider = executionResult.debug?.provider ?? selection.executorUsed;
    debugContext.model = executionResult.debug?.model ?? "n/a";
    debugContext.providerLatencyMs = executionResult.debug?.latencyMs ?? 0;

    // 7. Resposta e Failsafe
    let finalText = sanitizeResponse(executionResult.replyText);

    // 8. Execução de Tools geradas pelo LLM
    if (executionResult.toolCalls && executionResult.toolCalls.length > 0) {
      for (const call of executionResult.toolCalls) {
        await observer?.report(`Executando ferramenta: ${call.tool}`);
        const res = await this.toolExecutor.execute(call, message.chatId);
        finalText += `\n\n⚙️ Resultado de ${call.tool}:\n${res}`;
      }
    }

    // 9. Actions suggested by the LLM via execution flags
    if (executionResult.shouldCreateNote && executionResult.noteTitle && executionResult.noteContent) {
      try {
        const note = await this.deps.obsidianService.createNote({
          title: executionResult.noteTitle,
          content: executionResult.noteContent
        });
        finalText += `\n\n💾 Nota criada: ${note.filePath}`;
      } catch (error) {
        finalText += `\n\n⚠️ Falha ao criar nota: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (executionResult.shouldPersistMemory && executionResult.memoryText) {
      if (this.deps.obsidianWriterService) {
        try {
          const saved = await this.deps.obsidianWriterService.saveMemoryToObsidian({
            chatId: message.chatId,
            content: executionResult.memoryText,
            source: "llm"
          });
          finalText += `\n\n💾 Memória salva: ${saved.filePath}`;
        } catch (error) {
          finalText += `\n\n⚠️ Falha ao salvar memória no Obsidian: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      try {
        const ragSaved = await this.deps.ragService.saveMemory({
          text: executionResult.memoryText,
          source: "chat",
          chatId: message.chatId
        });
        if (ragSaved) {
          finalText += `\n\n💾 Memória também registrada no RAG: ${ragSaved.id}`;
        }
      } catch (error) {
        finalText += `\n\n⚠️ Falha ao salvar memória no RAG: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    const assistantMessage: ConversationMessage = {
      id: generateId("assistant"), chatId: message.chatId, role: "assistant", content: finalText,
      timestamp: new Date().toISOString(), intent: classification.intent
    };
    await this.deps.historyRepository.saveMessage(assistantMessage);
    this.deps.conversationMemoryService.addMessage(message.chatId, { role: "assistant", content: finalText, timestamp: Date.now() });

    if (debugEnabled) return { text: `${finalText}\n\n${formatDebugModeBlock(debugContext)}` };
    return { text: finalText };
  }
}
