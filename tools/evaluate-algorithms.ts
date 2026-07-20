import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { DEMO_REPOSITORIES } from "../src/data/demo-repositories";
import type {
  InterestProfile,
  Repository,
  SearchIntent,
} from "../src/domain/types";
import { searchRepositories } from "../src/search/service";
import { SEARCH_EVALUATION_CASES } from "../tests/evaluation/search-cases";
import { profile as makeProfile } from "../tests/fixtures";

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return (
    sorted[
      Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
    ] ?? 0
  );
}

function dcg(grades: number[]): number {
  return grades.reduce(
    (sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2),
    0,
  );
}

function violatesHardConstraint(
  repository: Repository,
  intent: SearchIntent,
): boolean {
  if (
    intent.languages.length &&
    !intent.languages.some(
      (language) =>
        repository.languages.includes(language) ||
        repository.language === language ||
        repository.technologies.includes(language),
    )
  )
    return true;
  if (
    intent.projectTypes.length &&
    !intent.projectTypes.includes(repository.projectType)
  )
    return true;
  if (
    intent.deployment.length &&
    !intent.deployment.every((value) => repository.deployment.includes(value))
  )
    return true;
  if (
    intent.licenses?.length &&
    !intent.licenses.some(
      (license) => repository.license.toLowerCase() === license.toLowerCase(),
    )
  )
    return true;
  const text = [
    repository.fullName,
    repository.description,
    repository.summary,
    ...repository.technologies,
    ...repository.topics,
  ]
    .join(" ")
    .toLowerCase();
  if (
    intent.negativeConstraints.some((constraint) =>
      text.includes(constraint.toLowerCase()),
    )
  )
    return true;
  return repository.archived || repository.mirror;
}

async function main() {
  const queryTimes: number[] = [];
  const cases = [];
  let totalRetrieved = 0;
  let totalRelevantRetrieved = 0;
  let totalRelevant = 0;
  let totalHardViolations = 0;
  let totalDuplicates = 0;
  let totalClusters = 0;
  let totalNdcg = 0;
  let totalMrr = 0;
  let emptyFalsePositives = 0;

  for (const item of SEARCH_EVALUATION_CASES) {
    const base = makeProfile(item.profile ?? {}) as InterestProfile;
    const started = performance.now();
    const response = await searchRepositories({
      query: item.query,
      mode: item.mode,
      profile: base,
      repositories: DEMO_REPOSITORIES,
    });
    const durationMs = performance.now() - started;
    queryTimes.push(durationMs);
    const top = response.results.slice(0, 10);
    const grades = top.map(
      (result) => item.relevance[result.repository.id] ?? 0,
    );
    const relevant = Object.values(item.relevance).filter(
      (grade) => grade >= 2,
    ).length;
    const relevantRetrieved = grades.filter((grade) => grade >= 2).length;
    const idealGrades = Object.values(item.relevance)
      .sort((a, b) => b - a)
      .slice(0, 10);
    const ndcg = idealGrades.length
      ? dcg(grades) / dcg(idealGrades)
      : top.length
        ? 0
        : 1;
    const firstRelevant = grades.findIndex((grade) => grade >= 2);
    const hardViolations = top.filter((result) =>
      violatesHardConstraint(result.repository, response.intent),
    ).length;
    const duplicates =
      top.length - new Set(top.map((result) => result.repository.id)).size;
    const clusters = new Set(top.map((result) => result.repository.cluster))
      .size;

    totalRetrieved += top.length;
    totalRelevantRetrieved += relevantRetrieved;
    totalRelevant += relevant;
    totalHardViolations += hardViolations;
    totalDuplicates += duplicates;
    totalClusters += clusters;
    totalNdcg += ndcg;
    totalMrr += firstRelevant < 0 ? 0 : 1 / (firstRelevant + 1);
    if (item.expectedEmpty) emptyFalsePositives += top.length;
    cases.push({
      id: item.id,
      durationMs: Number(durationMs.toFixed(3)),
      recallAt10: relevant
        ? Number((relevantRetrieved / relevant).toFixed(4))
        : null,
      precisionAt10: Number(
        (relevantRetrieved / Math.max(1, top.length)).toFixed(4),
      ),
      ndcgAt10: Number(ndcg.toFixed(4)),
      mrr: Number((firstRelevant < 0 ? 0 : 1 / (firstRelevant + 1)).toFixed(4)),
      hardViolations,
      clusters,
      topIds: top.map((result) => result.repository.id),
    });
  }

  const evaluatedRelevantCases = SEARCH_EVALUATION_CASES.filter(
    (item) => Object.keys(item.relevance).length > 0,
  ).length;
  const result = {
    generatedAt: new Date().toISOString(),
    corpusSize: DEMO_REPOSITORIES.length,
    queryCount: SEARCH_EVALUATION_CASES.length,
    metrics: {
      recallAt10: Number(
        (totalRelevantRetrieved / Math.max(1, totalRelevant)).toFixed(4),
      ),
      precisionAt10: Number(
        (totalRelevantRetrieved / Math.max(1, totalRetrieved)).toFixed(4),
      ),
      ndcgAt10: Number((totalNdcg / SEARCH_EVALUATION_CASES.length).toFixed(4)),
      mrr: Number((totalMrr / evaluatedRelevantCases).toFixed(4)),
      hardConstraintViolationRate: Number(
        (totalHardViolations / Math.max(1, totalRetrieved)).toFixed(4),
      ),
      duplicateRate: Number(
        (totalDuplicates / Math.max(1, totalRetrieved)).toFixed(4),
      ),
      averageClusterCoverageAt10: Number(
        (totalClusters / SEARCH_EVALUATION_CASES.length).toFixed(3),
      ),
      emptyQueryFalsePositives: emptyFalsePositives,
      p50Ms: Number(percentile(queryTimes, 0.5).toFixed(3)),
      p95Ms: Number(percentile(queryTimes, 0.95).toFixed(3)),
      p99Ms: Number(percentile(queryTimes, 0.99).toFixed(3)),
    },
    cases,
  };
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0 && process.argv[outputIndex + 1]) {
    await writeFile(
      process.argv[outputIndex + 1]!,
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    );
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
