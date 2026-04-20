import { ClaudeCliClient } from "../agent-executor/claude-cli-client.js";

export class ClaudeService {
  private readonly client: ClaudeCliClient;

  public constructor() {
    this.client = new ClaudeCliClient();
  }

  /**
   * Run a non-interactive Claude CLI instruction and return its text output.
   * Keeps a simple retry and sanitization policy.
   */
  public async run(instruction: string): Promise<{ text: string }> {
    const sanitized = String(instruction || "").trim();
    if (!sanitized) {
      return { text: "Nenhuma instrucao fornecida." };
    }

    // Basic escape/sanitize: avoid accidental newlines that could include secrets in prompt
    const safeInstruction = sanitized.replace(/[\x00-\x1F\x7F]/g, " ").slice(0, 20000);

    // Delegate to existing CLI client
    try {
      const res = await this.client.run({
        context: "Execute no contexto do projeto 'beta' conforme instrucoes do usuario.",
        instruction: safeInstruction,
        tools: []
      });
      return res;
    } catch (err) {
      return { text: err instanceof Error ? err.message : String(err) };
    }
  }
}
