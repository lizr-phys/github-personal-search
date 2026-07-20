import type { InterestProfile, Repository, SearchIntent } from "@/domain/types";
import {
  clamp,
  cosineSimilarity,
  normalizeText,
  overlapScore,
  tokenize,
} from "./text";
import { getIndexedDocument, getQueryVector } from "./document-index";
import type { SearchMode } from "./ranking";

export type RetrievalCandidate = {
  repository: Repository;
  retrievalSources: string[];
  rrfScore: number;
};

type Channel = {
  name: string;
  quota: number;
  weight: number;
  score: (repository: Repository) => number;
};

const QUOTAS: Record<SearchMode, Record<string, number>> = {
  comprehensive: {
    lexical: 34,
    semantic: 28,
    topic: 24,
    personal: 12,
    trend: 10,
    exploration: 8,
  },
  precise: {
    lexical: 40,
    semantic: 22,
    topic: 28,
    personal: 7,
    trend: 5,
    exploration: 4,
  },
  inspiration: {
    lexical: 24,
    semantic: 34,
    topic: 26,
    personal: 14,
    trend: 12,
    exploration: 14,
  },
  latest: {
    lexical: 26,
    semantic: 24,
    topic: 20,
    personal: 8,
    trend: 28,
    exploration: 9,
  },
};

function metadataScore(repository: Repository, intent: SearchIntent): number {
  const targets = new Set(
    [...intent.domains, ...intent.technologies, ...intent.languages].map(
      normalizeText,
    ),
  );
  if (!targets.size) return 0;
  const values = new Set(
    [
      ...repository.domains,
      ...repository.technologies,
      ...repository.topics,
      repository.language,
      repository.cluster,
    ].map(normalizeText),
  );
  let matched = 0;
  for (const target of targets)
    if (
      values.has(target) ||
      [...values].some(
        (value) => value.includes(target) || target.includes(value),
      )
    )
      matched += 1;
  return clamp(matched / Math.min(4, targets.size));
}

function personalScore(
  repository: Repository,
  profile: InterestProfile,
): number {
  const entries = [
    ...Object.entries(profile.longTerm),
    ...Object.entries(profile.shortTerm),
  ];
  const values = new Set(
    [
      ...repository.domains,
      ...repository.topics,
      ...repository.technologies,
    ].map(normalizeText),
  );
  let score = 0;
  for (const [term, weight] of entries)
    if (values.has(normalizeText(term))) score += Math.max(0, weight);
  score += Math.max(0, profile.languages[repository.language] ?? 0) * 0.6;
  return clamp(score / 7);
}

function addChannel(
  aggregate: Map<string, RetrievalCandidate>,
  selected: Array<{ repository: Repository; score: number }>,
  channel: { name: string; weight: number },
): void {
  selected.forEach((item, rank) => {
    const existing = aggregate.get(item.repository.id) ?? {
      repository: item.repository,
      retrievalSources: [],
      rrfScore: 0,
    };
    existing.retrievalSources.push(channel.name);
    existing.rrfScore += channel.weight / (60 + rank + 1);
    aggregate.set(item.repository.id, existing);
  });
}

export class CandidateRetriever {
  readonly version = "multi-channel-staged-rrf-v3";

  async retrieve(
    repositories: Repository[],
    intent: SearchIntent,
    profile: InterestProfile,
    mode: SearchMode,
  ): Promise<RetrievalCandidate[]> {
    const queryText = [intent.normalizedQuery, ...intent.generatedTerms].join(
      " ",
    );
    const queryTerms = tokenize(queryText);
    const quotas = QUOTAS[mode];
    const channels: Channel[] = [
      {
        name: "lexical",
        quota: quotas.lexical ?? 24,
        weight: mode === "precise" ? 1.25 : 1,
        score: (repository) =>
          overlapScore(queryTerms, getIndexedDocument(repository).tokens),
      },
      {
        name: "topic",
        quota: quotas.topic ?? 18,
        weight: 1.12,
        score: (repository) => metadataScore(repository, intent),
      },
      {
        name: "personal",
        quota: quotas.personal ?? 8,
        weight: 0.72,
        score: (repository) => personalScore(repository, profile),
      },
      {
        name: "trend",
        quota: quotas.trend ?? 8,
        weight: mode === "latest" ? 1.3 : 0.6,
        score: (repository) => repository.trend7d.heat * repository.quality,
      },
      {
        name: "exploration",
        quota: quotas.exploration ?? 6,
        weight: mode === "inspiration" ? 1.05 : 0.45,
        score: (repository) => repository.novelty * repository.quality,
      },
    ];
    const aggregate = new Map<string, RetrievalCandidate>();
    for (const channel of channels) {
      const minimum =
        channel.name === "trend" ||
        channel.name === "exploration" ||
        channel.name === "personal"
          ? 0.18
          : 0.025;
      const selected = repositories
        .map((repository) => ({ repository, score: channel.score(repository) }))
        .filter((item) => item.score >= minimum)
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.repository.id.localeCompare(right.repository.id),
        )
        .slice(0, channel.quota);
      addChannel(aggregate, selected, channel);
    }

    // Expensive semantic recall is a fine stage over the cheap-channel union
    // plus a bounded quality reservoir, never a request-time full-catalog scan.
    const semanticPool = new Map<string, Repository>(
      [...aggregate.values()].map((candidate) => [
        candidate.repository.id,
        candidate.repository,
      ]),
    );
    if (semanticPool.size < 180) {
      for (const repository of [...repositories]
        .sort(
          (left, right) =>
            right.quality +
            right.novelty * 0.15 -
            (left.quality + left.novelty * 0.15),
        )
        .slice(0, 180))
        semanticPool.set(repository.id, repository);
    }
    const queryVector = await getQueryVector(queryText);
    const semanticScored = await Promise.all(
      [...semanticPool.values()].map(async (repository) => ({
        repository,
        score: clamp(
          cosineSimilarity(
            queryVector,
            await getIndexedDocument(repository).vector(),
          ),
        ),
      })),
    );
    const semanticSelected = semanticScored
      .filter((item) => item.score >= 0.025)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.repository.id.localeCompare(right.repository.id),
      )
      .slice(0, quotas.semantic ?? 24);
    addChannel(aggregate, semanticSelected, {
      name: "semantic-local",
      weight: mode === "inspiration" ? 1.18 : 1,
    });

    const values = [...aggregate.values()].sort(
      (left, right) =>
        right.rrfScore - left.rrfScore ||
        left.repository.id.localeCompare(right.repository.id),
    );
    const maxRrf = values[0]?.rrfScore ?? 1;
    return values
      .slice(0, 90)
      .map((item) => ({ ...item, rrfScore: clamp(item.rrfScore / maxRrf) }));
  }
}

export const candidateRetriever = new CandidateRetriever();
