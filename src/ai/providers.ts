import { ALGORITHM_VERSIONS } from "@/config/algorithms";
import type { SearchIntent } from "@/domain/types";
import { SearchIntentSchema } from "@/domain/types";
import { tokenize } from "@/search/text";

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
}

export interface LLMProvider {
  readonly name: string;
  expandQuery(intent: SearchIntent): Promise<SearchIntent>;
  summarize(
    text: string,
    maxLength: number,
  ): Promise<{
    text: string;
    confidence: number;
    source: "extractive" | "model";
  }>;
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export class LocalMultilingualEmbeddingProvider implements EmbeddingProvider {
  readonly name = ALGORITHM_VERSIONS.localEmbedding;
  readonly dimensions = 384;

  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimensions).fill(0);
    const terms = tokenize(text);
    for (const term of terms) {
      const index = hash(term) % this.dimensions;
      const sign = hash(`${term}:sign`) % 2 === 0 ? 1 : -1;
      vector[index] =
        (vector[index] ?? 0) + sign * (1 + Math.log1p(term.length));
    }
    const norm = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0),
    );
    return norm ? vector.map((value) => value / norm) : vector;
  }
}

export class ExtractiveLocalLLMProvider implements LLMProvider {
  readonly name = "extractive-local-v1";

  async expandQuery(intent: SearchIntent): Promise<SearchIntent> {
    return SearchIntentSchema.parse(intent);
  }

  async summarize(text: string, maxLength: number) {
    const sentence =
      text
        .split(/(?<=[。！？.!?])\s*/)
        .find((item) => item.trim().length > 20) ?? text;
    return {
      text: sentence.trim().slice(0, maxLength),
      confidence: 0.72,
      source: "extractive" as const,
    };
  }
}

export const embeddingProvider = new LocalMultilingualEmbeddingProvider();
export const llmProvider = new ExtractiveLocalLLMProvider();
