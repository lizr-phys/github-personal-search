import { RECOMMENDATION_QUALITY } from "@/config/algorithms";
import type { Repository } from "@/domain/types";

const DAY = 86_400_000;

export type RepositoryAttention = {
  eligible: boolean;
  tier: "established" | "emerging" | "ineligible";
  score: number;
  reasons: string[];
};

export function evaluateRepositoryAttention(
  repository: Repository,
  now = Date.now(),
): RepositoryAttention {
  const createdAt = new Date(repository.createdAt).getTime();
  const pushedAt = new Date(repository.pushedAt).getTime();
  const ageDays = Number.isFinite(createdAt)
    ? Math.max(0, (now - createdAt) / DAY)
    : Number.POSITIVE_INFINITY;
  const pushAgeDays = Number.isFinite(pushedAt)
    ? Math.max(0, (now - pushedAt) / DAY)
    : Number.POSITIVE_INFINITY;
  const baseQuality =
    !repository.archived &&
    !repository.mirror &&
    !repository.fork &&
    repository.hasReadme &&
    repository.quality >= RECOMMENDATION_QUALITY.minimumQuality &&
    pushAgeDays <= RECOMMENDATION_QUALITY.maximumPushAgeDays;
  const established =
    baseQuality &&
    repository.stars >= RECOMMENDATION_QUALITY.establishedMinimumStars;
  const emergingAttention =
    (repository.ownerFollowers ?? 0) >=
      RECOMMENDATION_QUALITY.emergingMinimumOwnerFollowers ||
    (repository.watchers ?? 0) >=
      RECOMMENDATION_QUALITY.emergingMinimumWatchers ||
    repository.trend30d.stars >=
      RECOMMENDATION_QUALITY.emergingMinimumGrowth30d;
  const emerging =
    baseQuality &&
    ageDays <= RECOMMENDATION_QUALITY.emergingMaximumAgeDays &&
    repository.stars >= RECOMMENDATION_QUALITY.emergingMinimumStars &&
    repository.quality >= RECOMMENDATION_QUALITY.emergingMinimumQuality &&
    repository.maintenance === "active" &&
    emergingAttention;
  const score = Math.min(
    1,
    repository.quality * 0.45 +
      Math.min(1, Math.log10(repository.stars + 1) / 5) * 0.25 +
      Math.min(1, Math.log10((repository.ownerFollowers ?? 0) + 1) / 5) * 0.12 +
      repository.trend30d.heat * 0.18,
  );
  const reasons = established
    ? [
        `${repository.stars.toLocaleString("en-US")} Stars`,
        `质量 ${Math.round(repository.quality * 100)}%`,
      ]
    : emerging
      ? [
          "新锐项目",
          (repository.ownerFollowers ?? 0) >=
          RECOMMENDATION_QUALITY.emergingMinimumOwnerFollowers
            ? `作者 ${repository.ownerFollowers?.toLocaleString("en-US")} 关注者`
            : (repository.watchers ?? 0) >=
                RECOMMENDATION_QUALITY.emergingMinimumWatchers
              ? `${repository.watchers?.toLocaleString("en-US")} Watchers`
              : `30 日 +${repository.trend30d.stars} Stars`,
        ]
      : [];
  return {
    eligible: established || emerging,
    tier: established ? "established" : emerging ? "emerging" : "ineligible",
    score: Number(score.toFixed(4)),
    reasons,
  };
}

export function isRecommendationEligible(repository: Repository): boolean {
  return evaluateRepositoryAttention(repository).eligible;
}
