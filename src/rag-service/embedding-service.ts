import OpenAI from "openai";

export class EmbeddingService {
  private readonly client: OpenAI;

  public constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.client = new OpenAI({ apiKey });
  }

  public async generateEmbedding(input: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input
    });

    return response.data[0]?.embedding ?? [];
  }
}

