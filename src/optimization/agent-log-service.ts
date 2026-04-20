import fs from "node:fs/promises";
import path from "node:path";

export interface AgentLogEntryV2 {
  timestamp: string;
  session_id: string;
  user_id: string;
  intent: string;
  latency_ms: number;
  input_length: number;
  output_length: number;
  rag: {
    found: number;
    used: number;
    filtered: number;
  };
  memory: {
    score: number;
    saved: boolean;
  };
  tools: {
    available: string[];
    used: string[];
    latency_ms: number;
    success: boolean;
  };
  executor: {
    provider: string;
    model: string;
    latency_ms: number;
  };
  errors: string | null;
}

type LegacyAgentLogEntry = {
  timestamp?: string;
  intent?: string;
  latency_ms?: number;
  rag_found?: number;
  rag_used?: number;
  memory_saved?: boolean;
  tool_available?: string[];
  tool_used?: string[];
  error?: string;
};

function clampNumber(input: unknown, fallback = 0): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(input: unknown, fallback = ""): string {
  const value = String(input ?? "").trim();
  return value || fallback;
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((item) => String(item)).filter(Boolean);
}

function toV2(raw: unknown): AgentLogEntryV2 | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;

  const hasV2 =
    value.session_id !== undefined &&
    value.user_id !== undefined &&
    value.rag &&
    value.memory &&
    value.tools &&
    value.executor;

  if (hasV2) {
    const rag = (value.rag as Record<string, unknown>) ?? {};
    const memory = (value.memory as Record<string, unknown>) ?? {};
    const tools = (value.tools as Record<string, unknown>) ?? {};
    const executor = (value.executor as Record<string, unknown>) ?? {};
    return {
      timestamp: normalizeText(value.timestamp, new Date().toISOString()),
      session_id: normalizeText(value.session_id, "unknown_session"),
      user_id: normalizeText(value.user_id, "unknown_user"),
      intent: normalizeText(value.intent, "CHAT"),
      latency_ms: clampNumber(value.latency_ms, clampNumber((executor.latency_ms as number) ?? 0)),
      input_length: clampNumber(value.input_length),
      output_length: clampNumber(value.output_length),
      rag: {
        found: clampNumber(rag.found),
        used: clampNumber(rag.used),
        filtered: clampNumber(rag.filtered)
      },
      memory: {
        score: clampNumber(memory.score),
        saved: Boolean(memory.saved)
      },
      tools: {
        available: normalizeStringList(tools.available),
        used: normalizeStringList(tools.used),
        latency_ms: clampNumber(tools.latency_ms),
        success: tools.success === undefined ? true : Boolean(tools.success)
      },
      executor: {
        provider: normalizeText(executor.provider, "unknown"),
        model: normalizeText(executor.model, "unknown"),
        latency_ms: clampNumber(executor.latency_ms)
      },
      errors: value.errors ? String(value.errors) : null
    };
  }

  const legacy = value as LegacyAgentLogEntry;
  const found = clampNumber(legacy.rag_found);
  const used = clampNumber(legacy.rag_used);
  return {
    timestamp: normalizeText(legacy.timestamp, new Date().toISOString()),
    session_id: "legacy_session",
    user_id: "legacy_user",
    intent: normalizeText(legacy.intent, "CHAT"),
    latency_ms: clampNumber(legacy.latency_ms),
    input_length: 0,
    output_length: 0,
    rag: {
      found,
      used,
      filtered: Math.max(0, found - used)
    },
    memory: {
      score: legacy.memory_saved ? 1 : 0,
      saved: Boolean(legacy.memory_saved)
    },
    tools: {
      available: normalizeStringList(legacy.tool_available),
      used: normalizeStringList(legacy.tool_used),
      latency_ms: 0,
      success: !legacy.error
    },
    executor: {
      provider: "legacy",
      model: "legacy",
      latency_ms: clampNumber(legacy.latency_ms)
    },
    errors: legacy.error ?? null
  };
}

export class AgentLogService {
  public constructor(private readonly logPath: string) {}

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.logPath), { recursive: true });
    try {
      await fs.access(this.logPath);
    } catch {
      await fs.writeFile(this.logPath, "", "utf-8");
    }
  }

  public async append(entry: AgentLogEntryV2): Promise<void> {
    await fs.appendFile(this.logPath, `${JSON.stringify(entry)}\n`, "utf-8");
  }

  public async readRecent(limit = 500): Promise<AgentLogEntryV2[]> {
    try {
      const raw = await fs.readFile(this.logPath, "utf-8");
      const lines = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const selected = lines.slice(-limit);
      const parsed: AgentLogEntryV2[] = [];
      for (const line of selected) {
        try {
          const candidate = toV2(JSON.parse(line));
          if (candidate) {
            parsed.push(candidate);
          }
        } catch {
          // Ignore malformed lines to keep optimizer resilient.
        }
      }
      return parsed;
    } catch {
      return [];
    }
  }
}
