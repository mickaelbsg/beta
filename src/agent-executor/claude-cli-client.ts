import { spawnSync } from "node:child_process";

interface RunInput {
  context: string;
  instruction: string;
  tools: string[];
}

export class ClaudeCliClient {
  public async run(input: RunInput): Promise<{ text: string }> {
    const fullInstruction = `${input.context}\n\n${input.instruction}`.trim();
    try {
      // Use flags supported by the local 'claude' binary: -p/--print for non-interactive output.
      // Also enable --dangerously-skip-permissions and set permission-mode to 'auto' for automatic behavior.
      const args = ["-p", "--dangerously-skip-permissions", "--permission-mode", "auto", fullInstruction];
      const res = spawnSync("claude", args, {
        encoding: "utf-8",
        timeout: 120000
      });

      const stdout = String(res.stdout || "").trim();
      const stderr = String(res.stderr || "").trim();

      if (typeof res.status === "number" && res.status !== 0) {
        return { text: stderr || stdout || `claude exited with status ${res.status}` };
      }

      return { text: stdout };
    } catch (err) {
      return { text: err instanceof Error ? err.message : String(err) };
    }
  }
}
