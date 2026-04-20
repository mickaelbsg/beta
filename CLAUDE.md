# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Overview
- Purpose: backend for a personal AI assistant (Telegram front-end) implemented in Node.js + TypeScript.
- Single-user v1 design: SQLite for conversational history, Qdrant for semantic memory (optional), Obsidian for notes, pluggable executors (LLM / OpenCode).

Common commands
- Install deps: npm install
- Dev (run with tsx, auto-restart not configured): npm run dev
- Build: npm run build
- Run compiled build: npm start
- Run tests (all): npm test
- Run a single test file: npx vitest run tests/<file>.test.ts or npm test -- tests/<file>.test.ts
- Run a single named test: npx vitest -t "<test name>" or npm test -- -t "<test name>"
- Run Qdrant locally (optional): docker compose up -d

Where to look (high-level)
- App bootstrap and composition: [src/app/bootstrap.ts:61-214](src/app/bootstrap.ts#L61-L214) — constructs repositories, services, executors and starts Telegram polling.
- Main conversational flow / decision logic: [src/orchestrator/orchestrator.ts:167-600](src/orchestrator/orchestrator.ts#L167-L600) — intent classification, history compression, RAG retrieval, executor selection, memory persist/confirmation, and debug-mode output.
- Memory persistence and fallbacks: memory repository construction in [src/app/bootstrap.ts:36-59](src/app/bootstrap.ts#L36-L59) — attempts Qdrant, falls back to NullMemoryRepository; embedding probe detects vector dimension.
- RAG surface: [src/rag-service](src/rag-service/) — embeddings, retrieval, reranking and relevance filters used by orchestrator.
- Executor layer: [src/agent-executor](src/agent-executor/) — LlmExecutor + optional OpenCodeExecutor; selection happens via ExecutorRouter ([src/orchestrator/executor-router.ts]).
- Telegram ingress: [src/message-handler](src/message-handler/) — long-polling handler that delegates to CommandRouter or Orchestrator.
- Command router: [src/command-router](src/command-router/) — deterministic commands (e.g. /note, /memories, /config, /set).
- Obsidian integration: [src/obsidian-service](src/obsidian-service/) — where notes are created and file paths reported to users.
- Runtime config: [src/config/runtime-config-service.ts] — overrides for rag_top_k, executor choice, and other runtime knobs.
- Optimization & logging: [src/optimization] and [src/shared/logger.ts] — structured JSON logs and agent optimization services for self-observation.

Important configuration and env vars
- Copy .env.example → .env and populate at least: TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, ALLOWED_TELEGRAM_USER_ID, OBSIDIAN_VAULT_PATH.
- Other env/config knobs (selected): RAG_MIN_RELEVANCE_SCORE, MEMORY_SAVE_THRESHOLD, MEMORY_SEMANTIC_DUPLICATE_SCORE, INTENT_LLM_FALLBACK_THRESHOLD, WEB_SEARCH_PROVIDER, EXECUTOR_MODE, LLM_PROVIDER, OPENAI_MODEL, OPENAI_EMBEDDING_MODEL.
- Runtime config file path: RUNTIME_CONFIG_PATH (used by RuntimeConfigService to change values without restart).

Behavioral notes for Claude Code
- Prefer small, local edits; avoid large refactors without entering plan mode. This repo composes many pluggable services in bootstrap — changing constructor args or wiring touches runtime behavior broadly.
- When changing memory, RAG, or embedding behavior, update both bootstrap wiring and rag-service tests. Vector size is probed at runtime: take care when changing embedding model constants.
- Debug-mode: debug output is appended to assistant responses when DebugModeService.isEnabled(userId) — useful for troubleshooting; see formatDebugModeBlock in [src/orchestrator/orchestrator.ts:144-165](src/orchestrator/orchestrator.ts#L144-L165).
- Safe defaults / fallbacks: Qdrant unavailability falls back to NullMemoryRepository (no-op memory). OpenCode executor is optional and guarded by EXECUTOR_MODE.

Files to read first when onboarding
- [README.md](README.md) — quick orientation and env list
- [src/app/bootstrap.ts:61-214](src/app/bootstrap.ts#L61-L214)
- [src/orchestrator/orchestrator.ts:167-600](src/orchestrator/orchestrator.ts#L167-L600)
- [src/rag-service/rag-service.ts](src/rag-service/rag-service.ts)
- [src/agent-executor/llm-executor.ts](src/agent-executor/llm-executor.ts)

Testing and CI notes
- Tests use Vitest (devDependency). There is no CI config in the repo root; keep tests fast and avoid starting heavy external services during unit tests. Mock Qdrant and Playwright interactions where possible.

What I did not include
- I intentionally omitted file-by-file listings and generic coding guidelines.

If you want, I can open a small PR adding this file to the repo and run the test suite locally. 
