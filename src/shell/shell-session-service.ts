import path from "node:path";

function normalizeRoots(roots: string[]): string[] {
  return roots
    .map((root) => path.resolve(root.trim()))
    .filter(Boolean);
}

function ensureWithinAllowedRoots(target: string, allowedRoots: string[]): void {
  const resolved = path.resolve(target);
  const allowed = allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  if (!allowed) {
    throw new Error("filesystem_path_not_allowed");
  }
}

export class ShellSessionService {
  private readonly allowedRoots: string[];
  private readonly sessions = new Map<string, string>();

  public constructor(allowedRoots: string[]) {
    this.allowedRoots = normalizeRoots(allowedRoots);
    if (!this.allowedRoots.length) {
      throw new Error("filesystem_no_allowed_roots");
    }
  }

  public getCurrentDirectory(chatId: string): string {
    return this.sessions.get(chatId) ?? this.allowedRoots[0];
  }

  public changeDirectory(chatId: string, target: string): string {
    const resolved = this.resolvePath(chatId, target);
    ensureWithinAllowedRoots(resolved, this.allowedRoots);
    this.sessions.set(chatId, resolved);
    return resolved;
  }

  public resolvePath(chatId: string, target: string): string {
    const currentDir = this.getCurrentDirectory(chatId);
    const candidate = target.trim() === "" ? currentDir : path.resolve(currentDir, target);
    ensureWithinAllowedRoots(candidate, this.allowedRoots);
    return candidate;
  }
}
