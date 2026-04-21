import { Skill, SkillExecutionContext } from "./skill.js";
import { ClaudeService } from "../services/claude-service.js";

export class ClaudeCodeSkill implements Skill {
  public readonly name = "claude_code";
  public readonly description = "Agente de codificação e análise técnica via Claude Code CLI.";

  public trigger(input: string): boolean {
    const normalized = input.toLowerCase();
    return (
      normalized.includes("codifique") ||
      normalized.includes("refatore") ||
      normalized.includes("analise o código") ||
      normalized.includes("ajuste o arquivo") ||
      normalized.includes("crie um componente")
    );
  }

  public async execute(context: SkillExecutionContext): Promise<string> {
    const svc = new ClaudeService();
    const res = await svc.run(context.input);
    return res.text;
  }
}
