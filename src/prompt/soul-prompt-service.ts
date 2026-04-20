import fs from "node:fs/promises";
import path from "node:path";

const defaultSoulPrompt = [
  "You are a Personal AI Assistant designed for reliable daily use.",
  "Your behavior must be consistent, precise, and grounded in provided context.",
  "",
  "# SYSTEM RULES (HIGHEST PRIORITY)",
  "- Never invent information.",
  "- If you are not sure, say you don't know.",
  "- Always prioritize provided memory over assumptions.",
  "- Be direct, structured, and concise.",
  "- Do not perform or suggest critical real-world actions.",
  "- Ask for clarification if context is insufficient.",
  "",
  "Current detected intent: {{intent}}"
].join("\n");

export class SoulPromptService {
  public constructor(private readonly filePath: string) {}

  public async buildSystemPrompt(intent: string): Promise<string> {
    const base = await this.readSoulPrompt();
    return base.replaceAll("{{intent}}", intent);
  }

  public async appendRule(rule: string): Promise<void> {
    const cleaned = rule.trim();
    if (!cleaned) {
      throw new Error("rule_empty");
    }
    const raw = await this.readSoulPrompt();
    const lines = raw.split("\n");
    const ruleLine = `- ${cleaned}`;
    if (lines.includes(ruleLine)) {
      return;
    }

    let insertIndex = lines.findIndex((line) => line.includes("Current detected intent:"));
    if (insertIndex === -1) {
      insertIndex = lines.length;
    }

    lines.splice(insertIndex, 0, ruleLine);

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, lines.join("\n"), "utf-8");
  }

  public async listRules(): Promise<string[]> {
    const raw = await this.readSoulPrompt();
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "));
  }

  public async deleteRule(rule: string): Promise<boolean> {
    const cleaned = rule.trim();
    if (!cleaned) {
      throw new Error("rule_empty");
    }
    const raw = await this.readSoulPrompt();
    const lines = raw.split("\n");
    const ruleLine = `- ${cleaned}`;
    const updated = lines.filter((line) => line.trim() !== ruleLine);
    if (updated.length === lines.length) {
      return false;
    }
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, updated.join("\n"), "utf-8");
    return true;
  }

  public async editRule(oldRule: string, newRule: string): Promise<boolean> {
    const cleanedOld = oldRule.trim();
    const cleanedNew = newRule.trim();
    if (!cleanedOld || !cleanedNew) {
      throw new Error("rule_empty");
    }
    const raw = await this.readSoulPrompt();
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
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, updated.join("\n"), "utf-8");
    return true;
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

