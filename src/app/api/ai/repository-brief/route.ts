import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { generateRepositoryBrief } from "@/ai/deepseek";
import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { findRepositoryById } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import { checkRateLimit } from "@/server/security/rate-limit";

const BriefRequestSchema = z.object({
  repositoryId: z.string().min(1).max(180),
  locale: z.enum(["zh", "en"]).default("zh"),
});

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  // A complete 10-project batch plus detail transitions can legitimately
  // request more than 20 localized briefs during React development replays.
  const rate = checkRateLimit(`ai-brief:${user.userId}`, 60, 60_000);
  if (!rate.allowed)
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "AI 简介请求过于频繁。" } },
      { status: 429 },
    );
  try {
    const input = BriefRequestSchema.parse(await request.json());
    const repository = await findRepositoryById(input.repositoryId);
    if (!repository)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "未找到该项目。" } },
        { status: 404 },
      );
    const brief = await generateRepositoryBrief(repository, input.locale);
    await runtimeStore.mutate((state) => {
      state.metrics.aiCalls = (state.metrics.aiCalls ?? 0) + 1;
      if (brief.provider === "local")
        state.metrics.aiFallbacks = (state.metrics.aiFallbacks ?? 0) + 1;
    });
    return NextResponse.json(brief, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "AI 简介参数无效。" } },
        { status: 400 },
      );
    return apiError(error, "AI_BRIEF_FAILED");
  }
}
