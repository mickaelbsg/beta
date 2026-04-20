export class WebExtractor {
  public extractTextFromHtml(html: string, maxChars = 6000): string {
    const noScript = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
    const stripped = noScript
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return stripped.length <= maxChars ? stripped : `${stripped.slice(0, maxChars)}...`;
  }

  public cleanPageText(text: string, maxChars = 6000): string {
    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length <= maxChars ? cleaned : `${cleaned.slice(0, maxChars)}...`;
  }
}

