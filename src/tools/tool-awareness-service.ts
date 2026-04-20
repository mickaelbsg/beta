import fs from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../shared/types.js";

interface ToolAwarenessArgs {
  specPath: string;
  toolsDir: string;
}

function normalizeTool(tool: Partial<ToolDefinition>): ToolDefinition | null {
  const name = String(tool.name ?? "").trim();
  const description = String(tool.description ?? "").trim();
  if (!name || !description) {
    return null;
  }
  return {
    name,
    description,
    whenToUse: Array.isArray(tool.whenToUse) ? tool.whenToUse.map(String) : undefined,
    inputSchema:
      tool.inputSchema && typeof tool.inputSchema === "object"
        ? Object.fromEntries(
            Object.entries(tool.inputSchema).map(([key, value]) => [String(key), String(value)])
          )
        : undefined
  };
}

function extractJsonFromMarkdown(raw: string): string {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return raw.trim();
}

export class ToolAwarenessService {
  private cachedTools: ToolDefinition[] = [];
  private lastStamp = "";

  public constructor(private readonly args: ToolAwarenessArgs) {}

  public async listTools(): Promise<ToolDefinition[]> {
    const stamp = await this.computeStamp();
    if (stamp === this.lastStamp && this.cachedTools.length) {
      return this.cachedTools;
    }

    const tools = new Map<string, ToolDefinition>();
    for (const tool of await this.loadFromSpec()) {
      tools.set(tool.name, tool);
    }
    for (const tool of await this.loadFromDirectory()) {
      tools.set(tool.name, tool);
    }

    this.cachedTools = [...tools.values()].sort((a, b) => a.name.localeCompare(b.name));
    this.lastStamp = stamp;
    return this.cachedTools;
  }

  public async searchTools(query: string): Promise<ToolDefinition[]> {
    const normalized = query.toLowerCase().trim();
    if (!normalized) {
      return this.listTools();
    }
    const tools = await this.listTools();
    return tools.filter((tool) => {
      const hay = [
        tool.name,
        tool.description,
        ...(tool.whenToUse ?? []),
        ...Object.keys(tool.inputSchema ?? {})
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(normalized);
    });
  }

  private async computeStamp(): Promise<string> {
    const pieces: string[] = [];
    try {
      const stat = await fs.stat(this.args.specPath);
      pieces.push(`${this.args.specPath}:${stat.mtimeMs}`);
    } catch {
      pieces.push(`${this.args.specPath}:missing`);
    }
    try {
      const entries = await fs.readdir(this.args.toolsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) {
          continue;
        }
        const full = path.join(this.args.toolsDir, entry.name);
        const stat = await fs.stat(full);
        pieces.push(`${full}:${stat.mtimeMs}`);
      }
    } catch {
      pieces.push(`${this.args.toolsDir}:missing`);
    }
    return pieces.sort().join("|");
  }

  private async loadFromSpec(): Promise<ToolDefinition[]> {
    try {
      const raw = await fs.readFile(this.args.specPath, "utf-8");
      const parsed = JSON.parse(extractJsonFromMarkdown(raw)) as {
        tools?: Array<{
          name?: string;
          description?: string;
          when_to_use?: string[];
          input?: Record<string, string>;
        }>;
      };
      const result: ToolDefinition[] = [];
      for (const item of parsed.tools ?? []) {
        const normalized = normalizeTool({
          name: item.name,
          description: item.description,
          whenToUse: item.when_to_use,
          inputSchema: item.input
        });
        if (normalized) {
          result.push(normalized);
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  private async loadFromDirectory(): Promise<ToolDefinition[]> {
    try {
      const entries = await fs.readdir(this.args.toolsDir, { withFileTypes: true });
      const tools: ToolDefinition[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) {
          continue;
        }
        const full = path.join(this.args.toolsDir, entry.name);
        try {
          const raw = await fs.readFile(full, "utf-8");
          const parsed = JSON.parse(raw) as Partial<ToolDefinition>;
          const normalized = normalizeTool(parsed);
          if (normalized) {
            tools.push(normalized);
          }
        } catch {
          // Ignore invalid tool files to keep service resilient.
        }
      }
      return tools;
    } catch {
      return [];
    }
  }
}

