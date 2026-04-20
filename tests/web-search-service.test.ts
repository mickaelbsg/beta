import { afterEach, describe, expect, it, vi } from "vitest";
import { ResilientWebSearchService } from "../src/web-search/web-search-service.js";

const originalFetch = global.fetch;

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("ResilientWebSearchService", () => {
  it("returns mock results only when provider is explicitly mock", async () => {
    const service = new ResilientWebSearchService({
      provider: "mock",
      timeoutMs: 5000
    });
    const results = await service.search("ia");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.url).toContain("example.com");
  });

  it("falls back to DDG when google scraping fails", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("google_blocked"))
      .mockResolvedValueOnce(
        htmlResponse(`
          <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fnews.ycombinator.com%2Fitem%3Fid%3D1">HN</a>
          <a class="result__snippet">Topico de IA</a>
        `)
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new ResilientWebSearchService({
      provider: "google_scrape",
      timeoutMs: 5000
    });
    const results = await service.search("novidades ia");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results.length).toBe(1);
    expect(results[0]?.url).toContain("news.ycombinator.com");
  });

  it("throws explicit error when paid provider is selected without key", () => {
    expect(
      () =>
        new ResilientWebSearchService({
          provider: "tavily",
          timeoutMs: 5000
        })
    ).toThrowError("missing_tavily_api_key");
  });

  it("throws when both google and ddg fail", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network_down")) as unknown as typeof fetch;
    const service = new ResilientWebSearchService({
      provider: "google_scrape",
      timeoutMs: 5000
    });
    await expect(service.search("ia")).rejects.toThrow();
  });
});
