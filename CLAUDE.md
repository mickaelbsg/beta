# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Overview
- Purpose: backend for a personal AI assistant with a Telegram front-end, written in Node.js + TypeScript.
- Single-user v1 design: SQLite for conversational history, optional Qdrant for semantic memory, Obsidian for note storage, and pluggable executor backends.

Common commands
- Install deps: npm install
- Run in development: npm run dev
- Build: npm run build
- Run compiled build: npm start
- Run all tests: npm test
- Run a single test file: npx vitest run tests/<file>.test.ts or npm test -- tests/<file>.test.ts
- Run a single named test: npx vitest -t "<test name>" or npm test -- -t "<test name>"
- Start Qdrant locally (optional): docker compose up -d

Where to look (high-level)
- App composition: [src/app/bootstrap.ts:61-214](src/app/bootstrap.ts#L61-L214) — constructs config, repositories, services, executors, orchestrator, command router, and Telegram polling.
- Main runtime flow: [src/orchestrator/orchestrator.ts:167-600](src/orchestrator/orchestrator.ts#L167-L600) — intent classification, history/RAG context assembly, executor selection, memory persistence, and debug-mode output.
- Memory persistence and fallback behavior: [src/app/bootstrap.ts:36-59](src/app/bootstrap.ts#L36-L59) and [src/memory-service](src/memory-service/) — SQLite history is always used; Qdrant is optional and falls back to NullMemoryRepository.
- RAG layer: [src/rag-service](src/rag-service/) — embedding generation, retrieval, reranking, duplicate filtering, and relevance scoring.
- Executor layer: [src/agent-executor](src/agent-executor/) — LlmExecutor is the default, OpenCodeExecutor is optional and only enabled when EXECUTOR_MODE is set and the Claude CLI is available.
- Telegram ingress: [src/message-handler/telegram-bot.ts](src/message-handler/telegram-bot.ts) — long polling entrypoint that routes slash commands to CommandRouter or conversational inputs to Orchestrator.
- Command router: [src/command-router](src/command-router/) — deterministic Telegram commands like /note, /memories, /config, /set, and tool-related operations.
- Runtime config: [src/config/runtime-config-service.ts](src/config/runtime-config-service.ts) — supports runtime overrides for settings like rag_top_k and executor behavior without restart.
- Debug and optimization: [src/optimization](src/optimization/) and [src/shared/logger.ts](src/shared/logger.ts) — structured logging, execution insights, and self-optimization services.

Important configuration and env vars
- Copy .env.example → .env and populate at least: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, ALLOWED_TELEGRAM_USER_ID, OBSIDIAN_VAULT_PATH.
- Other important env/config knobs: RAG_MIN_RELEVANCE_SCORE, MEMORY_SAVE_THRESHOLD, MEMORY_SEMANTIC_DUPLICATE_SCORE, INTENT_LLM_FALLBACK_THRESHOLD, WEB_SEARCH_PROVIDER, EXECUTOR_MODE, LLM_PROVIDER, OPENAI_MODEL, OPENAI_EMBEDDING_MODEL, RUNTIME_CONFIG_PATH.

Behavioral notes for Claude Code
- Prefer small, local edits; avoid large refactors without entering plan mode. This repo composes many pluggable services in bootstrap, so constructor wiring changes can affect runtime behavior broadly.
- When changing memory, RAG, or embedding behavior, update bootstrap wiring and rag-service tests. Embedding dimension is probed at runtime.
- Debug mode appends debug output to assistant responses when enabled for a user; see [src/orchestrator/orchestrator.ts:144-165](src/orchestrator/orchestrator.ts#L144-L165).
- Safe defaults / fallbacks: Qdrant unavailability falls back to NullMemoryRepository; OpenCode executor is optional and guarded by EXECUTOR_MODE + Claude CLI availability.

Files to read first when onboarding
- [README.md](README.md)
- [src/app/bootstrap.ts:61-214](src/app/bootstrap.ts#L61-L214)
- [src/orchestrator/orchestrator.ts:167-600](src/orchestrator/orchestrator.ts#L167-L600)
- [src/rag-service/rag-service.ts](src/rag-service/rag-service.ts)
- [src/agent-executor/llm-executor.ts](src/agent-executor/llm-executor.ts)

Testing and CI notes
- Tests use Vitest. There is no CI config in the repo root; keep tests fast and avoid starting heavy external services during unit tests.
