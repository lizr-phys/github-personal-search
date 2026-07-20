import { ALGORITHM_VERSIONS, INTERACTION_WEIGHTS } from "@/config/algorithms";
import type { InteractionType } from "@/domain/types";
import { userProfileUpdater } from "@/recommendation/profile-updater";
import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";

export async function completeOnboarding(input: {
  interests: string[];
  languages: string[];
  difficulty: "beginner" | "medium" | "advanced";
  seedRepositories: string[];
  feedback: Array<{
    repositoryId: string;
    type: Extract<
      InteractionType,
      "interested" | "not_interested" | "seen" | "learn"
    >;
  }>;
  sessionId: string;
}) {
  const repositories = (await getRepositoryCatalog()).repositories;
  return runtimeStore.mutate((state) => {
    state.profile.completed = true;
    state.profile.difficulty = input.difficulty;
    state.profile.longTerm = Object.fromEntries(
      input.interests.map((interest) => [interest, 2.5]),
    );
    state.profile.shortTerm = Object.fromEntries(
      input.interests.slice(0, 3).map((interest) => [interest, 1.5]),
    );
    state.profile.languages = Object.fromEntries(
      input.languages.map((language) => [language, 1.8]),
    );
    const now = new Date().toISOString();
    state.profile.sources.unshift({
      label: "兴趣初始化",
      detail: input.interests.join("、"),
      at: now,
    });
    for (const repositoryId of input.seedRepositories) {
      const repository = repositories.find((item) => item.id === repositoryId);
      if (!repository) continue;
      for (const domain of repository.domains.slice(0, 2))
        state.profile.longTerm[domain] =
          (state.profile.longTerm[domain] ?? 0) + 1.5;
      state.profile.languages[repository.language] =
        (state.profile.languages[repository.language] ?? 0) + 0.8;
      state.profile.sources.unshift({
        label: "种子项目",
        detail: repository.fullName,
        at: now,
      });
    }
    for (const feedback of input.feedback) {
      const repository = repositories.find(
        (item) => item.id === feedback.repositoryId,
      );
      if (!repository) continue;
      state.interactions.push({
        id: crypto.randomUUID(),
        repositoryId: repository.id,
        type: feedback.type,
        weight: INTERACTION_WEIGHTS[feedback.type],
        surface: "onboarding",
        sessionId: input.sessionId,
        algorithmVersion: ALGORITHM_VERSIONS.feed,
        at: now,
      });
      state.profile = userProfileUpdater.apply(
        state.profile,
        repository,
        feedback.type,
      );
      if (feedback.type === "learn") {
        const existing = state.library.find(
          (item) => item.repositoryId === repository.id,
        );
        if (existing) {
          existing.status = "learning";
          existing.updatedAt = now;
        } else {
          state.library.push({
            repositoryId: repository.id,
            collectionId: "default",
            status: "learning",
            tags: repository.domains.slice(0, 2),
            note: "由兴趣初始化加入",
            addedAt: now,
            updatedAt: now,
          });
        }
      }
    }
    state.batches = [];
    state.warmQueues = [];
    state.exposures = [];
    return state.profile;
  });
}
