import { describe, expect, it } from "vitest";

import { FEED_QUOTA, INTERACTION_WEIGHTS } from "@/config/algorithms";
import { DEMO_REPOSITORIES } from "@/data/demo-repositories";
import { feedRanker } from "@/recommendation/ranking";
import { userProfileUpdater } from "@/recommendation/profile-updater";
import { evaluateRepositoryAttention } from "@/recommendation/quality-policy";
import { profile } from "../fixtures";

describe("feed ranking and behavior weights", () => {
  it("keeps configured behavior weights aligned with the PRD", () => {
    expect(INTERACTION_WEIGHTS.used).toBe(8);
    expect(INTERACTION_WEIGHTS.ran).toBe(6);
    expect(INTERACTION_WEIGHTS.reproduced).toBe(6);
    expect(INTERACTION_WEIGHTS.learn).toBe(5);
    expect(INTERACTION_WEIGHTS.favorite).toBe(4);
    expect(INTERACTION_WEIGHTS.not_interested).toBe(-6);
    expect(INTERACTION_WEIGHTS.seen).toBe(-3);
  });

  it("updates negative preferences but treats seen as repetition suppression only", () => {
    const repository = DEMO_REPOSITORIES.find(
      (item) => item.fullName === "qutip/qutip",
    )!;
    const base = profile();
    const seen = userProfileUpdater.apply(base, repository, "seen");
    expect(seen.longTerm).toEqual(base.longTerm);
    const negative = userProfileUpdater.apply(
      base,
      repository,
      "not_interested",
    );
    expect(negative.longTerm.quantum).toBeLessThan(0);
    const mismatch = userProfileUpdater.apply(
      base,
      repository,
      "language_mismatch",
    );
    expect(mismatch.blockedLanguages).toContain("Python");
  });

  it("builds a unique ten-item batch with quota-aware candidate types", () => {
    const ranked = feedRanker.rank(DEMO_REPOSITORIES, profile(), []);
    const batch = feedRanker.selectBatch(ranked, 10);
    expect(batch).toHaveLength(10);
    expect(new Set(batch.map((item) => item.repository.id)).size).toBe(10);
    expect(
      new Set(batch.map((item) => item.repository.cluster)).size,
    ).toBeGreaterThanOrEqual(3);
    expect(
      FEED_QUOTA.strong +
        FEED_QUOTA.short_term +
        FEED_QUOTA.trending +
        FEED_QUOTA.niche +
        FEED_QUOTA.exploration,
    ).toBe(10);
  });

  it("admits established repositories and only evidence-backed emerging projects", () => {
    const established = structuredClone(DEMO_REPOSITORIES[0]!);
    established.stars = 12_000;
    expect(evaluateRepositoryAttention(established).tier).toBe("established");

    const emerging = structuredClone(established);
    emerging.stars = 220;
    emerging.createdAt = new Date(Date.now() - 120 * 86_400_000).toISOString();
    emerging.ownerFollowers = 12_000;
    emerging.quality = 0.9;
    emerging.maintenance = "active";
    expect(evaluateRepositoryAttention(emerging).tier).toBe("emerging");

    const unsupported = structuredClone(emerging);
    unsupported.ownerFollowers = 0;
    unsupported.watchers = 0;
    unsupported.trend30d = { ...unsupported.trend30d, stars: 8 };
    expect(evaluateRepositoryAttention(unsupported).eligible).toBe(false);
  });

  it("never places an old low-attention repository in the recommendation feed", () => {
    const lowAttention = DEMO_REPOSITORIES.find(
      (item) => item.fullName === "phetsims/energy-skate-park",
    )!;
    const ranked = feedRanker.rank(DEMO_REPOSITORIES, profile(), []);
    expect(ranked.some((item) => item.repository.id === lowAttention.id)).toBe(
      false,
    );
    expect(
      ranked.every(
        (item) => evaluateRepositoryAttention(item.repository).eligible,
      ),
    ).toBe(true);
  });

  it("penalizes an explicitly disliked repository", () => {
    const target = DEMO_REPOSITORIES[0]!;
    const baseline = feedRanker
      .rank(DEMO_REPOSITORIES, profile(), [])
      .find((item) => item.repository.id === target.id)!;
    const penalized = feedRanker
      .rank(DEMO_REPOSITORIES, profile(), [
        {
          repositoryId: target.id,
          type: "not_interested",
          at: new Date().toISOString(),
        },
      ])
      .find((item) => item.repository.id === target.id);
    expect(penalized?.score ?? -1).toBeLessThan(baseline.score);
  });
});
