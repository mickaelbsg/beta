import { describe, expect, it } from "vitest";
import { LlmExecutor } from "../src/agent-executor/llm-executor.js";
import type { ExecutionRequest, ExecutionResult } from "../src/shared/types.js";
import type { LLMProvider } from "../src/agent-executor/providers/llm-provider.js";

class FakeProvider implements LLMProvider {
  public called = 0;
  public lastPrompt = "";
  public modelsUsed: string[] = [];
  public constructor(
    public readonly name: "omniroute" | "openai",
    private readonly result: ExecutionResult,
    private readonly shouldThrow = false
  ) {}

  public async generateResponse(_input: {
    request: ExecutionRequest;
    prompt: string;
    model: string;
  }): Promise<ExecutionResult> {
    this.called += 1;
    this.lastPrompt = _input.prompt;
    this.modelsUsed.push(_input.model);
    if (this.shouldThrow) {
      throw new Error(`${this.name}_failed`);
    }
    return this.result;
  }
}

function request(intent: ExecutionRequest["intent"] = "CHAT"): ExecutionRequest {
  return {
    intent,
    userMessage: "oi",
    recentHistory: [],
    retrievedMemories: [],
    systemRules: "rules"
  };
}

describe("LlmExecutor provider routing", () => {
  it("uses primary provider when successful", async () => {
    const primary = new FakeProvider("omniroute", {
      replyText: "ok",
      shouldPersistMemory: false,
      shouldCreateNote: false
    });
    const fallback = new FakeProvider("openai", {
      replyText: "fallback",
      shouldPersistMemory: false,
      shouldCreateNote: false
    });

    const executor = new LlmExecutor({
      model: "gpt-4.1",
      primaryProvider: primary,
      fallbackProvider: fallback
    });

    const result = await executor.execute(request());
    expect(result.replyText).toBe("ok");
    expect(primary.called).toBe(1);
    expect(fallback.called).toBe(0);
  });

  it("falls back when primary provider fails", async () => {
    const primary = new FakeProvider(
      "omniroute",
      {
        replyText: "nope",
        shouldPersistMemory: false,
        shouldCreateNote: false
      },
      true
    );
    const fallback = new FakeProvider("openai", {
      replyText: "fallback_ok",
      shouldPersistMemory: false,
      shouldCreateNote: false
    });

    const executor = new LlmExecutor({
      model: "gpt-4.1",
      primaryProvider: primary,
      fallbackProvider: fallback
    });

    const result = await executor.execute(request());
    expect(result.replyText).toBe("fallback_ok");
    expect(primary.called).toBe(1);
    expect(fallback.called).toBe(1);
  });

  it("injects tool awareness and SEARCH policy into prompt", async () => {
    const primary = new FakeProvider("omniroute", {
      replyText: "ok",
      shouldPersistMemory: false,
      shouldCreateNote: false
    });
    const executor = new LlmExecutor({
      model: "gpt-4.1",
      primaryProvider: primary
    });

    await executor.execute(request("SEARCH"));
    expect(primary.lastPrompt).toContain("### AVAILABLE TOOLS");
    expect(primary.lastPrompt).toContain("web_search");
    expect(primary.lastPrompt).toContain("SEARCH POLICY:");
    expect(primary.lastPrompt).toContain("Never claim you cannot access the web.");
  });

  it("falls back to secondary model on same provider before provider fallback", async () => {
    const primary = new FakeProvider(
      "omniroute",
      {
        replyText: "x",
        shouldPersistMemory: false,
        shouldCreateNote: false
      },
      true
    );
    const fallbackProvider = new FakeProvider("openai", {
      replyText: "provider_fallback",
      shouldPersistMemory: false,
      shouldCreateNote: false
    });

    const executor = new LlmExecutor({
      model: "gemini/gemini-2.0-flash",
      fallbackModel: "gh/gpt-5-mini",
      primaryProvider: primary,
      fallbackProvider
    });

    const result = await executor.execute(request());
    expect(result.replyText).toBe("provider_fallback");
    expect(primary.modelsUsed).toEqual(["gemini/gemini-2.0-flash", "gh/gpt-5-mini"]);
    expect(fallbackProvider.modelsUsed).toEqual(["gemini/gemini-2.0-flash"]);
  });
});
