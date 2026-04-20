import fs from "node:fs/promises";
import path from "node:path";

type FeedbackValue = "up" | "down";

interface FeedbackRecord {
  timestamp: string;
  userId: string;
  chatId: string;
  value: FeedbackValue;
}

interface FeedbackStore {
  records: FeedbackRecord[];
}

const defaultStore: FeedbackStore = {
  records: []
};

export class FeedbackService {
  private store: FeedbackStore = { ...defaultStore };

  public constructor(private readonly storePath: string) {}

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.storePath, "utf-8");
      const parsed = JSON.parse(raw) as FeedbackStore;
      this.store = {
        records: Array.isArray(parsed.records) ? parsed.records : []
      };
    } catch {
      await this.persist();
    }
  }

  public async addFeedback(userId: string, chatId: string, value: FeedbackValue): Promise<void> {
    this.store.records.push({
      timestamp: new Date().toISOString(),
      userId,
      chatId,
      value
    });
    if (this.store.records.length > 2000) {
      this.store.records = this.store.records.slice(-1000);
    }
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.storePath, JSON.stringify(this.store, null, 2), "utf-8");
  }
}
