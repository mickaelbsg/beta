export interface PendingMemoryCandidate {
  text: string;
  score: number;
  memoryType: "note" | "fact" | "preference" | "task";
  metadata?: Record<string, unknown>;
}

export class PendingMemoryConfirmationService {
  private readonly pendingByChat = new Map<string, PendingMemoryCandidate>();

  public set(chatId: string, candidate: PendingMemoryCandidate): void {
    this.pendingByChat.set(chatId, candidate);
  }

  public get(chatId: string): PendingMemoryCandidate | null {
    return this.pendingByChat.get(chatId) ?? null;
  }

  public clear(chatId: string): void {
    this.pendingByChat.delete(chatId);
  }
}

