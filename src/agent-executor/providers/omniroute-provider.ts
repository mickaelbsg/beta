import OpenAI from "openai";
import type { ExecutionRequest, ExecutionResult } from "../../shared/types.js";
import type { LLMProvider } from "./llm-provider.js";

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export class OmniRouteProvider implements LLMProvider {
  public readonly name = "omniroute" as const;
  private readonly client: OpenAI;

  public constructor(baseURL: string, apiKey?: string) {
    this.client = new OpenAI({
      baseURL,
      apiKey: apiKey?.trim() || "omniroute-local"
    });
  }

  public async generateResponse(input: {
    request: ExecutionRequest;
    prompt: string;
    model: string;
  }): Promise<ExecutionResult> {
    const completion = await this.client.chat.completions.create({
      model: input.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Responda APENAS JSON valido com chaves: replyText, shouldPersistMemory, memoryText, shouldCreateNote, noteTitle, noteContent."
        },
        {
          role: "user",
          content: input.prompt
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = safeJsonParse<ExecutionResult>(raw);
    if (!parsed || !parsed.replyText) {
      return {
        replyText: raw || "Nao consegui gerar resposta confiavel agora.",
        shouldPersistMemory: false,
        shouldCreateNote: false
      };
    }

    return {
      replyText: parsed.replyText,
      shouldPersistMemory: Boolean(parsed.shouldPersistMemory),
      memoryText: parsed.memoryText,
      shouldCreateNote: Boolean(parsed.shouldCreateNote),
      noteTitle: parsed.noteTitle,
      noteContent: parsed.noteContent
    };
  }
}
