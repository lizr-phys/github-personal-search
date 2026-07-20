import type { SearchIntent } from "@/domain/types";
import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import { searchRepositories } from "@/search/service";
import type { SearchMode } from "@/search/ranking";

export async function executeSearch(input: {
  query: string;
  mode: SearchMode;
  affectsProfile: boolean;
  intentOverride?: SearchIntent;
}) {
  const snapshot = await runtimeStore.read();
  const catalog = await getRepositoryCatalog();
  const response = await searchRepositories({
    query: input.query,
    mode: input.mode,
    profile: snapshot.profile,
    repositories: catalog.repositories,
    intentOverride: input.intentOverride,
  });
  await runtimeStore.mutate((state) => {
    state.searches.push({
      id: response.id,
      query: input.query,
      intent: response.intent,
      mode: response.mode,
      affectsProfile: input.affectsProfile,
      resultIds: response.results.map((item) => item.repository.id),
      timingMs: response.timing.totalMs,
      createdAt: new Date().toISOString(),
    });
    state.searches = state.searches.slice(-100);
    state.metrics.searchCount += 1;
    if (response.timing.cacheHit) state.metrics.cacheHits += 1;
    else state.metrics.cacheMisses += 1;
    if (input.affectsProfile && state.profile.searchAffectsProfile) {
      for (const domain of response.intent.domains)
        state.profile.shortTerm[domain] = Math.min(
          8,
          (state.profile.shortTerm[domain] ?? 0) + 0.65,
        );
      state.profile.sources.unshift({
        label: "近期搜索",
        detail: input.query,
        at: new Date().toISOString(),
      });
    }
  });
  return {
    ...response,
    dataUpdatedAt: catalog.dataUpdatedAt,
    catalog: {
      mode: catalog.mode,
      githubCount: catalog.githubCount,
      demoCount: catalog.demoCount,
      dataUpdatedAt: catalog.dataUpdatedAt,
    },
  };
}
