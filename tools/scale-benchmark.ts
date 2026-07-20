import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { DEMO_REPOSITORIES } from "../src/data/demo-repositories";
import type { Repository } from "../src/domain/types";
import { feedRanker } from "../src/recommendation/ranking";
import { searchRepositories } from "../src/search/service";
import { profile } from "../tests/fixtures";

const size = Number.parseInt(process.env.GPS_SCALE_REPOSITORIES ?? "20000", 10);

function syntheticRepository(index: number): Repository {
  const source = DEMO_REPOSITORIES[index % DEMO_REPOSITORIES.length]!;
  return {
    ...structuredClone(source),
    id: `${source.id}-scale-${index}`,
    owner: `${source.owner}-scale-${index % 997}`,
    fullName: `${source.owner}-scale-${index % 997}/${source.name}-${index}`,
    stars: source.stars + (index % 2000),
    novelty: ((index * 17) % 100) / 100,
    dataUpdatedAt: `2026-07-${String(1 + (index % 18)).padStart(2, "0")}T08:00:00.000Z`,
  };
}

function memoryMb(): number {
  return Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1));
}

async function main() {
  const beforeMemory = memoryMb();
  const generationStarted = performance.now();
  const repositories = Array.from({ length: size }, (_, index) =>
    syntheticRepository(index),
  );
  const generationMs = performance.now() - generationStarted;

  const feedStarted = performance.now();
  const feed = feedRanker.rank(repositories, profile(), []);
  const feedBatch = feedRanker.selectBatch(feed, 10);
  const feedMs = performance.now() - feedStarted;

  const searchStarted = performance.now();
  const search = await searchRepositories({
    query: "用 WebGPU 做 scientific computing 或物理模拟",
    profile: profile(),
    repositories,
  });
  const searchMs = performance.now() - searchStarted;

  const warmStarted = performance.now();
  await searchRepositories({
    query: "用 WebGPU 做 scientific computing 或物理模拟",
    profile: profile(),
    repositories,
  });
  const warmSearchMs = performance.now() - warmStarted;

  const result = {
    generatedAt: new Date().toISOString(),
    repositoryCount: size,
    generationMs: Number(generationMs.toFixed(2)),
    feedRankAndBatchMs: Number(feedMs.toFixed(2)),
    coldSearchMs: Number(searchMs.toFixed(2)),
    warmSearchMs: Number(warmSearchMs.toFixed(2)),
    resultCount: search.results.length,
    feedUnique: new Set(feedBatch.map((item) => item.repository.id)).size,
    feedClusters: new Set(feedBatch.map((item) => item.repository.cluster))
      .size,
    memory: { beforeMb: beforeMemory, afterMb: memoryMb() },
  };
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0 && process.argv[outputIndex + 1])
    await writeFile(
      process.argv[outputIndex + 1]!,
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
