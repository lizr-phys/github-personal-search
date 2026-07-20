import { performance } from "node:perf_hooks";

import { ALGORITHM_VERSIONS } from "@/config/algorithms";
import type {
  InterestProfile,
  RankedRepository,
  Repository,
  SearchIntent,
} from "@/domain/types";
import { TtlLruCache } from "@/lib/ttl-cache";
import { diversityReranker } from "./diversity";
import { candidateRetriever } from "./candidate-retriever";
import { queryParser } from "./query-parser";
import { searchRanker, type SearchMode } from "./ranking";

export type SearchResponse = {
  id: string;
  intent: SearchIntent;
  mode: SearchMode;
  results: RankedRepository[];
  clusters: Array<{ name: string; count: number; repositories: string[] }>;
  timing: {
    totalMs: number;
    parserMs: number;
    retrievalMs: number;
    rankingMs: number;
    rerankMs: number;
    cacheHit: boolean;
  };
  versions: Record<string, string>;
  dataUpdatedAt: string;
  semanticMode: "local" | "provider";
};

type SearchCore = Omit<SearchResponse, "id" | "timing"> & {
  stageTiming: Omit<SearchResponse["timing"], "totalMs" | "cacheHit">;
};

const searchPipelineCache = new TtlLruCache<Promise<SearchCore>>(
  400,
  5 * 60 * 1000,
);

function stableEntries(
  values: Record<string, number>,
): Array<[string, number]> {
  return Object.entries(values).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function profileFingerprint(profile: InterestProfile): string {
  return JSON.stringify({
    longTerm: stableEntries(profile.longTerm),
    shortTerm: stableEntries(profile.shortTerm),
    languages: stableEntries(profile.languages),
    blockedLanguages: [...profile.blockedLanguages].sort(),
    blockedOrganizations: [...profile.blockedOrganizations].sort(),
    blockedTypes: [...profile.blockedTypes].sort(),
  });
}

function catalogFingerprint(repositories: Repository[]): string {
  const first = repositories[0];
  const last = repositories.at(-1);
  return [
    repositories.length,
    first?.id ?? "empty",
    first?.dataUpdatedAt ?? "0",
    last?.id ?? "empty",
    last?.dataUpdatedAt ?? "0",
  ].join(":");
}

export async function searchRepositories(input: {
  query: string;
  mode?: SearchMode;
  profile: InterestProfile;
  repositories: Repository[];
  intentOverride?: SearchIntent;
}): Promise<SearchResponse> {
  const started = performance.now();
  const parserStarted = performance.now();
  const intent = input.intentOverride ?? queryParser.parse(input.query);
  const parserMs = performance.now() - parserStarted;
  const mode = input.mode ?? "comprehensive";
  const cacheKey = JSON.stringify({
    query: intent.normalizedQuery,
    intent,
    mode,
    profile: profileFingerprint(input.profile),
    catalog: catalogFingerprint(input.repositories),
    versions: [
      queryParser.version,
      searchRanker.version,
      diversityReranker.version,
      candidateRetriever.version,
    ],
  });
  const cached = searchPipelineCache.get(cacheKey);
  const corePromise =
    cached ??
    searchPipelineCache.set(
      cacheKey,
      (async (): Promise<SearchCore> => {
        const retrievalStarted = performance.now();
        const candidates = await candidateRetriever.retrieve(
          input.repositories,
          intent,
          input.profile,
          mode,
        );
        const retrievalMs = performance.now() - retrievalStarted;
        const rankingStarted = performance.now();
        const ranked = await searchRanker.rank(
          candidates,
          intent,
          input.profile,
          mode,
        );
        const rankingMs = performance.now() - rankingStarted;
        const rerankStarted = performance.now();
        const reranked = diversityReranker.rerank(
          ranked,
          Math.min(30, ranked.length),
          {
            explicitTechnology:
              intent.technologies.length > 0 || intent.languages.length > 0,
            mode,
          },
        );
        const rerankMs = performance.now() - rerankStarted;
        const clusterMap = new Map<string, string[]>();
        for (const result of reranked) {
          const current = clusterMap.get(result.repository.cluster) ?? [];
          current.push(result.repository.id);
          clusterMap.set(result.repository.cluster, current);
        }
        return {
          intent,
          mode,
          results: reranked,
          clusters: [...clusterMap].map(([name, repositories]) => ({
            name,
            count: repositories.length,
            repositories,
          })),
          stageTiming: {
            parserMs,
            retrievalMs,
            rankingMs,
            rerankMs,
          },
          versions: {
            parser: queryParser.version,
            ranker: searchRanker.version,
            diversity: diversityReranker.version,
            embedding: ALGORITHM_VERSIONS.localEmbedding,
            retriever: candidateRetriever.version,
          },
          dataUpdatedAt:
            input.repositories[0]?.dataUpdatedAt ?? new Date(0).toISOString(),
          semanticMode: "local",
        };
      })(),
    );
  let core: SearchCore;
  try {
    core = await corePromise;
  } catch (error) {
    searchPipelineCache.delete(cacheKey);
    throw error;
  }
  const cacheHit = Boolean(cached);
  return {
    id: crypto.randomUUID(),
    intent: core.intent,
    mode: core.mode,
    results: core.results,
    clusters: core.clusters,
    timing: {
      totalMs: Number((performance.now() - started).toFixed(2)),
      parserMs: Number(parserMs.toFixed(2)),
      retrievalMs: Number(
        (cacheHit ? 0 : core.stageTiming.retrievalMs).toFixed(2),
      ),
      rankingMs: Number((cacheHit ? 0 : core.stageTiming.rankingMs).toFixed(2)),
      rerankMs: Number((cacheHit ? 0 : core.stageTiming.rerankMs).toFixed(2)),
      cacheHit,
    },
    versions: core.versions,
    dataUpdatedAt: core.dataUpdatedAt,
    semanticMode: core.semanticMode,
  };
}
