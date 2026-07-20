import { embeddingProvider } from "@/ai/providers";
import type { Repository } from "@/domain/types";
import { TtlLruCache } from "@/lib/ttl-cache";
import { normalizeText, tokenize } from "./text";

export type IndexedRepositoryDocument = {
  text: string;
  normalizedText: string;
  tokens: string[];
  tokenSet: Set<string>;
  vector: () => Promise<number[]>;
};

const documentCache = new TtlLruCache<IndexedRepositoryDocument>(
  20_000,
  24 * 60 * 60 * 1000,
);
const queryVectorCache = new TtlLruCache<Promise<number[]>>(
  2_000,
  60 * 60 * 1000,
);

export function repositorySemanticDocument(repository: Repository): string {
  return [
    repository.fullName,
    repository.chineseTitle,
    repository.description,
    repository.summary,
    repository.problem,
    repository.readmeSummary,
    repository.cluster,
    repository.projectType,
    repository.language,
    ...repository.targetUsers,
    ...repository.coreFeatures,
    ...repository.topics,
    ...repository.domains,
    ...repository.technologies,
    ...repository.deployment,
  ].join(" ");
}

function repositoryRetrievalDocument(repository: Repository): string {
  return [
    repository.fullName,
    repository.chineseTitle,
    repository.description,
    repository.cluster,
    repository.projectType,
    repository.language,
    ...repository.topics,
    ...repository.domains,
    ...repository.technologies,
    ...repository.deployment,
  ].join(" ");
}

export function getIndexedDocument(
  repository: Repository,
): IndexedRepositoryDocument {
  const key = `${repository.id}:${repository.dataUpdatedAt}`;
  return documentCache.getOrCreate(key, () => {
    const text = repositoryRetrievalDocument(repository);
    const normalizedText = normalizeText(text);
    const tokens = tokenize(normalizedText).slice(0, 96);
    let vector: Promise<number[]> | undefined;
    return {
      text,
      normalizedText,
      tokens,
      tokenSet: new Set(tokens),
      vector: () =>
        (vector ??= embeddingProvider.embed(
          repositorySemanticDocument(repository),
        )),
    };
  });
}

export function getQueryVector(text: string): Promise<number[]> {
  return queryVectorCache.getOrCreate(normalizeText(text), () =>
    embeddingProvider.embed(text),
  );
}
