import OpenAI from "openai";
import { logger } from "../shared/logger.js";

export class EmbeddingService {
  private readonly client: OpenAI;

  public constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.client = new OpenAI({ apiKey });
  }

  public async generateEmbedding(input: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input
      });

      const embedding = response.data[0]?.embedding ?? [];
      logger.info("embedding_generated", {
        module: "EmbeddingService",
        action: "generateEmbedding",
        model: this.model,
        inputPreview: input.slice(0, 80),
        vectorSize: embedding.length,
        error: null
      });
      return embedding;
    } catch (error) {
      logger.error("embedding_generation_failed", {
        module: "EmbeddingService",
        action: "generateEmbedding",
        model: this.model,
        inputPreview: input.slice(0, 80),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

