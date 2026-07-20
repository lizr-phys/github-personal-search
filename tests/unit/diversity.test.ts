import { describe, expect, it } from "vitest";

import { DEMO_REPOSITORIES } from "@/data/demo-repositories";
import { feedRanker } from "@/recommendation/ranking";
import { diversityReranker, repositorySimilarity } from "@/search/diversity";
import { profile } from "../fixtures";

describe("MMR diversity reranker", () => {
  it("limits organizations and covers at least three clusters", () => {
    const ranked = feedRanker.rank(DEMO_REPOSITORIES, profile(), []);
    const output = diversityReranker.rerank(ranked, 10);
    const owners = output.reduce<Record<string, number>>(
      (counts, item) => ({
        ...counts,
        [item.repository.owner]: (counts[item.repository.owner] ?? 0) + 1,
      }),
      {},
    );
    expect(Math.max(...Object.values(owners))).toBeLessThanOrEqual(2);
    expect(
      new Set(output.map((item) => item.repository.cluster)).size,
    ).toBeGreaterThanOrEqual(3);
  });

  it("scores same-cluster candidates as more similar", () => {
    const ranked = feedRanker.rank(DEMO_REPOSITORIES, profile(), []);
    const knowledge = ranked.filter(
      (item) => item.repository.cluster === "个人知识库",
    );
    const unrelated = ranked.find(
      (item) => item.repository.cluster === "WebGPU 示例",
    )!;
    expect(repositorySimilarity(knowledge[0]!, knowledge[1]!)).toBeGreaterThan(
      repositorySimilarity(knowledge[0]!, unrelated),
    );
  });
});
