import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteHistoryRepository } from "../src/memory-service/sqlite-history-repository.js";

describe("SqliteHistoryRepository", () => {
  it("stores and retrieves recent messages in ascending order", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "assistant-test-"));
    const dbPath = path.join(tmpDir, "test.db");
    const repo = new SqliteHistoryRepository(dbPath);
    await repo.init();

    await repo.saveMessage({
      id: "1",
      chatId: "chat-1",
      role: "user",
      content: "primeira",
      timestamp: "2026-01-01T00:00:00.000Z",
      intent: "CHAT"
    });
    await repo.saveMessage({
      id: "2",
      chatId: "chat-1",
      role: "assistant",
      content: "segunda",
      timestamp: "2026-01-01T00:00:01.000Z",
      intent: "CHAT"
    });
    await repo.saveMessage({
      id: "3",
      chatId: "chat-1",
      role: "user",
      content: "terceira",
      timestamp: "2026-01-01T00:00:02.000Z",
      intent: "QUERY"
    });

    const recent = await repo.getRecentMessages("chat-1", 2);
    expect(recent.map((m) => m.id)).toEqual(["2", "3"]);

    const deleted = await repo.clearChatHistory("chat-1");
    expect(deleted).toBe(3);
    const afterReset = await repo.getRecentMessages("chat-1", 5);
    expect(afterReset).toEqual([]);
  });
});
