import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import type { ConversationMessage, HistoryRepository } from "../shared/types.js";

export class SqliteHistoryRepository implements HistoryRepository {
  private db: Database.Database | null = null;

  public constructor(private readonly dbPath: string) {
    // Open lazily in init after ensuring parent directory exists.
  }

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        intent TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_events (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);
  }

  public async saveMessage(message: ConversationMessage): Promise<void> {
    if (!this.db) {
      throw new Error("sqlite_not_initialized");
    }
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO messages (id, chat_id, role, content, intent, timestamp)
      VALUES (@id, @chat_id, @role, @content, @intent, @timestamp)
    `);
    stmt.run({
      id: message.id,
      chat_id: message.chatId,
      role: message.role,
      content: message.content,
      intent: message.intent,
      timestamp: message.timestamp
    });
  }

  public async getRecentMessages(chatId: string, limit: number): Promise<ConversationMessage[]> {
    if (!this.db) {
      throw new Error("sqlite_not_initialized");
    }
    const stmt = this.db.prepare(`
      SELECT id, chat_id, role, content, intent, timestamp
      FROM messages
      WHERE chat_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(chatId, limit) as Array<{
      id: string;
      chat_id: string;
      role: ConversationMessage["role"];
      content: string;
      intent: ConversationMessage["intent"];
      timestamp: string;
    }>;

    return rows
      .map((row) => ({
        id: row.id,
        chatId: row.chat_id,
        role: row.role,
        content: row.content,
        intent: row.intent,
        timestamp: row.timestamp
      }))
      .reverse();
  }

  public async getMessagesByDate(chatId: string, date: string): Promise<ConversationMessage[]> {
    if (!this.db) {
      throw new Error("sqlite_not_initialized");
    }
    const start = `${date}T00:00:00.000Z`;
    const endDate = new Date(`${date}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const end = endDate.toISOString();

    const stmt = this.db.prepare(`
      SELECT id, chat_id, role, content, intent, timestamp
      FROM messages
      WHERE chat_id = ?
        AND timestamp >= ?
        AND timestamp < ?
      ORDER BY timestamp ASC
    `);
    const rows = stmt.all(chatId, start, end) as Array<{
      id: string;
      chat_id: string;
      role: ConversationMessage["role"];
      content: string;
      intent: ConversationMessage["intent"];
      timestamp: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      chatId: row.chat_id,
      role: row.role,
      content: row.content,
      intent: row.intent,
      timestamp: row.timestamp
    }));
  }

  public async clearChatHistory(chatId: string): Promise<number> {
    if (!this.db) {
      throw new Error("sqlite_not_initialized");
    }
    const stmt = this.db.prepare(`
      DELETE FROM messages
      WHERE chat_id = ?
    `);
    const result = stmt.run(chatId);
    return result.changes;
  }
}
