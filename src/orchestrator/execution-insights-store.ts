import type { ExecutionSnapshot } from "../shared/types.js";

export class ExecutionInsightsStore {
  private latest: ExecutionSnapshot | null = null;

  public record(snapshot: ExecutionSnapshot): void {
    this.latest = snapshot;
  }

  public getLatest(): ExecutionSnapshot | null {
    return this.latest;
  }
}

