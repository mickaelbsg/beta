import fs from "node:fs/promises";
import path from "node:path";

interface FileSystemServiceArgs {
  enabled: boolean;
  allowedRoots: string[];
}

function normalizeRoots(roots: string[]): string[] {
  return roots
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(item));
}

function ensureWithinAllowedRoots(target: string, allowedRoots: string[]): void {
  const resolved = path.resolve(target);
  const isAllowed = allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  if (!isAllowed) {
    throw new Error("filesystem_path_not_allowed");
  }
}

function parseTargetPath(input: string): string {
  const cleaned = input.trim();
  if (!cleaned) {
    throw new Error("filesystem_missing_path");
  }
  return path.resolve(cleaned);
}

function splitPathAndContent(input: string): { targetPath: string; content: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("filesystem_missing_path");
  }
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace < 0) {
    return { targetPath: parseTargetPath(trimmed), content: "" };
  }
  const rawPath = trimmed.slice(0, firstSpace);
  const content = trimmed.slice(firstSpace + 1).trim();
  return {
    targetPath: parseTargetPath(rawPath),
    content
  };
}

export class FileSystemService {
  private readonly enabled: boolean;
  private readonly allowedRoots: string[];

  public constructor(args: FileSystemServiceArgs) {
    this.enabled = args.enabled;
    this.allowedRoots = normalizeRoots(args.allowedRoots);
  }

  public listAllowedRoots(): string[] {
    return [...this.allowedRoots];
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async listDirectory(inputPath: string): Promise<string[]> {
    this.assertEnabled();
    const targetPath = parseTargetPath(inputPath);
    ensureWithinAllowedRoots(targetPath, this.allowedRoots);
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    return entries.map((entry) => (entry.isDirectory() ? `[dir] ${entry.name}` : `[file] ${entry.name}`));
  }

  public async readFile(inputPath: string, maxChars = 8000): Promise<string> {
    this.assertEnabled();
    const targetPath = parseTargetPath(inputPath);
    ensureWithinAllowedRoots(targetPath, this.allowedRoots);
    const content = await fs.readFile(targetPath, "utf-8");
    return content.length <= maxChars ? content : `${content.slice(0, maxChars)}\n\n...[truncado]`;
  }

  public async writeFile(rawInput: string): Promise<string> {
    this.assertEnabled();
    const { targetPath, content } = splitPathAndContent(rawInput);
    if (!content) {
      throw new Error("filesystem_missing_content");
    }
    ensureWithinAllowedRoots(targetPath, this.allowedRoots);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, "utf-8");
    return targetPath;
  }

  public async appendFile(rawInput: string): Promise<string> {
    this.assertEnabled();
    const { targetPath, content } = splitPathAndContent(rawInput);
    if (!content) {
      throw new Error("filesystem_missing_content");
    }
    ensureWithinAllowedRoots(targetPath, this.allowedRoots);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.appendFile(targetPath, `${content}\n`, "utf-8");
    return targetPath;
  }

  public async findPaths(query: string, rootPath?: string, maxResults = 50): Promise<string[]> {
    this.assertEnabled();
    const trimmed = query.trim();
    if (!trimmed) {
      throw new Error("filesystem_missing_query");
    }

    const searchRoots = rootPath ? [parseTargetPath(rootPath)] : this.allowedRoots;
    for (const root of searchRoots) {
      ensureWithinAllowedRoots(root, this.allowedRoots);
    }

    const normalizedQuery = trimmed.toLowerCase();
    const results: string[] = [];
    const queue = [...searchRoots];

    while (queue.length > 0 && results.length < maxResults) {
      const current = queue.shift()!;
      let entries;
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.name.toLowerCase().includes(normalizedQuery)) {
          results.push(fullPath);
          if (results.length >= maxResults) {
            break;
          }
        }
        if (entry.isDirectory()) {
          queue.push(fullPath);
        }
      }
    }

    return results;
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new Error("filesystem_disabled");
    }
    if (!this.allowedRoots.length) {
      throw new Error("filesystem_no_allowed_roots");
    }
  }
}
