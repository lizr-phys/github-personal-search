import { NextResponse, type NextRequest } from "next/server";

import { apiError, isResponse, requireUser } from "@/server/http";
import { getFeedBatch } from "@/server/services/feed-service";
import { checkRateLimit } from "@/server/security/rate-limit";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rate = checkRateLimit(`feed:${user.userId}`, 60, 60_000);
  if (!rate.allowed)
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT",
          message: "请求过于频繁，请稍后再试。",
          resetAt: rate.resetAt,
        },
      },
      { status: 429 },
    );
  const batchNumber = Math.max(
    0,
    Math.min(
      4,
      Number.parseInt(request.nextUrl.searchParams.get("batch") ?? "0", 10) ||
        0,
    ),
  );
  try {
    const result = await getFeedBatch(user.sessionId, batchNumber);
    if (result.code === "ONBOARDING_REQUIRED")
      return NextResponse.json(
        { error: { code: result.code, message: "请先完成兴趣初始化。" } },
        { status: 409 },
      );
    return NextResponse.json(
      {
        ...result,
        demo: result.catalog.mode === "demo",
        dataFreshness:
          result.catalog.mode === "demo"
            ? "演示快照：2026-07-18"
            : `GitHub 实时索引 ${result.catalog.githubCount} 个 · 演示补充 ${result.catalog.demoCount} 个`,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Server-Timing": `feed;dur=1`,
        },
      },
    );
  } catch (error) {
    return apiError(error, "FEED_FAILED");
  }
}
