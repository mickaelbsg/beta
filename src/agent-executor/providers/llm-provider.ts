import type { ExecutionRequest, ExecutionResult } from "../../shared/types.js";

export interface LLMProvider {
  name: "omniroute" | "openai";
  generateResponse(input: {
    request: ExecutionRequest;
    prompt: string;
    model: string;
  }): Promise<ExecutionResult>;
}

