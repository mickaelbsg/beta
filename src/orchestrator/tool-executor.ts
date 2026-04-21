import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolCall } from "../shared/types.js";
import { logger } from "../shared/logger.js";
import { ObsidianWriterService } from "../obsidian-service/obsidian-writer-service.js";
import type { WebAgentService } from "../web-search/web-agent-service.js";

const execFileAsync = promisify(execFile);

export interface ToolExecutorDeps {
  obsidianWriterService?: ObsidianWriterService;
  webAgentService?: WebAgentService;
}

export class ToolExecutor {
  public constructor(private readonly deps: ToolExecutorDeps) {}

  public async execute(call: ToolCall, chatId: string): Promise<string> {
    const { tool, input } = call;
    logger.info("tool_execution_start", { tool, input, chatId });

    try {
      if (tool === "run" || tool === "shell") {
        return await this.handleRun(input);
      }
      if (tool === "save_memory" || tool === "note") {
        return await this.handleSaveMemory(input, chatId);
      }
      if (tool === "web_search") {
        return await this.handleWebSearch(input, chatId);
      }

      return `Ferramenta desconhecida: ${tool}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("tool_execution_failed", { tool, error: message, chatId });
      return `Erro na execução da ferramenta ${tool}: ${message}`;
    }
  }

  private async handleRun(input: Record<string, unknown>): Promise<string> {
    const command = String(input.command || input.cmd || "");
    if (!command) return "Erro: comando vazio.";

    const allowedCommands = ["docker", "pm2", "git", "ls", "cat"];
    const prohibitedPatterns = ["rm", "shutdown", "reboot", ":(){:|:&};:", "ddos"];

    if (prohibitedPatterns.some((pattern) => command.includes(pattern))) {
      return "Bloqueado: comando contém padrões proibidos.";
    }

    const [cmdName, ...args] = command.split(/\s+/).filter(Boolean);
    if (!allowedCommands.includes(cmdName)) {
      return `Bloqueado: comando '${cmdName}' não está na whitelist.`;
    }

    const { stdout, stderr } = await execFileAsync(cmdName, args, { timeout: 30000 });
    return stdout || stderr || "Comando executado sem saída.";
  }

  private async handleSaveMemory(input: Record<string, unknown>, chatId: string): Promise<string> {
    const content = String(input.content || input.text || "");
    if (!content) return "Erro: conteúdo da memória vazio.";

    if (!this.deps.obsidianWriterService) {
      return "Erro: ObsidianWriterService não disponível.";
    }

    const result = await this.deps.obsidianWriterService.saveMemoryToObsidian({
      chatId,
      content,
      source: "tool_call"
    });

    return `Memória salva com sucesso em: ${result.filePath}`;
  }

  private async handleWebSearch(input: Record<string, unknown>, chatId: string): Promise<string> {
    const query = String(input.query || input.search_query || input.text || "");
    if (!query) return "Erro: query de busca vazia.";

    if (!this.deps.webAgentService) {
      return "Erro: WebAgentService não disponível.";
    }

    try {
      const result = await this.deps.webAgentService.run({
        query,
        preferredExecutor: "llm"
      });
      return result.text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Erro na busca web: ${message}`;
    }
  }
}

