# Registro de Bugs e Soluções (BETA)

## 2026-04-20

### 1. Perda de contexto conversacional (Short-term memory)

- **Bug:** O assistente tratava cada mensagem de forma isolada, esquecendo o que foi dito imediatamente antes.
- **Causa:** O `ConversationMemoryService` não estava sendo alimentado corretamente ou não estava sendo injetado no prompt.
- **Solução:** Implementação do `ConversationMemoryService` com limite de 10 mensagens por chat. Inclusão obrigatória das últimas 6 interações no prompt final via `ContextBuilder`.

### 2. Memória incompleta (Assistant messages missing)

- **Bug:** Referências como "por que você falou isso?" falhavam porque apenas as mensagens do usuário eram salvas no histórico recente.
- **Causa:** O orchestrator só chamava `addMessage` para o input do usuário.
- **Solução:** Adicionado salvamento da resposta do assistente no `ConversationMemoryService` logo após a geração/envio da mensagem.

### 3. Diário Inteligente (/diary) quebrado

- **Bug:** O comando `/diary` retornava histórico vazio ou de chats aleatórios.
- **Causa:** O código usava a data do dia como `chatId` na busca do repositório de histórico (`getRecentMessages(title, 200)`).
- **Solução:**
  - Adicionado método `getMessagesByDate(chatId, date)` no `SqliteHistoryRepository`.
  - Atualizado `/diary` para usar o `chatId` real do contexto e filtrar apenas as mensagens do dia atual.

### 4. Vulnerabilidade Crítica de Shell Injection (/run)

- **Bug:** Permissão de execução arbitrária via comando `sh` na whitelist. Exemplo: `/run sh -c "..."`.
- **Causa:** Uso de `execSync` com shell implícito e presença de `sh` na lista de comandos permitidos.
- **Solução:**
  - Removido `sh` da whitelist.
  - Substituído `execSync` por `execFile` (execução direta binária).
  - Adicionado bloqueio de caracteres de concatenação/pipe (`&&`, `|`, `;`).

### 5. Falha Global no Sistema RAG (OpenAI API Key)

- **Bug:** O sistema parava de responder se a chave OpenAI para embeddings estivesse inválida/vencida.
- **Causa:** `EmbeddingService` lançava exceção não tratada no fluxo principal de salvamento de memória, interrompendo o ciclo de resposta do bot.
- **Solução (Intermediária):** Migração para o **Obsidian Memory Engine** (busca textual simples), desativando temporariamente a dependência de embeddings e Qdrant para o fluxo básico de memória.

### 6. Duplicação de arquivos no Obsidian (Profile/Journal)

- **Bug:** O sistema criava novos arquivos para cada atualização de perfil ou diário.
- **Causa:** O `ObsidianService` original apenas escrevia novos arquivos com slugs baseados no título/conteúdo.
- **Solução:**
  - Implementação de caminhos fixos obrigatórios (`/knowledge/user/profile.md` e `/journal/YYYY-MM-DD.md`).
  - Adicionada lógica de atualização em vez de recriação para esses arquivos específicos.

### 7. Erros de API 400/401 no Fallback de Modelos

- **Bug:** O sistema tentava usar provedores de fallback mesmo sem chaves válidas configuradas, resultando em erros fatais que quebravam a resposta final.
- **Causa:** O `LlmExecutor` não validava se os candidatos tinham credenciais antes de tentar a execução.
- **Solução:** Implementado método `isConfigured()` na interface `LLMProvider`. O executor agora filtra a lista de candidatos e só tenta os que possuem chaves de API válidas (não-placeholders).

### 8. Desorganização no profile.md

- **Bug:** Informações como nome e área eram apenas adicionadas ao fim do arquivo, ignorando o template estruturado.
- **Causa:** Lógica simples de "append" no `ObsidianWriterService`.
- **Solução:** Refatorada a lógica de atualização para usar substituição de texto baseada em regex, preenchendo as seções `## Identidade` e `## Área` de forma organizada.

### 9. Beta Reativo vs Ativo (Loop Agentic)

- **Bug:** O sistema dizia que "iria fazer" algo mas parava, esperando nova interação do usuário.
- **Causa:** Fluxo linear de resposta sem loop de execução de ferramentas.
- **Solução:** Implementado **Agentic Loop (ReAct)** no `Orchestrator`. Agora o sistema executa a ferramenta, analisa o resultado e só responde ao usuário com a tarefa concluída.

### 10. "Mentira" do Assistente (Tool Use Integrity)

- **Bug:** O assistente confirmava ter salvo informações sem realmente disparar o comando de escrita.
- **Causa:** O modelo gerava apenas texto de confirmação no JSON, sem o objeto `toolCalls`.
- **Solução:** Reforçados guardrails no `PromptBuilder` e nos `Providers` (OpenAI/OmniRoute) para tornar o campo `toolCalls` obrigatório sempre que uma ação for mencionada.

### 11. Perda de Regras (Persistência no Obsidian)

- **Bug:** Regras cadastradas via `/set_rule` sumiam após reinicialização.
- **Causa:** Persistência em arquivo local temporário.
- **Solução:** Migradas todas as `rules` para o Obsidian em `/rules/rules.md`. Agora são permanentes e editáveis diretamente pelo vault.
