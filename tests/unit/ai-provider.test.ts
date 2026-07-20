import { describe, expect, it } from "vitest";

import {
  filterAgentActions,
  generateRepositoryBrief,
  runSiteAgent,
} from "@/ai/deepseek";
import { DEMO_REPOSITORIES } from "@/data/demo-repositories";

describe("evidence-grounded AI fallbacks", () => {
  it("keeps repository briefs in the requested language without a provider key", async () => {
    const repository = DEMO_REPOSITORIES[0]!;
    const chinese = await generateRepositoryBrief(repository, "zh");
    const english = await generateRepositoryBrief(repository, "en");

    expect(chinese.provider).toBe("local");
    expect(chinese.overview).toMatch(/[\u4e00-\u9fff]/);
    expect(english.provider).toBe("local");
    expect(english.overview).not.toMatch(/[\u4e00-\u9fff]/);
    expect(english.overview).toContain(repository.fullName);
    expect(english.confidence).toBeLessThanOrEqual(0.8);
  });

  it("provides a usable site-agent fallback when the external provider is absent", async () => {
    const result = await runSiteAgent({
      messages: [
        {
          role: "user",
          content: "找一个可以自托管、支持 Markdown 的知识库",
        },
      ],
      locale: "zh",
      currentPath: "/",
      context: "Search and library are available.",
    });

    expect(result.provider).toBe("local");
    expect(result.actions[0]?.href).toMatch(/^\/search\?q=/);
    expect(result.reply).toMatch(/[\u4e00-\u9fff]/);
  });

  it("turns a short Agent-building request into a useful expanded search", async () => {
    const result = await runSiteAgent({
      messages: [{ role: "user", content: "我想做一个 agent" }],
      locale: "zh",
      currentPath: "/",
      context: "Search and trends are available.",
    });

    expect(result.model).toBe("gps-agent-rules-v2");
    expect(result.reply).toContain("三条可比较路线");
    expect(decodeURIComponent(result.actions[0]?.href ?? "")).toContain(
      "工具调用",
    );
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/trends" }),
      ]),
    );
  });

  it("routes a direct rising-project request to trends instead of echoing help", async () => {
    const result = await runSiteAgent({
      messages: [
        { role: "user", content: "带我查看最近 7 天快速上升的高质量项目" },
      ],
      locale: "zh",
      currentPath: "/",
      context: "Trends are available.",
    });

    expect(result.actions[0]?.href).toBe("/trends");
    expect(result.reply).toContain("7 日");
  });

  it("rejects external and lookalike paths from model-proposed actions", () => {
    expect(
      filterAgentActions([
        { type: "navigate", label: "Home", href: "/" },
        { type: "search", label: "Search", href: "/search?q=rust" },
        { type: "navigate", label: "Unsafe", href: "/settings-evil" },
        { type: "navigate", label: "Unsafe", href: "/api/secrets" },
      ]),
    ).toEqual([
      { type: "navigate", label: "Home", href: "/" },
      { type: "search", label: "Search", href: "/search?q=rust" },
    ]);
  });
});
