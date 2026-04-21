import { decideAction } from "./src/orchestrator/action-decider.js";

const tests = [
  { input: "Meu nome é Alpha", expected: "SAVE_MEMORY" },
  { input: "Estou estudando Kubernetes", expected: "SAVE_MEMORY" },
  { input: "/run ls -la", expected: "RUN_COMMAND" },
  { input: "/note Documentação do projeto", expected: "CREATE_NOTE" },
  { input: "/search docker", expected: "SEARCH" },
  { input: "/diary", expected: "GENERATE_DIARY" },
  { input: "Olá, como vai?", expected: "NONE" }
];

console.log("🚀 Iniciando Testes de Action Layer...");
let passed = 0;

for (const t of tests) {
  const action = decideAction(t.input);
  if (action.type === t.expected) {
    console.log(`✅ PASSOU: '${t.input}' -> ${action.type}`);
    passed++;
  } else {
    console.log(`❌ FALHOU: '${t.input}' -> esperado ${t.expected}, mas veio ${action.type}`);
  }
}

console.log(`\n📊 Resultado: ${passed}/${tests.length} testes passados.`);
if (passed === tests.length) {
  process.exit(0);
} else {
  process.exit(1);
}
