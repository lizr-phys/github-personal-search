import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import type { LibraryStatus } from "@/server/runtime/types";

export async function getLibrary(query = "") {
  const [state, catalog] = await Promise.all([
    runtimeStore.read(),
    getRepositoryCatalog(),
  ]);
  const normalized = query.toLowerCase().trim();
  return state.library.flatMap((entry) => {
    const repository = catalog.repositories.find(
      (item) => item.id === entry.repositoryId,
    );
    if (!repository) return [];
    const haystack = [
      repository.fullName,
      repository.chineseTitle,
      repository.summary,
      entry.note,
      ...entry.tags,
    ]
      .join(" ")
      .toLowerCase();
    if (normalized && !haystack.includes(normalized)) return [];
    return [{ ...entry, repository }];
  });
}

export async function updateLibraryEntry(
  repositoryId: string,
  input: {
    status?: LibraryStatus;
    tags?: string[];
    note?: string;
    collectionId?: string;
  },
) {
  const repository = (await getRepositoryCatalog()).repositories.find(
    (item) => item.id === repositoryId,
  );
  if (!repository) throw new Error("Repository not found");
  return runtimeStore.mutate((state) => {
    const now = new Date().toISOString();
    if (
      input.collectionId &&
      !state.collections.some((item) => item.id === input.collectionId)
    )
      throw new Error("Collection not found");
    let entry = state.library.find(
      (item) => item.repositoryId === repositoryId,
    );
    if (!entry) {
      entry = {
        repositoryId,
        collectionId: input.collectionId ?? "default",
        status: input.status ?? "read_later",
        tags: input.tags ?? [],
        note: input.note ?? "",
        addedAt: now,
        updatedAt: now,
      };
      state.library.push(entry);
    } else {
      if (input.status) entry.status = input.status;
      if (input.tags) entry.tags = [...new Set(input.tags)].slice(0, 10);
      if (input.note !== undefined) entry.note = input.note.slice(0, 10_000);
      if (input.collectionId) entry.collectionId = input.collectionId;
      entry.updatedAt = now;
    }
    if (
      input.status &&
      ["learning", "ran", "reproduced", "used", "paused", "outdated"].includes(
        input.status,
      )
    ) {
      state.learningLogs.push({
        id: crypto.randomUUID(),
        repositoryId,
        status: input.status,
        minutes: 0,
        note: input.note,
        at: now,
      });
    }
    return entry;
  });
}

export async function createCollection(input: {
  name: string;
  description?: string;
}) {
  return runtimeStore.mutate((state) => {
    const name = input.name.trim();
    if (
      state.collections.some(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new Error("Collection already exists");
    const collection = {
      id: crypto.randomUUID(),
      name,
      description: input.description?.trim() ?? "",
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    state.collections.push(collection);
    return collection;
  });
}

export async function deleteCollection(id: string) {
  return runtimeStore.mutate((state) => {
    const index = state.collections.findIndex(
      (item) => item.id === id && !item.isDefault,
    );
    if (index < 0) return false;
    state.collections.splice(index, 1);
    for (const entry of state.library)
      if (entry.collectionId === id) entry.collectionId = "default";
    return true;
  });
}

export async function saveRepositoryRelation(input: {
  fromRepositoryId: string;
  toRepositoryId: string;
  type: string;
  note?: string;
}) {
  if (input.fromRepositoryId === input.toRepositoryId)
    throw new Error("A repository cannot relate to itself");
  const repositories = (await getRepositoryCatalog()).repositories;
  if (
    !repositories.some((item) => item.id === input.fromRepositoryId) ||
    !repositories.some((item) => item.id === input.toRepositoryId)
  )
    throw new Error("Repository not found");
  return runtimeStore.mutate((state) => {
    const existing = state.relations.find(
      (item) =>
        item.fromRepositoryId === input.fromRepositoryId &&
        item.toRepositoryId === input.toRepositoryId &&
        item.type === input.type,
    );
    if (existing) {
      existing.note = input.note?.trim();
      existing.at = new Date().toISOString();
      return existing;
    }
    const relation = {
      ...input,
      note: input.note?.trim(),
      at: new Date().toISOString(),
    };
    state.relations.push(relation);
    return relation;
  });
}

export async function deleteRepositoryRelation(input: {
  fromRepositoryId: string;
  toRepositoryId: string;
  type: string;
}) {
  return runtimeStore.mutate((state) => {
    const index = state.relations.findIndex(
      (item) =>
        item.fromRepositoryId === input.fromRepositoryId &&
        item.toRepositoryId === input.toRepositoryId &&
        item.type === input.type,
    );
    if (index < 0) return false;
    state.relations.splice(index, 1);
    return true;
  });
}

export async function removeLibraryEntry(repositoryId: string) {
  return runtimeStore.mutate((state) => {
    const index = state.library.findIndex(
      (item) => item.repositoryId === repositoryId,
    );
    if (index < 0) return false;
    state.library.splice(index, 1);
    return true;
  });
}
