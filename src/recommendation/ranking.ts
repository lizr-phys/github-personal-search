import {
  ALGORITHM_VERSIONS,
  FEED_QUOTA,
  FEED_WEIGHTS,
  INTERACTION_WEIGHTS,
} from "@/config/algorithms";
import type {
  InteractionType,
  InterestProfile,
  RankedRepository,
  RankingFeatures,
  Repository,
} from "@/domain/types";
import { explanationBuilder } from "@/search/explanation";
import { clamp } from "@/search/text";
import { diversityReranker } from "@/search/diversity";
import { isRecommendationEligible } from "./quality-policy";

export type InteractionSignal = {
  repositoryId: string;
  type: InteractionType;
  undoneAt?: string;
  at: string;
};

function topicScore(
  repository: Repository,
  values: Record<string, number>,
): number {
  let score = 0;
  for (const [term, weight] of Object.entries(values)) {
    if (
      repository.domains.includes(term) ||
      repository.topics.includes(term) ||
      repository.technologies.some(
        (item) => item.toLowerCase() === term.toLowerCase(),
      )
    )
      score += weight;
  }
  return clamp(score / 6, -1, 1);
}

function buildSignalPenalties(
  signals: InteractionSignal[],
  now = Date.now(),
): Map<string, number> {
  const penalties = new Map<string, number>();
  for (const signal of signals) {
    if (signal.undoneAt) continue;
    const weight = INTERACTION_WEIGHTS[signal.type];
    if (weight >= 0) continue;
    const ageDays = Math.max(
      0,
      (now - new Date(signal.at).getTime()) / 86_400_000,
    );
    const halfLife = signal.type === "seen" ? 7 : 30;
    const decayed = (Math.abs(weight) / 8) * 2 ** (-ageDays / halfLife);
    penalties.set(
      signal.repositoryId,
      (penalties.get(signal.repositoryId) ?? 0) + decayed,
    );
  }
  return penalties;
}

export class FeedRanker {
  readonly version = ALGORITHM_VERSIONS.feed;

  rank(
    repositories: Repository[],
    profile: InterestProfile,
    signals: InteractionSignal[],
  ): RankedRepository[] {
    const signalPenalties = buildSignalPenalties(signals);
    return repositories
      .filter(isRecommendationEligible)
      .map((repository): RankedRepository => {
        const longTerm = topicScore(repository, profile.longTerm);
        const shortTerm = topicScore(repository, profile.shortTerm);
        const language = clamp(
          (profile.languages[repository.language] ?? 0) / 4,
          -1,
          1,
        );
        let penalty = signalPenalties.get(repository.id) ?? 0;
        if (repository.archived || repository.mirror) penalty += 1;
        if (repository.fork) penalty += 0.3;
        if (profile.blockedLanguages.includes(repository.language))
          penalty += 1;
        if (profile.blockedOrganizations.includes(repository.owner))
          penalty += 1;
        if (profile.blockedTypes.includes(repository.projectType)) penalty += 1;
        const features: RankingFeatures = {
          semantic: 0,
          lexical: 0,
          constraints: 1,
          quality: repository.quality,
          freshness: repository.trend7d.heat,
          personal: clamp((longTerm + shortTerm + language) / 3),
          novelty: repository.novelty,
          longTerm: clamp(longTerm * 0.8 + language * 0.2),
          shortTerm: clamp(shortTerm, -1, 1),
          collaborative: clamp(
            repository.quality * 0.45 + Math.log10(repository.stars + 1) / 10,
          ),
          exploration: clamp(repository.novelty * (longTerm > 0.1 ? 0.55 : 1)),
          penalty,
        };
        const score =
          (
            Object.entries(FEED_WEIGHTS) as Array<
              [keyof typeof FEED_WEIGHTS, number]
            >
          ).reduce(
            (sum, [feature, weight]) => sum + features[feature] * weight,
            0,
          ) - penalty;
        const candidateType: RankedRepository["candidateType"] =
          shortTerm > 0.35
            ? "short_term"
            : longTerm > 0.3
              ? "strong"
              : repository.trend7d.heat > 0.72
                ? "trending"
                : repository.stars < 10_000 && repository.quality > 0.84
                  ? "niche"
                  : "exploration";
        const explanation = explanationBuilder.forFeed(
          repository,
          profile,
          features,
        );
        return {
          repository,
          score: Number(score.toFixed(6)),
          features,
          retrievalSources: [
            candidateType === "trending"
              ? "trend"
              : candidateType === "exploration"
                ? "exploration"
                : "personal-content",
          ],
          explanation: explanation.text,
          explanationEvidence: explanation.evidence,
          candidateType,
        };
      })
      .filter((item) => item.score > -0.1 && item.features.penalty < 1)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.repository.fullName.localeCompare(right.repository.fullName),
      );
  }

  selectBatch(ranked: RankedRepository[], limit = 10): RankedRepository[] {
    const selected: RankedRepository[] = [];
    const used = new Set<string>();
    for (const [candidateType, amount] of Object.entries(FEED_QUOTA) as Array<
      [RankedRepository["candidateType"], number]
    >) {
      for (const candidate of ranked
        .filter((item) => item.candidateType === candidateType)
        .slice(0, amount)) {
        if (used.has(candidate.repository.id)) continue;
        selected.push(candidate);
        used.add(candidate.repository.id);
      }
    }
    for (const candidate of ranked) {
      if (selected.length >= limit) break;
      if (used.has(candidate.repository.id)) continue;
      selected.push(candidate);
      used.add(candidate.repository.id);
    }
    // MMR can change order, but cannot discard quota-selected membership.
    return diversityReranker.rerank(selected, Math.min(limit, selected.length));
  }
}

export const feedRanker = new FeedRanker();
