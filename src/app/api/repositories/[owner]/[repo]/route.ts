import { NextResponse, type NextRequest } from "next/server";

import {
  findRepositoryByFullName,
  getRepositoryCatalog,
} from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import { isRecommendationEligible } from "@/recommendation/quality-policy";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await context.params;
  const [repository, catalog] = await Promise.all([
    findRepositoryByFullName(owner, repo),
    getRepositoryCatalog(),
  ]);
  if (!repository)
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到该项目。" } },
      { status: 404 },
    );
  const state = await runtimeStore.read();
  const relatedIds = new Set(repository.similar);
  const related = catalog.repositories
    .filter(
      (candidate) =>
        isRecommendationEligible(candidate) &&
        candidate.id !== repository.id &&
        (relatedIds.has(candidate.id) ||
          candidate.domains.some((domain) =>
            repository.domains.includes(domain),
          )),
    )
    .slice(0, 4);
  const library = state.library.find(
    (item) => item.repositoryId === repository.id,
  );
  return NextResponse.json({
    repository,
    related,
    library,
    demo: repository.dataSource === "demo",
    evidencePolicy:
      repository.dataSource === "github"
        ? "结论来自 GitHub 元数据、Topic、README 提取内容与实际行为；无证据字段显示信息不足。"
        : "所有结论来自演示元数据、Topic 或 README 提取式摘要。",
  });
}
