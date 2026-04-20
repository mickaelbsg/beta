# PRD — Assistente Pessoal IA com RAG + Obsidian

🧭 Visão do Produto

Criar um assistente pessoal inteligente, focado em:

- memória persistente (RAG)
- integração com Obsidian
- uso via Telegram
- comportamento confiável (não “alucinando”)

O sistema NÃO deve ser um agente autônomo complexo.
Deve ser um assistente previsível, útil e com memória real.

🎯 Objetivos

Permitir ao usuário:
- salvar notas rapidamente
- recuperar informações passadas
- organizar conhecimento
- estudar com ajuda da IA
- receber novidades relevantes

Garantir:
- memória consistente
- respostas contextualizadas
- baixo nível de erro

👤 Usuário

Técnico (Dev / Infra / NOC)
Usa Telegram diariamente
Usa Obsidian como base de conhecimento

🧩 Funcionalidades Principais

1. 📝 Criação de Notas

Input: “anota que…”
Output:
- arquivo .md no Obsidian
- indexação no RAG

2. 🔍 Recuperação de Memória

Input: “o que eu falei sobre X?”
Sistema:
- busca no vector DB
- injeta contexto
- responde

3. 💬 Conversa com Contexto

- Histórico recente considerado
- Memória relevante injetada automaticamente

4. 📚 Modo Estudo

- resumir conteúdo
- gerar perguntas
- explicar conceitos

5. 🌐 Busca de Novidades

- buscar notícias/updates
- resumir
- entregar ao usuário

6. 🧠 Decisão de Memória

O sistema decide:
- quando salvar
- o que salvar
- como salvar

🚫 Fora do Escopo (agora)

- multi-agentes
- automação complexa
- execução autônoma de tarefas críticas
- interface web (Telegram only por enquanto)

📏 Métricas de Sucesso

- % de respostas com contexto correto
- tempo de resposta
- taxa de recuperação correta de memória
- uso diário do usuário
