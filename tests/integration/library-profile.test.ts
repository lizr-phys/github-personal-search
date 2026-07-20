import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_REPOSITORIES } from "@/data/demo-repositories";
import { runtimeStore } from "@/server/runtime/store";
import {
  createCollection,
  deleteCollection,
  getLibrary,
  saveRepositoryRelation,
  updateLibraryEntry,
} from "@/server/services/library-service";
import {
  recordInteraction,
  undoInteraction,
} from "@/server/services/interaction-service";

describe("knowledge library and profile updates", () => {
  beforeEach(async () => runtimeStore.reset());

  it("writes favorite/learning state, notes and tags into the library", async () => {
    const repository = DEMO_REPOSITORIES.find(
      (item) => item.fullName === "qmsolve/qmsolve",
    )!;
    const interaction = await recordInteraction({
      repositoryId: repository.id,
      type: "favorite",
      surface: "repository",
      sessionId: "library",
    });
    await updateLibraryEntry(repository.id, {
      status: "learning",
      tags: ["量子", "波函数"],
      note: "先复现二维波函数示例",
    });
    const items = await getLibrary("波函数");
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe("learning");
    expect(items[0]!.note).toContain("二维");
    expect(
      (await runtimeStore.read()).profile.longTerm.quantum,
    ).toBeGreaterThan(0);
    await undoInteraction(interaction.id);
    expect((await runtimeStore.read()).interactions[0]!.undoneAt).toBeTruthy();
  });

  it("creates custom collections and saves explicit project relations", async () => {
    const first = DEMO_REPOSITORIES[0]!;
    const second = DEMO_REPOSITORIES[1]!;
    const collection = await createCollection({ name: "科学工具箱" });
    await updateLibraryEntry(first.id, {
      collectionId: collection.id,
      status: "read_later",
    });
    await updateLibraryEntry(second.id, { status: "learning" });
    const relation = await saveRepositoryRelation({
      fromRepositoryId: first.id,
      toRepositoryId: second.id,
      type: "similar",
      note: "同属交互式科学学习",
    });
    const state = await runtimeStore.read();
    expect(
      state.library.find((item) => item.repositoryId === first.id)
        ?.collectionId,
    ).toBe(collection.id);
    expect(relation.note).toContain("科学学习");
    expect(state.relations).toHaveLength(1);
    expect(await deleteCollection(collection.id)).toBe(true);
    expect(
      (await runtimeStore.read()).library.find(
        (item) => item.repositoryId === first.id,
      )?.collectionId,
    ).toBe("default");
  });
});
