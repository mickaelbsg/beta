import type { ExecutionRequest, ExecutionResult, Executor } from "../shared/types.js";

interface OpenCodeLikeClient {
  run(input: {
    context: string;
    instruction: string;
    tools: string[];
  }): Promise<{ text: string }>;
}

export class OpenCodeExecutor implements Executor {
  public constructor(
    private readonly client: OpenCodeLikeClient | null,
    private readonly fallbackExecutor: Executor
  ) {}

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (!this.client) {
      return this.fallbackExecutor.execute(request);
    }

    try {
      const context = JSON.stringify(
        {
          intent: request.intent,
          recentHistory: request.recentHistory,
          retrievedMemories: request.retrievedMemories,
          webSearchResults: request.toolHints?.webSearchResults ?? []
        },
        null,
        2
      );

      const result = await this.client.run({
        context,
        instruction: `${request.systemRules}\n\nMensagem: ${request.userMessage}`,
        tools: ["create_note", "search_memory", "save_memory", "web_search", "study_helper"]
      });

      return {
        replyText: result.text,
        shouldPersistMemory: false,
        shouldCreateNote: false
      };
    } catch {
      return this.fallbackExecutor.execute(request);
    }
  }
}

