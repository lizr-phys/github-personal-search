import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { INTERACTION_WEIGHTS } from "@/config/algorithms";
import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { recordInteraction } from "@/server/services/interaction-service";

const InteractionSchema = z.object({
  repositoryId: z.string().min(1).max(200),
  type: z.enum(
    Object.keys(INTERACTION_WEIGHTS) as [
      keyof typeof INTERACTION_WEIGHTS,
      ...(keyof typeof INTERACTION_WEIGHTS)[],
    ],
  ),
  reason: z.string().max(300).optional(),
  surface: z
    .enum(["feed", "search", "repository", "library", "email"])
    .default("feed"),
});

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    const input = InteractionSchema.parse(await request.json());
    const interaction = await recordInteraction({
      ...input,
      sessionId: user.sessionId,
    });
    return NextResponse.json({ ok: true, interaction });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "反馈参数无效。",
            issues: error.issues,
          },
        },
        { status: 400 },
      );
    return apiError(error, "INTERACTION_FAILED");
  }
}
