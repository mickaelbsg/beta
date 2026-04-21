export type Intent = "NOTE" | "QUERY" | "STUDY" | "SEARCH" | "CHAT" | "COMMAND";

export type MessageRole = "user" | "assistant" | "system";

export interface InboundMessage {
  platform: "telegram";
  chatId: string;
  userId: string;
  messageId: string;
  text: string;
  timestamp: string;
}

export interface ConversationMessage {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  intent: Intent | "UNCLASSIFIED";
}

export interface ConversationMemoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface MemoryRecord {
  id: string;
  text: string;
  source: "chat" | "obsidian";
  timestamp: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface IntentClassification {
  intent: Intent;
  confidence: number;
  source: "keyword" | "llm" | "fallback";
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  whenToUse?: string[];
  inputSchema?: Record<string, string>;
}

export interface ExecutionRequest {
  intent: Intent;
  userMessage: string;
  recentHistory: ConversationMessage[];
  retrievedMemories: MemoryRecord[];
  systemRules: string;
  preferredExecutor?: "llm" | "opencode";
  availableTools?: ToolDefinition[];
  toolHints?: {
    webSearchResults?: SearchResult[];
  };
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
}

export interface ExecutionResult {
  replyText: string;
  toolCalls?: ToolCall[];
  shouldPersistMemory: boolean;
  memoryText?: string;
  shouldCreateNote: boolean;
  noteTitle?: string;
  noteContent?: string;
  debug?: {
    provider?: string;
    model?: string;
    latencyMs?: number;
    usedFallback?: boolean;
  };
}

export interface HistoryRepository {
  init(): Promise<void>;
  saveMessage(message: ConversationMessage): Promise<void>;
  getRecentMessages(chatId: string, limit: number): Promise<ConversationMessage[]>;
  getMessagesByDate(chatId: string, date: string): Promise<ConversationMessage[]>;
  clearChatHistory(chatId: string): Promise<number>;
}

export interface MemoryRepository {
  init(): Promise<void>;
  saveMemory(record: Omit<MemoryRecord, "id"> & { id?: string; vector: number[] }): Promise<MemoryRecord>;
  searchMemories(queryEmbedding: number[], topK: number): Promise<MemoryRecord[]>;
  findNearDuplicate(text: string): Promise<MemoryRecord | null>;
  listMemories(limit: number): Promise<MemoryRecord[]>;
  getMemoryByShortId(shortId: string): Promise<MemoryRecord | null>;
  deleteMemoryByShortId(shortId: string): Promise<boolean>;
}

export interface Executor {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

export interface IntentClassifier {
  detect(message: string): Promise<IntentClassification>;
}

export interface MemoryScoreResult {
  score: number;
  category: "explicit_request" | "future_plan" | "personal_info" | "general_info";
  memoryType: "note" | "fact" | "preference" | "task";
}

export interface ExecutorSelection {
  executorUsed: "llm" | "opencode";
  reason: string;
}

export interface ExecutionSnapshot {
  timestamp: string;
  intent: Intent;
  memoriesUsed: number;
  memorySaved: boolean;
  executor: "llm" | "opencode";
  elapsedMs: number;
}

export interface WebSearchService {
  search(query: string): Promise<SearchResult[]>;
}

export interface InteractionObserver {
  report(step: string): Promise<void>;
}

export interface CommandContext {
  chatId: string;
  userId: string;
}
