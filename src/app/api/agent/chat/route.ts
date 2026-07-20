import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { runSiteAgent } from "@/ai/deepseek";
import { apiError } from "@/server/http";
import { getSession } from "@/server/session";
import { hasValidOrigin } from "@/server/security/csrf";
import { checkRateLimit } from "@/server/security/rate-limit";
import { runtimeStore } from "@/server/runtime/store";

const AgentRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1_200),
      }),
    )
    .min(1)
    .max(12),
  locale: z.enum(["zh", "en"]).default("zh"),
  currentPath: z.string().startsWith("/").max(300).default("/"),
});

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request))
    return NextResponse.json(
      { error: { code: "ORIGIN", message: "Origin mismatch" } },
      { status: 403 },
    );
  const session = getSession(request);
  const rate = checkRateLimit(`agent:${session.sessionId}`, 16, 60_000);
  if (!rate.allowed)
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT",
          message: "对话请求过于频繁，请稍后再试。",
        },
      },
      { status: 429 },
    );
  try {
    const input = AgentRequestSchema.parse(await request.json());
    const state = await runtimeStore.read();
    const interests = session.userId
      ? Object.entries(state.profile.longTerm)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 5)
          .map(([term]) => term)
      : [];
    const response = await runSiteAgent({
      ...input,
      context: `Available areas: recommendations, natural-language search, project details, library, trends, subscriptions, interests, settings. Current interests: ${interests.join(", ") || "not initialized"}. The agent may only suggest navigation or searches.`,
    });
    await runtimeStore.mutate((draft) => {
      draft.metrics.aiCalls = (draft.metrics.aiCalls ?? 0) + 1;
      if (response.provider === "local")
        draft.metrics.aiFallbacks = (draft.metrics.aiFallbacks ?? 0) + 1;
    });
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "对话内容无效。" } },
        { status: 400 },
      );
    return apiError(error, "AGENT_FAILED");
  }
}
