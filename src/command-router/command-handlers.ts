import type {
  CommandContext,
  HistoryRepository,
  InteractionObserver,
  SearchResult
} from "../shared/types.js";
import { RagService } from "../rag-service/rag-service.js";
import { ObsidianService } from "../obsidian-service/obsidian-service.js";
import { ExecutorRouter } from "../orchestrator/executor-router.js";
import type { WebSearchService } from "../shared/types.js";
import { RuntimeConfigService } from "../config/runtime-config-service.js";
import { ExecutionInsightsStore } from "../orchestrator/execution-insights-store.js";
import { ToolAwarenessService } from "../tools/tool-awareness-service.js";
import { DebugModeService } from "../debug/debug-mode-service.js";
import { SelfOptimizationService } from "../optimization/self-optimization-service.js";
import { FeedbackService } from "../optimization/feedback-service.js";
import { UserProfileService, type UserResponseStyle } from "../optimization/user-profile-service.js";
import { SoulPromptService } from "../prompt/soul-prompt-service.js";
import { FileSystemService } from "../filesystem/filesystem-service.js";
import { ShellSessionService } from "../shell/shell-session-service.js";
import {
  formatHelp,
  formatLogs,
  formatMemoryDetail,
  formatMemoryList,
  formatMemorySavedBlock,
  formatMemorySearch,
  formatToolsList
} from "./formatters.js";

interface CommandHandlerDeps {
  ragService: RagService;
  obsidianService: ObsidianService;
  webSearchService: WebSearchService;
  executorRouter: ExecutorRouter;
  runtimeConfigService: RuntimeConfigService;
  executionInsightsStore: ExecutionInsightsStore;
  soulPromptService: SoulPromptService;
  historyRepository: HistoryRepository;
  toolAwarenessService: ToolAwarenessService;
  debugModeService: DebugModeService;
  selfOptimizationService: SelfOptimizationService;
  feedbackService: FeedbackService;
  userProfileService: UserProfileService;
  fileSystemService: FileSystemService;
  shellSessionService: ShellSessionService;
}

// Runtime controls intentionally limited to keep behavior predictable.
const settableKeys = new Set([
  "rag_top_k",
  "executor",
  "memory_save_threshold",
  "rag_min_relevance_score",
  "context_history_limit"
]);

function summarizeSearch(items: SearchResult[]): string {
  if (!items.length) {
    return "Nenhum resultado encontrado no momento.";
  }
  return items
    .slice(0, 5)
    .map((item, idx) => `${idx + 1}. ${item.title}\n${item.snippet}\n${item.url}`)
    .join("\n\n");
}

export class CommandHandlers {
  public constructor(private readonly deps: CommandHandlerDeps) {}

  public async help(observer?: InteractionObserver): Promise<string> {
    await observer?.report("Executando comando /help");
    return formatHelp();
  }

  public async note(text: string, observer?: InteractionObserver): Promise<string> {
    if (!text) {
      return "Uso: /note <texto>";
    }
    await observer?.report("Criando nota no Obsidian");
    const title = text.slice(0, 60);
    const note = await this.deps.obsidianService.createNote({
      title,
      content: text
    });
    await observer?.report("Salvando conteudo da nota na memoria");
    const memory = await this.deps.ragService.saveMemory({
      text,
      source: "obsidian",
      metadata: {
        notePath: note.filePath,
        memoryType: "note"
      }
    });
    const memoryId = String(memory?.metadata?.shortId ?? "n/a");
    return note.duplicated
      ? `Nota ja existente: ${note.filePath}\n\n${formatMemorySavedBlock(text, memoryId)}`
      : `Nota criada: ${note.filePath}\n\n${formatMemorySavedBlock(text, memoryId)}`;
  }

  public async memories(arg = "", observer?: InteractionObserver): Promise<string> {
    await observer?.report("Listando memorias salvas");
    const parsedPage = Number(arg.trim() || "1");
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
    const pageSize = Math.min(Math.max(this.deps.runtimeConfigService.getNumber("rag_top_k", 10), 10), 20);
    const memories = await this.deps.ragService.listMemories(100);
    return formatMemoryList(memories, page, pageSize);
  }

