# BETA — Seu Copiloto Técnico (Telegram + Obsidian + Admin UI)

O BETA é um assistente pessoal projetado para ser seu terminal remoto seguro, seu "segundo cérebro" persistente e agora com um painel de administração moderno. Ele opera via Telegram, armazena conhecimento no seu Obsidian, tem um dashboard de monitoramento e aprende com o histórico das suas interações.

---

## 🔐 Princípios de Segurança

1. **Sem Autonomia Espontânea:** A IA não executa nada por conta própria. Toda ação é disparada por comando ou intenção clara.
2. **Controle Total:** O usuário comanda, o sistema executa, a IA assiste e explica.
3. **Guardrails Determinísticos:** Comandos operacionais são validados por uma camada de código (Action Layer) antes de processamento da IA.
4. **Isolamento de Contêineres:** Todo o sistema, incluindo backend e dashboard, opera dentro de contêineres Docker isolados, minimizando acesso indevido à máquina hospedeira.

---

## 💻 Painel Administrativo (Admin UI)

A partir da versão 0.3.0, o Beta inclui um dashboard visual construído em React, Vite e Tailwind CSS. 

- **Monitoramento:** Acompanhamento do Uptime, Status do Servidor e da conexão com o Obsidian Vault.
- **Logs em Tempo Real:** Tabela visual dos últimos eventos técnicos da Action Layer, com auditoria de falha/sucesso.
- **Configurações Dinâmicas:** Gerenciamento visual das chaves de API, com suporte nativo de habilitar e desabilitar provedores e a ordem de roteamento (Fallback).
- **Acessibilidade & UX:** Painel modular (Sidebar, Header) e modo responsivo.

---

## 🧠 Sistema de Memória (Obsidian-First)

O Obsidian é a **fonte única de verdade** do sistema. O BETA organiza seu conhecimento automaticamente:

- `/knowledge/user/profile.md`: Suas informações pessoais, área de atuação e preferências (atualizado de forma inteligente).
- `/journal/YYYY-MM-DD.md`: Seu diário técnico consolidado do dia, gerado sob demanda.
- `/inbox/`: Entrada rápida para notas diversas capturadas durante a conversa.
- `/rules/rules.md`: Onde vivem suas regras customizadas que o sistema **nunca** desobedece.

---

## 🚀 Comandos Principais (Telegram)

### 💻 Execução e Host (Action Layer)

- `/run <comando>`: Executa comandos no host local. Whitelist segura: `docker, pm2, git, ls, cat`.
- `/shell <cmd>`: Navegação e leitura rápida de arquivos (`pwd`, `ls`, `cd`, `cat`).

### 🤖 Assistente IA (Ativo & Proativo)

- `/claude <instrução>`: Invoca o Claude Code CLI para tarefas pesadas de programação ou análise técnica.
- `/ask <pergunta>`: Consulta técnica à IA preservando o contexto das últimas 10 mensagens.
- `/build <instrução>`: Gera scripts ou blocos de código sem executá-los.

### 📓 Gestão de Conhecimento

- `/note <texto>`: Salva uma nota estruturada no Obsidian e indexa para busca.
- `/search <termo>`: Realiza uma busca profunda no seu vault do Obsidian.
- `/diary`: Sintetiza suas interações do dia em um registro diário organizado.

### ⚙️ Gestão do Sistema

- `/config`: Mostra o estado atual do sistema e variáveis ativas.
- `/debug on|off`: Ativa telemetria detalhada nas respostas (tokens, latência, ações).
- `/reset_session`: Limpa o histórico imediato da conversa (RAM).

---

## 🏗️ Configuração Técnica e Implantação (Docker)

O sistema agora é totalmente nativo para Docker.

### Requisitos
- Docker Engine & Docker Compose
- Vault do Obsidian configurado para montagem no volume do contêiner.
- Arquivo `.env` configurado.

### Subindo o ecossistema

O comando único para construir as imagens (Backend Node.js e Admin UI Nginx) e subir o sistema de bancos (Qdrant):

```bash
docker-compose up -d --build
```

### Acesso aos Serviços
- **Telegram Bot:** Rodando silenciosamente em background.
- **Backend API:** Internamente porta `3001` (Exposto via porta configurada no docker-compose).
- **Admin UI Dashboard:** Porta `8080` (Acesse `http://localhost:8080`).

---
*BETA — O motorista do seu ecossistema técnico.*
