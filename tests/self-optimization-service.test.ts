import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RuntimeConfigService } from "../src/config/runtime-config-service.js";
import { AgentLogService } from "../src/optimization/agent-log-service.js";
import { SelfOptimizationService } from "../src/optimization/self-optimization-service.js";
import { AlertService } from "../src/optimization/alert-service.js";

describe("SelfOptimizationService", () => {
  it("applies safe incremental adjustments from log metrics", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "assistant-opt-"));
    const cfg = new RuntimeConfigService(path.join(tmpDir, "runtime.json"));
    await cfg.init();
    await cfg.set("rag_top_k", "5");
    await cfg.set("memory_save_threshold", "0.70");
    await cfg.set("context_history_limit", "5");
    await cfg.set("openai_model", "gpt-4.1");

    const logs = new AgentLogService(path.join(tmpDir, "agent-log.jsonl"));
    await logs.init();
    const alert = new AlertService(path.join(tmpDir, "alert-state.json"), true, 1);
    await alert.init();
    for (let i = 0; i < 12; i += 1) {
      await logs.append({
        timestamp: new Date().toISOString(),
        session_id: "s1",
        user_id: "u1",
        intent: "QUERY",
        latency_ms: 4300,
        input_length: 100,
        output_length: 300,
        rag: {
          found: 5,
          used: 1,
          filtered: 4
        },
        memory: {
          score: 0.9,
          saved: true
        },
        tools: {
          available: ["web_search"],
          used: [],
          latency_ms: 10,
          success: true
        },
        executor: {
          provider: "omniroute",
          model: "gpt-4.1",
          latency_ms: 200
        },
        errors: i < 3 ? "web_search_failed" : null
      });
    }

    const optimizer = new SelfOptimizationService({
      runtimeConfigService: cfg,
      agentLogService: logs,
      alertService: alert,
      windowSize: 500,
      toolUsageMinRate: 0.2,
      fastModel: "gpt-4.1-mini"
    });
    const result = await optimizer.optimize();

    expect(result.issues).toContain("low_rag_quality");
    expect(result.issues).toContain("slow_system");
    expect(result.issues).toContain("memory_spam");
    expect(cfg.get("rag_top_k")).toBe("3");
    expect(cfg.get("context_history_limit")).toBe("4");
    expect(cfg.get("memory_save_threshold")).toBe("0.75");
  });
});
