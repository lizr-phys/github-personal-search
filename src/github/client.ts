import { createHash } from "node:crypto";

import { runtimeStore } from "@/server/runtime/store";

type CacheEntry = { etag?: string; body: unknown; storedAt: number };
const cache = new Map<string, CacheEntry>();

class Semaphore {
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit)
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.waiters.shift()?.();
    }
  }
}

const semaphore = new Semaphore(4);

export type GitHubResponse<T> = {
  data: T;
  etag?: string;
  cache: "hit" | "miss" | "revalidated";
  remaining?: number;
  resetAt?: string;
};

export class GitHubClient {
  private readonly cacheNamespace: string;

  constructor(private readonly token?: string) {
    this.cacheNamespace = token
      ? createHash("sha256").update(token).digest("hex").slice(0, 12)
      : "public";
  }

  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      cacheSeconds?: number;
      search?: boolean;
    } = {},
  ): Promise<GitHubResponse<T>> {
    const url = path.startsWith("https://")
      ? path
      : `https://api.github.com${path}`;
    const method = options.method ?? "GET";
    const cacheKey = `${this.cacheNamespace}:${method}:${url}`;
    const cached = cache.get(cacheKey);
    const maxAge = (options.cacheSeconds ?? 900) * 1000;
    if (method === "GET" && cached && Date.now() - cached.storedAt < maxAge)
      return { data: cached.body as T, etag: cached.etag, cache: "hit" };

    return semaphore.run(async () => {
      let lastError: Error | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const response = await fetch(url, {
            method,
            signal: controller.signal,
            headers: {
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "github-personal-search/1.0",
              ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
              ...(cached?.etag ? { "If-None-Match": cached.etag } : {}),
              ...(options.body ? { "Content-Type": "application/json" } : {}),
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
          }).finally(() => clearTimeout(timeout));
          const remaining = Number.parseInt(
            response.headers.get("x-ratelimit-remaining") ?? "",
            10,
          );
          const reset = Number.parseInt(
            response.headers.get("x-ratelimit-reset") ?? "",
            10,
          );
          await runtimeStore.mutate((state) => {
            if (Number.isFinite(remaining))
              state.metrics.githubRemaining = remaining;
            if (Number.isFinite(reset))
              state.metrics.githubResetAt = new Date(
                reset * 1000,
              ).toISOString();
          });
          if (response.status === 304 && cached) {
            cached.storedAt = Date.now();
            return {
              data: cached.body as T,
              etag: cached.etag,
              cache: "revalidated" as const,
              remaining,
              resetAt: Number.isFinite(reset)
                ? new Date(reset * 1000).toISOString()
                : undefined,
            };
          }
          if (
            response.status === 403 ||
            response.status === 429 ||
            response.status >= 500
          ) {
            const retryAfter = Number.parseInt(
              response.headers.get("retry-after") ?? "",
              10,
            );
            if (attempt < 2) {
              await new Promise((resolve) =>
                setTimeout(
                  resolve,
                  Number.isFinite(retryAfter)
                    ? Math.min(retryAfter * 1000, 5000)
                    : 250 * 2 ** attempt,
                ),
              );
              continue;
            }
          }
          if (!response.ok)
            throw new Error(
              `GitHub API ${response.status}: ${response.statusText}`,
            );
          const data = (await response.json()) as T;
          const etag = response.headers.get("etag") ?? undefined;
          if (method === "GET")
            cache.set(cacheKey, { body: data, etag, storedAt: Date.now() });
          await runtimeStore.mutate((state) => {
            state.metrics.fetchSuccess += 1;
          });
          return {
            data,
            etag,
            cache: "miss" as const,
            remaining,
            resetAt: Number.isFinite(reset)
              ? new Date(reset * 1000).toISOString()
              : undefined,
          };
        } catch (error) {
          lastError = error as Error;
        }
      }
      await runtimeStore.mutate((state) => {
        state.metrics.fetchFailure += 1;
      });
      throw lastError ?? new Error("GitHub request failed");
    });
  }
}

export type GitHubUser = {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
};
export type GitHubOwnerProfile = {
  login: string;
  followers: number;
  type: "User" | "Organization";
};
export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  html_url: string;
  homepage?: string | null;
  description?: string | null;
  language?: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  watchers_count?: number;
  subscribers_count?: number;
  open_issues_count: number;
  archived: boolean;
  disabled?: boolean;
  mirror_url?: string | null;
  fork: boolean;
  pushed_at: string;
  updated_at: string;
  created_at: string;
  license?: { spdx_id?: string | null } | null;
  size?: number;
};

export type GitHubStarredRepository = GitHubRepository;
export type GitHubSearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
};
export type GitHubReadme = {
  content: string;
  encoding: string;
  html_url: string;
  download_url?: string;
};
export type GitHubRelease = {
  tag_name: string;
  name?: string;
  body?: string;
  published_at?: string;
  html_url: string;
};
