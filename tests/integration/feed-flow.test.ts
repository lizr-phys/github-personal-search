import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_REPOSITORIES } from "@/data/demo-repositories";
import { runtimeStore } from "@/server/runtime/store";
import { getFeedBatch } from "@/server/services/feed-service";
import { recordInteraction } from "@/server/services/interaction-service";
import { completeOnboarding } from "@/server/services/onboarding-service";
import { onboardingFeedback } from "../fixtures";

async function initialize(sessionId: string) {
  await completeOnboarding({
    interests: ["scientific-computing", "visualization", "webgpu"],
    languages: ["TypeScript", "Python"],
    difficulty: "medium",
    seedRepositories: [DEMO_REPOSITORIES[1]!.id],
    feedback: onboardingFeedback,
    sessionId,
  });
}

describe("daily warm queue and session reranking", () => {
  beforeEach(async () => runtimeStore.reset());

  it("returns unique batches and suppresses 30-day exposure repeats", async () => {
    await initialize("feed-a");
    const first = await getFeedBatch("feed-a", 0);
    const second = await getFeedBatch("feed-a", 1);
    expect(first.code).toBe("OK");
    expect(second.code).toBe("OK");
    if (first.code !== "OK" || second.code !== "OK") return;
    expect(first.items).toHaveLength(10);
    expect(second.items).toHaveLength(10);
    expect(new Set(first.items.map((item) => item.repository.id)).size).toBe(
      10,
    );
    expect(
      first.items.some((left) =>
        second.items.some(
          (right) => right.repository.id === left.repository.id,
        ),
      ),
    ).toBe(false);
    expect(
      new Set(first.items.map((item) => item.repository.cluster)).size,
    ).toBeGreaterThanOrEqual(3);
  });

  it("current-session negative feedback changes the next batch", async () => {
    await initialize("baseline");
    const baselineFirst = await getFeedBatch("baseline", 0);
    const baselineSecond = await getFeedBatch("baseline", 1);
    if (baselineFirst.code !== "OK" || baselineSecond.code !== "OK")
      throw new Error("baseline failed");
    const baselineIds = baselineSecond.items.map((item) => item.repository.id);

    await runtimeStore.reset();
    await initialize("feedback");
    const feedbackFirst = await getFeedBatch("feedback", 0);
    if (feedbackFirst.code !== "OK") throw new Error("feedback first failed");
    await recordInteraction({
      repositoryId: feedbackFirst.items[0]!.repository.id,
      type: "block_similar",
      surface: "feed",
      sessionId: "feedback",
    });
    const feedbackSecond = await getFeedBatch("feedback", 1);
    if (feedbackSecond.code !== "OK") throw new Error("feedback second failed");
    expect(feedbackSecond.items.map((item) => item.repository.id)).not.toEqual(
      baselineIds,
    );
    expect(
      (await runtimeStore.read()).interactions.some(
        (item) => item.type === "block_similar",
      ),
    ).toBe(true);
  });

  it("invalidates a prefetched future batch after session feedback", async () => {
    await initialize("prefetch");
    const first = await getFeedBatch("prefetch", 0);
    const prefetched = await getFeedBatch("prefetch", 1);
    if (first.code !== "OK" || prefetched.code !== "OK")
      throw new Error("feed setup failed");
    const staleBatchId = prefetched.batch.id;
    await recordInteraction({
      repositoryId: first.items[0]!.repository.id,
      type: "block_similar",
      surface: "feed",
      sessionId: "prefetch",
    });
    const stateAfterFeedback = await runtimeStore.read();
    expect(
      stateAfterFeedback.batches.some((batch) => batch.id === staleBatchId),
    ).toBe(false);
    expect(
      stateAfterFeedback.exposures.some(
        (exposure) => exposure.batchId === staleBatchId,
      ),
    ).toBe(false);
    const refreshed = await getFeedBatch("prefetch", 1);
    if (refreshed.code !== "OK") throw new Error("refreshed batch failed");
    expect(refreshed.batch.id).not.toBe(staleBatchId);
  });
});
