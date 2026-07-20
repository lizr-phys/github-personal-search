import { NextResponse } from "next/server";

import { getRepositoryCatalog } from "@/server/repositories/catalog";

export async function GET() {
  const catalog = await getRepositoryCatalog();
  return NextResponse.json({
    status: "ok",
    mode: catalog.mode,
    repositories: catalog.repositories.length,
    githubRepositories: catalog.githubCount,
    demoRepositories: catalog.demoCount,
    dataUpdatedAt: catalog.dataUpdatedAt,
    timestamp: new Date().toISOString(),
  });
}
