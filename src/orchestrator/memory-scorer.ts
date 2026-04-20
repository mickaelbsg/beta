import type { MemoryScoreResult } from "../shared/types.js";

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const explicit = ["anota", "salva", "lembra", "guarda", "registre"];
const futurePlan = ["amanha", "semana", "vou", "preciso", "planejo", "meta", "objetivo"];
const personal = ["eu sou", "minha", "meu", "nasci", "gosto", "prefiro", "familia"];

export class MemoryScorer {
  public score(text: string): MemoryScoreResult {
    const normalized = normalize(text);

    if (explicit.some((k) => normalized.includes(k))) {
      return { score: 1.0, category: "explicit_request", memoryType: "note" };
    }
    if (futurePlan.some((k) => normalized.includes(k))) {
      return { score: 0.8, category: "future_plan", memoryType: "task" };
    }
    if (personal.some((k) => normalized.includes(k))) {
      return { score: 0.7, category: "personal_info", memoryType: "preference" };
    }
    return { score: 0.3, category: "general_info", memoryType: "fact" };
  }
}
