import OpenAI from "openai";
import type { ExecutionRequest, ExecutionResult, Executor } from "../shared/types.js";

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export class LlmExecutor implements Executor {
  private readonly client: OpenAI;

  public constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.client = new OpenAI({ apiKey });
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const prompt = this.buildPrompt(request);
    const completion = await this.client.chat.completions.create({
      model: this.model,
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
          content: prompt
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

  private buildPrompt(request: ExecutionRequest): string {
    const history = request.recentHistory
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n");
    const memories = request.retrievedMemories
      .map((m) => `[${m.source}] ${m.text}`)
      .join("\n");
    const webSearch = request.toolHints?.webSearchResults
      ?.map((r) => `${r.title} | ${r.url} | ${r.snippet}`)
      .join("\n");

    return [
      `Regras do sistema:\n${request.systemRules}`,
      `Intent detectada: ${request.intent}`,
      `Memorias RAG:\n${memories || "Sem memorias relevantes."}`,
      `Historico recente:\n${history || "Sem historico."}`,
      `Resultados de busca web:\n${webSearch || "Sem busca web."}`,
      `Mensagem do usuario:\n${request.userMessage}`,
      "Responda de forma objetiva e util."
    ].join("\n\n");
  }
}

