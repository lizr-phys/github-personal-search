import { beforeEach, describe, expect, it } from "vitest";

import type { GitHubRepository } from "@/github/client";
import {
  mapGitHubRepository,
  storeGitHubRepositories,
} from "@/github/repository-sync";
import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import { executeSearch } from "@/server/services/search-service";

const raw: GitHubRepository = {
  id: 987654,
  name: "live-wave",
  full_name: "gps-test/live-wave",
  owner: { login: "gps-test" },
  html_url: "https://github.com/gps-test/live-wave",
  homepage: "https://example.test/live-wave",
  description: "gpsliveunique WebGPU scientific visualization toolkit",
  language: "TypeScript",
  topics: ["webgpu", "visualization", "scientific-computing"],
  stargazers_count: 100,
  forks_count: 12,
  open_issues_count: 3,
  archived: false,
  fork: false,
  pushed_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_at: "2025-01-01T00:00:00.000Z",
  license: { spdx_id: "MIT" },
  size: 1200,
};

describe("real GitHub repository index", () => {
  beforeEach(async () => runtimeStore.reset());

  it("maps evidence, stores a real repository and makes it searchable", async () => {
    const repository = mapGitHubRepository(raw, {
      readme:
        "# Live Wave\nA browser toolkit for interactive WebGPU scientific visualization.\n- Render simulation fields\n- Export interactive scenes",
      languages: ["TypeScript", "WGSL"],
    });
    await storeGitHubRepositories([repository], "public");
    const catalog = await getRepositoryCatalog();
    expect(catalog.mode).toBe("hybrid");
    expect(catalog.githubCount).toBe(1);
    expect(catalog.repositories[0]!.dataSource).toBe("github");
    expect(catalog.repositories[0]!.hasReadme).toBe(true);
    const search = await executeSearch({
      query: "gpsliveunique WebGPU",
      mode: "comprehensive",
      affectsProfile: false,
    });
    expect(
      search.results.some((item) => item.repository.fullName === raw.full_name),
    ).toBe(true);
    expect(search.catalog.githubCount).toBe(1);
  });

  it("derives growth from stored snapshots instead of total stars", async () => {
    await storeGitHubRepositories([mapGitHubRepository(raw)], "public");
    const previous = (await runtimeStore.read()).repositorySnapshots.filter(
      (item) => item.repositoryId === `github-${raw.id}`,
    );
    const updated = mapGitHubRepository(
      { ...raw, stargazers_count: 121, forks_count: 15 },
      { previous },
    );
    expect(updated.trend7d.stars).toBe(21);
    expect(updated.trend7d.forks).toBe(3);
  });

  it("does not classify arbitrary words containing ai as an AI agent", () => {
    const repository = mapGitHubRepository({
      ...raw,
      id: 987655,
      name: "quantum-toolkit",
      full_name: "gps-test/quantum-toolkit",
      html_url: "https://github.com/gps-test/quantum-toolkit",
      description: "A maintained numerical library for quantum dynamics",
      topics: ["quantum", "numerical"],
      language: "Python",
    });
    expect(repository.domains).toContain("scientific-computing");
    expect(repository.domains).not.toContain("ai-agent");
  });
});
