import type { Intent } from "../shared/types.js";

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function detectIntent(message: string): Intent {
  const normalized = normalizeText(message);

  if (includesAny(normalized, ["anota", "salva", "lembra"])) {
    return "NOTE";
  }

  if (includesAny(normalized, ["o que eu falei", "lembra", "sobre"])) {
    return "QUERY";
  }

  if (includesAny(normalized, ["explica", "me ensina", "como funciona"])) {
    return "STUDY";
  }

  if (includesAny(normalized, ["busca", "novidades", "noticias"])) {
    return "SEARCH";
  }

  return "CHAT";
}

