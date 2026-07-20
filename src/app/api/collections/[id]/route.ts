import { NextResponse, type NextRequest } from "next/server";

import { isResponse, requireMutation, requireUser } from "@/server/http";
import { deleteCollection } from "@/server/services/library-service";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  const removed = await deleteCollection((await context.params).id);
  return NextResponse.json({ ok: removed }, { status: removed ? 200 : 404 });
}
