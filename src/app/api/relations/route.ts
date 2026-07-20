import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import {
  deleteRepositoryRelation,
  saveRepositoryRelation,
} from "@/server/services/library-service";

const RelationSchema = z.object({
  fromRepositoryId: z.string().min(1).max(200),
  toRepositoryId: z.string().min(1).max(200),
  type: z.enum([
    "similar",
    "alternative",
    "depends_on",
    "extends",
    "inspired_by",
  ]),
  note: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const [state, catalog] = await Promise.all([
    runtimeStore.read(),
    getRepositoryCatalog(),
  ]);
  const repositoryById = new Map(
    catalog.repositories.map((item) => [item.id, item]),
  );
  return NextResponse.json({
    relations: state.relations.map((item) => ({
      ...item,
      fromRepository: repositoryById.get(item.fromRepositoryId),
      toRepository: repositoryById.get(item.toRepositoryId),
    })),
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
        relation: await saveRepositoryRelation(
          RelationSchema.parse(await request.json()),
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
            message: "项目关系字段无效。",
            issues: error.issues,
          },
        },
        { status: 400 },
      );
    return apiError(error, "RELATION_SAVE_FAILED", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    const removed = await deleteRepositoryRelation(
      RelationSchema.omit({ note: true }).parse(await request.json()),
    );
    return NextResponse.json({ ok: removed }, { status: removed ? 200 : 404 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "项目关系字段无效。",
            issues: error.issues,
          },
        },
        { status: 400 },
      );
    return apiError(error, "RELATION_DELETE_FAILED", 400);
  }
}
