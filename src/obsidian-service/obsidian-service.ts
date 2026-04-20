import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

interface CreateNoteInput {
  title: string;
  content: string;
}

export interface CreatedNote {
  filePath: string;
  title: string;
  content: string;
  duplicated: boolean;
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function hashText(input: string): string {
  return crypto.createHash("sha256").update(input.trim()).digest("hex");
}

function renderMarkdown(title: string, content: string): string {
  return `# ${title}\n\n- Date: ${new Date().toISOString()}\n\n${content.trim()}\n`;
}

export class ObsidianService {
  public constructor(private readonly vaultPath: string) {}

  public async init(): Promise<void> {
    await fs.mkdir(this.vaultPath, { recursive: true });
  }

  public async createNote(input: CreateNoteInput): Promise<CreatedNote> {
    const normalizedTitle = input.title.trim() || "nota";
    const filename = `${slugify(normalizedTitle) || "nota"}.md`;
    const filePath = path.join(this.vaultPath, filename);
    const rendered = renderMarkdown(normalizedTitle, input.content);
    const requestedHash = hashText(input.content);

    try {
      const existing = await fs.readFile(filePath, "utf-8");
      const existingHash = hashText(existing);
      if (existingHash === requestedHash || existing.includes(input.content.trim())) {
        return {
          filePath,
          title: normalizedTitle,
          content: input.content,
          duplicated: true
        };
      }
    } catch {
      // File does not exist; continue.
    }

    await fs.writeFile(filePath, rendered, "utf-8");
    return {
      filePath,
      title: normalizedTitle,
      content: input.content,
      duplicated: false
    };
  }

  public async appendToNote(filePath: string, content: string): Promise<void> {
    await fs.appendFile(filePath, `\n${content.trim()}\n`, "utf-8");
  }

  public async searchNotes(query: string): Promise<string[]> {
    const normalized = query.toLowerCase().trim();
    const files = await fs.readdir(this.vaultPath);
    const matched: string[] = [];
    for (const file of files) {
      if (!file.endsWith(".md")) {
        continue;
      }
      const fullPath = path.join(this.vaultPath, file);
      const content = await fs.readFile(fullPath, "utf-8");
      if (file.toLowerCase().includes(normalized) || content.toLowerCase().includes(normalized)) {
        matched.push(fullPath);
      }
    }
    return matched;
  }
}

