import { GitHubClient } from "@/github/client";
import {
  fetchGitHubRepository,
  storeGitHubRepositories,
} from "@/github/repository-sync";
import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import { decryptSecret } from "@/server/security/crypto";
import { buildEmailPreview } from "@/server/services/subscription-service";

export type JobName =
  "refresh-repository" | "build-feed" | "match-subscription" | "send-digest";

export async function handleJob(
  name: JobName,
  payload: Record<string, unknown>,
) {
  if (name === "refresh-repository") {
    const fullName = String(payload.fullName ?? "");
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName))
      throw new Error("A valid fullName is required");
    const state = await runtimeStore.read();
    const client = new GitHubClient(
      state.user.githubTokenEncrypted
        ? decryptSecret(state.user.githubTokenEncrypted)
        : undefined,
    );
    const repository = await fetchGitHubRepository(client, fullName);
    await storeGitHubRepositories(
      [repository],
      payload.source === "webhook"
        ? "webhook"
        : state.user.githubTokenEncrypted
          ? "oauth"
          : "public",
    );
    return {
      refreshed: true,
      fullName,
      mode: "github",
      dataUpdatedAt: repository.dataUpdatedAt,
    };
  }
  if (name === "build-feed") {
    const catalog = await getRepositoryCatalog();
    return {
      queuedCandidates: Math.min(50, catalog.repositories.length),
      mode: catalog.mode,
    };
  }
  if (name === "match-subscription") {
    const preview = await buildEmailPreview(
      typeof payload.subscriptionId === "string"
        ? payload.subscriptionId
        : undefined,
    );
    return {
      matched: preview.email.repositoryIds.length,
      skipped: preview.skipped,
    };
  }
  if (name === "send-digest")
    return buildEmailPreview(
      typeof payload.subscriptionId === "string"
        ? payload.subscriptionId
        : undefined,
    );
  throw new Error(`Unknown job: ${name}`);
}
