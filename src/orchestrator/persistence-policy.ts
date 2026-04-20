import type { ExecutionResult, Intent } from "../shared/types.js";

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const explicitSaveKeywords = ["anota", "salva", "lembra"];
const strongSignalKeywords = [
  "decidi",
  "decisao",
  "plano",
  "vou fazer",
  "objetivo",
  "meta",
  "aprendi",
  "preferencia",
  "agenda",
  "compromisso"
];
const trivialKeywords = ["oi", "ola", "bom dia", "boa tarde", "boa noite"];

export function shouldSaveToObsidian(intent: Intent): boolean {
  return intent === "NOTE";
}

export function shouldSaveToRagByInput(intent: Intent, userText: string): boolean {
  if (intent === "NOTE") {
    return true;
  }
  const text = normalizeText(userText);
  if (explicitSaveKeywords.some((k) => text.includes(k))) {
    return true;
  }
  if (trivialKeywords.includes(text)) {
    return false;
  }
  return strongSignalKeywords.some((k) => text.includes(k));
}

export function shouldSaveToRagByExecution(
  intent: Intent,
  userText: string,
  executionResult: ExecutionResult
): boolean {
  if (intent === "NOTE") {
    return true;
  }
  if (!executionResult.shouldPersistMemory) {
    return false;
  }
  return shouldSaveToRagByInput(intent, userText);
}

