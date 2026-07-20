import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import {
  removeLibraryEntry,
  updateLibraryEntry,
} from "@/server/services/library-service";

const LibrarySchema = z.object({
  status: z
    .enum([
      "read_later",
      "learning",
      "ran",
      "reproduced",
      "used",
      "paused",
      "outdated",
    ])
    .optional(),
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
  note: z.string().max(10_000).optional(),
  collectionId: z.string().max(100).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ repositoryId: string }> },
) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    const entry = await updateLibraryEntry(
      (await context.params).repositoryId,
      LibrarySchema.parse(await request.json()),
    );
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "知识库字段无效。",
            issues: error.issues,
          },
        },
        { status: 400 },
      );
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ repositoryId: string }> },
) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  const removed = await removeLibraryEntry((await context.params).repositoryId);
  return NextResponse.json({ ok: removed });
}
