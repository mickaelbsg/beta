import type { ExecutionSnapshot, MemoryRecord } from "../shared/types.js";
import type { ToolDefinition } from "../shared/types.js";
import { commandDefinitions } from "./command-definitions.js";

function clip(text: string, max = 80): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3)}...`;
}

export function formatHelp(): string {
  const categories = new Map<string, string[]>();
  for (const command of commandDefinitions) {
    const lines = categories.get(command.category) ?? [];
    lines.push(command.usage);
    lines.push(command.description);
    lines.push("");
    categories.set(command.category, lines);
  }

  const sections: string[] = ["🤖 Assistente Pessoal - Comandos", ""];
  for (const [category, lines] of categories.entries()) {
    sections.push(`## ${category}`);
    sections.push("");
    sections.push(...lines);
  }
  return sections.join("\n");
}

export function formatMemoryList(memories: MemoryRecord[], page: number, pageSize: number): string {
  if (!memories.length) {
    return "🧠 Suas memorias:\n\nNenhuma memoria encontrada.";
  }
  const start = (page - 1) * pageSize;
  const pageItems = memories.slice(start, start + pageSize);
  if (!pageItems.length) {
    return "🧠 Suas memorias:\n\nPagina sem itens. Use /memories 1.";
  }
  const lines = pageItems.map((memory, idx) => {
    const id = String(memory.metadata?.shortId ?? memory.id);
    const type = String(memory.metadata?.memoryType ?? "fact");
    return `${start + idx + 1}. [${id}] (${type})\n"${clip(memory.text, 90)}"`;
  });
  return [
    "🧠 Suas memorias:",
    "",
    ...lines,
    "",
    `Pagina ${page} | Itens por pagina: ${pageSize}`,
    "Use /memory_detail <id> para ver detalhes."
  ].join("\n");
}

export function formatMemorySearch(memories: MemoryRecord[]): string {
  if (!memories.length) {
    return "🧠 Busca de memoria:\n\nNenhuma memoria relevante encontrada.";
  }
  const lines = memories.map((memory, idx) => {
    const id = String(memory.metadata?.shortId ?? memory.id);
    const score = typeof memory.score === "number" ? `score ${(memory.score * 100).toFixed(0)}%` : "score n/a";
    return `${idx + 1}. [${id}] ${score}\n"${clip(memory.text, 100)}"`;
  });
  return ["🧠 Resultado da busca:", "", ...lines].join("\n");
}

export function formatMemoryDetail(memory: MemoryRecord): string {
  const id = String(memory.metadata?.shortId ?? memory.id);
  const source = String(memory.source ?? "chat").toUpperCase();
  const score =
    typeof memory.score === "number"
      ? memory.score.toFixed(2)
      : typeof memory.metadata?.memoryScore === "number"
        ? Number(memory.metadata.memoryScore).toFixed(2)
        : "n/a";
  const createdAt = String(memory.timestamp).slice(0, 10);
  const type = String(memory.metadata?.memoryType ?? "fact");
  return [
    "🧠 Detalhes da memoria",
    "",
    `ID: ${id}`,
    `Tipo: ${type}`,
    `Conteudo: ${memory.text}`,
    `Criado em: ${createdAt}`,
    `Origem: ${source}`,
    `Score: ${score}`
  ].join("\n");
}

export function formatMemorySavedBlock(text: string, shortId: string): string {
  return ['💾 Memoria salva:', '', `"${clip(text, 140)}"`, '', `ID: ${shortId}`].join("\n");
}

export function formatLogs(snapshot: ExecutionSnapshot | null): string {
  if (!snapshot) {
    return "📊 Ultima execucao:\n\nSem execucoes recentes registradas.";
  }
  return [
    "📊 Ultima execucao:",
    "",
    `🧠 Intent: ${snapshot.intent}`,
    `📚 Memorias usadas: ${snapshot.memoriesUsed}`,
    `💾 Memoria salva: ${snapshot.memorySaved ? "sim" : "nao"}`,
    `⚙️ Executor: ${snapshot.executor.toUpperCase()}`,
    `⏱️ Tempo: ${snapshot.elapsedMs}ms`
  ].join("\n");
}

export function formatToolsList(tools: ToolDefinition[]): string {
  if (!tools.length) {
    return "🧰 Ferramentas:\n\nNenhuma tool encontrada.";
  }
  const lines = tools.map((tool, idx) => {
    const when = tool.whenToUse?.length ? `\nQuando usar: ${tool.whenToUse.join("; ")}` : "";
    return `${idx + 1}. ${tool.name}\n${tool.description}${when}`;
  });
  return ["🧰 Ferramentas disponiveis:", "", ...lines].join("\n\n");
}
