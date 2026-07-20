import { afterEach, describe, expect, it, vi } from "vitest";

import { GitHubClient } from "@/github/client";

describe("GitHub client cache and quota handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("caches repository responses and records rate-limit headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, full_name: "gps/demo" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ETag: '"etag-1"',
          "X-RateLimit-Remaining": "4999",
          "X-RateLimit-Reset": "1784361600",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new GitHubClient("secret-test-token");
    const first = await client.request<{ id: number }>(
      "/repos/gps/demo-test-cache",
      { cacheSeconds: 60 },
    );
    const second = await client.request<{ id: number }>(
      "/repos/gps/demo-test-cache",
      { cacheSeconds: 60 },
    );
    expect(first.cache).toBe("miss");
    expect(second.cache).toBe("hit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("isolates cached responses by access token", async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ login: "user" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await new GitHubClient("token-a").request("/user?cache-isolation=1", {
      cacheSeconds: 60,
    });
    await new GitHubClient("token-b").request("/user?cache-isolation=1", {
      cacheSeconds: 60,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
