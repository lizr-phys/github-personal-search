import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_REPOSITORIES } from "@/data/demo-repositories";
import { queryParser } from "@/search/query-parser";
import { runtimeStore } from "@/server/runtime/store";
import { completeOnboarding } from "@/server/services/onboarding-service";
import {
  buildEmailPreview,
  createSubscription,
} from "@/server/services/subscription-service";
import { onboardingFeedback } from "../fixtures";

describe("semantic subscription email flow", () => {
  beforeEach(async () => {
    await runtimeStore.reset();
    await completeOnboarding({
      interests: ["scientific-computing", "visualization"],
      languages: ["TypeScript", "Python"],
      difficulty: "medium",
      seedRepositories: [DEMO_REPOSITORIES[0]!.id],
      feedback: onboardingFeedback,
      sessionId: "mail",
    });
  });

  it("creates an evidence-filtered local email preview", async () => {
    const query = "科学计算与交互式可视化";
    const subscription = await createSubscription({
      name: "科学可视化周报",
      rawQuery: query,
      intent: queryParser.parse(query),
      frequency: "weekly",
      minRelevance: 0.2,
      minQuality: 0.7,
      heatThreshold: 0,
    });
    const preview = await buildEmailPreview(subscription.id);
    expect(preview.skipped).toBe(false);
    expect(preview.email.repositoryIds.length).toBeGreaterThanOrEqual(5);
    expect(preview.email.repositoryIds.length).toBeLessThanOrEqual(10);
    expect(preview.email.html).toContain("新出现");
    expect(preview.email.html).toContain("/api/mail/feedback?token=");
    expect(preview.email.html).toContain("不相关");
    expect(preview.email.html).toContain("独立第三方项目");
  });
});
