import type { InteractionType, RankingFeatures } from "@/domain/types";

export const ALGORITHM_VERSIONS = {
  queryParser: "query-rules-zh-en-v2",
  localEmbedding: "multilingual-hash-384-v1",
  search: "search-rrf-weighted-v2",
  feed: "feed-quality-gated-v3",
  diversity: "mmr-quota-v2",
  trend: "trend-zscore-v1",
  explanation: "evidence-template-v1",
} as const;

export const RECOMMENDATION_QUALITY = {
  minimumQuality: 0.78,
  establishedMinimumStars: 1_000,
  emergingMaximumAgeDays: 730,
  emergingMinimumStars: 100,
  emergingMinimumQuality: 0.82,
  emergingMinimumOwnerFollowers: 5_000,
  emergingMinimumWatchers: 200,
  emergingMinimumGrowth30d: 300,
  maximumPushAgeDays: 365,
} as const;

export const SEARCH_WEIGHTS: Record<
  keyof Pick<
    RankingFeatures,
    | "semantic"
    | "lexical"
    | "constraints"
    | "quality"
    | "freshness"
    | "personal"
    | "novelty"
  >,
  number
> = {
  semantic: 0.31,
  lexical: 0.23,
  constraints: 0.14,
  quality: 0.1,
  freshness: 0.08,
  personal: 0.07,
  novelty: 0.07,
};

export const FEED_WEIGHTS: Record<
  keyof Pick<
    RankingFeatures,
    | "longTerm"
    | "shortTerm"
    | "collaborative"
    | "quality"
    | "freshness"
    | "novelty"
    | "exploration"
  >,
  number
> = {
  longTerm: 0.29,
  shortTerm: 0.22,
  collaborative: 0.11,
  quality: 0.1,
  freshness: 0.1,
  novelty: 0.08,
  exploration: 0.1,
};

export const INTERACTION_WEIGHTS: Record<InteractionType, number> = {
  used: 8,
  ran: 6,
  reproduced: 6,
  learn: 5,
  favorite: 4,
  interested: 3,
  open_github: 2,
  open_demo: 2,
  dwell: 1,
  expand: 0.5,
  not_interested: -6,
  language_mismatch: -4,
  too_complex: -4,
  unmaintained: -5,
  block_similar: -7,
  seen: -3,
};

export const FEED_QUOTA = {
  strong: 4,
  short_term: 2,
  trending: 2,
  niche: 1,
  exploration: 1,
} as const;

export const DIVERSITY_CONFIG = {
  lambda: 0.74,
  minClustersInTopTen: 3,
  maxPerOrganization: 2,
  explorationMin: 0.15,
  explorationMax: 0.25,
} as const;

export const EXPOSURE_SUPPRESSION_DAYS = 30;
export const SUBSCRIPTION_DEDUP_DAYS = 30;
