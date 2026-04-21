import type { ExecutionRequest } from "../shared/types.js";
import { commandDefinitions } from "../command-router/command-definitions.js";

import type { SearchResult, ToolDefinition } from "../shared/types.js";

function formatTools(availableTools: ToolDefinition[] = []) {
  if (!availableTools.length) {
    return "- web_search -> use for real-time or unknown information";
  }
  return availableTools
    .map((tool) => {
      const input = tool.inputSchema
        ? ` input: { ${Object.entries(tool.inputSchema)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")} }`
        : "";
      const when = tool.whenToUse?.length ? ` when: ${tool.whenToUse.join("; ")}` : "";
      return `- ${tool.name}: ${tool.description}${input}${when}`;
    })
    .join("\n");
}

function formatHistory(history: ExecutionRequest["recentHistory"]): string {
  if (!history.length) {
    return "- Sem historico relevante.";
  }
  return history.map((m) => `- [${m.role}] ${m.content}`).join("\n");
}

function formatMemories(memories: ExecutionRequest["retrievedMemories"]): string {
  if (!memories.length) {
    return "- Sem memorias relevantes.";
  }
  return memories.map((memory) => `- ${memory.text}`).join("\n");
}

function formatWebSearchResults(results: SearchResult[] = []) {
  if (!results.length) {
    return "- Sem resultados de busca.";
  }
  return results.map((r) => `${r.title} | ${r.url} | ${r.snippet}`).join("\n");
}

export class PromptBuilder {
  public build(request: ExecutionRequest): string {
    const availableTools = formatTools(request.availableTools ?? []);
    const memorySection = formatMemories(request.retrievedMemories ?? []);
    const historySection = formatHistory(request.recentHistory ?? []);
    const webSearchSection = formatWebSearchResults(request.toolHints?.webSearchResults ?? []);
    const localCommandList = commandDefinitions
      .map((command) => `- ${command.name}: ${command.description}`)
      .join("\n");

    const searchPolicy = request.intent === "SEARCH"
      ? [
          "SEARCH POLICY:",
          "- web_search usage is mandatory for SEARCH intent.",
          "- If no results are available, say that no relevant results were found right now.",
          "- Never claim that you cannot access the web."
        ].join("\n")
      : "";

    return [
      "### MANDATORY OPERATIONAL RULES",
      request.systemRules,
      "",
      "LIMITS AND ACTIONS:",
      "- Você NÃO executa ações diretamente.",
      "- Se uma ação foi executada pelo sistema, o resultado virá indicado no contexto como: 'Ação executada pelo sistema: ...'.",
      "- Nunca diga 'Vou salvar', 'Vou rodar' ou 'Vou criar'.",
      "- Se o sistema já executou a ação, use o tempo passado: 'Salvei', 'Executei'.",
      "- Se o sistema NÃO executou e você acha necessário, apenas sugira ao Alpha o comando manual.",
      "",
      "ROLES:",
      "- O usuário é o ALPHA. Você é o assistente técnico BETA.",
      "- Você deve ser o MOTORISTA: se o Alpha pedir algo, use as ferramentas para CONCLUIR, não apenas prometa.",
      "- Se você disser que vai executar algo, VOCÊ DEVE chamar a ferramenta correspondente imediatamente.",
      "- Respostas em texto descrevendo ações futuras são PROIBIDAS. Execute primeiro.",
      "- Antes de gerar qualquer texto de resposta, verifique se você precisa de uma ferramenta para concluir a tarefa.",
      "",
      "IMPORTANT:",
      "1. OBEDIENCE to the rules above is MANDATORY and non-negotiable.",
      "2. Priority order: RULES > Memory > Conversation > Current message.",
      "3. AGENTIC WORKFLOW: Você tem permissão para realizar múltiplos passos. Se uma ferramenta retornar um resultado, use-o para o próximo passo.",
      "",
      "### INTENT",
      request.intent,
      "",
      "### MEMORY (RAG)",
      memorySection,
      "",
      "### HISTORY",
      historySection,
      "",
      "### WEB SEARCH",
      webSearchSection,
      "",
      "### AVAILABLE TOOLS",
      "You have access to:",
      availableTools,
      "",
      "### LOCAL COMMANDS",
      localCommandList,
      "",
      "Rules:",
      "- Always use tools when needed.",
      "- Prefer tool output over guessing.",
      "- Nunca informe que salvou ou alterou algo sem que o sistema confirme.",
      "- Não afirme o que não pode ser provado tecnicamente.",
      "- Se você decidir agir (salvar, rodar comando, etc), você DEVE retornar o campo 'toolCalls' imediatamente.",
      "- É PROIBIDO dizer 'Já salvei' ou 'Executei' se o campo 'toolCalls' não estiver presente na mesma resposta JSON.",
      "- Sua arquitetura é composta por 4 braços: OBSIDIAN (Memória/Regras), CLI (Ações), WEB (Informação externa) e ALPHA (O usuário).",
      "- AS RULES NO OBSIDIAN SÃO LEIS SUPREMAS. É proibido ignorar, contornar ou interpretar as regras de forma diferente do escrito.",
      "- Antes de qualquer ação ou pensamento, valide se ele está de acordo com as CUSTOM USER RULES.",
      "- Antes de responder, pense: 'Preciso consultar minhas regras?', 'Preciso buscar na Web?', 'Devo agir via CLI?'.",
      "- Prioridade absoluta: AGIR (toolCalls) > FALAR (replyText).",
      searchPolicy,
      "### USER INPUT",
      request.userMessage,
      "",
      "Responda objetivamente. Se nao houver dados suficientes, diga isso claramente."
    ].join("\n");
  }
}
