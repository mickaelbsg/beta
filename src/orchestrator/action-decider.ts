export type Action =
  | { type: "SAVE_MEMORY"; content: string }
  | { type: "CREATE_NOTE"; content: string }
  | { type: "RUN_COMMAND"; command: string }
  | { type: "SEARCH"; query: string }
  | { type: "GENERATE_DIARY" }
  | { type: "SHOW_CONFIG" }
  | { type: "SHOW_HELP" }
  | { type: "SHOW_TOOLS" }
  | { type: "NONE" };

export function decideAction(input: string): Action {
  const text = input.toLowerCase().trim();

  // Prioridade 1: Comandos explícitos
  if (text.startsWith("/run ")) return { type: "RUN_COMMAND", command: input.slice(5).trim() };
  if (text.startsWith("/note ")) return { type: "CREATE_NOTE", content: input.slice(6).trim() };
  if (text.startsWith("/search ")) return { type: "SEARCH", query: input.slice(8).trim() };
  if (text === "/diary") return { type: "GENERATE_DIARY" };
  if (text === "/config") return { type: "SHOW_CONFIG" };
  if (text === "/help" || text === "/commands") return { type: "SHOW_HELP" };
  if (text === "/tools") return { type: "SHOW_TOOLS" };

  // Prioridade 2: Padrões de busca na web via linguagem natural
  if (text.includes("busque na web") || text.includes("pesquise sobre") || text.includes("procure na internet")) {
    return { type: "SEARCH", query: input.replace(/busque na web|pesquise sobre|procure na internet/gi, "").trim() };
  }

  // Prioridade 3: Padrões de salvamento de memória automática
  if (
    text.includes("meu nome é") ||
    text.includes("meu nome e") ||
    text.includes("eu moro") ||
    text.includes("eu trabalho") ||
    text.includes("anota") ||
    text.includes("lembra") ||
    text.includes("estou estudando") ||
    text.includes("aprendi que")
  ) {
    return { type: "SAVE_MEMORY", content: input };
  }

  return { type: "NONE" };
}
