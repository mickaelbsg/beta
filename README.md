# BETA — Seu Copiloto Técnico (Telegram + Obsidian)

O BETA é um assistente pessoal projetado para ser seu terminal remoto seguro e seu "segundo cérebro" persistente. Ele opera via Telegram, armazena conhecimento no seu Obsidian e aprende com o histórico das suas interações.

---

## 🔐 Princípios de Segurança

1. **Sem Autonomia:** A IA não executa nada por conta própria.
2. **Controle Total:** O usuário comanda, a IA assiste.
3. **Guardrails:** Comandos sensíveis são bloqueados ou restritos a uma whitelist.

---

## 🧠 Sistema de Memória (Obsidian-First)

O Obsidian é a **fonte única de verdade** do sistema. O BETA organiza seu conhecimento automaticamente no diretório configurado:

- `/knowledge/user/profile.md`: Suas informações pessoais, área de atuação e preferências (atualizado automaticamente).
- `/journal/YYYY-MM-DD.md`: Seu diário técnico consolidado do dia.
- `/inbox/`: Entrada rápida para notas diversas.

---

## 🚀 Comandos Principais (Telegram)

### 💻 Execução e Host

- `/run <comando>`: Executa comandos no host local (whitelist: `docker, pm2, git, ls, cat`).
- `/shell <cmd>`: Navegação básica no sistema (`pwd`, `ls`, `cd`, `cat`).

### 🤖 Assistente IA (Claude Code)

- `/ask <pergunta>`: Consulta técnica à IA sem execução de código. Preserva contexto da conversa.
- `/build <instrução>`: Gera scripts ou blocos de código prontos para uso.

### 📓 Conhecimento e Notas

- `/note <texto>`: Salva uma nota estruturada diretamente no seu Obsidian e indexa para busca futura.
- `/search <termo>`: Busca fatos e notas relevantes dentro do seu vault do Obsidian.
- `/diary`: Gera uma síntese inteligente das suas atividades e aprendizados do dia e salva no seu diário.

### ⚙️ Gestão do Sistema

- `/config`: Mostra as configurações ativas do sistema.
- `/debug on|off`: Ativa detalhes técnicos nas respostas (tokens, latência, intenção).
- `/reset_session`: Limpa o histórico recente da conversa (RAM) para começar um assunto novo.

---

## 🛠️ Guia de Uso Rápido

1. **Ensine o sistema sobre você:**
   > Envie: "Meu nome é Mickael e trabalho com DevOps"
   > O BETA atualizará seu `profile.md` e passará a te tratar pelo nome.

2. **Salve uma descoberta técnica:**
   > Envie: "/note aprendi que o keepalived usa o protocolo VRRP para alta disponibilidade"
   > Isso será arquivado e poderá ser recuperado depois.

3. **Recupere informação:**
   > Envie: "O que eu falei sobre keepalived?"
   > O BETA lerá suas notas e responderá com base nelas.

4. **Gerencie seus containers:**
   > Envie: "/run docker ps"
   > Veja o status dos seus serviços diretamente no chat.

---

## 🏗️ Configuração Técnica

### Requisitos

- Node.js 20+
- Um vault do Obsidian local.
- Bot no Telegram e token da API (OmniRoute ou OpenAI).

### Instalação

```bash
npm install
cp .env.example .env
# Configure suas chaves e o caminho do vault do Obsidian
npm run build
npm run dev
```

### CLI Interno

Você também pode operar o sistema via terminal local:

```bash
npm run cli -- note "Sua nota aqui"
npm run cli -- search "termo de busca"
```

---
*BETA — Mais do que um bot, sua infraestrutura com memória.*
