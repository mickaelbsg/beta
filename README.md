# Personal AI Assistant Backend

Backend modular em Node.js + TypeScript para assistente pessoal com Telegram, memoria em SQLite, RAG com Qdrant, integracao com Obsidian e executor LLM/OpenCode.

## Arquitetura

- `src/message-handler`: entrada Telegram (long polling)
- `src/command-router`: comandos deterministas para controle operacional
- `src/command-router/command-definitions.ts`: lista central de comandos e alias para registro automatico
- `src/orchestrator`: fluxo principal, deteccao de intent, decisao de persistencia
- `src/orchestrator/context-builder.ts`: compressao de historico e selecao de sinal
- `src/orchestrator/memory-scorer.ts`: score de persistencia de memoria
- `src/orchestrator/executor-router.ts`: selecao de executor (LLM padrao, OpenCode quando necessario)
- `src/memory-service`: persistencia de historico (SQLite) e memoria semantica (Qdrant)
- `src/rag-service`: embeddings + recuperacao top-k + reranking + filtro por relevancia
- `src/obsidian-service`: criacao e busca de notas markdown
- `src/agent-executor`: executores `llm` e `opencode` (com fallback)
- `src/web-search`: web agent (busca, navegador headless, extracao e sumarizacao)
- `src/skills`: fundacao de skills e registry
- `src/app/bootstrap.ts`: composicao da aplicacao
- `soul.md`: prompt-base editavel (identidade e comportamento do agente)

## Requisitos

- Node.js 20+
- Docker (opcional, para Qdrant local)

## Setup

1. Instalar dependencias:

```bash
npm install
```

2. Subir Qdrant local (opcional, recomendado):

```bash
docker compose up -d
```

3. Configurar variaveis:

```bash
cp .env.example .env
```

Preencha pelo menos:

- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY`
- `ALLOWED_TELEGRAM_USER_ID`
- `OBSIDIAN_VAULT_PATH`

Variaveis de qualidade recomendadas:

- `RAG_MIN_RELEVANCE_SCORE`
- `MEMORY_SAVE_THRESHOLD`
- `MEMORY_SEMANTIC_DUPLICATE_SCORE`
- `MEMORY_FREQUENCY_WINDOW_MS`
- `INTENT_LLM_FALLBACK_THRESHOLD`
- `WEB_SEARCH_TIMEOUT_MS`
- `WEB_SEARCH_PROVIDER`
- `TAVILY_API_KEY`
- `SERPAPI_API_KEY`
- `WEB_AGENT_ENABLE_BROWSER`
- `WEB_AGENT_BROWSER_TOP_PAGES`
- `WEB_AGENT_TIMEOUT_MS`
- `RUNTIME_CONFIG_PATH`
- `SOUL_PROMPT_PATH`

4. Rodar em desenvolvimento:

```bash
npm run dev
```

## Scripts

- `npm run dev`: executa com `tsx`
- `npm run build`: compila para `dist/`
- `npm start`: executa build compilado
- `npm test`: roda testes com `vitest`

## Fluxo Principal

1. Recebe mensagem do Telegram
2. Se iniciar com `/`, executa no command router (deterministico)
3. Caso contrario, segue para orchestrator
4. Salva historico em SQLite
5. Detecta intent (`NOTE`, `QUERY`, `STUDY`, `SEARCH`, `CHAT`)
6. Recupera contexto (historico comprimido + RAG reordenado e filtrado quando aplicavel)
7. Monta prompt estruturado
8. Executa no executor (`llm` ou `opencode`)
9. Retorna resposta
10. Persiste memoria/nota conforme politicas

## Comandos Telegram

- `/help` ou `/commands`
- `/note <texto>`
- `/memories [pagina]`
- `/memory <consulta>`
- `/memory_detail <id>`
- `/delete_memory <id>`
- `/logs`
- `/config`
- `/set <chave>=<valor>`
- `/search <consulta>`
- `/study <topico>`
- `/tools`
- `/tool_search <termo>`
- `/debug on|off`
- `/optimize`
- `/metrics`
- `/health`
- `/feedback up|down`
- `/profile short|detailed`
- `/reset_session`
- `/fs_ls <pasta>`
- `/fs_read <arquivo>`
- `/fs_write <arquivo> <conteudo>`
- `/fs_append <arquivo> <conteudo>`
- `/find <nome> [raiz]`
- `/shell <cmd> [args]`
- `/set_rule <regra>`
- `/list_rules`
- `/delete_rule <regra exata>`
- `/edit_rule <regra atual> => <nova regra>`

## Observabilidade

Logs sao emitidos em JSON por evento, incluindo:

- `intent_detected`
- `rag_results_count`
- `rag_filtered_count`
- `executor_used`
- `memory_saved`
- `execution_time`

## Observacoes

- Sistema otimizado para um unico usuario confiavel (v1).
- Modo `opencode` e opcional; sem cliente configurado, usa fallback para `llm`.
- `web_search` esta mockado por interface para troca futura por provider real.
- Comandos Telegram e opções de menu sao registrados automaticamente a partir de `src/command-router/command-definitions.ts`.
- Tools que o modelo pode usar sao definidas em `tools-contract-spec.md`; adicione novas tools ali para que o agente tenha ciencia automaticamente.
