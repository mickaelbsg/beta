import crypto from "node:crypto";
import type {
  ConversationMessage,
  ExecutionRequest,
  Executor,
  HistoryRepository,
  InboundMessage,
  Intent,
  WebSearchService
} from "../shared/types.js";
import { detectIntent } from "./intent-classifier.js";
import { shouldSaveToObsidian, shouldSaveToRagByExecution } from "./persistence-policy.js";
import { RagService } from "../rag-service/rag-service.js";
import { ObsidianService } from "../obsidian-service/obsidian-service.js";

interface OrchestratorDeps {
  historyRepository: HistoryRepository;
  ragService: RagService;
  obsidianService: ObsidianService;
  executor: Executor;
  webSearchService: WebSearchService;
  ragTopK: number;
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
  const cleaned = input
    .replace(/^anota(r)?\s+/i, "")
    .replace(/^salva(r)?\s+/i, "")
    .replace(/^lembra(r)?\s+(de\s+)?/i, "")
    .trim();
  return cleaned || input.trim();
}

function buildSystemRules(): string {
  return [
    "Voce e um assistente pessoal tecnico, direto, objetivo e sem enrolacao.",
    "Nunca invente informacoes.",
    "Sempre priorize memoria relevante (RAG), depois historico recente e input atual.",
    "Se faltar contexto, peca mais detalhes com clareza.",
    "Nao execute acoes criticas.",
    "Quando salvar memoria ou nota importante, confirme explicitamente."
  ].join("\n");
}

function buildIntentInstruction(intent: Intent): string {
  if (intent === "NOTE") {
    return "Crie uma confirmacao curta. Se possivel, sugira titulo e conteudo da nota.";
  }
  if (intent === "QUERY") {
    return "Responda usando o contexto recuperado e seja objetivo.";
  }
  if (intent === "STUDY") {
    return "Explique em partes simples e inclua opcionalmente perguntas de revisao.";
  }
  if (intent === "SEARCH") {
    return "Resuma os resultados de busca em resposta pratica.";
  }
  return "Responda de forma simples e util.";
}

export class Orchestrator {
  public constructor(private readonly deps: OrchestratorDeps) {}

  public async handleMessage(message: InboundMessage): Promise<OrchestratorResponse> {
    const userMessage: ConversationMessage = {
      id: message.messageId,
      chatId: message.chatId,
      role: "user",
      content: message.text,
      timestamp: message.timestamp,
      intent: "UNCLASSIFIED"
    };
    await this.deps.historyRepository.saveMessage(userMessage);

    const intent = detectIntent(message.text);
    const recentHistory = await this.deps.historyRepository.getRecentMessages(message.chatId, 5);

    const retrievedMemories =
      intent === "QUERY" || intent === "NOTE"
        ? await this.deps.ragService.retrieveRelevantMemories(message.text, this.deps.ragTopK)
        : [];

    const webSearchResults =
      intent === "SEARCH" ? await this.deps.webSearchService.search(message.text) : undefined;

    const executionRequest: ExecutionRequest = {
      intent,
      userMessage: message.text,
      recentHistory,
      retrievedMemories,
      systemRules: `${buildSystemRules()}\n${buildIntentInstruction(intent)}`,
      toolHints: {
        webSearchResults
      }
    };

    const executionResult = await this.deps.executor.execute(executionRequest);

    let finalText = executionResult.replyText;
    if (intent === "NOTE" || (executionResult.shouldCreateNote && shouldSaveToObsidian(intent))) {
      const fallbackContent = extractNoteContent(message.text);
      const noteTitle = executionResult.noteTitle ?? summarizeText(fallbackContent);
      const noteContent = executionResult.noteContent ?? fallbackContent;
      const note = await this.deps.obsidianService.createNote({
        title: noteTitle,
        content: noteContent
      });

      await this.deps.ragService.saveMemory({
        text: noteContent,
        source: "obsidian",
        metadata: {
          notePath: note.filePath,
          chatId: message.chatId
        }
      });

      finalText = note.duplicated
        ? `Nota ja existente em ${note.filePath}.`
        : executionResult.replyText || `Nota criada em ${note.filePath}.`;
    } else if (shouldSaveToRagByExecution(intent, message.text, executionResult)) {
      await this.deps.ragService.saveMemory({
        text: executionResult.memoryText ?? message.text,
        source: "chat",
        metadata: {
          chatId: message.chatId
        }
      });
    }

    const assistantMessage: ConversationMessage = {
      id: generateId("assistant"),
      chatId: message.chatId,
      role: "assistant",
      content: finalText,
      timestamp: new Date().toISOString(),
      intent
    };
    await this.deps.historyRepository.saveMessage(assistantMessage);

    return {
      text: finalText
    };
  }
}

