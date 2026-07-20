import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RuntimeState } from "./types";

const GLOBAL_KEY = Symbol.for("gps.runtime.store");

function initialState(): RuntimeState {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    user: {
      id: "demo-user",
      displayName: "GPS 演示用户",
      isDemo: true,
      githubScopes: [],
      importedStars: [],
    },
    profile: {
      completed: false,
      longTerm: {},
      shortTerm: {},
      languages: {},
      difficulty: "medium",
      blockedLanguages: [],
      blockedOrganizations: [],
      blockedTypes: [],
      searchAffectsProfile: true,
      sources: [{ label: "演示模式", detail: "尚未完成兴趣初始化", at: now }],
    },
    interactions: [],
    exposures: [],
    batches: [],
    warmQueues: [],
    searches: [],
    repositories: [],
    repositorySnapshots: [],
    githubSync: { status: "idle", indexedCount: 0, source: "none" },
    collections: [
      {
        id: "default",
        name: "我的项目",
        description: "默认知识库合集",
        isDefault: true,
        createdAt: now,
      },
    ],
    library: [],
    learningLogs: [],
    relations: [],
    subscriptions: [],
    emails: [],
    metrics: {
      cacheHits: 0,
      cacheMisses: 0,
      searchCount: 0,
      feedGenerations: 0,
      negativeFeedback: 0,
      fetchSuccess: 0,
      fetchFailure: 0,
      aiCalls: 0,
      aiFallbacks: 0,
    },
  };
}

class RuntimeStore {
  private state: RuntimeState | undefined;
  private queue: Promise<void> = Promise.resolve();
  private readonly mode = process.env.GPS_RUNTIME_STORE ?? "file";
  private readonly file = (() => {
    const configured =
      process.env.GPS_DATA_FILE ?? path.join(".data", "gps-demo.json");
    return path.isAbsolute(configured)
      ? configured
      : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
  })();

  private async load(): Promise<RuntimeState> {
    if (this.state) return this.state;
    if (this.mode === "memory") {
      this.state = initialState();
      return this.state;
    }
    try {
      const parsed = JSON.parse(
        await readFile(this.file, "utf8"),
      ) as RuntimeState;
      if (parsed.schemaVersion !== 1)
        throw new Error("Unsupported demo state schema");
      this.state = {
        ...parsed,
        repositories: parsed.repositories ?? [],
        repositorySnapshots: parsed.repositorySnapshots ?? [],
        warmQueues: parsed.warmQueues ?? [],
        githubSync: parsed.githubSync ?? {
          status: "idle",
          indexedCount: parsed.repositories?.length ?? 0,
          source: "none",
        },
      };
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "ENOENT" &&
        !(error instanceof SyntaxError)
      ) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "runtime_store_reset",
            reason: (error as Error).message,
          }),
        );
      }
      this.state = initialState();
      await this.persist(this.state);
    }
    return this.state;
  }

  private async persist(state: RuntimeState): Promise<void> {
    if (this.mode === "memory") return;
    await mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
    await rename(temporary, this.file);
  }

  async read(): Promise<RuntimeState> {
    return structuredClone(await this.load());
  }

  async mutate<T>(
    mutator: (state: RuntimeState) => T | Promise<T>,
  ): Promise<T> {
    let result!: T;
    let failure: unknown;
    this.queue = this.queue.then(async () => {
      try {
        const state = await this.load();
        result = await mutator(state);
        await this.persist(state);
      } catch (error) {
        failure = error;
      }
    });
    await this.queue;
    if (failure) throw failure;
    return result;
  }

  async reset(): Promise<RuntimeState> {
    this.state = initialState();
    await this.persist(this.state);
    return structuredClone(this.state);
  }
}

type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: RuntimeStore };
const runtimeGlobal = globalThis as GlobalWithStore;
export const runtimeStore = runtimeGlobal[GLOBAL_KEY] ?? new RuntimeStore();
runtimeGlobal[GLOBAL_KEY] = runtimeStore;
