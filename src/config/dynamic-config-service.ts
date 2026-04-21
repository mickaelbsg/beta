import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../shared/logger.js";

export interface LlmProviderConfig {
  id: string;
  name: string;
  type: "omniroute" | "openai" | "anthropic";
  baseUrl?: string;
  apiKey: string;
  enabled: boolean;
}

export interface LlmModelConfig {
  id: string;
  name: string;
  providerId: string;
  isFallback: boolean;
  priority: number;
}

export interface DynamicConfig {
  providers: LlmProviderConfig[];
  models: LlmModelConfig[];
  systemPromptOverride?: string;
}

const defaultConfig: DynamicConfig = {
  providers: [
    {
      id: "omniroute-default",
      name: "OmniRoute",
      type: "omniroute",
      baseUrl: "http://localhost:20128/v1",
      apiKey: "",
      enabled: true
    },
    {
      id: "openai-default",
      name: "OpenAI",
      type: "openai",
      apiKey: "",
      enabled: true
    }
  ],
  models: [
    {
      id: "gemini-3-flash",
      name: "antigravity/gemini-3-flash",
      providerId: "omniroute-default",
      isFallback: false,
      priority: 1
    },
    {
      id: "gpt-4.1",
      name: "gpt-4.1",
      providerId: "openai-default",
      isFallback: true,
      priority: 2
    }
  ]
};

export class DynamicConfigService {
  private config: DynamicConfig = { ...defaultConfig };
  private listeners: (() => void)[] = [];

  public constructor(private readonly configPath: string) {}

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    try {
      const raw = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(raw) as DynamicConfig;
      this.config = {
        ...defaultConfig,
        ...parsed,
        providers: parsed.providers ?? defaultConfig.providers,
        models: parsed.models ?? defaultConfig.models
      };
    } catch {
      logger.info("dynamic_config_not_found_using_default", { path: this.configPath });
      await this.persist();
    }
  }

  public getConfig(): DynamicConfig {
    return { ...this.config };
  }

  public async updateConfig(newConfig: Partial<DynamicConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...newConfig
    };
    await this.persist();
    this.notifyListeners();
  }

  public onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
  }
}
