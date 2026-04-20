import { RuntimeConfigService } from "../config/runtime-config-service.js";
import type { AgentLogEntryV2 } from "./agent-log-service.js";
import { AgentLogService } from "./agent-log-service.js";
import { AlertService } from "./alert-service.js";
import { IssueDetector, type OptimizationIssue } from "./issue-detector.js";
import { MetricsAggregator, type AggregatedMetrics } from "./metrics-aggregator.js";

interface OptimizationAdjustment {
  key: string;
  from: string;
  to: string;
}

interface LlmAnalyzer {
  suggest(input: {
    metrics: AggregatedMetrics;
    issues: OptimizationIssue[];
  }): Promise<string[]>;
}

export interface OptimizationResult {
  metrics: AggregatedMetrics;
  issues: OptimizationIssue[];
  adjustments: OptimizationAdjustment[];
  suggestions: string[];
  alertMessage: string | null;
}

interface SelfOptimizationArgs {
  runtimeConfigService: RuntimeConfigService;
  agentLogService: AgentLogService;
  alertService: AlertService;
  llmAnalyzer?: LlmAnalyzer;
  windowSize: number;
  toolUsageMinRate: number;
  fastModel: string;
}

function toFixed(value: number): string {
  return value.toFixed(2);
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function clampFloat(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class SelfOptimizationService {
  private readonly metricsAggregator = new MetricsAggregator();
  private readonly issueDetector: IssueDetector;
  private readonly windowSize: number;
  private readonly fastModel: string;

  public constructor(private readonly args: SelfOptimizationArgs) {
    this.issueDetector = new IssueDetector({
      toolUsageMinRate: args.toolUsageMinRate
    });
    this.windowSize = args.windowSize;
    this.fastModel = args.fastModel;
  }

  public async getMetrics(): Promise<AggregatedMetrics> {
    const entries = await this.args.agentLogService.readRecent(this.windowSize);
    return this.metricsAggregator.compute(entries);
  }

  public async diagnose(): Promise<{
    metrics: AggregatedMetrics;
    issues: OptimizationIssue[];
    alertMessage: string | null;
  }> {
    const metrics = await this.getMetrics();
    const issues = this.issueDetector.detect(metrics);
    const alertMessage = await this.args.alertService.evaluateAndBuildAlert(issues, metrics);
    return { metrics, issues, alertMessage };
  }

  public async optimize(): Promise<OptimizationResult> {
    const { metrics, issues, alertMessage } = await this.diagnose();
    const adjustments = await this.applyAdjustments(issues);
    const suggestions = await this.buildSuggestions(metrics, issues);
    return {
      metrics,
      issues,
      adjustments,
      suggestions,
      alertMessage
    };
  }

  private async applyAdjustments(issues: OptimizationIssue[]): Promise<OptimizationAdjustment[]> {
    const adjustments: OptimizationAdjustment[] = [];
    const currentRagTopK = this.args.runtimeConfigService.getNumber("rag_top_k", 5);
    const currentMemoryThreshold = this.args.runtimeConfigService.getNumber(
      "memory_save_threshold",
      0.7
    );
    const currentHistoryLimit = this.args.runtimeConfigService.getNumber("context_history_limit", 5);
    const currentModel = this.args.runtimeConfigService.get("openai_model") ?? "";

    let nextRagTopK = currentRagTopK;
    let nextMemoryThreshold = currentMemoryThreshold;
    let nextHistoryLimit = currentHistoryLimit;
    let nextModel = currentModel;

    if (issues.includes("low_rag_quality")) {
      nextRagTopK = clampInteger(currentRagTopK - 1, 2, 10);
    }
    if (issues.includes("memory_spam")) {
      nextMemoryThreshold = clampFloat(currentMemoryThreshold + 0.05, 0.6, 0.95);
    }

    const slowSystemStreak = this.args.alertService.trackSlowSystem(issues);
    if (issues.includes("slow_system")) {
      nextRagTopK = clampInteger(nextRagTopK - 1, 2, 10);
      nextHistoryLimit = clampInteger(currentHistoryLimit - 1, 3, 8);
      if (slowSystemStreak >= 2 && this.fastModel) {
        nextModel = this.fastModel;
      }
    }

    if (nextRagTopK !== currentRagTopK) {
      await this.args.runtimeConfigService.set("rag_top_k", String(nextRagTopK));
      adjustments.push({
        key: "RAG_TOP_K",
        from: String(currentRagTopK),
        to: String(nextRagTopK)
      });
    }
    if (nextMemoryThreshold !== currentMemoryThreshold) {
      await this.args.runtimeConfigService.set("memory_save_threshold", toFixed(nextMemoryThreshold));
      adjustments.push({
        key: "MEMORY_THRESHOLD",
        from: toFixed(currentMemoryThreshold),
        to: toFixed(nextMemoryThreshold)
      });
    }
    if (nextHistoryLimit !== currentHistoryLimit) {
      await this.args.runtimeConfigService.set("context_history_limit", String(nextHistoryLimit));
      adjustments.push({
        key: "CONTEXT_COMPRESSION",
        from: String(currentHistoryLimit),
        to: String(nextHistoryLimit)
      });
    }
    if (nextModel && nextModel !== currentModel) {
      await this.args.runtimeConfigService.set("openai_model", nextModel);
      adjustments.push({
        key: "MODEL",
        from: currentModel || "default",
        to: nextModel
      });
    }
    return adjustments;
  }

  private async buildSuggestions(
    metrics: AggregatedMetrics,
    issues: OptimizationIssue[]
  ): Promise<string[]> {
    const deterministicSuggestions: string[] = [];
    if (!issues.length) {
      deterministicSuggestions.push("Nenhum problema critico detectado. Mantenha monitoramento.");
    }
    if (issues.includes("tool_ignored")) {
      deterministicSuggestions.push("Revisar prompts de SEARCH para forcar uso de web_search.");
    }
    if (issues.includes("slow_system")) {
      deterministicSuggestions.push("Reduzir contexto e avaliar modelo rapido para intents simples.");
    }
    if (!this.args.llmAnalyzer) {
      return deterministicSuggestions;
    }
    try {
      const llmSuggestions = await this.args.llmAnalyzer.suggest({
        metrics,
        issues
      });
      return [...deterministicSuggestions, ...llmSuggestions].slice(0, 6);
    } catch {
      return deterministicSuggestions;
    }
  }

  public buildTelegramReport(result: OptimizationResult): string {
    const issueLabels: Record<OptimizationIssue, string> = {
      low_rag_quality: "RAG precisao baixa",
      memory_spam: "Memoria sendo salva em excesso",
      slow_system: "Latencia alta",
      tool_ignored: "Tools disponiveis pouco utilizadas",
      repeated_errors: "Erros repetidos no pipeline"
    };

    const issueLines = result.issues.length
      ? result.issues.map((issue) => `- ${issueLabels[issue]}`)
      : ["- Nenhum problema critico detectado"];
    const adjustmentLines = result.adjustments.length
      ? result.adjustments.map((item) => `- ${item.key}: ${item.from} -> ${item.to}`)
      : ["- Nenhum ajuste aplicado"];
    const metricLines = [
      `- Latencia media: ${result.metrics.avgLatencyMs}ms`,
      `- P95 latencia: ${result.metrics.p95LatencyMs}ms`,
      `- RAG precisao: ${(result.metrics.ragPrecision * 100).toFixed(0)}%`,
      `- Taxa de memoria salva: ${(result.metrics.memorySaveRate * 100).toFixed(0)}%`,
      `- Taxa de uso de tools: ${(result.metrics.toolUsageRate * 100).toFixed(0)}%`
    ];
    const suggestions = result.suggestions.length
      ? ["", "Sugestoes:", ...result.suggestions.map((item) => `- ${item}`)]
      : [];
    const alert = result.alertMessage ? ["", result.alertMessage] : [];

    return [
      "🧠 Diagnostico:",
      "",
      ...issueLines,
      "",
      "⚙️ Ajustes aplicados:",
      "",
      ...adjustmentLines,
      "",
      "📊 Metricas:",
      "",
      ...metricLines,
      ...suggestions,
      ...alert
    ].join("\n");
  }

  public buildMetricsReport(metrics: AggregatedMetrics): string {
    return [
      "📊 Sistema:",
      "",
      `Latencia media: ${metrics.avgLatencyMs}ms`,
      `P95 latencia: ${metrics.p95LatencyMs}ms`,
      `RAG precisao: ${(metrics.ragPrecision * 100).toFixed(0)}%`,
      `Memoria salva: ${(metrics.memorySaveRate * 100).toFixed(0)}%`,
      `Uso de tools: ${(metrics.toolUsageRate * 100).toFixed(0)}%`,
      `Sucesso de tools: ${(metrics.toolSuccessRate * 100).toFixed(0)}%`,
      `Tokens/resposta (est.): ${metrics.tokensPerResponse}`
    ].join("\n");
  }

  public async buildHealthReport(): Promise<string> {
    const { metrics, issues } = await this.diagnose();
    return this.args.alertService.buildHealthSummary(issues, metrics);
  }

  public getLastAlertMessage(): string | null {
    return this.args.alertService.getLastAlertMessage();
  }

  public async appendAgentLog(entry: AgentLogEntryV2): Promise<void> {
    await this.args.agentLogService.append(entry);
  }
}
