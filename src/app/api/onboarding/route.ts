import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { completeOnboarding } from "@/server/services/onboarding-service";
import { isRecommendationEligible } from "@/recommendation/quality-policy";

const OnboardingSchema = z.object({
  interests: z.array(z.string().min(1).max(60)).min(2).max(8),
  languages: z.array(z.string().min(1).max(30)).min(1).max(8),
  difficulty: z.enum(["beginner", "medium", "advanced"]),
  seedRepositories: z.array(z.string()).max(5).default([]),
  feedback: z
    .array(
      z.object({
        repositoryId: z.string(),
        type: z.enum(["interested", "not_interested", "seen", "learn"]),
      }),
    )
    .min(10)
    .max(20),
});

export async function GET() {
  const catalog = await getRepositoryCatalog();
  const qualified = catalog.repositories
    .filter(isRecommendationEligible)
    .sort(
      (left, right) =>
        Number(right.dataSource === "demo") -
          Number(left.dataSource === "demo") ||
        right.quality - left.quality ||
        left.id.localeCompare(right.id),
    );
  const seedDomains = [
    "web-development",
    "developer-tools",
    "machine-learning",
    "data-engineering",
    "database",
    "devops",
    "mobile",
    "game-development",
    "security",
    "self-hosted",
    "knowledge-base",
    "scientific-computing",
  ];
  const diverseSeeds = seedDomains
    .map((domain) =>
      qualified.find(
        (item) => item.domains.includes(domain) || item.topics.includes(domain),
      ),
    )
    .filter(
      (item, index, items): item is (typeof qualified)[number] =>
        item !== undefined &&
        items.findIndex((candidate) => candidate?.id === item.id) === index,
    );
  const selectedIds = new Set(diverseSeeds.map((item) => item.id));
  const seedRepositories = [
    ...diverseSeeds,
    ...qualified.filter((item) => !selectedIds.has(item.id)),
  ].slice(0, 12);
  return NextResponse.json({
    interests: [
      { id: "web-development", label: "Web 与前端" },
      { id: "developer-tools", label: "开发工具" },
      { id: "machine-learning", label: "AI 与机器学习" },
      { id: "data-engineering", label: "数据与分析" },
      { id: "devops", label: "云与运维" },
      { id: "self-hosted", label: "自托管服务" },
      { id: "knowledge-base", label: "知识与效率" },
      { id: "mobile", label: "移动开发" },
      { id: "game-development", label: "游戏与图形" },
      { id: "security", label: "安全" },
      { id: "education", label: "学习与教育" },
      { id: "scientific-computing", label: "科学与工程" },
    ],
    languages: [
      "TypeScript",
      "Python",
      "Go",
      "Rust",
      "JavaScript",
      "Java",
      "C++",
      "Dart",
    ],
    seeds: seedRepositories.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      title: item.chineseTitle,
      cluster: item.cluster,
      dataSource: item.dataSource,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    const input = OnboardingSchema.parse(await request.json());
    const profile = await completeOnboarding({
      ...input,
      sessionId: user.sessionId,
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "兴趣初始化信息不完整。",
            issues: error.issues,
          },
        },
        { status: 400 },
      );
    return apiError(error);
  }
}
