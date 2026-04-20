import { CommandHandlers } from "./command-handlers.js";
import { commandDefinitions } from "./command-definitions.js";
import type { CommandContext, HistoryRepository, InteractionObserver } from "../shared/types.js";
import { RagService } from "../rag-service/rag-service.js";
import { ObsidianService } from "../obsidian-service/obsidian-service.js";
import { ExecutorRouter } from "../orchestrator/executor-router.js";
import type { WebSearchService } from "../shared/types.js";
import { RuntimeConfigService } from "../config/runtime-config-service.js";
import { ExecutionInsightsStore } from "../orchestrator/execution-insights-store.js";
import { ToolAwarenessService } from "../tools/tool-awareness-service.js";
import { DebugModeService } from "../debug/debug-mode-service.js";
import { SelfOptimizationService } from "../optimization/self-optimization-service.js";
import { FeedbackService } from "../optimization/feedback-service.js";
import { UserProfileService } from "../optimization/user-profile-service.js";
import { SoulPromptService } from "../prompt/soul-prompt-service.js";
import { FileSystemService } from "../filesystem/filesystem-service.js";
import { ShellSessionService } from "../shell/shell-session-service.js";

interface CommandRouterDeps {
  ragService: RagService;
  obsidianService: ObsidianService;
  webSearchService: WebSearchService;
  executorRouter: ExecutorRouter;
  runtimeConfigService: RuntimeConfigService;
  executionInsightsStore: ExecutionInsightsStore;
  historyRepository: HistoryRepository;
  toolAwarenessService: ToolAwarenessService;
  debugModeService: DebugModeService;
  selfOptimizationService: SelfOptimizationService;
  feedbackService: FeedbackService;
  userProfileService: UserProfileService;
  soulPromptService: SoulPromptService;
  fileSystemService: FileSystemService;
  shellSessionService: ShellSessionService;
}

interface CommandParseResult {
  name: string;
  args: string;
}

function parseCommand(input: string): CommandParseResult {
  const [name, ...rest] = input.trim().split(" ");
  const normalizedName = name.toLowerCase().replace(/@[\w_]+$/, "");
  return {
    name: normalizedName,
    args: rest.join(" ").trim()
  };
}

export class CommandRouter {
  private readonly handlers: CommandHandlers;

  public constructor(deps: CommandRouterDeps) {
    this.handlers = new CommandHandlers(deps);
  }

  public isCommand(input: string): boolean {
    return input.trim().startsWith("/");
  }

  public async handle(
    input: string,
    context?: CommandContext,
    observer?: InteractionObserver
  ): Promise<string> {
    const parsed = parseCommand(input);
    // Deterministic router avoids signature mismatches in dynamic dispatch.
    if (parsed.name === "/help" || parsed.name === "/commands" || parsed.name === "/comands") {
      return this.handlers.help(observer);
    }
    if (parsed.name === "/note") {
      return this.handlers.note(parsed.args, observer);
    }
    if (parsed.name === "/memories") {
      return this.handlers.memories(parsed.args, observer);
    }
    if (parsed.name === "/memory") {
      return this.handlers.memoryQuery(parsed.args, observer);
    }
    if (parsed.name === "/memory_detail") {
      return this.handlers.memoryDetail(parsed.args, observer);
    }
    if (parsed.name === "/delete_memory") {
      return this.handlers.deleteMemory(parsed.args, observer);
    }
    if (parsed.name === "/logs") {
      return this.handlers.logs(observer);
    }
    if (parsed.name === "/config") {
      return this.handlers.config(observer);
    }
    if (parsed.name === "/set") {
      return this.handlers.set(parsed.args, observer);
    }
    if (parsed.name === "/search") {
      return this.handlers.search(parsed.args, observer);
    }
    if (parsed.name === "/study") {
      return this.handlers.study(parsed.args, observer);
    }
    if (parsed.name === "/tools") {
      return this.handlers.tools(observer);
    }
    if (parsed.name === "/tool_search") {
      return this.handlers.toolSearch(parsed.args, observer);
    }
    if (parsed.name === "/debug") {
      return this.handlers.debug(parsed.args, context, observer);
    }
    if (parsed.name === "/optimize") {
      return this.handlers.optimize(observer);
    }
    if (parsed.name === "/metrics") {
      return this.handlers.metrics(observer);
    }
    if (parsed.name === "/health") {
      return this.handlers.health(observer);
    }
    if (parsed.name === "/feedback") {
      return this.handlers.feedback(parsed.args, context, observer);
    }
    if (parsed.name === "/profile") {
      return this.handlers.profile(parsed.args, context, observer);
    }
    if (parsed.name === "/reset_session") {
      return this.handlers.resetSession(context, observer);
    }
    if (parsed.name === "/fs_ls") {
      return this.handlers.fileSystemList(parsed.args, observer);
    }
    if (parsed.name === "/fs_read") {
      return this.handlers.fileSystemRead(parsed.args, observer);
    }
    if (parsed.name === "/fs_write") {
      return this.handlers.fileSystemWrite(parsed.args, observer);
    }
    if (parsed.name === "/fs_append") {
      return this.handlers.fileSystemAppend(parsed.args, observer);
    }
    if (parsed.name === "/shell") {
      return this.handlers.shellCommand(parsed.args, context, observer);
    }
    if (parsed.name === "/find") {
      return this.handlers.find(parsed.args, observer);
    }
    if (parsed.name === "/set_rule") {
      return this.handlers.setRule(parsed.args, context, observer);
    }
    if (parsed.name === "/list_rules") {
      return this.handlers.listRules(observer);
    }
    if (parsed.name === "/delete_rule") {
      return this.handlers.deleteRule(parsed.args, observer);
    }
    if (parsed.name === "/edit_rule") {
      return this.handlers.editRule(parsed.args, observer);
    }
    if (parsed.name === "/claude_code") {
      return this.handlers.claudeCode(parsed.args, context, observer);
    }
    // Keep fallback aligned with command catalog.
    const known = new Set(commandDefinitions.map((item) => item.name));
    if (!known.has(parsed.name)) {
      return "Comando desconhecido. Use /help para ver os comandos disponiveis.";
    }
    return "Comando nao implementado.";
  }
}
