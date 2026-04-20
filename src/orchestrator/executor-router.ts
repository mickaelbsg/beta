import type { ExecutionRequest, ExecutionResult, Executor, ExecutorSelection } from "../shared/types.js";

function looksComplexInstruction(input: string): boolean {
  const normalized = input.toLowerCase();
  const hints = [
    "passo a passo",
    "multi passo",
    "encadeie",
    "tool",
    "ferramenta",
    "json",
    "tabela",
    "formate",
    "comparativo"
  ];
  return hints.some((hint) => normalized.includes(hint));
}

export class ExecutorRouter {
  public constructor(
    private readonly llmExecutor: Executor,
    private readonly openCodeExecutor?: Executor
  ) {}

  public pick(request: ExecutionRequest): ExecutorSelection {
    if (!this.openCodeExecutor) {
      return { executorUsed: "llm", reason: "opencode_not_configured" };
    }

    if (request.preferredExecutor === "opencode") {
      return { executorUsed: "opencode", reason: "runtime_config_preference" };
    }
    if (request.preferredExecutor === "llm") {
      return { executorUsed: "llm", reason: "runtime_config_preference" };
    }

    const shouldUseOpenCode =
      looksComplexInstruction(request.userMessage) ||
      (request.intent === "SEARCH" && (request.toolHints?.webSearchResults?.length ?? 0) > 2);

    return shouldUseOpenCode
      ? { executorUsed: "opencode", reason: "complex_or_tool_chain_request" }
      : { executorUsed: "llm", reason: "default_llm_path" };
  }

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const selection = this.pick(request);
    if (selection.executorUsed === "opencode" && this.openCodeExecutor) {
      return this.openCodeExecutor.execute(request);
    }
    return this.llmExecutor.execute(request);
  }
}
