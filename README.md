# BETA — Seu Copiloto Técnico (Telegram + Obsidian)

O BETA é um assistente pessoal projetado para ser seu terminal remoto seguro e seu "segundo cérebro" persistente. Ele opera via Telegram, armazena conhecimento no seu Obsidian e aprende com o histórico das suas interações.

---

## 🔐 Princípios de Segurança

1. **Sem Autonomia Espontânea:** A IA não executa nada por conta própria. Toda ação é disparada por comando ou intenção clara.
2. **Controle Total:** O usuário comanda, o sistema executa, a IA assiste e explica.
3. **Guardrails Determinísticos:** Comandos operacionais são validados por uma camada de código (Action Layer) antes de qualquer processamento da IA.

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

## 🛠️ Guia de Uso Rápido

1. **Ensine o sistema sobre você:**
   > Envie: "Meu nome é Alpha e trabalho com Engenharia de Dados"
   > O sistema atualizará seu `profile.md` instantaneamente.

2. **Execute com segurança:**
   > Envie: "/run docker ps"
   > O sistema executa o comando e a IA explica o status dos seus serviços.

3. **Recupere conhecimento:**
   > Envie: "Busque na web sobre os novos recursos do Python 3.13"
   > O braço **WEB** será acionado para trazer informações atualizadas.

---

## 🏗️ Configuração Técnica

### Requisitos

- Node.js 20+
- Vault do Obsidian local configurado em `OBSIDIAN_VAULT_PATH`.
- Chaves de API (OmniRoute ou OpenAI) no `.env`.

### Instalação

```bash
npm install
npm run build
npm run dev
```

### CLI Interno

```bash
npm run cli -- note "Minha nota técnica"
npm run cli -- search "Kubernetes"
```

---
*BETA — O motorista do seu ecossistema técnico.*
