import { describe, expect, it } from "vitest";

import { DEMO_REPOSITORIES } from "@/data/demo-repositories";
import { searchRepositories } from "@/search/service";
import { profile } from "../fixtures";

describe("search retrieval and ranking", () => {
  it("finds non-literal repositories for Chinese requirements", async () => {
    const response = await searchRepositories({
      query: "量子力学波函数可视化网站",
      profile: profile(),
      repositories: DEMO_REPOSITORIES,
    });
    expect(
      response.results
        .slice(0, 10)
        .some((item) => item.repository.fullName === "qmsolve/qmsolve"),
    ).toBe(true);
    expect(response.intent.generatedTerms).toContain("wavefunction");
    expect(
      new Set(
        response.results.slice(0, 10).map((item) => item.repository.cluster),
      ).size,
    ).toBeGreaterThanOrEqual(3);
  });

  it("applies explicit language constraints and negative preferences", async () => {
    const response = await searchRepositories({
      query: "TypeScript 自托管知识库",
      profile: profile({ blockedOrganizations: ["outline"] }),
      repositories: DEMO_REPOSITORIES,
    });
    const outline = response.results.find(
      (item) => item.repository.owner === "outline",
    );
    expect(outline).toBeUndefined();
    expect(
      response.results.some(
        (item) =>
          item.repository.language === "TypeScript" ||
          item.repository.languages.includes("TypeScript"),
      ),
    ).toBe(true);
  });

  it("treats an excluded language as an exact constraint instead of a substring", async () => {
    const response = await searchRepositories({
      query: "自托管并支持 Markdown 的个人知识库，不要 Java",
      profile: profile(),
      repositories: DEMO_REPOSITORIES,
    });
    expect(response.intent.languages).not.toContain("Java");
    expect(
      response.results.some(
        (item) => item.repository.fullName === "laurent22/joplin",
      ),
    ).toBe(true);
    expect(
      response.results.some((item) => item.repository.language === "Java"),
    ).toBe(false);
  });

  it("stores feature decomposition and evidence-backed explanations", async () => {
    const response = await searchRepositories({
      query: "WebGPU 科学计算",
      profile: profile(),
      repositories: DEMO_REPOSITORIES,
    });
    const first = response.results[0]!;
    expect(first.features.semantic).toBeGreaterThanOrEqual(0);
    expect(first.retrievalSources.length).toBeGreaterThan(0);
    if (!first.explanation.includes("证据只支持弱相关")) {
      expect(first.explanationEvidence.length).toBeGreaterThan(0);
      expect(
        first.explanationEvidence.every(
          (evidence) => evidence.source.length > 0,
        ),
      ).toBe(true);
    }
  });

  it("reuses an identical personalized search pipeline without reusing session ids", async () => {
    const input = {
      query: "cross-platform mobile UI framework cache probe",
      profile: profile({
        longTerm: { mobile: 2 },
        shortTerm: {},
      }),
      repositories: DEMO_REPOSITORIES,
    };
    const first = await searchRepositories(input);
    const second = await searchRepositories(input);
    expect(first.timing.cacheHit).toBe(false);
    expect(second.timing.cacheHit).toBe(true);
    expect(second.id).not.toBe(first.id);
    expect(second.results.map((item) => item.repository.id)).toEqual(
      first.results.map((item) => item.repository.id),
    );
  });
});
