import { runtimeStore } from "@/server/runtime/store";

export type PrivacyAction =
  | "clear_history"
  | "reset_profile"
  | "clear_imports"
  | "delete_account"
  | "revoke_github";

export async function applyPrivacyAction(action: PrivacyAction) {
  if (action === "delete_account") return runtimeStore.reset();
  return runtimeStore.mutate((state) => {
    if (action === "clear_history") {
      state.searches = [];
      state.exposures = [];
      state.batches = [];
      state.warmQueues = [];
      state.interactions = [];
    }
    if (action === "reset_profile") {
      state.profile.completed = false;
      state.profile.longTerm = {};
      state.profile.shortTerm = {};
      state.profile.languages = {};
      state.profile.blockedLanguages = [];
      state.profile.blockedOrganizations = [];
      state.profile.blockedTypes = [];
      state.profile.sources = [];
      state.batches = [];
      state.warmQueues = [];
    }
    if (action === "clear_imports") {
      const imported = new Set(
        state.user.importedStars.map((fullName) => fullName.toLowerCase()),
      );
      state.user.importedStars = [];
      state.repositories = state.repositories.filter(
        (repository) => !imported.has(repository.fullName.toLowerCase()),
      );
      const remaining = new Set(
        state.repositories.map((repository) => repository.id),
      );
      state.repositorySnapshots = state.repositorySnapshots.filter((snapshot) =>
        remaining.has(snapshot.repositoryId),
      );
      state.githubSync.indexedCount = state.repositories.length;
      state.warmQueues = [];
    }
    if (action === "revoke_github") {
      state.user.githubLogin = undefined;
      state.user.githubScopes = [];
      state.user.githubTokenEncrypted = undefined;
      state.user.githubConnectedAt = undefined;
      state.user.importedStars = [];
    }
    return state;
  });
}
