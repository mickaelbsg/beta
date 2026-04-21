import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1"),
  OPENAI_FALLBACK_MODEL: z.string().min(1).default("gh/gpt-5-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  LLM_PROVIDER: z.enum(["omniroute", "openai"]).default("omniroute"),
  OMNIROUTE_BASE_URL: z.string().url().default("http://localhost:20128/v1"),
  OMNIROUTE_API_KEY: z.string().optional(),
  SQLITE_DB_PATH: z.string().min(1).default("./data/assistant.db"),
  QDRANT_URL: z.string().url(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION_NAME: z.string().min(1).default("memories"),
  OBSIDIAN_VAULT_PATH: z.string().min(1).default("./memoria_beta"),
  EXECUTOR_MODE: z.enum(["llm", "opencode"]).default("llm"),
  WEB_SEARCH_PROVIDER: z
    .enum(["tavily", "serpapi", "ddg", "google_scrape", "mock"])
    .default("google_scrape"),
  TAVILY_API_KEY: z.string().optional(),
  SERPAPI_API_KEY: z.string().optional(),
  WEB_AGENT_ENABLE_BROWSER: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  WEB_AGENT_BROWSER_TOP_PAGES: z
    .string()
    .default("2")
    .transform((value) => Number(value))
    .pipe(z.number().int().min(0).max(3)),
  WEB_AGENT_TIMEOUT_MS: z
    .string()
    .default("8000")
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1000).max(20000)),
  ALLOWED_TELEGRAM_USER_ID: z.string().min(1),
  RAG_TOP_K: z
    .string()
    .default("5")
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1).max(20)),
  RAG_MIN_RELEVANCE_SCORE: z
    .string()
    .default("0.45")
    .transform((value) => Number(value))
    .pipe(z.number().min(0).max(1)),
  MEMORY_SAVE_THRESHOLD: z
    .string()
    .default("0.7")
    .transform((value) => Number(value))
    .pipe(z.number().min(0).max(1)),
  MEMORY_SEMANTIC_DUPLICATE_SCORE: z
    .string()
    .default("0.92")
    .transform((value) => Number(value))
    .pipe(z.number().min(0).max(1)),
  MEMORY_FREQUENCY_WINDOW_MS: z
    .string()
    .default("600000")
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1000)),
  INTENT_LLM_FALLBACK_THRESHOLD: z
    .string()
    .default("0.75")
    .transform((value) => Number(value))
    .pipe(z.number().min(0).max(1)),
  WEB_SEARCH_TIMEOUT_MS: z
    .string()
    .default("5000")
    .transform((value) => Number(value))
    .pipe(z.number().int().min(500)),
  AGENT_LOG_PATH: z.string().min(1).default("./logs/agent-log.jsonl"),
  OPTIMIZER_WINDOW_SIZE: z
    .string()
    .default("500")
    .transform((value) => Number(value))
    .pipe(z.number().int().min(50).max(5000)),
  ALERTS_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  ALERT_COOLDOWN_MS: z
    .string()
    .default("600000")
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1000)),
  ALERT_STATE_PATH: z.string().min(1).default("./data/alert-state.json"),
  FAST_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  LLM_ANALYZER_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  TOOL_USAGE_MIN_RATE: z
    .string()
    .default("0.20")
    .transform((value) => Number(value))
    .pipe(z.number().min(0).max(1)),
  FEEDBACK_STORE_PATH: z.string().min(1).default("./data/feedback.json"),
  USER_PROFILE_STORE_PATH: z.string().min(1).default("./data/user-profiles.json"),
  RUNTIME_CONFIG_PATH: z.string().min(1).default("./data/runtime-config.json"),
  DEBUG_MODE_STORE_PATH: z.string().min(1).default("./data/debug-mode.json"),
  SOUL_PROMPT_PATH: z.string().min(1).default("./soul.md"),
  TOOLS_SPEC_PATH: z.string().min(1).default("./tools-contract-spec.md"),
  TOOLS_REGISTRY_DIR: z.string().min(1).default("./tools"),
  FILESYSTEM_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  FILESYSTEM_ALLOWED_ROOTS: z
    .string()
    .default("./vault,/home/pc/projetos/obsidian")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string()))
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(): AppConfig {
  return schema.parse(process.env);
}
