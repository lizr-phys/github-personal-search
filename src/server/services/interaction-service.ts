import { ALGORITHM_VERSIONS, INTERACTION_WEIGHTS } from "@/config/algorithms";
import type { InteractionType } from "@/domain/types";
import { userProfileUpdater } from "@/recommendation/profile-updater";
import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import type { LibraryStatus, RuntimeInteraction } from "@/server/runtime/types";

const LIBRARY_STATUS: Partial<Record<InteractionType, LibraryStatus>> = {
  favorite: "read_later",
  learn: "learning",
  ran: "ran",
  reproduced: "reproduced",
  used: "used",
  unmaintained: "outdated",
};

export async function recordInteraction(input: {
  repositoryId: string;
  type: InteractionType;
  reason?: string;
  surface: string;
  sessionId: string;
}) {
  const repository = (await getRepositoryCatalog()).repositories.find(
    (item) => item.id === input.repositoryId,
  );
  if (!repository) throw new Error("Repository not found");
  return runtimeStore.mutate((state) => {
    const exposure = [...state.exposures]
      .reverse()
      .find(
        (item) =>
          item.repositoryId === input.repositoryId &&
          item.surface === input.surface,
      );
    const interaction: RuntimeInteraction = {
      id: crypto.randomUUID(),
      repositoryId: input.repositoryId,
      type: input.type,
      reason: input.reason,
      weight: INTERACTION_WEIGHTS[input.type],
      surface: input.surface,
      sessionId: input.sessionId,
      algorithmVersion: exposure?.algorithmVersion ?? ALGORITHM_VERSIONS.feed,
      exposureId: exposure?.id,
      at: new Date().toISOString(),
    };
    state.interactions.push(interaction);
    state.profile = userProfileUpdater.apply(
      state.profile,
      repository,
      input.type,
    );
    if (INTERACTION_WEIGHTS[input.type] < 0)
      state.metrics.negativeFeedback += 1;
    // A prefetched future batch was ranked against the old session profile.
    // Remove it and its exposure records so the next request is reranked using
    // this feedback instead of returning stale recommendations.
    const currentBatch = exposure?.batchId
      ? state.batches.find((batch) => batch.id === exposure.batchId)
      : undefined;
    if (currentBatch) {
      const staleBatchIds = new Set(
        state.batches
          .filter(
            (batch) =>
              batch.sessionId === input.sessionId &&
              batch.batchNumber > currentBatch.batchNumber,
          )
          .map((batch) => batch.id),
      );
      if (staleBatchIds.size) {
        state.batches = state.batches.filter(
          (batch) => !staleBatchIds.has(batch.id),
        );
        state.exposures = state.exposures.filter(
          (item) => !item.batchId || !staleBatchIds.has(item.batchId),
        );
      }
    }
    const status = LIBRARY_STATUS[input.type];
    if (status) {
      const existing = state.library.find(
        (item) => item.repositoryId === repository.id,
      );
      if (existing) {
        existing.status = status;
        existing.updatedAt = interaction.at;
      } else {
        state.library.push({
          repositoryId: repository.id,
          collectionId: "default",
          status,
          tags: repository.domains.slice(0, 2),
          note: "",
          addedAt: interaction.at,
          updatedAt: interaction.at,
        });
      }
      if (["learning", "ran", "reproduced", "used"].includes(status)) {
        state.learningLogs.push({
          id: crypto.randomUUID(),
          repositoryId: repository.id,
          status,
          minutes: 0,
          at: interaction.at,
        });
      }
    }
    return interaction;
  });
}

export async function undoInteraction(id: string) {
  const repositories = (await getRepositoryCatalog()).repositories;
  return runtimeStore.mutate((state) => {
    const interaction = state.interactions.find((item) => item.id === id);
    if (!interaction || interaction.undoneAt) return undefined;
    const repository = repositories.find(
      (item) => item.id === interaction.repositoryId,
    );
    if (!repository) return undefined;
    interaction.undoneAt = new Date().toISOString();
    state.profile = userProfileUpdater.apply(
      state.profile,
      repository,
      interaction.type,
      true,
    );
    return interaction;
  });
}
