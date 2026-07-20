import { describe, expect, it } from "vitest";

import { trendCalculator, type TrendInput } from "@/trends/calculator";

const group: TrendInput[] = [
  {
    id: "new-fast",
    starsDelta: 140,
    forksDelta: 18,
    commitsDelta: 40,
    issuesPrsDelta: 22,
    releaseSignal: 1,
    ageDays: 40,
  },
  {
    id: "old-large",
    starsDelta: 160,
    forksDelta: 20,
    commitsDelta: 18,
    issuesPrsDelta: 10,
    releaseSignal: 0,
    ageDays: 3200,
  },
  {
    id: "steady",
    starsDelta: 30,
    forksDelta: 4,
    commitsDelta: 15,
    issuesPrsDelta: 8,
    releaseSignal: 0,
    ageDays: 600,
  },
];

describe("trend calculator", () => {
  it("is deterministic for 1/7/30-day snapshot deltas", () => {
    expect(trendCalculator.calculate(group)).toEqual(
      trendCalculator.calculate(structuredClone(group)),
    );
  });

  it("age-normalizes new repository growth", () => {
    const scores = trendCalculator.calculate(group);
    expect(scores.find((item) => item.id === "new-fast")!.heat).toBeGreaterThan(
      scores.find((item) => item.id === "old-large")!.heat,
    );
  });

  it("handles zero-variance groups", () => {
    const input = group.map((item) => ({
      ...item,
      starsDelta: 0,
      forksDelta: 0,
      commitsDelta: 0,
      issuesPrsDelta: 0,
    }));
    expect(
      trendCalculator
        .calculate(input)
        .every((item) => Number.isFinite(item.heat)),
    ).toBe(true);
  });
});
