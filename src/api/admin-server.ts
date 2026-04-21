import express from "express";
import cors from "cors";
import { logger } from "../shared/logger.js";
import { DynamicConfigService } from "../config/dynamic-config-service.js";
import { AgentLogService } from "../optimization/agent-log-service.js";
import { HistoryRepository } from "../shared/types.js";
import { ObsidianService } from "../obsidian-service/obsidian-service.js";

interface AdminApiServerDeps {
  port: number;
  adminToken: string;
  dynamicConfigService: DynamicConfigService;
  agentLogService: AgentLogService;
  historyRepository: HistoryRepository;
  obsidianService: ObsidianService;
}

export class AdminApiServer {
  private readonly app = express();

  public constructor(private readonly deps: AdminApiServerDeps) {
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Middleware de autenticação simples
    this.app.use((req, res, next) => {
      const token = req.headers["x-admin-token"];
      if (token !== this.deps.adminToken) {
        logger.warn("unauthorized_admin_api_access", { path: req.path, ip: req.ip });
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    });
  }

  private setupRoutes(): void {
    // Configurações
    this.app.get("/api/admin/config", (req, res) => {
      res.json(this.deps.dynamicConfigService.getConfig());
    });

    this.app.post("/api/admin/config", async (req, res) => {
      try {
        await this.deps.dynamicConfigService.updateConfig(req.body);
        res.json({ status: "ok" });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
      }
    });

    // Logs Técnicos
    this.app.get("/api/admin/logs/technical", async (req, res) => {
      const limit = Number(req.query.limit) || 100;
      const logs = await this.deps.agentLogService.readRecent(limit);
      res.json(logs);
    });

    // Histórico de Mensagens
    this.app.get("/api/admin/logs/messages", async (req, res) => {
      const chatId = req.query.chatId as string;
      const limit = Number(req.query.limit) || 50;
      if (!chatId) {
        res.status(400).json({ error: "chatId is required" });
        return;
      }
      const messages = await this.deps.historyRepository.getRecentMessages(chatId, limit);
      res.json(messages);
    });

    // Status do Sistema
    this.app.get("/api/admin/status", async (req, res) => {
      const obsidianStatus = await this.deps.obsidianService.getVaultStatus();
      res.json({
        obsidian: obsidianStatus,
        version: "0.3.0",
        uptime: process.uptime()
      });
    });
  }

  public start(): void {
    this.app.listen(this.deps.port, "0.0.0.0", () => {
      logger.info("admin_api_server_started", { port: this.deps.port });
    });
  }
}
