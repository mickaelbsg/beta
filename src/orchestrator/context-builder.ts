import type { ConversationMemoryMessage, MemoryRecord } from "../shared/types.js";

interface BuildContextInput {
  history: ConversationMemoryMessage[];
  userInput: string;
  ragContext: MemoryRecord[];
  systemPrompt: string;
}

export class ContextBuilder {
  public buildContext(input: BuildContextInput): string {
    const historySection = input.history.length
      ? input.history.map((message) => `- [${message.role}] ${message.content}`).join("\n")
      : "- Sem historico recente.";

    const ragSection = input.ragContext.length
      ? input.ragContext.map((memory) => `- ${memory.text}`).join("\n")
      : "- Sem contexto de memoria adicional.";

    return [
      "### SYSTEM",
      input.systemPrompt,
      "",
      "### HISTORICO RECENTE",
      historySection,
      "",
      "### MEMORIA RELEVANTE",
      ragSection,
      "",
      "### MENSAGEM ATUAL",
      input.userInput,
      ""
    ].join("\n");
  }

  public buildMemoryFacts(memories: MemoryRecord[], maxFacts = 5): MemoryRecord[] {
    return memories.slice(0, maxFacts);
  }
}
