import TelegramBot from "node-telegram-bot-api";
import { logger } from "../shared/logger.js";
import type { InboundMessage, InteractionObserver } from "../shared/types.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { CommandRouter } from "../command-router/command-router.js";
import { commandDefinitions } from "../command-router/command-definitions.js";
import { SelfOptimizationService } from "../optimization/self-optimization-service.js";
import { DebugModeService } from "../debug/debug-mode-service.js";

interface TelegramMessageHandlerArgs {
  botToken: string;
  allowedUserId: string;
  orchestrator: Orchestrator;
  commandRouter: CommandRouter;
  selfOptimizationService: SelfOptimizationService;
  debugModeService: DebugModeService;
}

function shouldReportStatus(step: string, debugEnabled: boolean): boolean {
  if (debugEnabled) {
    return true;
  }
  const normalized = step.toLowerCase();
  const importantSignals = [
    "busca na web",
    "web agent",
    "salvando memoria",
    "salvando nota",
    "criando nota",
    "obsidian",
    "tools",
    "removendo memoria",
    "listando arquivos",
    "lendo arquivo",
    "editando arquivo",
    "anexando conteudo no arquivo"
  ];
  return importantSignals.some((signal) => normalized.includes(signal));
}

export class TelegramMessageHandler {
  private readonly bot: TelegramBot;
  private readonly processedMessageIds = new Set<string>();

  public constructor(private readonly args: TelegramMessageHandlerArgs) {
    this.bot = new TelegramBot(args.botToken, { polling: true });
  }

  private async registerCommands(): Promise<void> {
    try {
      await this.bot.setMyCommands(
        commandDefinitions.map((item) => ({
          command: item.name.replace(/^\//, ""),
          description: item.description
        }))
      );
    } catch {
      logger.warn("telegram_command_registration_failed", {});
    }
  }

  public start(): void {
    void this.registerCommands();
    this.bot.on("message", async (msg) => {
      const text = msg.text?.trim();
      const fromId = msg.from?.id ? String(msg.from.id) : "";
      const messageId = String(msg.message_id);

      if (!text) {
        logger.info("telegram_non_text_ignored", {
          chatId: String(msg.chat.id),
          messageId
        });
        return;
      }
      if (this.processedMessageIds.has(messageId)) {
        logger.info("telegram_duplicate_ignored", {
          chatId: String(msg.chat.id),
          messageId
        });
        return;
      }
      if (!fromId || fromId !== this.args.allowedUserId) {
        logger.warn("telegram_unauthorized_user", { fromId });
        return;
      }
      this.processedMessageIds.add(messageId);
      if (this.processedMessageIds.size > 5000) {
        this.processedMessageIds.clear();
      }

      const inbound: InboundMessage = {
        platform: "telegram",
        chatId: String(msg.chat.id),
        userId: fromId,
        messageId,
        text,
        timestamp: new Date((msg.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString()
      };
      const observer: InteractionObserver = {
        report: async (step: string) => {
          try {
            const debugEnabled = this.args.debugModeService.isEnabled(fromId);
            if (!shouldReportStatus(step, debugEnabled)) {
              return;
            }
            await this.bot.sendMessage(msg.chat.id, `[status] ${step}`);
          } catch (error) {
            logger.warn("telegram_status_message_failed", {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      };

      try {
        // Commands follow a deterministic path; natural language stays in the orchestrator.
        const isCommand = this.args.commandRouter.isCommand(text);
        const response = isCommand
          ? {
              text: await this.args.commandRouter.handle(
                text,
                { chatId: inbound.chatId, userId: inbound.userId },
                observer
              )
            }
          : await this.args.orchestrator.handleMessage(inbound, observer);
        await this.bot.sendMessage(msg.chat.id, response.text);
        if (!isCommand) {
          try {
            const diagnosis = await this.args.selfOptimizationService.diagnose();
            if (diagnosis.alertMessage) {
              await this.bot.sendMessage(msg.chat.id, diagnosis.alertMessage);
            }
          } catch (error) {
            logger.warn("telegram_alert_push_failed", {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      } catch (error) {
        logger.error("telegram_message_failed", {
          error: error instanceof Error ? error.message : String(error)
        });
        await this.bot.sendMessage(
          msg.chat.id,
          "Nao consegui processar sua mensagem agora. Tente novamente em instantes."
        );
      }
    });

    logger.info("telegram_bot_started", { mode: "long_polling" });
  }
}
