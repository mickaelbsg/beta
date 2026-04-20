{
  "tools": [
    {
      "name": "create_note",
      "description": "Cria uma nota no Obsidian",
      "when_to_use": [
        "Usuário pedir para anotar algo",
        "Detectado intent NOTE"
      ],
      "input": {
        "title": "string",
        "content": "string"
      },
      "rules": [
        "Gerar título claro e curto",
        "Organizar conteúdo em markdown",
        "Evitar duplicação de notas"
      ]
    },
    {
      "name": "search_memory",
      "description": "Busca memória no RAG (Qdrant)",
      "when_to_use": [
        "Perguntas sobre algo já dito",
        "Recuperação de contexto"
      ],
      "input": {
        "query": "string"
      },
      "rules": [
        "Buscar top-k resultados",
        "Retornar apenas dados relevantes"
      ]
    },
    {
      "name": "save_memory",
      "description": "Salva informação no RAG",
      "when_to_use": [
        "Informação relevante detectada",
        "Usuário pede para lembrar"
      ],
      "input": {
        "text": "string",
        "source": "chat | obsidian"
      },
      "rules": [
        "Não salvar dados irrelevantes",
        "Evitar duplicação"
      ]
    },
    {
      "name": "web_search",
      "description": "Busca informações na internet",
      "when_to_use": [
        "Usuário pede novidades",
        "Pergunta sobre eventos atuais"
      ],
      "input": {
        "query": "string"
      },
      "rules": [
        "Priorizar fontes confiáveis",
        "Resumir resultado"
      ]
    },
    {
      "name": "study_helper",
      "description": "Auxilia no estudo",
      "when_to_use": [
        "Usuário pede explicação",
        "Modo estudo detectado"
      ],
      "input": {
        "topic": "string"
      },
      "rules": [
        "Explicar de forma simples",
        "Dividir em partes",
        "Opcional: gerar perguntas"
      ]
    }
  ]
}