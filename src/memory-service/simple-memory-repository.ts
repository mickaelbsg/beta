import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

export interface SimpleMemory {
  id: string;
  chatId: string;
  content: string;
  createdAt: number;
}

export class SimpleMemoryRepository {
  private db: Database.Database | null = null;

  public constructor(private readonly dbPath: string) {}

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS simple_memories (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  public async save(memory: Omit<SimpleMemory, "id" | "createdAt"> & { id?: string; createdAt?: number }): Promise<SimpleMemory> {
    if (!this.db) {
      throw new Error("simple_memory_not_initialized");
    }
    const record: SimpleMemory = {
      id: memory.id ?? crypto.randomUUID(),
      chatId: memory.chatId,
      content: memory.content.trim(),
      createdAt: memory.createdAt ?? Date.now()
    };

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO simple_memories (id, chat_id, content, created_at)
      VALUES (@id, @chat_id, @content, @created_at)
    `);
    stmt.run({
      id: record.id,
      chat_id: record.chatId,
      content: record.content,
      created_at: record.createdAt
    });

    return record;
  }

  public async listByChat(chatId: string, limit = 100): Promise<SimpleMemory[]> {
    if (!this.db) {
      throw new Error("simple_memory_not_initialized");
    }

    const stmt = this.db.prepare(`
      SELECT id, chat_id, content, created_at
      FROM simple_memories
      WHERE chat_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(chatId, limit) as Array<{
      id: string;
      chat_id: string;
      content: string;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      chatId: row.chat_id,
      content: row.content,
      createdAt: row.created_at
    }));
  }

  public async search(chatId: string, query: string, limit = 10): Promise<SimpleMemory[]> {
    const normalizedQuery = query.toLowerCase().trim();
    const memories = await this.listByChat(chatId, 300);
    return memories
      .filter((memory) => memory.content.toLowerCase().includes(normalizedQuery))
      .slice(0, limit);
  }
}
