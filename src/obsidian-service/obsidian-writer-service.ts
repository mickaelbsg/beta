import fs from "node:fs/promises";
import path from "node:path";
import { ObsidianService } from "./obsidian-service.js";
import { logger } from "../shared/logger.js";

export interface StructuredNoteInput {
  title: string;
  content: string;
  type?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

interface SaveMemoryInput {
  chatId: string;
  content: string;
  source?: string;
}

function normalize(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function slug(input: string): string {
  return normalize(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function detectPersonalInfo(content: string): boolean {
  const normalized = content.toLowerCase();
  return (
    normalized.includes("meu nome e") ||
    normalized.includes("meu nome é") ||
    normalized.includes("eu trabalho com") ||
    normalized.includes("eu uso")
  );
}

function extractProfileUpdate(content: string): string[] {
  const normalized = content.toLowerCase();
  const updates: string[] = [];

  const nameMatch = content.match(/meu nome é?\s+([^\n,.!]+)/i);
  if (nameMatch?.[1]) {
    updates.push(`- Nome: ${nameMatch[1].trim()}`);
  }

  const areaMatch = content.match(/eu trabalho com\s+([^\n,.!]+)/i);
  if (areaMatch?.[1]) {
    updates.push(`- Área: ${areaMatch[1].trim()}`);
  }

  const useMatch = content.match(/eu uso\s+([^\n,.!]+)/i);
  if (useMatch?.[1]) {
    updates.push(`- ${useMatch[1].trim()}`);
  }

  if (!updates.length && normalized) {
    updates.push(`- ${normalize(content)}`);
  }

  return updates;
}

function buildProfileTemplate(): string {
  return [
    "# Perfil do Usuário",
    "",
    "## Identidade",
    "- Nome:",
    "- Área:",
    "",
    "## Preferências",
    "-",
    "",
    "## Contexto relevante",
    "-"
  ].join("\n");
}

function buildJournalTemplate(date: string): string {
  return [
    `# Diário — ${date}`,
    "",
    "## Atividades",
    "-",
    "",
    "## Aprendizados",
    "-",
    "",
    "## Bugs / Problemas",
    "-"
  ].join("\n");
}

async function ensureFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
  }
}

export class ObsidianWriterService {
  public constructor(private readonly obsidianService: ObsidianService) {}

  private get vaultPath(): string {
    return this.obsidianService.getVaultPath();
  }

  public async writeStructuredNote(input: StructuredNoteInput) {
    const note = await this.obsidianService.createNote({
      title: input.title,
      content: input.content,
      type: input.type,
      tags: input.tags,
      metadata: {
        source: input.metadata?.source ?? "cli",
        ...input.metadata
      }
    });

    logger.info("obsidian_note_written", {
      module: "ObsidianWriterService",
      action: "writeStructuredNote",
      title: note.title,
      type: note.type,
      filePath: note.filePath,
      duplicated: note.duplicated,
      error: null
    });

    return note;
  }

  public async saveMemoryToObsidian(input: SaveMemoryInput): Promise<{ filePath: string; updated: boolean }> {
    const content = normalize(input.content);
    const source = input.source ?? "telegram";
    const base = this.vaultPath;

    const profilePath = path.join(base, "knowledge", "user", "profile.md");
    const journalPath = path.join(base, "journal", `${new Date().toISOString().slice(0, 10)}.md`);

    if (detectPersonalInfo(content)) {
      await ensureFile(profilePath, buildProfileTemplate());
      let profile = await fs.readFile(profilePath, "utf-8");
      let updated = false;

      const nameMatch = content.match(/meu nome é?\s+([^\n,.!]+)/i);
      if (nameMatch?.[1]) {
        const name = nameMatch[1].trim();
        if (!profile.includes(`- Nome: ${name}`)) {
          profile = profile.replace(/- Nome:.*?\n/i, `- Nome: ${name}\n`);
          updated = true;
        }
      }

      const areaMatch = content.match(/eu trabalho com\s+([^\n,.!]+)/i);
      if (areaMatch?.[1]) {
        const area = areaMatch[1].trim();
        if (!profile.includes(`- Área: ${area}`)) {
          profile = profile.replace(/- Área:.*?\n/i, `- Área: ${area}\n`);
          updated = true;
        }
      }

      const updates = extractProfileUpdate(content).filter((line) => !profile.includes(line));
      if (updates.length) {
        profile = `${profile.trim()}\n${updates.join("\n")}\n`;
        updated = true;
      }

      if (updated) {
        await fs.writeFile(profilePath, profile, "utf-8");
      }
      return { filePath: profilePath, updated };
    }

    if (/aprendi|aprendizado|problema|bug|solucao|solução/i.test(content)) {
      await ensureFile(journalPath, buildJournalTemplate(new Date().toISOString().slice(0, 10)));
      const existing = await fs.readFile(journalPath, "utf-8");
      if (!existing.toLowerCase().includes(content.toLowerCase())) {
        const next = `${existing.trim()}\n- ${content}\n`;
        await fs.writeFile(journalPath, next, "utf-8");
        return { filePath: journalPath, updated: true };
      }
      return { filePath: journalPath, updated: false };
    }

    const inboxPath = path.join(base, "inbox", `${slug(content) || "nota"}.md`);
    await fs.mkdir(path.dirname(inboxPath), { recursive: true });
    try {
      const existing = await fs.readFile(inboxPath, "utf-8");
      if (existing.toLowerCase().includes(content.toLowerCase())) {
        return { filePath: inboxPath, updated: false };
      }
    } catch {
      // file does not exist
    }

    const note = [
      `# ${content.slice(0, 60)}`,
      "",
      "## Type",
      "knowledge",
      "",
      "## Content",
      content,
      "",
      "## Tags",
      "#auto",
      "",
      "## Metadata",
      `created_at: ${new Date().toISOString()}`,
      `source: ${source}`
    ].join("\n");
    await fs.writeFile(inboxPath, note, "utf-8");
    return { filePath: inboxPath, updated: true };
  }

  public async searchObsidian(query: string): Promise<string[]> {
    const normalized = normalize(query).toLowerCase();
    const matches: string[] = [];

    // 1. Sempre carregar o perfil do usuário
    try {
      const profilePath = path.join(this.vaultPath, "knowledge", "user", "profile.md");
      const profileContent = await fs.readFile(profilePath, "utf-8");
      matches.push("CONTEXTO DO USUÁRIO (profile.md):");
      matches.push(profileContent.trim());
    } catch {
      // Perfil não existe
    }

    // 2. Sempre carregar as notas mais recentes do Inbox para contexto imediato
    try {
      const inboxFiles = await this.readMarkdownFiles(path.join(this.vaultPath, "inbox"));
      const recent = inboxFiles.slice(-5);
      if (recent.length > 0) {
        matches.push("\nNOTAS RECENTES NO INBOX:");
        for (const file of recent) {
          const content = await fs.readFile(file, "utf-8");
          const title = path.basename(file, ".md");
          matches.push(`- [${title}]: ${content.split("## Content")[1]?.split("## Tags")[0]?.trim() || content.trim()}`);
        }
      }
    } catch {
      // Inbox vazio ou inacessível
    }

    if (!normalized || normalized.length < 3) {
      return matches;
    }

    const roots = [
      path.join(this.vaultPath, "knowledge"),
      path.join(this.vaultPath, "journal")
    ];

    const terms = normalized.split(/\s+/).filter(t => t.length > 2);

    for (const root of roots) {
      const files = await this.readMarkdownFiles(root);
      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");
        const lowerContent = content.toLowerCase();

        // Busca se contém todos os termos ou a frase exata
        if (lowerContent.includes(normalized) || terms.every(t => lowerContent.includes(t))) {
          const lines = content.split("\n");
          for (const line of lines) {
            if (line.toLowerCase().includes(normalized) || terms.some(t => line.toLowerCase().includes(t))) {
              matches.push(line.trim());
              break;
            }
          }
        }
      }
    }

    return matches.slice(0, 12);
  }

  private async readMarkdownFiles(root: string): Promise<string[]> {
    try {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) {
        return [];
      }
    } catch {
      return [];
    }

    const entries = await fs.readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.readMarkdownFiles(full)));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(full);
      }
    }
    return files;
  }
}
