import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_CHAT_MODEL: z.string().min(1).default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  SQLITE_DB_PATH: z.string().min(1).default("./data/assistant.db"),
  QDRANT_URL: z.string().url(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION_NAME: z.string().min(1).default("memories"),
  OBSIDIAN_VAULT_PATH: z.string().min(1),
  EXECUTOR_MODE: z.enum(["llm", "opencode"]).default("llm"),
  WEB_SEARCH_MODE: z.enum(["mock"]).default("mock"),
  ALLOWED_TELEGRAM_USER_ID: z.string().min(1),
  RAG_TOP_K: z
    .string()
    .default("5")
    .transform((value) => Number(value))
    .pipe(z.number().int().min(1).max(20))
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(): AppConfig {
  return schema.parse(process.env);
}

