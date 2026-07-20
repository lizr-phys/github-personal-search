import { NextResponse, type NextRequest } from "next/server";

import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { undoInteraction } from "@/server/services/interaction-service";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    const interaction = await undoInteraction((await context.params).id);
    if (!interaction)
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "反馈不存在或已经撤销。" } },
        { status: 404 },
      );
    return NextResponse.json({ ok: true, interaction });
  } catch (error) {
    return apiError(error, "UNDO_FAILED");
  }
}
