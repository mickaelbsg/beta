import { describe, expect, it } from "vitest";
import { WebExtractor } from "../src/web-search/web-extractor.js";

describe("WebExtractor", () => {
  it("cleans html and limits size", () => {
    const extractor = new WebExtractor();
    const text = extractor.extractTextFromHtml(
      "<html><head><script>bad()</script></head><body><h1>Titulo</h1><p>Conteudo principal</p></body></html>",
      30
    );
    expect(text).toContain("Titulo");
    expect(text).not.toContain("bad()");
    expect(text.length).toBeLessThanOrEqual(33);
  });
});

