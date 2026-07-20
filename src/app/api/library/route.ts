import { NextResponse, type NextRequest } from "next/server";

import { isResponse, requireUser } from "@/server/http";
import { getLibrary } from "@/server/services/library-service";
import { runtimeStore } from "@/server/runtime/store";
import { getRepositoryCatalog } from "@/server/repositories/catalog";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const [items, state, catalog] = await Promise.all([
    getLibrary(query),
    runtimeStore.read(),
    getRepositoryCatalog(),
  ]);
  const repositoryById = new Map(
    catalog.repositories.map((item) => [item.id, item]),
  );
  return NextResponse.json({
    items,
    collections: state.collections,
    learningLogs: state.learningLogs
      .slice(-20)
      .reverse()
      .map((item) => ({
        ...item,
        repository: repositoryById.get(item.repositoryId),
      })),
    history: state.exposures
      .slice(-30)
      .reverse()
      .map((item) => ({
        ...item,
        repository: repositoryById.get(item.repositoryId),
      })),
    relations: state.relations.map((item) => ({
      ...item,
      fromRepository: repositoryById.get(item.fromRepositoryId),
      toRepository: repositoryById.get(item.toRepositoryId),
    })),
  });
}
