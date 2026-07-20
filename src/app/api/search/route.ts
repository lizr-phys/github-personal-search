import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { SearchIntentSchema } from "@/domain/types";
import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { checkRateLimit } from "@/server/security/rate-limit";
import { executeSearch } from "@/server/services/search-service";

const SearchSchema = z.object({
  query: z.string().trim().min(1).max(300),
  mode: z
    .enum(["comprehensive", "precise", "inspiration", "latest"])
    .default("comprehensive"),
  affectsProfile: z.boolean().default(true),
  intentOverride: SearchIntentSchema.optional(),
});

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  const rate = checkRateLimit(`search:${user.userId}`, 30, 60_000);
  if (!rate.allowed)
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT",
          message: "搜索请求过于频繁。",
          resetAt: rate.resetAt,
        },
      },
      { status: 429 },
    );
  try {
    const input = SearchSchema.parse(await request.json());
    const result = await executeSearch(input);
    return NextResponse.json(
      { ...result, demo: result.catalog.mode === "demo" },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Server-Timing": `search;dur=${result.timing.totalMs}`,
        },
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "搜索条件无效。",
            issues: error.issues,
          },
        },
        { status: 400 },
      );
    return apiError(error, "SEARCH_FAILED");
  }
}
