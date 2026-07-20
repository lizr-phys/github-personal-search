import { describe, expect, it } from "vitest";

import { DEMO_REPOSITORIES } from "@/data/demo-repositories";
import { queryParser } from "@/search/query-parser";
import { repositorySatisfiesHardConstraints } from "@/search/ranking";
import { searchRepositories } from "@/search/service";
import { profile } from "../fixtures";

describe("search robustness and deterministic degradation", () => {
  it("normalizes common spelling errors and records confidence", () => {
    const intent = queryParser.parse("webgup comput shder examples");
    expect(intent.normalizedQuery).toBe("webgpu compute shader examples");
    expect(intent.corrections).toHaveLength(3);
    expect(intent.confidence?.overall).toBeGreaterThanOrEqual(0.7);
  });

  it("returns the intended WebGPU route for a typo query", async () => {
    const response = await searchRepositories({
      query: "webgup comput shder examples",
      profile: profile(),
      repositories: DEMO_REPOSITORIES,
    });
    expect(response.results[0]?.repository.id).toBe("webgpu-webgpu-samples");
  });

  it("does not pad an impossible hard-constrained query", async () => {
    const response = await searchRepositories({
      query: "COBOL quantum mobile game engine for Palm OS",
      profile: profile(),
      repositories: DEMO_REPOSITORIES,
    });
    expect(response.results).toEqual([]);
  });

  it("never lets blocked or explicit constraints through final ranking", async () => {
    const currentProfile = profile({ blockedOrganizations: ["outline"] });
    const response = await searchRepositories({
      query: "TypeScript self-hosted knowledge base，不要 React",
      mode: "precise",
      profile: currentProfile,
      repositories: DEMO_REPOSITORIES,
    });
    expect(
      response.results.every((item) =>
        repositorySatisfiesHardConstraints(
          item.repository,
          response.intent,
          currentProfile,
        ),
      ),
    ).toBe(true);
  });

  it("works without external LLM or embedding credentials", async () => {
    const previousLlm = process.env.LLM_API_KEY;
    const previousEmbedding = process.env.EMBEDDING_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.EMBEDDING_API_KEY;
    const response = await searchRepositories({
      query: "自托管 RSS 阅读器",
      profile: profile(),
      repositories: DEMO_REPOSITORIES,
    });
    expect(response.semanticMode).toBe("local");
    expect(
      response.results.some((item) => item.repository.id === "miniflux-v2"),
    ).toBe(true);
    if (previousLlm) process.env.LLM_API_KEY = previousLlm;
    if (previousEmbedding) process.env.EMBEDDING_API_KEY = previousEmbedding;
  });
});
