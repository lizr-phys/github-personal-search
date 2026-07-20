import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { runtimeStore } from "@/server/runtime/store";
import { createCollection } from "@/server/services/library-service";

const CollectionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional(),
});

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  return NextResponse.json({
    collections: (await runtimeStore.read()).collections,
  });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    return NextResponse.json(
      {
        collection: await createCollection(
          CollectionSchema.parse(await request.json()),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "合集字段无效。",
            issues: error.issues,
          },
        },
        { status: 400 },
      );
    return apiError(error, "COLLECTION_CREATE_FAILED", 400);
  }
}
