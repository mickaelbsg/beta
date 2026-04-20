import { chromium } from "playwright";
import { WebExtractor } from "./web-extractor.js";

interface BrowserPageContent {
  url: string;
  title: string;
  text: string;
}

interface YouTubeMetadata {
  title: string;
  description: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("web_browser_timeout")), timeoutMs);
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

function isYouTubeUrl(url: string): boolean {
  return /(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
}

export class WebBrowserService {
  private readonly extractor = new WebExtractor();

  public async fetchMainContent(url: string, timeoutMs: number): Promise<BrowserPageContent | null> {
    const run = async (): Promise<BrowserPageContent | null> => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        const title = await page.title();
        const text = await page.evaluate(() => {
          const selectors = ["script", "style", "noscript", "iframe", "nav", "aside", "footer", "header"];
          for (const selector of selectors) {
            for (const item of Array.from(document.querySelectorAll(selector))) {
              item.remove();
            }
          }
          return document.body?.innerText ?? "";
        });
        return {
          url,
          title,
          text: this.extractor.cleanPageText(text)
        };
      } finally {
        await browser.close();
      }
    };

    try {
      return await withTimeout(run(), timeoutMs);
    } catch {
      return null;
    }
  }

  public async fetchYouTubeMetadata(url: string, timeoutMs: number): Promise<YouTubeMetadata | null> {
    if (!isYouTubeUrl(url)) {
      return null;
    }
    try {
      const oembed = new URL("https://www.youtube.com/oembed");
      oembed.searchParams.set("url", url);
      oembed.searchParams.set("format", "json");
      const response = await withTimeout(fetch(oembed.toString()), timeoutMs);
      if (!response.ok) {
        return null;
      }
      const json = (await response.json()) as { title?: string; author_name?: string };
      return {
        title: String(json.title ?? "YouTube"),
        description: `Video publicado por ${String(json.author_name ?? "canal desconhecido")}`
      };
    } catch {
      return null;
    }
  }
}

