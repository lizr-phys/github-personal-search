import {
  DEMO_REPOSITORIES,
  DEMO_SNAPSHOT_DATE,
} from "@/data/demo-repositories";
import type { Repository } from "@/domain/types";
import { runtimeStore } from "@/server/runtime/store";

export type RepositoryCatalog = {
  repositories: Repository[];
  githubCount: number;
  demoCount: number;
  dataUpdatedAt: string;
  mode: "demo" | "hybrid" | "github";
};

export async function getRepositoryCatalog(): Promise<RepositoryCatalog> {
  const state = await runtimeStore.read();
  const liveByName = new Map(
    state.repositories.map((repository) => [
      repository.fullName.toLowerCase(),
      repository,
    ]),
  );
  const includeDemoFallback =
    process.env.GPS_DEMO_FALLBACK !== "false" || liveByName.size < 30;
  const repositories = [
    ...liveByName.values(),
    ...(includeDemoFallback
      ? DEMO_REPOSITORIES.filter(
          (repository) => !liveByName.has(repository.fullName.toLowerCase()),
        )
      : []),
  ];
  const latestLive = state.repositories.reduce(
    (latest, repository) =>
      repository.dataUpdatedAt > latest ? repository.dataUpdatedAt : latest,
    "",
  );
  return {
    repositories,
    githubCount: state.repositories.length,
    demoCount: repositories.filter(
      (repository) => repository.dataSource === "demo",
    ).length,
    dataUpdatedAt: latestLive || DEMO_SNAPSHOT_DATE,
    mode: state.repositories.length
      ? includeDemoFallback
        ? "hybrid"
        : "github"
      : "demo",
  };
}

export async function findRepositoryById(
  id: string,
): Promise<Repository | undefined> {
  return (await getRepositoryCatalog()).repositories.find(
    (repository) => repository.id === id,
  );
}

export async function findRepositoryByFullName(
  owner: string,
  name: string,
): Promise<Repository | undefined> {
  const fullName = `${owner}/${name}`.toLowerCase();
  return (await getRepositoryCatalog()).repositories.find(
    (repository) => repository.fullName.toLowerCase() === fullName,
  );
}
