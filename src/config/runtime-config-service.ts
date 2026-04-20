import fs from "node:fs/promises";
import path from "node:path";

const defaultConfig: Record<string, string> = {
  rag_top_k: "5",
  executor: "llm",
  context_history_limit: "5"
};

export class RuntimeConfigService {
  private cache: Record<string, string> = { ...defaultConfig };

  public constructor(private readonly configPath: string) {}

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    try {
      const raw = await fs.readFile(this.configPath, "utf-8");
      this.cache = {
        ...defaultConfig,
        ...(JSON.parse(raw) as Record<string, string>)
      };
    } catch {
      await this.persist();
    }
  }

  public list(): Record<string, string> {
    return { ...this.cache };
  }

  public get(key: string): string | undefined {
    return this.cache[key];
  }

  public getNumber(key: string, fallback: number): number {
    const value = this.cache[key];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  public async set(key: string, value: string): Promise<void> {
    this.cache[key] = value;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.cache, null, 2), "utf-8");
  }
}
