import type {
  Evidence,
  RankedRepository,
  RankingFeatures,
  Repository,
} from "@/domain/types";
import { clamp } from "@/search/text";

export const SPONSORSHIP_POLICY_VERSION = "sponsor-isolated-v1";
export const SPONSORSHIP_ENABLED =
  process.env.GPS_SPONSORSHIP_ENABLED === "true";

export type SponsoredCandidate = {
  campaignId: string;
  repository: Repository;
  relevance: number;
  quality: number;
  safetyApproved: boolean;
  commercialScore: number;
  evidence: Evidence[];
};

export type SponsorshipPolicy = {
  enabled: boolean;
  maxPerBatch: number;
  minimumRelevance: number;
  minimumQuality: number;
  blockedRepositoryIds?: string[];
};

const EMPTY_FEATURES: RankingFeatures = {
  semantic: 0,
  lexical: 0,
  constraints: 1,
  quality: 0,
  freshness: 0,
  personal: 0,
  novelty: 0,
  longTerm: 0,
  shortTerm: 0,
  collaborative: 0,
  exploration: 0,
  penalty: 0,
};

/**
 * Sponsored ranking is deliberately isolated from natural ranking. A bid can
 * only order candidates that already passed relevance, quality and safety.
 */
export function rankSponsoredCandidates(
  candidates: SponsoredCandidate[],
  policy: SponsorshipPolicy,
): RankedRepository[] {
  if (!policy.enabled || policy.maxPerBatch < 1) return [];
  const blocked = new Set(policy.blockedRepositoryIds ?? []);
  return candidates
    .filter((candidate) => candidate.safetyApproved)
    .filter(
      (candidate) =>
        candidate.relevance >= policy.minimumRelevance &&
        candidate.quality >= policy.minimumQuality,
    )
    .filter((candidate) => !blocked.has(candidate.repository.id))
    .map((candidate): RankedRepository => {
      const score =
        clamp(candidate.relevance) * 0.65 +
        clamp(candidate.quality) * 0.25 +
        clamp(candidate.commercialScore) * 0.1;
      return {
        repository: candidate.repository,
        score: Number(score.toFixed(6)),
        candidateType: "sponsored",
        retrievalSources: [`sponsored:${candidate.campaignId}`],
        features: {
          ...EMPTY_FEATURES,
          semantic: candidate.relevance,
          quality: candidate.quality,
        },
        explanation: "赞助项目 · 与当前需求相关并通过 GPS 最低质量与安全门槛。",
        explanationEvidence: candidate.evidence,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(1, policy.maxPerBatch));
}

export function mergeSponsoredSlot(
  natural: RankedRepository[],
  sponsored: RankedRepository[],
  policy: SponsorshipPolicy,
): RankedRepository[] {
  if (!policy.enabled || !sponsored.length || policy.maxPerBatch < 1)
    return [...natural];
  const result = [...natural];
  const candidate = sponsored.find(
    (item) =>
      !result.some(
        (naturalItem) => naturalItem.repository.id === item.repository.id,
      ),
  );
  if (!candidate) return result;
  result.splice(Math.min(3, result.length), 0, candidate);
  return result;
}
