import OpenAI from "openai";
import type { AggregatedMetrics } from "./metrics-aggregator.js";
import type { OptimizationIssue } from "./issue-detector.js";

interface LlmSuggestionArgs {
  enabled: boolean;
  provider: "openai" | "omniroute";
  model: string;
  apiKey: string;
  omnirouteBaseUrl: string;
  omnirouteApiKey?: string;
}

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export class LlmSuggestionService {
  private readonly enabled: boolean;
  private readonly model: string;
  private readonly client: OpenAI;

  public constructor(args: LlmSuggestionArgs) {
    this.enabled = args.enabled;
    this.model = args.model;
    this.client =
      args.provider === "omniroute"
        ? new OpenAI({
            baseURL: args.omnirouteBaseUrl,
            apiKey: args.omnirouteApiKey?.trim() || "omniroute-local"
          })
        : new OpenAI({ apiKey: args.apiKey });
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async suggest(input: {
    metrics: AggregatedMetrics;
    issues: OptimizationIssue[];
  }): Promise<string[]> {
    if (!this.enabled) {
      return [];
    }
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Voce e um consultor. Responda APENAS JSON no formato {\"suggestions\":[\"...\"]}. Nao tome acoes."
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ]
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = safeJsonParse<{ suggestions?: string[] }>(raw);
    return Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.map((item) => String(item)).slice(0, 4)
      : [];
  }
}
