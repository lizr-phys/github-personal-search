import { ALGORITHM_VERSIONS, DIVERSITY_CONFIG } from "@/config/algorithms";
import type { RankedRepository } from "@/domain/types";

export function repositorySimilarity(
  left: RankedRepository,
  right: RankedRepository,
): number {
  let similarity = 0;
  if (left.repository.cluster === right.repository.cluster) similarity += 0.4;
  if (left.repository.language === right.repository.language)
    similarity += 0.18;
  if (left.repository.owner === right.repository.owner) similarity += 0.28;
  const topics = new Set(left.repository.topics);
  const overlap = right.repository.topics.filter((topic) =>
    topics.has(topic),
  ).length;
  similarity += Math.min(0.3, overlap * 0.1);
  return Math.min(1, similarity);
}

export class DiversityReranker {
  readonly version = ALGORITHM_VERSIONS.diversity;

  rerank(
    candidates: RankedRepository[],
    limit = 10,
    context:
      | boolean
      | {
          explicitTechnology?: boolean;
          mode?: "comprehensive" | "precise" | "inspiration" | "latest";
        } = false,
  ): RankedRepository[] {
    const remaining = [...candidates];
    const selected: RankedRepository[] = [];
    const organizations = new Map<string, number>();
    const clusters = new Set<string>();
    const explicitTechnology =
      typeof context === "boolean"
        ? context
        : Boolean(context.explicitTechnology);
    const mode =
      typeof context === "boolean"
        ? "comprehensive"
        : (context.mode ?? "comprehensive");
    const lambda =
      explicitTechnology || mode === "precise"
        ? 0.9
        : mode === "inspiration"
          ? 0.64
          : mode === "latest"
            ? 0.78
            : DIVERSITY_CONFIG.lambda;

    while (remaining.length && selected.length < limit) {
      let bestIndex = -1;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index]!;
        if (
          (organizations.get(candidate.repository.owner) ?? 0) >=
          DIVERSITY_CONFIG.maxPerOrganization
        )
          continue;
        const maximumSimilarity = selected.length
          ? Math.max(
              ...selected.map((item) => repositorySimilarity(candidate, item)),
            )
          : 0;
        const clusterBonus = clusters.has(candidate.repository.cluster)
          ? 0
          : selected.length < 6
            ? 0.09
            : 0.03;
        const score =
          lambda * candidate.score -
          (1 - lambda) * maximumSimilarity +
          clusterBonus;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      if (bestIndex < 0) break;
      const [picked] = remaining.splice(bestIndex, 1);
      if (!picked) break;
      selected.push(picked);
      clusters.add(picked.repository.cluster);
      organizations.set(
        picked.repository.owner,
        (organizations.get(picked.repository.owner) ?? 0) + 1,
      );
    }

    if (
      !explicitTechnology &&
      selected.length >= 10 &&
      clusters.size < DIVERSITY_CONFIG.minClustersInTopTen
    ) {
      const missingClusterCandidate = candidates.find(
        (candidate) =>
          !clusters.has(candidate.repository.cluster) &&
          !selected.some(
            (item) => item.repository.id === candidate.repository.id,
          ),
      );
      if (missingClusterCandidate)
        selected[selected.length - 1] = missingClusterCandidate;
    }
    return selected;
  }
}

export const diversityReranker = new DiversityReranker();
