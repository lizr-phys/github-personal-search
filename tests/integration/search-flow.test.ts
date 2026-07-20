import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_REPOSITORIES } from "@/data/demo-repositories";
import { runtimeStore } from "@/server/runtime/store";
import { completeOnboarding } from "@/server/services/onboarding-service";
import { executeSearch } from "@/server/services/search-service";
import { onboardingFeedback } from "../fixtures";

describe("project indexing and search flow", () => {
  beforeEach(async () => {
    await runtimeStore.reset();
    await completeOnboarding({
      interests: ["scientific-computing", "visualization"],
      languages: ["TypeScript", "Python"],
      difficulty: "medium",
      seedRepositories: [DEMO_REPOSITORIES[0]!.id],
      feedback: onboardingFeedback,
      sessionId: "integration",
    });
  });

  it("retrieves, ranks and clusters the local project index", async () => {
    const result = await executeSearch({
      query: "用 WebGPU 做科学计算或物理模拟",
      mode: "comprehensive",
      affectsProfile: true,
    });
    expect(result.results.length).toBeGreaterThanOrEqual(10);
    expect(result.clusters.length).toBeGreaterThanOrEqual(3);
    expect(
      result.results.some(
        (item) => item.repository.fullName === "webgpu/webgpu-samples",
      ),
    ).toBe(true);
    const state = await runtimeStore.read();
    expect(state.searches).toHaveLength(1);
    expect(state.profile.shortTerm.webgpu).toBeGreaterThan(0);
  });

  it("does not pollute the profile for a temporary search", async () => {
    const before = (await runtimeStore.read()).profile.shortTerm;
    await executeSearch({
      query: "个人预算工具",
      mode: "precise",
      affectsProfile: false,
    });
    expect((await runtimeStore.read()).profile.shortTerm).toEqual(before);
  });
});
