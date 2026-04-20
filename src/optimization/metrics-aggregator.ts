import type { AgentLogEntryV2 } from "./agent-log-service.js";

export interface AggregatedMetrics {
  sampleSize: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  ragPrecision: number;
  memorySaveRate: number;
  toolUsageRate: number;
  toolSuccessRate: number;
  tokensPerResponse: number;
  entriesWithAvailableTools: number;
  repeatedErrors: Record<string, number>;
}

function percentile(values: number[], target: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((target / 100) * sorted.length) - 1;
  const idx = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[idx];
}

export class MetricsAggregator {
  public compute(entries: AgentLogEntryV2[]): AggregatedMetrics {
    if (!entries.length) {
      return {
        sampleSize: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        ragPrecision: 1,
        memorySaveRate: 0,
        toolUsageRate: 1,
        toolSuccessRate: 1,
        tokensPerResponse: 0,
        entriesWithAvailableTools: 0,
        repeatedErrors: {}
      };
    }

    const latencies = entries.map((item) => Math.max(0, item.latency_ms ?? item.executor.latency_ms));
    const latencyTotal = latencies.reduce((sum, item) => sum + item, 0);

    const ragFoundTotal = entries.reduce((sum, item) => sum + Math.max(0, item.rag.found), 0);
    const ragUsedTotal = entries.reduce((sum, item) => sum + Math.max(0, item.rag.used), 0);

    const memorySavedCount = entries.filter((item) => item.memory.saved).length;
    const entriesWithAvailableTools = entries.filter((item) => item.tools.available.length > 0).length;
    const entriesWithUsedTools = entries.filter(
      (item) => item.tools.available.length > 0 && item.tools.used.length > 0
    ).length;
    const toolsSuccessfulCount = entries.filter((item) => item.tools.success).length;

    const tokensPerResponse =
      entries.reduce((sum, item) => sum + Math.ceil(Math.max(0, item.output_length) / 4), 0) /
      entries.length;

    const repeatedErrors: Record<string, number> = {};
    for (const item of entries) {
      if (!item.errors) {
        continue;
      }
      repeatedErrors[item.errors] = (repeatedErrors[item.errors] ?? 0) + 1;
    }

    return {
      sampleSize: entries.length,
      avgLatencyMs: Math.round(latencyTotal / entries.length),
      p95LatencyMs: percentile(latencies, 95),
      ragPrecision: ragFoundTotal > 0 ? ragUsedTotal / ragFoundTotal : 1,
      memorySaveRate: memorySavedCount / entries.length,
      toolUsageRate:
        entriesWithAvailableTools > 0 ? entriesWithUsedTools / entriesWithAvailableTools : 1,
      toolSuccessRate: toolsSuccessfulCount / entries.length,
      tokensPerResponse: Math.round(tokensPerResponse),
      entriesWithAvailableTools,
      repeatedErrors
    };
  }
}
