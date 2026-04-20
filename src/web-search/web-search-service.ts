import type { SearchResult, WebSearchService } from "../shared/types.js";

export class MockWebSearchService implements WebSearchService {
  public async search(query: string): Promise<SearchResult[]> {
    return [
      {
        title: `Resumo de novidades sobre: ${query}`,
        url: "https://example.com/noticia-1",
        snippet: "Resultado simulado para desenvolvimento local. Troque por provider real na producao."
      },
      {
        title: `Guia rapido: ${query}`,
        url: "https://example.com/noticia-2",
        snippet: "Segundo resultado simulado com foco em praticidade."
      },
      {
        title: `Contexto adicional: ${query}`,
        url: "https://example.com/noticia-3",
        snippet: "Terceiro resultado simulado para sumarizacao pelo executor."
      }
    ];
  }
}

