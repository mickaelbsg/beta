# Personal AI Assistant Backend

Backend modular em Node.js + TypeScript para assistente pessoal com Telegram, memoria em SQLite, RAG com Qdrant, integracao com Obsidian e executor LLM/OpenCode.

## Arquitetura

- `src/message-handler`: entrada Telegram (long polling)
- `src/orchestrator`: fluxo principal, deteccao de intent, decisao de persistencia
- `src/memory-service`: persistencia de historico (SQLite) e memoria semantica (Qdrant)
- `src/rag-service`: embeddings + recuperacao top-k
- `src/obsidian-service`: criacao e busca de notas markdown
- `src/agent-executor`: executores `llm` e `opencode` (com fallback)
- `src/web-search`: provedor de busca web (mock inicial)
- `src/app/bootstrap.ts`: composicao da aplicacao

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
2. Salva historico em SQLite
3. Detecta intent (`NOTE`, `QUERY`, `STUDY`, `SEARCH`, `CHAT`)
4. Recupera contexto (historico recente + RAG quando aplicavel)
5. Monta prompt estruturado
6. Executa no executor (`llm` ou `opencode`)
7. Retorna resposta
8. Persiste memoria/nota conforme politicas

## Observacoes

- Sistema otimizado para um unico usuario confiavel (v1).
- Modo `opencode` e opcional; sem cliente configurado, usa fallback para `llm`.
- `web_search` esta mockado por interface para troca futura por provider real.

