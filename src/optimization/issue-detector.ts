import type { AggregatedMetrics } from "./metrics-aggregator.js";

export type OptimizationIssue =
  | "low_rag_quality"
  | "memory_spam"
  | "slow_system"
  | "tool_ignored"
  | "repeated_errors";

interface IssueDetectorArgs {
  toolUsageMinRate: number;
}

export class IssueDetector {
  private readonly toolUsageMinRate: number;

  public constructor(args: IssueDetectorArgs) {
    this.toolUsageMinRate = args.toolUsageMinRate;
  }

  public detect(metrics: AggregatedMetrics): OptimizationIssue[] {
    if (metrics.sampleSize < 10) {
      return [];
    }

    const issues: OptimizationIssue[] = [];
    if (metrics.ragPrecision < 0.3) {
      issues.push("low_rag_quality");
    }
    if (metrics.memorySaveRate > 0.7) {
      issues.push("memory_spam");
    }
    if (metrics.avgLatencyMs > 1500 || metrics.p95LatencyMs > 2200) {
      issues.push("slow_system");
    }
    if (metrics.entriesWithAvailableTools > 0 && metrics.toolUsageRate < this.toolUsageMinRate) {
      issues.push("tool_ignored");
    }
    const hasRepeatedErrors = Object.values(metrics.repeatedErrors).some((count) => count >= 3);
    if (hasRepeatedErrors) {
      issues.push("repeated_errors");
    }

    return issues;
  }
}
