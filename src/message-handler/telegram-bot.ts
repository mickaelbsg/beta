import TelegramBot from "node-telegram-bot-api";
import { logger } from "../shared/logger.js";
import type { InboundMessage } from "../shared/types.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";

interface TelegramMessageHandlerArgs {
  botToken: string;
  allowedUserId: string;
  orchestrator: Orchestrator;
}

export class TelegramMessageHandler {
  private readonly bot: TelegramBot;

  public constructor(private readonly args: TelegramMessageHandlerArgs) {
    this.bot = new TelegramBot(args.botToken, { polling: true });
  }

  public start(): void {
    this.bot.on("message", async (msg) => {
      const text = msg.text?.trim();
      const fromId = msg.from?.id ? String(msg.from.id) : "";

      if (!text) {
        return;
      }
      if (!fromId || fromId !== this.args.allowedUserId) {
        logger.warn("Unauthorized Telegram user tried to use the bot.", { fromId });
        return;
      }

      const inbound: InboundMessage = {
        platform: "telegram",
        chatId: String(msg.chat.id),
        userId: fromId,
        messageId: String(msg.message_id),
        text,
        timestamp: new Date((msg.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString()
      };

      try {
        const response = await this.args.orchestrator.handleMessage(inbound);
        await this.bot.sendMessage(msg.chat.id, response.text);
      } catch (error) {
        logger.error("Failed to process Telegram message.", {
          error: error instanceof Error ? error.message : String(error)
        });
        await this.bot.sendMessage(
          msg.chat.id,
          "Nao consegui processar sua mensagem agora. Tente novamente em instantes."
        );
      }
    });

    logger.info("Telegram bot started in long polling mode.");
  }
}

