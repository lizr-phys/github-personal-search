import {
  ALGORITHM_VERSIONS,
  EXPOSURE_SUPPRESSION_DAYS,
} from "@/config/algorithms";
import type { RankedRepository } from "@/domain/types";
import { feedRanker } from "@/recommendation/ranking";
import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import type {
  RuntimeBatch,
  RuntimeExposure,
  RuntimeState,
  RuntimeWarmQueue,
} from "@/server/runtime/types";

function batchToRanked(
  batch: RuntimeBatch,
  repositories: RankedRepository["repository"][],
): RankedRepository[] {
  const byId = new Map(
    repositories.map((repository) => [repository.id, repository]),
  );
  return batch.items.flatMap((item) => {
    const repository = byId.get(item.repositoryId);
    return repository
      ? [
          {
            repository,
            score: item.score,
            candidateType:
              item.candidateType as RankedRepository["candidateType"],
            retrievalSources: item.retrievalSources,
            features: item.features,
            explanation: item.explanation,
            explanationEvidence:
              item.explanationEvidence as RankedRepository["explanationEvidence"],
          },
        ]
      : [];
  });
}

function ensureWarmQueue(
  state: RuntimeState,
  repositories: RankedRepository["repository"][],
  catalogUpdatedAt: string,
): RuntimeWarmQueue {
  const date = new Date().toISOString().slice(0, 10);
  const existing = state.warmQueues.find(
    (queue) =>
      queue.userId === state.user.id &&
      queue.date === date &&
      queue.algorithmVersion === ALGORITHM_VERSIONS.feed &&
      queue.catalogUpdatedAt === catalogUpdatedAt,
  );
  if (existing) return existing;
  const ranked = feedRanker.rank(
    repositories,
    state.profile,
    state.interactions,
  );
  const queue: RuntimeWarmQueue = {
    userId: state.user.id,
    date,
    generatedAt: new Date().toISOString(),
    algorithmVersion: ALGORITHM_VERSIONS.feed,
    catalogUpdatedAt,
    repositoryIds: ranked.slice(0, 50).map((item) => item.repository.id),
  };
  state.warmQueues = state.warmQueues.filter(
    (item) => item.userId !== state.user.id || item.date !== date,
  );
  state.warmQueues.push(queue);
  return queue;
}

export async function getFeedBatch(sessionId: string, batchNumber: number) {
  const catalog = await getRepositoryCatalog();
  const repositoryById = new Map(
    catalog.repositories.map((repository) => [repository.id, repository]),
  );
  return runtimeStore.mutate((state) => {
    if (!state.profile.completed)
      return { code: "ONBOARDING_REQUIRED" as const };
    const existing = state.batches.find(
      (batch) =>
        batch.sessionId === sessionId && batch.batchNumber === batchNumber,
    );
    if (existing) {
      state.metrics.cacheHits += 1;
      return {
        code: "OK" as const,
        batch: existing,
        items: batchToRanked(existing, catalog.repositories),
        warmQueueSize: Math.min(50, catalog.repositories.length),
        cache: "hit" as const,
        catalog: {
          mode: catalog.mode,
          githubCount: catalog.githubCount,
          demoCount: catalog.demoCount,
        },
      };
    }

    const warmQueue = ensureWarmQueue(
      state,
      catalog.repositories,
      catalog.dataUpdatedAt,
    );
    const cutoff = Date.now() - EXPOSURE_SUPPRESSION_DAYS * 86_400_000;
    const suppressed = new Set(
      state.exposures
        .filter((exposure) => new Date(exposure.at).getTime() >= cutoff)
        .map((exposure) => exposure.repositoryId),
    );
    const warmRepositories = warmQueue.repositoryIds.flatMap((id) => {
      const repository = repositoryById.get(id);
      return repository && !suppressed.has(id) ? [repository] : [];
    });
    const available =
      warmRepositories.length >= 10
        ? warmRepositories
        : catalog.repositories.filter(
            (repository) => !suppressed.has(repository.id),
          );
    const ranked = feedRanker.rank(
      available,
      state.profile,
      state.interactions,
    );
    const items = feedRanker.selectBatch(ranked, 10);
    const now = new Date().toISOString();
    const batch: RuntimeBatch = {
      id: crypto.randomUUID(),
      sessionId,
      batchNumber,
      createdAt: now,
      algorithmVersion: ALGORITHM_VERSIONS.feed,
      items: items.map((item) => ({
        repositoryId: item.repository.id,
        score: item.score,
        candidateType: item.candidateType,
        retrievalSources: item.retrievalSources,
        features: item.features,
        explanation: item.explanation,
        explanationEvidence: item.explanationEvidence,
      })),
    };
    state.batches.push(batch);
    const exposures: RuntimeExposure[] = items.map((item, position) => ({
      id: crypto.randomUUID(),
      repositoryId: item.repository.id,
      surface: "feed",
      batchId: batch.id,
      position: position + 1,
      retrievalSources: item.retrievalSources,
      algorithmVersion: ALGORITHM_VERSIONS.feed,
      features: item.features,
      at: now,
    }));
    state.exposures.push(...exposures);
    state.metrics.cacheMisses += 1;
    state.metrics.feedGenerations += 1;
    return {
      code: "OK" as const,
      batch,
      items,
      warmQueueSize: warmQueue.repositoryIds.length,
      cache: "miss" as const,
      catalog: {
        mode: catalog.mode,
        githubCount: catalog.githubCount,
        demoCount: catalog.demoCount,
      },
    };
  });
}
