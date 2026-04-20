import OpenAI from "openai";
import type { Intent, IntentClassification, IntentClassifier } from "../shared/types.js";

interface Rule {
  intent: Intent;
  keywords: string[];
}

const rules: Rule[] = [
  { intent: "NOTE", keywords: ["anota", "salva", "lembra", "guarda", "registre", "nota", "anotacao"] },
  { intent: "QUERY", keywords: ["o que eu falei", "lembra", "sobre", "quando eu", "qual foi", "memoria", "onde voce salva", "obsidian", "wiki"] },
  { intent: "STUDY", keywords: ["explica", "me ensina", "como funciona", "resumo", "estudar"] },
  { intent: "SEARCH", keywords: ["busca", "novidades", "noticias", "pesquisa", "atualizacoes"] }
];

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getKeywordScore(text: string, keywords: string[]): number {
  const hits = keywords.filter((keyword) => text.includes(keyword)).length;
  if (hits === 0) {
    return 0;
  }
  return Math.min(1, hits / 2);
}

function bestKeywordMatch(message: string): IntentClassification {
  const normalized = normalize(message);
  let bestIntent: Intent = "CHAT";
  let bestScore = 0;

  for (const rule of rules) {
    const score = getKeywordScore(normalized, rule.keywords);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = rule.intent;
    }
  }

  if (bestScore === 0) {
    return {
      intent: "CHAT",
      confidence: 0.4,
      source: "keyword"
    };
  }

  return {
    intent: bestIntent,
    confidence: Math.max(0.55, bestScore),
    source: "keyword"
  };
}

export class HybridIntentClassifier implements IntentClassifier {
  private readonly openai: OpenAI;

  public constructor(
    apiKey: string,
    private readonly model: string,
    private readonly llmFallbackThreshold: number
  ) {
    this.openai = new OpenAI({ apiKey });
  }

  public async detect(message: string): Promise<IntentClassification> {
    const keyword = bestKeywordMatch(message);
    if (keyword.confidence >= this.llmFallbackThreshold) {
      return keyword;
    }

    const llm = await this.detectWithLlm(message);
    if (llm) {
      return llm;
    }

    return {
      intent: keyword.intent,
      confidence: keyword.confidence,
      source: "fallback"
    };
  }

  private async detectWithLlm(message: string): Promise<IntentClassification | null> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Classifique a mensagem em NOTE|QUERY|STUDY|SEARCH|CHAT. Responda JSON: {\"intent\":\"...\",\"confidence\":0-1}."
          },
          {
            role: "user",
            content: message
          }
        ]
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as { intent?: string; confidence?: number };
      const intent = parsed.intent as Intent;
      const confidence = Number(parsed.confidence ?? 0.6);
      if (!["NOTE", "QUERY", "STUDY", "SEARCH", "CHAT"].includes(intent)) {
        return null;
      }
      return {
        intent,
        confidence: Math.max(0, Math.min(1, confidence)),
        source: "llm"
      };
    } catch {
      return null;
    }
  }
}

export function detectIntent(message: string): Intent {
  return bestKeywordMatch(message).intent;
}
