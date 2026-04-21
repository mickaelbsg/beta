import type { Intent, IntentClassification } from "../shared/types.js";

export class RuleBasedIntentClassifier {
  public detect(input: string): IntentClassification | null {
    const text = input.toLowerCase().trim();

    // 1. Busca e Pesquisa
    if (
      text.includes("busca") ||
      text.includes("buscar") ||
      text.includes("procura") ||
      text.includes("pesquisa") ||
      text.includes("search") ||
      text.includes("encontre")
    ) {
      return { intent: "SEARCH", confidence: 1.0, source: "keyword" };
    }

    // 2. Notas e Memória
    if (
      text.includes("anota") ||
      text.includes("salva") ||
      text.includes("guarda") ||
      text.includes("lembra") ||
      text.includes("registre") ||
      text.includes("note") ||
      text.startsWith("/note")
    ) {
      return { intent: "NOTE", confidence: 1.0, source: "keyword" };
    }

    // 3. Comandos e Execução
    if (
      text.includes("roda") ||
      text.includes("executa") ||
      text.includes("run") ||
      text.includes("docker") ||
      text.includes("git") ||
      text.includes("pm2") ||
      text.startsWith("/run")
    ) {
      return { intent: "COMMAND", confidence: 1.0, source: "keyword" };
    }

    // 4. Estudo
    if (
      text.includes("estuda") ||
      text.includes("explique") ||
      text.includes("aprenda") ||
      text.includes("tutorial") ||
      text.startsWith("/study")
    ) {
      return { intent: "STUDY", confidence: 1.0, source: "keyword" };
    }

    return null;
  }
}
