import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { buildEmailPreview } from "@/server/services/subscription-service";

const PreviewSchema = z.object({
  subscriptionId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    const body = PreviewSchema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await buildEmailPreview(body.subscriptionId));
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "邮件预览参数无效。" } },
        { status: 400 },
      );
    return apiError(error, "MAIL_PREVIEW_FAILED");
  }
}
