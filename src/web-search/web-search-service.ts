import type { SearchResult, WebSearchService } from "../shared/types.js";

interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}

interface WebSearchArgs {
  provider: "tavily" | "serpapi" | "ddg" | "google_scrape" | "mock";
  timeoutMs: number;
  tavilyApiKey?: string;
  serpApiKey?: string;
}

const SEARCH_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function unwrapGoogleUrl(input: string): string {
  if (input.startsWith("/url?")) {
    const parsed = new URL(`https://www.google.com${input}`);
    const target = parsed.searchParams.get("q");
    return target ? target : input;
  }
  return input;
}

function unwrapDdgRedirect(input: string): string {
  if (input.includes("duckduckgo.com/l/?")) {
    try {
      const parsed = new URL(input, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) {
        return decodeURIComponent(uddg);
      }
    } catch {
      return input;
    }
  }
  return input;
}

class MockSearchProvider implements SearchProvider {
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

class DdgSearchProvider implements SearchProvider {
  public async search(query: string): Promise<SearchResult[]> {
    const url = new URL("https://duckduckgo.com/html/");
    url.searchParams.set("q", query);
    const response = await fetch(url.toString(), {
      headers: {
        "user-agent": SEARCH_USER_AGENT,
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
      }
    });
    if (!response.ok) {
      throw new Error(`ddg_http_${response.status}`);
    }
    const html = await response.text();
    const results: SearchResult[] = [];
    const blockRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null = blockRegex.exec(html);
    while (match && results.length < 8) {
      const rawUrl = decodeHtmlEntities(match[1] ?? "").trim();
      const title = stripTags(decodeHtmlEntities(match[2] ?? "")).trim();
      const url = unwrapDdgRedirect(rawUrl);
      const snippetMatch = /<a[^>]*class="result__a"[\s\S]*?<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(
        html.slice(Math.max(0, match.index), match.index + 1200)
      );
      const snippet = snippetMatch ? stripTags(decodeHtmlEntities(snippetMatch[1])) : "";
      results.push({
        title,
        url,
        snippet
      });
      match = blockRegex.exec(html);
    }
    return results;
  }
}

class GoogleScrapeProvider implements SearchProvider {
  public constructor(private readonly ddgFallback: DdgSearchProvider) {}

  public async search(query: string): Promise<SearchResult[]> {
    try {
      return await this.searchGoogle(query);
    } catch {
      // Single fallback attempt to DDG when Google scraping fails.
      return this.ddgFallback.search(query);
    }
  }

  private async searchGoogle(query: string): Promise<SearchResult[]> {
    const url = new URL("https://www.google.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("num", "5");
    url.searchParams.set("hl", "pt-BR");
    const response = await fetch(url.toString(), {
      headers: {
        "user-agent": SEARCH_USER_AGENT,
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
      }
    });
    if (!response.ok) {
      throw new Error(`google_http_${response.status}`);
    }
    const html = await response.text();
    const results: SearchResult[] = [];
    const blockRegex = /<a href="(\/url\?q=[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null = blockRegex.exec(html);
    while (match && results.length < 8) {
      const rawLink = decodeHtmlEntities(match[1] ?? "").trim();
      const urlCandidate = unwrapGoogleUrl(rawLink);
      const title = stripTags(decodeHtmlEntities(match[2] ?? "")).trim();
      const isGoogleInternal =
        urlCandidate.includes("google.com") ||
        urlCandidate.startsWith("/") ||
        urlCandidate.includes("webcache.googleusercontent.com");
      if (!isGoogleInternal && /^https?:\/\//i.test(urlCandidate) && title.length > 0) {
        results.push({
          title,
          url: urlCandidate,
          snippet: ""
        });
      }
      match = blockRegex.exec(html);
    }
    if (!results.length) {
      throw new Error("google_no_results");
    }
    return results;
  }
}

class TavilySearchProvider implements SearchProvider {
  public constructor(private readonly apiKey: string) {}

  public async search(query: string): Promise<SearchResult[]> {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        search_depth: "basic",
        max_results: 5
      })
    });
    if (!response.ok) {
      throw new Error(`tavily_http_${response.status}`);
    }
    const json = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return (json.results ?? []).map((item) => ({
      title: String(item.title ?? ""),
      url: String(item.url ?? ""),
      snippet: String(item.content ?? "")
    }));
  }
}

class SerpApiSearchProvider implements SearchProvider {
  public constructor(private readonly apiKey: string) {}

  public async search(query: string): Promise<SearchResult[]> {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("engine", "google");
    url.searchParams.set("num", "5");
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`serpapi_http_${response.status}`);
    }
    const json = (await response.json()) as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
    };
    return (json.organic_results ?? []).map((item) => ({
      title: String(item.title ?? ""),
      url: String(item.link ?? ""),
      snippet: String(item.snippet ?? "")
    }));
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("web_search_timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results
    .map((item) => ({
      title: item.title.trim(),
      url: item.url.trim(),
      snippet: item.snippet.replace(/\s+/g, " ").trim()
    }))
    .filter((item) => item.title && item.url)
    .filter((item) => {
      const key = item.url.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function buildProvider(args: WebSearchArgs): SearchProvider {
  if (args.provider === "mock") {
    return new MockSearchProvider();
  }
  if (args.provider === "ddg") {
    return new DdgSearchProvider();
  }
  if (args.provider === "google_scrape") {
    return new GoogleScrapeProvider(new DdgSearchProvider());
  }
  if (args.provider === "tavily") {
    if (!args.tavilyApiKey) {
      throw new Error("missing_tavily_api_key");
    }
    return new TavilySearchProvider(args.tavilyApiKey);
  }
  if (args.provider === "serpapi") {
    if (!args.serpApiKey) {
      throw new Error("missing_serpapi_api_key");
    }
    return new SerpApiSearchProvider(args.serpApiKey);
  }
  throw new Error("invalid_web_search_provider");
}

export class ResilientWebSearchService implements WebSearchService {
  private readonly provider: SearchProvider;

  public constructor(private readonly args: WebSearchArgs) {
    this.provider = buildProvider(args);
  }

  public async search(query: string): Promise<SearchResult[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }
    const raw = await withTimeout(this.provider.search(normalizedQuery), this.args.timeoutMs);
    return normalizeResults(raw);
  }
}
