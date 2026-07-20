import { NextResponse, type NextRequest } from "next/server";

import { isResponse, requireUser } from "@/server/http";
import { runtimeStore } from "@/server/runtime/store";
import { getRepositoryCatalog } from "@/server/repositories/catalog";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const [state, catalog] = await Promise.all([
    runtimeStore.read(),
    getRepositoryCatalog(),
  ]);
  const activeInteractions = state.interactions.filter(
    (item) => !item.undoneAt,
  );
  const languageDistribution: Record<string, number> = {};
  const organizationDistribution: Record<string, number> = {};
  for (const exposure of state.exposures) {
    const batchItem = state.batches
      .flatMap((batch) => batch.items)
      .find((item) => item.repositoryId === exposure.repositoryId);
    if (!batchItem) continue;
    const [organization = "unknown"] = exposure.repositoryId.split("-");
    organizationDistribution[organization] =
      (organizationDistribution[organization] ?? 0) + 1;
  }
  return NextResponse.json({
    metrics: {
      ...state.metrics,
      queueLength: 0,
      indexDelayHours: 0,
      modelCalls: state.metrics.aiCalls ?? 0,
      modelFallbacks: state.metrics.aiFallbacks ?? 0,
      exposureCount: state.exposures.length,
      interactionCount: activeInteractions.length,
      negativeFeedbackRate: activeInteractions.length
        ? activeInteractions.filter((item) => item.weight < 0).length /
          activeInteractions.length
        : 0,
      cacheHitRate:
        state.metrics.cacheHits + state.metrics.cacheMisses
          ? state.metrics.cacheHits /
            (state.metrics.cacheHits + state.metrics.cacheMisses)
          : 0,
      fetchSuccessRate:
        state.metrics.fetchSuccess + state.metrics.fetchFailure
          ? state.metrics.fetchSuccess /
            (state.metrics.fetchSuccess + state.metrics.fetchFailure)
          : 1,
      githubIndexedRepositories: catalog.githubCount,
    },
    distributions: {
      languages: languageDistribution,
      organizations: organizationDistribution,
    },
    recentSearchLatency: state.searches.slice(-20).map((item) => item.timingMs),
    mode: catalog.mode,
    githubSync: state.githubSync,
    dataUpdatedAt: catalog.dataUpdatedAt,
  });
}
