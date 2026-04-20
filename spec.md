## 🏗️ Arquitetura Geral

Telegram Bot  
   ↓  
Backend (Node.js)  
   ↓  
Orquestrador (core logic)  
   ↓  
├── RAG (Qdrant)  
├── Histórico (SQLite)  
├── Obsidian (filesystem)  
└── OpenCode (executor)

---

## 📦 Stack

- Node.js
- SQLite
- Qdrant
- API LLM (OpenAI/Claude)
- Telegram Bot API
- File system (Obsidian vault)

---

## 🧩 Módulos

---

### 1. `message-handler`

Responsável por:

- receber mensagem do Telegram
- normalizar input
- enviar para orchestrator

---

### 2. `orchestrator`

Cérebro do sistema.

Responsabilidades:

1. Detectar intenção:
    - note
    - query
    - chat
    - study
    - search
2. Buscar contexto:
    - histórico recente
    - RAG (top-k)
3. Montar prompt
4. Chamar OpenCode / LLM
5. Decidir persistência

---

### 3. `memory-service`

#### SQLite

Tabela:

messages (  
  id TEXT,  
  role TEXT,  
  content TEXT,  
  timestamp DATETIME  
)

---

#### Qdrant

- coleção: `memories`
- campos:
    - id
    - vector
    - payload:
        - text
        - source (obsidian/chat)
        - timestamp

---

### 4. `obsidian-service`

Funções:

- `createNote(title, content)`
- `appendToNote(file, content)`
- `searchNotes(query)`

Formato:

# Título  
  
- Data: {{timestamp}}  
  
Conteúdo...

---

### 5. `rag-service`

Fluxo:

1. gerar embedding
2. buscar top-k (3~5)
3. retornar contexto relevante

---

### 6. `agent-executor (OpenCode)`

Recebe:

- prompt estruturado
- contexto já enriquecido

Retorna:

- resposta final
- opcional: ação estruturada

---

## 🔁 Fluxo Principal

### 📥 Input

Usuário envia mensagem

---

### 🔍 Etapas

1. salvar no histórico
2. detectar intenção
3. buscar contexto:
    - últimos 5 messages
    - top-k RAG
4. montar prompt:

Contexto:  
- histórico  
- memórias relevantes  
  
Instrução:  
responda de forma objetiva e útil

5. chamar OpenCode
6. retornar resposta
7. decidir:
    - salvar como memória?
    - salvar no Obsidian?

---

## 🧠 Regras de Memória

Salvar quando:

- usuário pede explicitamente
- informação pessoal relevante
- aprendizado importante

Não salvar:

- conversa trivial
- respostas genéricas

---

## 🧪 Exemplos de Intenção

"anota que..." → NOTE  
"lembra de..." → NOTE  
"o que eu falei..." → QUERY  
"me explica..." → STUDY  
"busca sobre..." → SEARCH

Fallback:  
→ CHAT

---

## 🧠 Prompt Base do Agente

Você é um assistente pessoal técnico.  
  
Regras:  
- Seja direto e útil  
- Use o contexto fornecido  
- NÃO invente informações  
- Se não souber, diga que não sabe  
  
Objetivo:  
ajudar o usuário a lembrar, organizar e aprender

---

## 🔌 Integração OpenCode

Entrada:

{  
  "context": "...",  
  "instruction": "...",  
  "tools": ["obsidian", "search"]  
}

---

## 🚀 Fases de Implementação

### Fase 1

- Telegram bot
- histórico (SQLite)
- resposta básica

---

### Fase 2

- integração Obsidian
- comandos de nota

---

### Fase 3

- RAG (Qdrant)
- busca de contexto

---

### Fase 4

- OpenCode integrado
- melhorias de prompt

---

### Fase 5

- busca web
- modo estudo

# 💥 Observação final (importante)

> Não delegue inteligência pro agente  
> Delegue execução

👉 O sistema (orchestrator + memória) é o que faz isso funcionar.