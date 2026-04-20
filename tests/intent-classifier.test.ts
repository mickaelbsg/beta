import { describe, expect, it } from "vitest";
import { detectIntent } from "../src/orchestrator/intent-classifier.js";

describe("detectIntent", () => {
  it("returns NOTE for note keywords", () => {
    expect(detectIntent("anota isso pra mim")).toBe("NOTE");
    expect(detectIntent("salva essa informacao")).toBe("NOTE");
    expect(detectIntent("lembra que eu vou estudar")).toBe("NOTE");
  });

  it("returns QUERY for query keywords when NOTE does not match first", () => {
    expect(detectIntent("o que eu falei ontem?")).toBe("QUERY");
    expect(detectIntent("me mostra sobre banco de dados")).toBe("QUERY");
  });

  it("returns STUDY for study keywords", () => {
    expect(detectIntent("me ensina typescript")).toBe("STUDY");
    expect(detectIntent("como funciona fila?")).toBe("STUDY");
  });

  it("returns SEARCH for search keywords", () => {
    expect(detectIntent("busca noticias de IA")).toBe("SEARCH");
    expect(detectIntent("novidades de node")).toBe("SEARCH");
  });

  it("returns CHAT as fallback", () => {
    expect(detectIntent("oi tudo bem")).toBe("CHAT");
  });
});
