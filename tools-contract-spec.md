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
      "name": "fs_ls",
      "description": "Lista arquivos e pastas em diretórios permitidos",
      "when_to_use": [
        "Usuário pede para navegar pastas",
        "Usuário quer ver estrutura de diretório"
      ],
      "input": {
        "path": "string"
      },
      "rules": [
        "Acessar somente raízes permitidas",
        "Não expor arquivos sensíveis fora da whitelist"
      ]
    },
    {
      "name": "fs_read",
      "description": "Lê conteúdo de arquivo em diretório permitido",
      "when_to_use": [
        "Usuário pede para ler arquivo",
        "Usuário quer inspecionar conteúdo local"
      ],
      "input": {
        "path": "string"
      },
      "rules": [
        "Acessar somente raízes permitidas",
        "Retornar conteúdo truncado quando muito grande"
      ]
    },
    {
      "name": "fs_write",
      "description": "Escreve conteúdo em arquivo permitido",
      "when_to_use": [
        "Usuário pede para editar arquivo",
        "Usuário pede para criar/atualizar arquivo local"
      ],
      "input": {
        "path": "string",
        "content": "string"
      },
      "rules": [
        "Acessar somente raízes permitidas",
        "Não sobrescrever caminhos fora da whitelist"
      ]
    },
    {
      "name": "fs_append",
      "description": "Anexa conteúdo em arquivo permitido",
      "when_to_use": [
        "Usuário pede para adicionar conteúdo no final do arquivo"
      ],
      "input": {
        "path": "string",
        "content": "string"
      },
      "rules": [
        "Acessar somente raízes permitidas",
        "Manter operação simples e determinística"
      ]
    },
    {
      "name": "find",
      "description": "Busca arquivos e pastas por nome dentro de diretórios permitidos",
      "when_to_use": [
        "Usuário pede para localizar um arquivo ou pasta",
        "Explorar o conteúdo local do vault"
      ],
      "input": {
        "query": "string",
        "root": "string"
      },
      "rules": [
        "Buscar somente dentro de raízes permitidas",
        "Retornar apenas caminhos relevantes"
      ]
    },
    {
      "name": "shell",
      "description": "Executa comandos shell limitados em diretórios permitidos",
      "when_to_use": [
        "Usuário pede para navegar ou inspecionar arquivos locais",
        "Requer operações do sistema de arquivos com comandos seguros"
      ],
      "input": {
        "command": "string",
        "args": "string"
      },
      "rules": [
        "Permitir apenas comandos seguros como pwd, ls, cd e cat",
        "Não executar comandos fora do escopo do diretório permitido"
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
