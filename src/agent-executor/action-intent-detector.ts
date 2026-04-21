export type ActionIntentType = "command" | "note" | "search" | "unknown";

export interface ActionIntentResult {
  hasIntent: boolean;
  type: ActionIntentType;
}

export function detectActionIntent(text: string): ActionIntentResult {
  const normalized = text.toLowerCase();

  const patterns = {
    command: ["vou rodar", "executando", "rodando o comando", "comando executado", "saída do comando"],
    note: ["vou salvar", "vou criar", "anotado", "salvei na memória", "guardado no obsidian"],
    search: ["vou buscar", "vou pesquisar", "procurando na web", "resultado da busca"]
  };

  if (patterns.command.some(p => normalized.includes(p))) {
    return { hasIntent: true, type: "command" };
  }

  if (patterns.note.some(p => normalized.includes(p))) {
    return { hasIntent: true, type: "note" };
  }

  if (patterns.search.some(p => normalized.includes(p))) {
    return { hasIntent: true, type: "search" };
  }

  // Padrões genéricos de conclusão de ação sem ferramenta
  const genericActionWords = ["feito", "pronto", "concluído", "já fiz"];
  if (genericActionWords.some(w => normalized.includes(w)) && normalized.length < 100) {
    return { hasIntent: true, type: "unknown" };
  }

  return { hasIntent: false, type: "unknown" };
}