  public async memoryQuery(query: string, observer?: InteractionObserver): Promise<string> {
    if (!query) {
      return "Uso: /memory <consulta>";
    }
    await observer?.report("Consultando memoria vetorial por query");
    const topK = this.deps.runtimeConfigService.getNumber("rag_top_k", 5);
    const memories = await this.deps.ragService.retrieveRelevantMemories(query, Math.min(topK, 10));
    return formatMemorySearch(memories);
  }

  public async memoryDetail(arg: string, observer?: InteractionObserver): Promise<string> {
    const shortId = arg.trim();
    if (!shortId) {
      return "Uso: /memory_detail <id>";
    }
    await observer?.report(`Consultando detalhes da memoria ${shortId}`);
    const memory = await this.deps.ragService.getMemoryByShortId(shortId);
    if (!memory) {
      return `Memoria ${shortId} nao encontrada.`;
    }
    return formatMemoryDetail(memory);
  }

  public async deleteMemory(arg: string, observer?: InteractionObserver): Promise<string> {
    const shortId = arg.trim();
    if (!shortId) {
      return "Uso: /delete_memory <id>";
    }
    await observer?.report(`Removendo memoria ${shortId}`);
    const deleted = await this.deps.ragService.deleteMemoryByShortId(shortId);
    return deleted ? `Memoria ${shortId} removida com sucesso.` : `Memoria ${shortId} nao encontrada.`;
  }

  public async logs(observer?: InteractionObserver): Promise<string> {
    await observer?.report("Consultando ultima execucao registrada");
    return formatLogs(this.deps.executionInsightsStore.getLatest());
  }

  public async config(observer?: InteractionObserver): Promise<string> {
    await observer?.report("Lendo configuracao em runtime");
    const config = this.deps.runtimeConfigService.list();
    const lines = Object.entries(config)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    return ["Configuracao atual:", ...lines].join("\n");
  }

