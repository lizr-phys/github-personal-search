import { ALGORITHM_VERSIONS, SEARCH_WEIGHTS } from "@/config/algorithms";
import type {
  InterestProfile,
  RankedRepository,
  RankingFeatures,
  Repository,
  SearchIntent,
} from "@/domain/types";
import type { RetrievalCandidate } from "./candidate-retriever";
import { getIndexedDocument, getQueryVector } from "./document-index";
import { explanationBuilder } from "./explanation";
import { canonicalLanguage } from "./query-parser";
import {
  clamp,
  cosineSimilarity,
  fuzzyOverlapScore,
  normalizeText,
  tokenize,
} from "./text";

export type SearchMode = "comprehensive" | "precise" | "inspiration" | "latest";

const MODE_MULTIPLIER: Record<
  SearchMode,
  Partial<Record<keyof RankingFeatures, number>>
> = {
  comprehensive: {},
  precise: { lexical: 1.38, constraints: 1.22, novelty: 0.55, personal: 0.7 },
  inspiration: { semantic: 1.12, novelty: 1.7, personal: 0.9 },
  latest: { freshness: 2.3, novelty: 1.1, lexical: 0.82, personal: 0.75 },
};

function repositoryValues(repository: Repository): string[] {
  return [
    repository.language,
    ...repository.languages,
    ...repository.technologies,
    ...repository.topics,
    ...repository.domains,
    ...repository.deployment,
  ].map(normalizeText);
}

function containsValue(repository: Repository, value: string): boolean {
  const target = normalizeText(value);
  return repositoryValues(repository).some((candidate) => {
    if (candidate === target) return true;
    if (
      target === "web" &&
      (candidate.startsWith("web-") || candidate === "browser")
    )
      return true;
    if (Math.min(candidate.length, target.length) < 4) return false;
    return candidate.includes(target) || target.includes(candidate);
  });
}

export function repositorySatisfiesHardConstraints(
  repository: Repository,
  intent: SearchIntent,
  profile: InterestProfile,
): boolean {
  if (repository.archived || repository.mirror) return false;
  if (
    profile.blockedLanguages.some((language) =>
      containsValue(repository, language),
    )
  )
    return false;
  if (
    profile.blockedOrganizations.some(
      (owner) => normalizeText(repository.owner) === normalizeText(owner),
    )
  )
    return false;
  if (profile.blockedTypes.includes(repository.projectType)) return false;
  if (
    intent.languages.length &&
    !intent.languages.some((language) => containsValue(repository, language))
  )
    return false;
  if (
    intent.projectTypes.length &&
    !intent.projectTypes.includes(repository.projectType)
  )
    return false;
  if (
    intent.deployment.length &&
    !intent.deployment.every((deployment) =>
      containsValue(repository, deployment),
    )
  )
    return false;
  if (
    intent.platforms.length &&
    !intent.platforms.some((platform) => containsValue(repository, platform))
  )
    return false;
  if (intent.difficulty && repository.difficulty !== intent.difficulty)
    return false;
  if (intent.maturity && repository.maturity !== intent.maturity) return false;
  if (
    intent.licenses?.length &&
    !intent.licenses.some(
      (license) => normalizeText(repository.license) === normalizeText(license),
    )
  )
    return false;
  const text = getIndexedDocument(repository).normalizedText;
  if (
    intent.negativeConstraints.some((value) => {
      if (value === "archived") return repository.archived;
      const excludedLanguage = canonicalLanguage(value);
      if (excludedLanguage) {
        return [repository.language, ...repository.languages].some(
          (language) =>
            (canonicalLanguage(language) ?? language) === excludedLanguage,
        );
      }
      return text.includes(normalizeText(value));
    })
  )
    return false;
  return true;
}

function interestScore(
  repository: Repository,
  values: Record<string, number>,
): number {
  let score = 0;
  for (const [term, weight] of Object.entries(values))
    if (containsValue(repository, term)) score += Math.max(0, weight);
  return clamp(score / 7);
}

function personalScore(
  repository: Repository,
  profile: InterestProfile,
): number {
  const longTerm = interestScore(repository, profile.longTerm);
  const shortTerm = interestScore(repository, profile.shortTerm);
  const language = clamp((profile.languages[repository.language] ?? 0) / 4);
  return clamp(longTerm * 0.45 + shortTerm * 0.35 + language * 0.2);
}

function softPenalty(repository: Repository): number {
  let penalty = 0;
  if (repository.fork) penalty += 0.32;
  if (!repository.hasReadme) penalty += 0.28;
  if (repository.maintenance === "slower") penalty += 0.11;
  if (repository.maintenance === "unknown") penalty += 0.04;
  if (repository.quality < 0.45) penalty += 0.18;
  return penalty;
}

