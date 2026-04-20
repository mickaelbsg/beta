type LogLevel = "INFO" | "WARN" | "ERROR";

function write(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(meta ?? {})
  };
  console.log(JSON.stringify(payload));
}

export const logger = {
  info: (event: string, meta?: Record<string, unknown>) => write("INFO", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => write("WARN", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => write("ERROR", event, meta)
};