  public async set(input: string, observer?: InteractionObserver): Promise<string> {
    const [rawKey, ...rest] = input.split("=");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join("=").trim();
    if (!key || !value) {
      return "Uso: /set <chave>=<valor>";
    }
    if (!settableKeys.has(key)) {
      return `Chave nao permitida. Permitidas: ${[...settableKeys].join(", ")}`;
    }
    if (key === "executor" && !["llm", "opencode"].includes(value)) {
      return "Valor invalido para executor. Use llm ou opencode.";
    }
    if (key === "context_history_limit") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 3 || parsed > 8) {
        return "Valor invalido para context_history_limit. Use inteiro entre 3 e 8.";
      }
    }
    await observer?.report(`Atualizando configuracao: ${key}`);
    await this.deps.runtimeConfigService.set(key, value);
    return `Configuracao atualizada: ${key}=${value}`;
  }

  public async search(query: string, observer?: InteractionObserver): Promise<string> {
    if (!query) {
      return "Uso: /search <consulta>";
    }
    await observer?.report("Executando busca na web");
    const startedAt = Date.now();
    let results: SearchResult[] = [];
    try {
      results = await this.deps.webSearchService.search(query);
    } catch {
      return "Busca web indisponivel no momento. Tente novamente em instantes.";
    }
    this.deps.executionInsightsStore.record({
      timestamp: new Date().toISOString(),
      intent: "SEARCH",
      memoriesUsed: 0,
      memorySaved: false,
      executor: "llm",
      elapsedMs: Date.now() - startedAt
    });
    return ["Resultados de busca:", "", summarizeSearch(results)].join("\n");
  }

  public async study(topic: string, observer?: InteractionObserver): Promise<string> {
    if (!topic) {
      return "Uso: /study <topico>";
    }
    const preferred: "llm" | "opencode" =
      this.deps.runtimeConfigService.get("executor") === "opencode" ? "opencode" : "llm";
    const request = {
      intent: "STUDY" as const,
      userMessage: `Explique de forma didatica e objetiva: ${topic}`,
      recentHistory: [],
      retrievedMemories: [],
      preferredExecutor: preferred,
      systemRules:
        "Resposta de estudo em formato claro e pratico. Sem inventar fatos. Se necessario, admita incerteza."
    };
    const startedAt = Date.now();
    const selection = this.deps.executorRouter.pick(request);
    await observer?.report(`Executando estudo via ${selection.executorUsed.toUpperCase()}`);
    const response = await this.deps.executorRouter.execute(request);
    this.deps.executionInsightsStore.record({
      timestamp: new Date().toISOString(),
      intent: "STUDY",
      memoriesUsed: 0,
      memorySaved: false,
      executor: selection.executorUsed,
      elapsedMs: Date.now() - startedAt
    });
    return response.replyText;
  }

  public async tools(observer?: InteractionObserver): Promise<string> {
    await observer?.report("Lendo tools disponiveis");
    const tools = await this.deps.toolAwarenessService.listTools();
    return formatToolsList(tools);
  }

  public async toolSearch(query: string, observer?: InteractionObserver): Promise<string> {
    const normalized = query.trim();
    if (!normalized) {
      return "Uso: /tool_search <termo>";
    }
    await observer?.report(`Buscando tools por termo: ${normalized}`);
    const tools = await this.deps.toolAwarenessService.searchTools(normalized);
    return formatToolsList(tools);
  }

  public async debug(
    input: string,
    context?: CommandContext,
    observer?: InteractionObserver
  ): Promise<string> {
    if (!context?.userId) {
      return "Nao foi possivel identificar o usuario para ajustar debug mode.";
    }
    const action = input.trim().toLowerCase();
    if (action !== "on" && action !== "off") {
      return "Uso: /debug on | /debug off";
    }
    await observer?.report(`Atualizando debug mode: ${action}`);
    await this.deps.debugModeService.setEnabled(context.userId, action === "on");
    return action === "on"
      ? "Debug mode ativado para seu usuario."
      : "Debug mode desativado para seu usuario.";
  }

  public async optimize(observer?: InteractionObserver): Promise<string> {
    await observer?.report("Analisando logs e aplicando auto-otimizacao segura");
    const result = await this.deps.selfOptimizationService.optimize();
    return this.deps.selfOptimizationService.buildTelegramReport(result);
  }

  public async metrics(observer?: InteractionObserver): Promise<string> {
    await observer?.report("Calculando metricas do sistema");
    const metrics = await this.deps.selfOptimizationService.getMetrics();
    return this.deps.selfOptimizationService.buildMetricsReport(metrics);
  }

  public async health(observer?: InteractionObserver): Promise<string> {
    await observer?.report("Avaliando saude do sistema");
    return this.deps.selfOptimizationService.buildHealthReport();
  }

  public async feedback(
    input: string,
    context?: CommandContext,
    observer?: InteractionObserver
  ): Promise<string> {
    if (!context?.userId || !context.chatId) {
      return "Nao foi possivel identificar o usuario para registrar feedback.";
    }
    const value = input.trim().toLowerCase();
    if (value !== "up" && value !== "down") {
      return "Uso: /feedback up | /feedback down";
    }
    await observer?.report("Registrando feedback da resposta");
    await this.deps.feedbackService.addFeedback(context.userId, context.chatId, value);
    try {
      await this.deps.selfOptimizationService.appendAgentLog({
        timestamp: new Date().toISOString(),
        session_id: `${context.chatId}:${new Date().toISOString().slice(0, 10)}`,
        user_id: context.userId,
        intent: "FEEDBACK",
        latency_ms: 0,
        input_length: value.length,
        output_length: 0,
        rag: { found: 0, used: 0, filtered: 0 },
        memory: { score: 0, saved: false },
        tools: { available: [], used: [], latency_ms: 0, success: true },
        executor: { provider: "none", model: "none", latency_ms: 0 },
        errors: null
      });
    } catch {
      // Feedback command should succeed even if log append fails.
    }
    return value === "up" ? "Feedback positivo registrado." : "Feedback negativo registrado.";
  }

  public async profile(
    input: string,
    context?: CommandContext,
    observer?: InteractionObserver
  ): Promise<string> {
    if (!context?.userId) {
      return "Nao foi possivel identificar o usuario para atualizar perfil.";
    }
    const value = input.trim().toLowerCase();
    if (!value) {
      const current = this.deps.userProfileService.getResponseStyle(context.userId);
      return `Perfil atual: ${current}. Use /profile short ou /profile detailed.`;
    }
    if (value !== "short" && value !== "detailed") {
      return "Uso: /profile short | /profile detailed";
    }
    await observer?.report("Atualizando preferencia de resposta do perfil");
    await this.deps.userProfileService.setResponseStyle(context.userId, value as UserResponseStyle);
    return `Perfil atualizado: ${value}.`;
  }

  public async resetSession(context?: CommandContext, observer?: InteractionObserver): Promise<string> {
    if (!context?.chatId) {
      return "Nao foi possivel identificar o chat para resetar a sessao.";
    }
    await observer?.report("Limpando historico da sessao atual");
    const removed = await this.deps.historyRepository.clearChatHistory(context.chatId);
    return [
      "Sessao resetada com sucesso.",
      `Mensagens removidas: ${removed}`,
      "Agora o assistente vai responder com contexto novo (e seu soul prompt atual)."
    ].join("\n");
  }

  public async fileSystemList(arg: string, observer?: InteractionObserver): Promise<string> {
    const target = arg.trim();
    if (!target) {
      const roots = this.deps.fileSystemService.listAllowedRoots();
      return ["Uso: /fs_ls <caminho>", "", "Pastas permitidas:", ...roots.map((root) => `- ${root}`)].join("\n");
    }
    await observer?.report(`Listando arquivos em ${target}`);
    try {
      const entries = await this.deps.fileSystemService.listDirectory(target);
      return [`Arquivos em ${target}:`, "", ...entries].join("\n");
    } catch {
      return "Nao consegui listar esse caminho. Verifique se esta dentro das pastas permitidas.";
    }
  }

  public async shellCommand(arg: string, context?: CommandContext, observer?: InteractionObserver): Promise<string> {
    if (!context?.chatId) {
      return "Nao foi possivel identificar o chat para executar comandos de shell.";
    }
    const trimmed = arg.trim();
    if (!trimmed) {
      return [
        "Uso: /shell <cmd> [args]",
        "Comandos disponiveis:",
        "  pwd",
        "  ls <caminho>",
        "  cd <caminho>",
        "  cat <arquivo>"
      ].join("\n");
    }

    const [cmd, ...rest] = trimmed.split(" ");
    const target = rest.join(" ").trim();

    try {
      if (cmd === "pwd") {
        const current = this.deps.shellSessionService.getCurrentDirectory(context.chatId);
        return `Diretorio atual: ${current}`;
      }
      if (cmd === "ls") {
        const pathToList = target || ".";
        const entries = await this.deps.fileSystemService.listDirectory(pathToList);
        return [`Arquivos em ${pathToList}:`, "", ...entries].join("\n");
      }
      if (cmd === "cd") {
        if (!target) {
          return "Uso: /shell cd <caminho>";
        }
        const newDir = this.deps.shellSessionService.changeDirectory(context.chatId, target);
        return `Diretorio alterado para: ${newDir}`;
      }
      if (cmd === "cat") {
        if (!target) {
          return "Uso: /shell cat <arquivo>";
        }
        const filePath = this.deps.shellSessionService.resolvePath(context.chatId, target);
        const content = await this.deps.fileSystemService.readFile(filePath);
        return [`Conteudo de ${filePath}:`, "", content].join("\n");
      }
      return "Comando shell desconhecido. Use /shell para ajuda.";
    } catch {
      return "Falha no comando shell. Verifique o caminho e se a pasta esta permitida.";
    }
  }

  public async setRule(arg: string, context?: CommandContext, observer?: InteractionObserver): Promise<string> {
    if (!context?.userId) {
      return "Nao foi possivel identificar o usuario para definir a regra.";
    }
    const rawRule = arg.trim();
    if (!rawRule) {
      return "Uso: /set_rule <regra de alta prioridade>";
    }
    await observer?.report("Aplicando regra de guardrail no prompt do agente");
    try {
      await this.deps.soulPromptService.appendRule(rawRule);
      return `Regra adicionada aos guardrails: ${rawRule}`;
    } catch {
      return "Nao foi possivel adicionar a regra. Verifique o formato e tente novamente.";
    }
  }

  public async listRules(observer?: InteractionObserver): Promise<string> {
    await observer?.report("Listando regras de guardrail");
    try {
      const rules = await this.deps.soulPromptService.listRules();
      if (!rules.length) {
        return "Nenhuma regra de guardrail configurada.";
      }
      return ["Regras de guardrail:", "", ...rules].join("\n");
    } catch {
      return "Nao foi possivel listar as regras.";
    }
  }

  public async deleteRule(arg: string, observer?: InteractionObserver): Promise<string> {
    const rawRule = arg.trim();
    if (!rawRule) {
      return "Uso: /delete_rule <regra exata>";
    }
    await observer?.report("Removendo regra de guardrail");
    try {
      const removed = await this.deps.soulPromptService.deleteRule(rawRule);
      return removed ? `Regra removida: ${rawRule}` : "Regra nao encontrada.";
    } catch {
      return "Nao foi possivel remover a regra. Verifique o texto exato da regra.";
    }
  }

  public async editRule(arg: string, observer?: InteractionObserver): Promise<string> {
    const parts = arg.split("=>").map((item) => item.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return "Uso: /edit_rule <regra atual> => <nova regra>";
    }
    const [oldRule, newRule] = parts;
    await observer?.report("Editando regra de guardrail");
    try {
      const updated = await this.deps.soulPromptService.editRule(oldRule, newRule);
      return updated ? `Regra atualizada para: ${newRule}` : "Regra atual nao encontrada.";
    } catch {
      return "Nao foi possivel editar a regra. Verifique o formato e tente novamente.";
    }
  }

  public async fileSystemRead(arg: string, observer?: InteractionObserver): Promise<string> {
    const target = arg.trim();
    if (!target) {
      return "Uso: /fs_read <caminho_arquivo>";
    }
    await observer?.report(`Lendo arquivo ${target}`);
    try {
      const content = await this.deps.fileSystemService.readFile(target);
      return [`Conteudo de ${target}:`, "", content].join("\n");
    } catch {
      return "Nao consegui ler esse arquivo. Verifique o caminho e as permissoes configuradas.";
    }
  }

  public async fileSystemWrite(arg: string, observer?: InteractionObserver): Promise<string> {
    if (!arg.trim()) {
      return "Uso: /fs_write <caminho_arquivo> <conteudo>";
    }
    await observer?.report("Editando arquivo");
    try {
      const pathWritten = await this.deps.fileSystemService.writeFile(arg);
      return `Arquivo atualizado com sucesso: ${pathWritten}`;
    } catch {
      return "Nao consegui escrever no arquivo. Verifique formato do comando e pasta permitida.";
    }
  }

  public async fileSystemAppend(arg: string, observer?: InteractionObserver): Promise<string> {
    if (!arg.trim()) {
      return "Uso: /fs_append <caminho_arquivo> <conteudo>";
    }
    await observer?.report("Anexando conteudo no arquivo");
    try {
      const pathWritten = await this.deps.fileSystemService.appendFile(arg);
      return `Conteudo anexado com sucesso: ${pathWritten}`;
    } catch {
      return "Nao consegui anexar no arquivo. Verifique formato do comando e pasta permitida.";
    }
  }

  public async find(arg: string, observer?: InteractionObserver): Promise<string> {
    const normalized = arg.trim();
    if (!normalized) {
      return "Uso: /find <nome> [raiz_opcional]";
    }
    await observer?.report(`Buscando caminhoes que correspondam a: ${normalized}`);
    const [query, root] = normalized.split(/\s+/, 2);
    try {
      const results = await this.deps.fileSystemService.findPaths(query, root);
      if (!results.length) {
        return "Nenhum arquivo ou pasta encontrada com esse termo.";
      }
      return [
        `Resultados de busca para '${query}':`,
        "",
        ...results.slice(0, 20).map((item) => item)
      ].join("\n");
    } catch {
      return "Busca falhou. Verifique se a raiz opcional esta dentro das pastas permitidas.";
    }
  }
}
