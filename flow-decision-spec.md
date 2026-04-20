# Flow Decision Spec

## 1. Classificação de Intent

IF message contém:
- "anota", "salva", "lembra"
→ intent = NOTE

ELSE IF contém:
- "o que eu falei", "lembra", "sobre X"
→ intent = QUERY

ELSE IF contém:
- "explica", "me ensina", "como funciona"
→ intent = STUDY

ELSE IF contém:
- "busca", "novidades", "notícias"
→ intent = SEARCH

ELSE:
→ intent = CHAT

---

## 2. Fluxo por Intent

### NOTE
- criar nota no Obsidian
- salvar no RAG
- responder confirmação

---

### QUERY
- buscar no RAG (top-k)
- montar contexto
- gerar resposta

---

### STUDY
- gerar explicação estruturada
- opcional: perguntas
- não salvar automaticamente

---

### SEARCH
- chamar web_search
- resumir
- responder

---

### CHAT
- usar histórico recente
- resposta simples
- não salvar

---

## 3. Pipeline Global

1. Receber mensagem
2. Salvar no histórico
3. Detectar intent
4. Buscar contexto:
   - últimos 5 históricos
   - RAG (se aplicável)
5. Montar prompt
6. Executar via OpenCode
7. Retornar resposta
8. Avaliar persistência

---

## 4. Persistência

Salvar no RAG se:
- intent NOTE
- alta relevância

Salvar no Obsidian se:
- intent NOTE

---

## 5. Segurança

- nunca executar ações críticas
- sempre validar input
- evitar duplicação de memória