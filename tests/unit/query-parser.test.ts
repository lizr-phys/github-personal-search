import { describe, expect, it } from "vitest";

import { queryParser } from "@/search/query-parser";

describe("RuleQueryParser", () => {
  it("expands a Chinese physics query into English technical concepts", () => {
    const intent = queryParser.parse("量子力学波函数可视化网站");
    expect(intent.domains).toEqual(
      expect.arrayContaining(["quantum", "physics-education"]),
    );
    expect(intent.generatedTerms).toEqual(
      expect.arrayContaining([
        "wavefunction",
        "quantum mechanics",
        "scientific visualization",
      ]),
    );
    expect(intent.platforms).toContain("web");
  });

  it("parses technologies, deployment, language and negative constraints", () => {
    const intent = queryParser.parse(
      "自托管 TypeScript 知识库，支持 PDF 和 Markdown，排除归档项目",
    );
    expect(intent.deployment).toContain("self-hosted");
    expect(intent.languages).toContain("TypeScript");
    expect(intent.technologies).toEqual(
      expect.arrayContaining(["Docker", "Markdown"]),
    );
    expect(intent.negativeConstraints).toContain("archived");
  });

  it("understands English natural-language intent", () => {
    const intent = queryParser.parse(
      "extensible WebGPU framework for scientific computing, not Java",
    );
    expect(intent.domains).toEqual(
      expect.arrayContaining(["webgpu", "scientific-computing"]),
    );
    expect(intent.technologies).toEqual(
      expect.arrayContaining(["WebGPU", "WGSL"]),
    );
    expect(intent.negativeConstraints.join(" ")).toMatch(/java/i);
    expect(intent.languages).not.toContain("Java");
  });

  it("does not confuse an application-security domain with an application project type", () => {
    const intent = queryParser.parse(
      "web application security cheat sheets and secure coding guide",
    );
    expect(intent.domains).toContain("security");
    expect(intent.domains).not.toContain("education");
    expect(intent.projectTypes).not.toContain("application");
  });
});
