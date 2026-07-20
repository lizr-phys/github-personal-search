import { describe, expect, it } from "vitest";

import { isSubscriptionDeliveryEligible } from "@/server/services/subscription-service";

describe("subscription delivery deduplication", () => {
  const now = new Date("2026-07-18T00:00:00.000Z").getTime();

  it("suppresses the same repository for 30 days", () => {
    expect(
      isSubscriptionDeliveryEligible(
        "repo",
        [{ repositoryId: "repo", deliveredAt: "2026-07-01T00:00:00.000Z" }],
        now,
      ),
    ).toBe(false);
  });

  it("allows delivery after 30 days and a distinct major release", () => {
    expect(
      isSubscriptionDeliveryEligible(
        "repo",
        [{ repositoryId: "repo", deliveredAt: "2026-06-01T00:00:00.000Z" }],
        now,
      ),
    ).toBe(true);
    expect(
      isSubscriptionDeliveryEligible(
        "repo",
        [
          {
            repositoryId: "repo",
            deliveredAt: "2026-07-12T00:00:00.000Z",
            majorUpdateKey: "v1",
          },
        ],
        now,
        "v2",
      ),
    ).toBe(true);
  });
});
