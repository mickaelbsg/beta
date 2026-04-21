# Product Requirements Document (PRD) - BETA Copilot

## 1. Visão Geral do Produto
O BETA é um assistente pessoal projetado para operar como um terminal remoto seguro e um "segundo cérebro" persistente. Acessível nativamente via Telegram, ele consolida automação local, integração com LLMs e retenção de conhecimento no Obsidian, além de oferecer um painel administrativo para monitoramento.

## 2. Objetivos e Metas
- **Produtividade Aumentada:** Reduzir o atrito na execução de tarefas de shell ou na anotação de conhecimentos diários.
- **Segurança Primária:** Garantir que o LLM não tenha autonomia não autorizada (sem shell injection, sem "hallucinated actions").
- **Ownership de Dados:** Manter 100% dos dados gerados (perfil, regras, diários, notas) salvos de forma legível em Markdown local.
- **Gestão Facilitada:** Prover interface gráfica (Admin UI) para acompanhamento da saúde do sistema, chaves de API e roteamento de modelos.

## 3. Público-Alvo
- Engenheiros de Software, DevOps e Cientistas de Dados (perfil "Alpha").
- Usuários avançados de Obsidian que buscam automação conversacional.

## 4. Escopo das Funcionalidades

### 4.1 Interface de Chat (Telegram)
- Recepção de comandos imperativos (`/run`, `/shell`, `/note`, `/search`, `/diary`).
- Conversação natural para consultas técnicas com histórico de contexto (`/ask`, `/claude`).
- Injeção automática das regras (`/rules/rules.md`) no comportamento da IA.

### 4.2 Action Layer (Camada Determinística)
- Interceptação de intenções (ActionDecider) garantindo que ações destrutivas ou vitais rodem como código antes da IA gerar respostas.
- Whitelist de shell (`docker`, `pm2`, `git`, `ls`, etc.) isolado via `execFile` contra code injection.

### 4.3 Gestão de Conhecimento (Obsidian Integration)
- Auto-atualização do Perfil (`/knowledge/user/profile.md`).
- Consolidação diária (`/journal/YYYY-MM-DD.md`) gerada automaticamente no encerramento do dia ou sob demanda (`/diary`).

### 4.4 Admin UI (Dashboard)
- Aplicação React hospedada via Docker (Nginx).
- Visualização de logs técnicos de intenções e execuções em tempo real.
- Interface para enable/disable de provedores de IA (OmniRoute, OpenAI).
- Edição de prioridades na lista de modelos de Fallback.

## 5. Arquitetura de Software
- **Linguagem/Framework:** TypeScript, Node.js (Backend), React/Vite/Tailwind (Frontend).
- **Implantação:** 100% Docker-Compose (Backend Node, Admin-UI Nginx, Qdrant).
- **Bancos de Dados:** SQLite (Historico conversacional rápido), Qdrant (Vetores para RAG futuro), FileSystem (Obsidian Vault).

## 6. Métricas de Sucesso
- Zero incidentes de execução arbitrária no terminal host.
- Taxa de sucesso de respostas de fallback < 3s quando o provedor primário falha.
- Atualização consistente do `profile.md` ao capturar fatos pelo chat.

## 7. Roadmap (Próximos Passos)
- [ ] Ativação definitiva da RAG nativa via embeddings (Qdrant).
- [ ] Adição de sistema de Agendamento (Cron) nativo configurável no Admin-UI.
- [ ] Autenticação de dois fatores no painel Admin-UI.
