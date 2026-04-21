import type { ConversationMemoryMessage } from "../shared/types.js";

const MAX_MESSAGES_PER_CHAT = 15;

export class ConversationMemoryService {
  private readonly chats = new Map<string, ConversationMemoryMessage[]>();

  public addMessage(chatId: string, message: ConversationMemoryMessage): void {
    const messages = this.chats.get(chatId) ?? [];
    const next = [...messages, message].slice(-MAX_MESSAGES_PER_CHAT);
    this.chats.set(chatId, next);
  }

  public getRecentMessages(chatId: string, limit = 6): ConversationMemoryMessage[] {
    const messages = this.chats.get(chatId) ?? [];
    return messages.slice(-limit);
  }

  public clear(chatId: string): void {
    this.chats.delete(chatId);
  }
}
