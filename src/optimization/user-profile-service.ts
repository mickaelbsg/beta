import fs from "node:fs/promises";
import path from "node:path";

export type UserResponseStyle = "short" | "detailed";

interface UserProfile {
  responseStyle: UserResponseStyle;
  updatedAt: string;
}

interface ProfileStore {
  users: Record<string, UserProfile>;
}

const defaultStore: ProfileStore = { users: {} };

export class UserProfileService {
  private store: ProfileStore = { ...defaultStore };

  public constructor(private readonly storePath: string) {}

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.storePath, "utf-8");
      const parsed = JSON.parse(raw) as ProfileStore;
      this.store = {
        users: parsed.users ?? {}
      };
    } catch {
      await this.persist();
    }
  }

  public getResponseStyle(userId: string): UserResponseStyle {
    return this.store.users[userId]?.responseStyle ?? "short";
  }

  public async setResponseStyle(userId: string, responseStyle: UserResponseStyle): Promise<void> {
    this.store.users[userId] = {
      responseStyle,
      updatedAt: new Date().toISOString()
    };
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.storePath, JSON.stringify(this.store, null, 2), "utf-8");
  }
}
