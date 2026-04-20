type LogLevel = "INFO" | "WARN" | "ERROR";

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  if (meta) {
    console.log(`[${ts}] [${level}] ${message}`, meta);
    return;
  }
  console.log(`[${ts}] [${level}] ${message}`);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("INFO", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("WARN", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("ERROR", message, meta)
};

