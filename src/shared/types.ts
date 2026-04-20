export type Intent = "NOTE" | "QUERY" | "STUDY" | "SEARCH" | "CHAT";

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

export interface MemoryRecord {
  id: string;
  text: string;
  source: "chat" | "obsidian";
  timestamp: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ExecutionRequest {
  intent: Intent;
  userMessage: string;
  recentHistory: ConversationMessage[];
  retrievedMemories: MemoryRecord[];
  systemRules: string;
  toolHints?: {
    webSearchResults?: SearchResult[];
  };
}

export interface ExecutionResult {
  replyText: string;
  shouldPersistMemory: boolean;
  memoryText?: string;
  shouldCreateNote: boolean;
  noteTitle?: string;
  noteContent?: string;
}

export interface HistoryRepository {
  init(): Promise<void>;
  saveMessage(message: ConversationMessage): Promise<void>;
  getRecentMessages(chatId: string, limit: number): Promise<ConversationMessage[]>;
}

export interface MemoryRepository {
  init(): Promise<void>;
  saveMemory(record: Omit<MemoryRecord, "id"> & { id?: string; vector: number[] }): Promise<MemoryRecord>;
  searchMemories(queryEmbedding: number[], topK: number): Promise<MemoryRecord[]>;
  findNearDuplicate(text: string): Promise<MemoryRecord | null>;
}

export interface Executor {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

export interface WebSearchService {
  search(query: string): Promise<SearchResult[]>;
}

