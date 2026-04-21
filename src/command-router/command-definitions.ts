export interface CommandDefinition {
  name: string;
  usage: string;
  description: string;
  handler: string;
  category: string;
  showInTelegram?: boolean;
  needsContext?: boolean;
}

export const commandDefinitions: CommandDefinition[] = [
  {
    name: "/help",
    usage: "/help",
    description: "Mostra comandos disponiveis",
    handler: "help",
    category: "Sistema"
  },
  {
    name: "/commands",
    usage: "/commands",
    description: "Alias para /help",
    handler: "help",
    category: "Sistema"
  },
  {
    name: "/note",
    usage: "/note <texto>",
    description: "Salva uma nota",
    handler: "note",
    category: "Notas"
  },
  {
    name: "/memories",
    usage: "/memories [pagina]",
    description: "Lista memorias salvas",
    handler: "memories",
    category: "Memoria"
  },
  {
    name: "/memory",
    usage: "/memory <termo>",
    description: "Busca memorias por termo",
    handler: "memoryQuery",
    category: "Memoria"
  },
  {
    name: "/memory_detail",
    usage: "/memory_detail <id>",
    description: "Mostra detalhes de uma memoria",
    handler: "memoryDetail",
    category: "Memoria"
  },
  {
    name: "/delete_memory",
    usage: "/delete_memory <id>",
    description: "Remove uma memoria",
    handler: "deleteMemory",
    category: "Memoria"
  },
  {
    name: "/logs",
    usage: "/logs",
    description: "Exibe dados da ultima execucao",
    handler: "logs",
    category: "Sistema"
  },
  {
    name: "/config",
    usage: "/config",
    description: "Mostra configuracao atual",
    handler: "config",
    category: "Sistema"
  },
  {
    name: "/set",
    usage: "/set <chave>=<valor>",
    description: "Altera parametros do sistema",
    handler: "set",
    category: "Sistema"
  },
  {
    name: "/search",
    usage: "/search <consulta>",
    description: "Busca informacoes externas",
    handler: "search",
    category: "Sistema"
  },
  {
    name: "/study",
    usage: "/study <tema>",
    description: "Modo explicativo para aprendizado",
    handler: "study",
    category: "Sistema"
  },
  {
    name: "/tools",
    usage: "/tools",
    description: "Lista ferramentas conhecidas",
    handler: "tools",
    category: "Sistema"
  },
  {
    name: "/tool_search",
    usage: "/tool_search <termo>",
    description: "Procura ferramentas por termo",
    handler: "toolSearch",
    category: "Sistema"
  },
  {
    name: "/ask",
    usage: "/ask <pergunta>",
    description: "Pergunta para o assistente Claude Code (sem executar nada)",
    handler: "ask",
    category: "Sistema"
  },
  {
    name: "/build",
    usage: "/build <descricao>",
    description: "Gera codigo ou script sem executar",
    handler: "build",
    category: "Sistema"
  },
  {
    name: "/run",
    usage: "/run <comando>",
    description: "Executa comando local seguro com whitelist",
    handler: "run",
    category: "Shell",
    needsContext: true
  },
  {
    name: "/diary",
    usage: "/diary",
    description: "Gera e salva o diario inteligente do dia",
    handler: "diary",
    category: "Diario"
  },
  {
    name: "/debug",
    usage: "/debug on|off",
    description: "Ativa/desativa debug mode",
    handler: "debug",
    category: "Sistema",
    needsContext: true
  },
  {
    name: "/optimize",
    usage: "/optimize",
    description: "Executa auto-otimizacao",
    handler: "optimize",
    category: "Sistema"
  },
  {
    name: "/metrics",
    usage: "/metrics",
    description: "Mostra metricas do sistema",
    handler: "metrics",
    category: "Sistema"
  },
  {
    name: "/health",
    usage: "/health",
    description: "Mostra status de saude",
    handler: "health",
    category: "Sistema"
  },
  {
    name: "/feedback",
    usage: "/feedback up|down",
    description: "Registra feedback da resposta",
    handler: "feedback",
    category: "Sistema",
    needsContext: true
  },
  {
    name: "/profile",
    usage: "/profile short|detailed",
    description: "Ajusta estilo de resposta por usuario",
    handler: "profile",
    category: "Sistema",
    needsContext: true
  },
  {
    name: "/reset_session",
    usage: "/reset_session",
    description: "Limpa o historico do chat atual",
    handler: "resetSession",
    category: "Sistema",
    needsContext: true
  },
  {
    name: "/fs_ls",
    usage: "/fs_ls <pasta>",
    description: "Lista arquivos em pasta permitida",
    handler: "fileSystemList",
    category: "Arquivos"
  },
  {
    name: "/fs_read",
    usage: "/fs_read <arquivo>",
    description: "Lê arquivo permitido",
    handler: "fileSystemRead",
    category: "Arquivos"
  },
  {
    name: "/fs_write",
    usage: "/fs_write <arquivo> <conteudo>",
    description: "Escreve arquivo permitido",
    handler: "fileSystemWrite",
    category: "Arquivos"
  },
  {
    name: "/fs_append",
    usage: "/fs_append <arquivo> <conteudo>",
    description: "Anexa texto a arquivo permitido",
    handler: "fileSystemAppend",
    category: "Arquivos"
  },
  {
    name: "/shell",
    usage: "/shell <cmd> [args]",
    description: "Executa comandos de shell locais",
    handler: "shellCommand",
    category: "Arquivos",
    needsContext: true
  },
  {
    name: "/find",
    usage: "/find <nome> [raiz]",
    description: "Busca arquivos ou pastas no sistema",
    handler: "find",
    category: "Arquivos"
  },
  {
    name: "/set_rule",
    usage: "/set_rule <regra>",
    description: "Adiciona regra de alta prioridade aos guardrails",
    handler: "setRule",
    category: "Guardrails",
    needsContext: true
  },
  {
    name: "/list_rules",
    usage: "/list_rules",
    description: "Lista as regras de guardrail atuais",
    handler: "listRules",
    category: "Guardrails",
    needsContext: true
  },
  {
    name: "/delete_rule",
    usage: "/delete_rule <regra exata>",
    description: "Remove uma regra especifica",
    handler: "deleteRule",
    category: "Guardrails",
    needsContext: true
  },
  {
    name: "/edit_rule",
    usage: "/edit_rule <regra atual> => <nova regra>",
    description: "Edita uma regra existente",
    handler: "editRule",
    category: "Guardrails",
    needsContext: true
  },
  {
    name: "/claude",
    usage: "/claude <instrucao>",
    description: "Executa uma instrucao no Claude Code CLI (programacao e analise)",
    handler: "claudeCode",
    category: "Sistema",
    needsContext: true
  }
];
