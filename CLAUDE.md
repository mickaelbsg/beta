# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠 Settings & Automation

- **Permission Mode:** `bypass-all`
- **Agent Mindset:** Proactive technical copilot. Execute first, explain later.
- **Rules Priority:** Custom rules in Obsidian (`/rules/rules.md`) are supreme laws.

## 🧭 System Overview (BETA v0.3.0)

- **Philosophy:** System-driven Action Layer + Assistive LLM + Componentized Admin UI.
- **Core Loop:** Input -> ActionDecider (Body) -> Execution -> Context Injection -> LLM Response (Voice).
- **Primary Memory:** Obsidian Vault (structured .md files).
- **Execution:** Secure shell execution via `execFile` with command whitelist and Containerized environment.

## 🚀 Common Commands

- **Build and Run (Docker):** `docker-compose up -d --build`
- **Stop All:** `docker-compose down`
- **Local Dev Backend:** `npm run dev`
- **Local Dev UI:** `cd admin-ui && npm run dev`
- **CLI:** `npm run cli -- <command> <payload>` (e.g., `npm run cli -- note "test"`)

## 📂 Architecture Mapping

- **Action Layer:** `src/orchestrator/action-decider.ts` (Decision) & `src/orchestrator/tool-executor.ts` (Action).
- **Orchestration:** `src/orchestrator/orchestrator.ts` (Main entrypoint).
- **Obsidian Memory:** `src/obsidian-service/` (Reader/Writer).
- **History:** `src/orchestrator/conversation-memory-service.ts` (RAM) & `src/memory-service/sqlite-history-repository.ts` (DB).
- **Admin UI (Frontend):** `admin-ui/src/` (React, Vite, Tailwind CSS, Componentizado).
- **Docker/Deploy:** `docker-compose.yml`, `Dockerfile` (Backend), `admin-ui/Dockerfile` (Nginx + Frontend).

## ⚠️ Mandatory Behavioral Rules

1. **Never Lie:** Do not claim an action (save/run) was performed unless `actionResult` is present in context.
2. **Deterministic Actions:** Memory saving and slash commands MUST be handled by the Action Layer before the LLM.
3. **No Hallucinations:** If a system action fails, report it accurately.
4. **Sanitize Output:** Avoid "I will save..." or "I have saved..." if not confirmed by the system.
5. **Driver Mindset:** Be proactive. Use CLI, Web, and Obsidian arms to conclude tasks for Alpha.
6. **Frontend Specialist:** Use `frontend-ui-ux-specialist` for UI/UX refactoring inside the `admin-ui` folder.

## 📜 Files to Read First

- `README.md` (User Manual)
- `bugs.md` (Recent fixes and solved bugs)
- `src/orchestrator/action-decider.ts`
- `admin-ui/src/App.tsx` (Root do Painel Admin)
