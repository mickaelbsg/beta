import fs from "node:fs/promises";
import path from "node:path";
import type { AggregatedMetrics } from "./metrics-aggregator.js";
import type { OptimizationIssue } from "./issue-detector.js";

interface AlertState {
  lastSentAt: string | null;
  lastMessage: string | null;
  slowSystemStreak: number;
}

const defaultState: AlertState = {
  lastSentAt: null,
  lastMessage: null,
  slowSystemStreak: 0
};

function minutesAgo(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return diff / 60000;
}

export class AlertService {
  private state: AlertState = { ...defaultState };

  public constructor(
    private readonly statePath: string,
    private readonly alertsEnabled: boolean,
    private readonly cooldownMs: number
  ) {}

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.statePath, "utf-8");
      const parsed = JSON.parse(raw) as AlertState;
      this.state = {
        lastSentAt: parsed.lastSentAt ?? null,
        lastMessage: parsed.lastMessage ?? null,
        slowSystemStreak: Number(parsed.slowSystemStreak ?? 0)
      };
    } catch {
      await this.persist();
    }
  }

  public trackSlowSystem(issues: OptimizationIssue[]): number {
    if (issues.includes("slow_system")) {
      this.state.slowSystemStreak += 1;
    } else {
      this.state.slowSystemStreak = 0;
    }
    return this.state.slowSystemStreak;
  }

  public getSlowSystemStreak(): number {
    return this.state.slowSystemStreak;
  }

  public getLastAlertMessage(): string | null {
    return this.state.lastMessage;
  }

  public async evaluateAndBuildAlert(
    issues: OptimizationIssue[],
    metrics: AggregatedMetrics
  ): Promise<string | null> {
    if (!this.alertsEnabled || !issues.length) {
      await this.persist();
      return null;
    }
    const activeAlerts: string[] = [];
    if (issues.includes("slow_system") && metrics.avgLatencyMs > 1500) {
      activeAlerts.push("Latencia alta detectada por varios ciclos.");
    }
    if (issues.includes("repeated_errors")) {
      activeAlerts.push("Erros repetidos detectados no pipeline.");
    }
    if (issues.includes("tool_ignored")) {
      activeAlerts.push("Tools disponiveis estao sendo pouco usadas.");
    }
    if (!activeAlerts.length) {
      await this.persist();
      return null;
    }

    const nowIso = new Date().toISOString();
    const withinCooldown =
      this.state.lastSentAt !== null &&
      Date.now() - new Date(this.state.lastSentAt).getTime() < this.cooldownMs;
    if (withinCooldown) {
      await this.persist();
      return null;
    }

    const message = ["🚨 ALERTA:", "", ...activeAlerts].join("\n");
    this.state.lastSentAt = nowIso;
    this.state.lastMessage = message;
    await this.persist();
    return message;
  }

  public buildHealthSummary(issues: OptimizationIssue[], metrics: AggregatedMetrics): string {
    const status = issues.length === 0 ? "🟢 Sistema saudavel" : issues.length <= 2 ? "🟡 Sistema degradado" : "🔴 Sistema critico";
    const issueLines = issues.length ? issues.map((item) => `- ${item}`) : ["- sem issues ativos"];
    const lastAlert = this.state.lastSentAt
      ? `Ultimo alerta: ${minutesAgo(this.state.lastSentAt).toFixed(1)} min atras`
      : "Ultimo alerta: nenhum";
    return [
      status,
      "",
      ...issueLines,
      "",
      `Latencia media: ${metrics.avgLatencyMs}ms`,
      `P95 latencia: ${metrics.p95LatencyMs}ms`,
      lastAlert
    ].join("\n");
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf-8");
  }
}
