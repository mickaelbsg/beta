import fs from "node:fs/promises";
import path from "node:path";

const defaultSoulPrompt = [
  "You are a Personal AI Assistant (BETA) designed for technical tasks and memory management.",
  "Your behavior is governed by a set of strict rules that MUST be obeyed without exception.",
  "",
  "# MANDATORY OPERATIONAL RULES (NO EXCEPTIONS)",
  "- Never invent information.",
  "- If you are not sure, say you don't know.",
  "- Never claim you have performed a system action (save, delete, run) without system confirmation.",
  "- Always prioritize custom user rules over any internal default behavior.",
  "- Be direct, technical, and concise.",
  "",
  "## CUSTOM USER RULES",
  "{{custom_rules}}",
  "",
  "Current detected intent: {{intent}}"
].join("\n");

export class SoulPromptService {
  private rulesPath: string;

  public constructor(private readonly filePath: string) {
    this.rulesPath = "/home/pc/projetos/obsidian/rules/rules.md";
  }

  public async buildSystemPrompt(intent: string): Promise<string> {
    const base = await this.readSoulPrompt();
    const rules = await this.listRules();
    const customRulesText = rules.length ? rules.map(r => `- ${r}`).join("\n") : "- No custom rules defined.";

    return base
      .replaceAll("{{intent}}", intent)
      .replaceAll("{{custom_rules}}", customRulesText);
  }

  public async appendRule(rule: string): Promise<void> {
    const cleaned = rule.trim();
    if (!cleaned) {
      throw new Error("rule_empty");
    }

    await fs.mkdir(path.dirname(this.rulesPath), { recursive: true });
    let content = "";
    try {
      content = await fs.readFile(this.rulesPath, "utf-8");
    } catch {
      content = "# Custom User Rules\n\n";
    }

    const lines = content.split("\n");
    const ruleLine = `- ${cleaned}`;
    if (content.includes(ruleLine)) {
      return;
    }

    content = `${content.trim()}\n${ruleLine}\n`;
    await fs.writeFile(this.rulesPath, content, "utf-8");
  }

  public async listRules(): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.rulesPath, "utf-8");
      return raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2));
    } catch {
      return [];
    }
  }

  public async deleteRule(rule: string): Promise<boolean> {
    const cleaned = rule.trim();
    if (!cleaned) {
      throw new Error("rule_empty");
    }
    try {
      const raw = await fs.readFile(this.rulesPath, "utf-8");
      const lines = raw.split("\n");
      const ruleLine = `- ${cleaned}`;
      const updated = lines.filter((line) => line.trim() !== ruleLine);
      if (updated.length === lines.length) {
        return false;
      }
      await fs.writeFile(this.rulesPath, updated.join("\n"), "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  public async editRule(oldRule: string, newRule: string): Promise<boolean> {
    const cleanedOld = oldRule.trim();
    const cleanedNew = newRule.trim();
    if (!cleanedOld || !cleanedNew) {
      throw new Error("rule_empty");
    }
    try {
      const raw = await fs.readFile(this.rulesPath, "utf-8");
      const lines = raw.split("\n");
      const oldLine = `- ${cleanedOld}`;
      const newLine = `- ${cleanedNew}`;
      let replaced = false;
      const updated = lines.map((line) => {
        if (line.trim() === oldLine) {
          replaced = true;
          return newLine;
        }
        return line;
      });
      if (!replaced) {
        return false;
      }
      await fs.writeFile(this.rulesPath, updated.join("\n"), "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  private async readSoulPrompt(): Promise<string> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const cleaned = raw.trim();
      return cleaned || defaultSoulPrompt;
    } catch {
      return defaultSoulPrompt;
    }
  }
}

