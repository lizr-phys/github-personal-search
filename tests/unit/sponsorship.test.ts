import { describe, expect, it } from "vitest";

import { DEMO_REPOSITORIES } from "@/data/demo-repositories";
import { feedRanker } from "@/recommendation/ranking";
import {
  mergeSponsoredSlot,
  rankSponsoredCandidates,
} from "@/sponsorship/policy";
import { profile } from "../fixtures";

describe("isolated sponsorship policy", () => {
  const natural = feedRanker.selectBatch(
    feedRanker.rank(DEMO_REPOSITORIES, profile(), []),
    10,
  );
  const candidate = {
    campaignId: "campaign-test",
    repository: DEMO_REPOSITORIES[20]!,
    relevance: 0.8,
    quality: 0.9,
    safetyApproved: true,
    commercialScore: 1,
    evidence: DEMO_REPOSITORIES[20]!.evidence,
  };

  it("feature flag off returns the natural list byte-for-byte", () => {
    const merged = mergeSponsoredSlot(
      natural,
      rankSponsoredCandidates([candidate], {
        enabled: false,
        maxPerBatch: 1,
        minimumRelevance: 0.65,
        minimumQuality: 0.75,
      }),
      {
        enabled: false,
        maxPerBatch: 1,
        minimumRelevance: 0.65,
        minimumQuality: 0.75,
      },
    );
    expect(merged).toEqual(natural);
  });

  it("requires safety, relevance and quality and limits a batch to one", () => {
    const policy = {
      enabled: true,
      maxPerBatch: 3,
      minimumRelevance: 0.65,
      minimumQuality: 0.75,
    };
    const ranked = rankSponsoredCandidates(
      [
        candidate,
        {
          ...candidate,
          campaignId: "unsafe",
          repository: DEMO_REPOSITORIES[21]!,
          safetyApproved: false,
        },
      ],
      policy,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.candidateType).toBe("sponsored");
    expect(ranked[0]!.explanation).toContain("赞助项目");
  });

  it("immediate block removes a sponsored candidate without changing natural order", () => {
    const policy = {
      enabled: true,
      maxPerBatch: 1,
      minimumRelevance: 0.65,
      minimumQuality: 0.75,
      blockedRepositoryIds: [candidate.repository.id],
    };
    expect(rankSponsoredCandidates([candidate], policy)).toEqual([]);
    expect(mergeSponsoredSlot(natural, [], policy)).toEqual(natural);
  });
});
