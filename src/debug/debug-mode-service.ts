import fs from "node:fs/promises";
import path from "node:path";

interface DebugModeState {
  users: Record<string, boolean>;
}

const defaultState: DebugModeState = { users: {} };

export class DebugModeService {
  private state: DebugModeState = { ...defaultState };

  public constructor(private readonly statePath: string) {}

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.statePath, "utf-8");
      const parsed = JSON.parse(raw) as DebugModeState;
      this.state = {
        users: parsed.users ?? {}
      };
    } catch {
      await this.persist();
    }
  }

  public isEnabled(userId: string): boolean {
    return Boolean(this.state.users[userId]);
  }

  public async setEnabled(userId: string, enabled: boolean): Promise<void> {
    this.state.users[userId] = enabled;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf-8");
  }
}