function matchRatio(wanted: string[], actual: string[]): number {
  if (!wanted.length) return 0;
  const normalized = actual.map(normalizeText);
  const matches = wanted.filter((value) =>
    normalized.some(
      (candidate) =>
        candidate === normalizeText(value) ||
        candidate.includes(normalizeText(value)) ||
        normalizeText(value).includes(candidate),
    ),
  ).length;
  return clamp(matches / wanted.length);
}

export class SearchRanker {
  readonly version = ALGORITHM_VERSIONS.search;

  async rank(
    candidates: RetrievalCandidate[],
    intent: SearchIntent,
    profile: InterestProfile,
    mode: SearchMode,
  ): Promise<RankedRepository[]> {
    const rawTerms = tokenize(intent.normalizedQuery);
    const expandedTerms = tokenize(intent.generatedTerms.join(" "));
    const queryText = [intent.normalizedQuery, ...intent.generatedTerms].join(
      " ",
    );
    const queryVector = await getQueryVector(queryText);
    const multipliers = MODE_MULTIPLIER[mode];
    const minimumEvidence =
      mode === "precise" ? 0.085 : mode === "inspiration" ? 0.03 : 0.05;
    const ranked = await Promise.all(
      candidates.map(
        async (candidate): Promise<RankedRepository | undefined> => {
          const repository = candidate.repository;
          if (!repositorySatisfiesHardConstraints(repository, intent, profile))
            return undefined;
          const document = getIndexedDocument(repository);
          const rawLexical = fuzzyOverlapScore(rawTerms, document.tokens);
          const expandedLexical = fuzzyOverlapScore(
            expandedTerms,
            document.tokens,
          );
          const lexical = clamp(rawLexical * 0.72 + expandedLexical * 0.28);
          const vectorSemantic = clamp(
            cosineSimilarity(queryVector, await document.vector()),
          );
          const domainMatch = matchRatio(
            intent.domains,
            repository.domains.concat(repository.topics),
          );
          const technologyMatch = matchRatio(
            intent.technologies,
            repository.technologies.concat(repository.topics),
          );
          const structuredMatch = Math.max(domainMatch, technologyMatch);
          const semantic =
            intent.domains.length || intent.technologies.length
              ? clamp(
                  vectorSemantic * 0.42 +
                    domainMatch * 0.36 +
                    technologyMatch * 0.22,
                )
              : vectorSemantic;
          const evidenceStrength = Math.max(
            rawLexical,
            semantic,
            structuredMatch,
          );
          if (
            evidenceStrength < minimumEvidence &&
            !(
              mode === "inspiration" &&
              candidate.retrievalSources.includes("exploration") &&
              repository.quality >= 0.86
            )
          )
            return undefined;
          const penalty = softPenalty(repository);
          const features: RankingFeatures = {
            semantic,
            lexical,
            constraints: 1,
            quality: repository.quality,
            freshness:
              mode === "latest"
                ? repository.trend1d.heat * 0.35 +
                  repository.trend7d.heat * 0.65
                : repository.trend7d.heat,
            personal: personalScore(repository, profile),
            novelty: repository.novelty,
            longTerm: 0,
            shortTerm: 0,
            collaborative: 0,
            exploration: repository.novelty,
            penalty,
          };
          const weighted = (
            Object.entries(SEARCH_WEIGHTS) as Array<
              [keyof typeof SEARCH_WEIGHTS, number]
            >
          ).reduce(
            (sum, [feature, weight]) =>
              sum + features[feature] * weight * (multipliers[feature] ?? 1),
            0,
          );
          const score = weighted + candidate.rrfScore * 0.055 - penalty;
          const explanation = explanationBuilder.forSearch(
            repository,
            intent,
            features,
          );
          return {
            repository,
            score: Number(score.toFixed(6)),
            features,
            retrievalSources: candidate.retrievalSources,
            explanation: explanation.text,
            explanationEvidence: explanation.evidence,
            candidateType:
              repository.stars < 10_000 && repository.quality > 0.84
                ? "niche"
                : repository.trend7d.heat > 0.76
                  ? "trending"
                  : mode === "inspiration" && repository.novelty > 0.7
                    ? "exploration"
                    : "strong",
          };
        },
      ),
    );
    return ranked
      .filter(
        (item): item is RankedRepository => Boolean(item) && item!.score > 0.06,
      )
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.repository.fullName.localeCompare(right.repository.fullName),
      );
  }
}

export const searchRanker = new SearchRanker();
