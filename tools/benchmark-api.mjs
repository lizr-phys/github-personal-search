import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseUrl =
  argument("--url") ?? process.env.GPS_BENCHMARK_URL ?? "http://localhost:3000";
const origin = argument("--origin") ?? baseUrl;
const cookies = new Map();

function ingestCookies(headers) {
  const values =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0)
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  if (cookies.size) headers.set("cookie", cookieHeader());
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  ingestCookies(response.headers);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok)
    throw new Error(
      `${init.method ?? "GET"} ${path} -> ${response.status}: ${text.slice(0, 300)}`,
    );
  return { response, body };
}

function mutationHeaders() {
  return {
    "content-type": "application/json",
    origin,
    "x-gps-csrf": decodeURIComponent(cookies.get("gps_csrf") ?? ""),
  };
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[
      Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
    ] ?? 0
  );
}

async function timed(label, fn) {
  const started = performance.now();
  const result = await fn();
  return { label, durationMs: performance.now() - started, result };
}

async function initialize() {
  await request("/api/demo/start", { method: "POST", headers: { origin } });
  const onboarding = await request("/api/onboarding");
  const feedback = onboarding.body.seeds
    .slice(0, 10)
    .map((repository, index) => ({
      repositoryId: repository.id,
      type: index % 4 === 0 ? "learn" : "interested",
    }));
  await request("/api/onboarding", {
    method: "POST",
    headers: mutationHeaders(),
    body: JSON.stringify({
      interests: ["web-development", "data-engineering", "self-hosted"],
      languages: ["TypeScript", "Python"],
      difficulty: "medium",
      seedRepositories: onboarding.body.seeds
        .slice(0, 3)
        .map((item) => item.id),
      feedback,
    }),
  });
}

async function main() {
  await initialize();
  const scenarios = {};

  const coldFeed = await timed("feed-cold", () => request("/api/feed?batch=0"));
  const cachedFeedTimes = [];
  for (let index = 0; index < 12; index += 1)
    cachedFeedTimes.push(
      (await timed("feed-warm", () => request("/api/feed?batch=0"))).durationMs,
    );

  const repositoryId = coldFeed.result.body.items[0].repository.id;
  const feedbackTimes = [];
  for (let index = 0; index < 8; index += 1) {
    feedbackTimes.push(
      (
        await timed("feedback", () =>
          request("/api/interactions", {
            method: "POST",
            headers: mutationHeaders(),
            body: JSON.stringify({
              repositoryId,
              type: index % 2 ? "seen" : "interested",
              surface: "feed",
            }),
          }),
        )
      ).durationMs,
    );
  }
  const nextFeedTimes = [];
  for (let index = 1; index <= 4; index += 1)
    nextFeedTimes.push(
      (await timed("feed-next", () => request(`/api/feed?batch=${index}`)))
        .durationMs,
    );

  const query = "自托管并支持 PDF 和 Markdown 的个人知识库";
  const coldSearch = await timed("search-cold", () =>
    request("/api/search", {
      method: "POST",
      headers: mutationHeaders(),
      body: JSON.stringify({
        query,
        mode: "comprehensive",
        affectsProfile: false,
      }),
    }),
  );
  const warmSearchTimes = [];
  for (let index = 0; index < 8; index += 1)
    warmSearchTimes.push(
      (
        await timed("search-warm", () =>
          request("/api/search", {
            method: "POST",
            headers: mutationHeaders(),
            body: JSON.stringify({
              query,
              mode: "comprehensive",
              affectsProfile: false,
            }),
          }),
        )
      ).durationMs,
    );

  const burstStarted = performance.now();
  const burst = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      timed("search-burst", () =>
        request("/api/search", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({
            query: `${query} ${index % 2 ? "docker" : "self-hosted"}`,
            mode: index % 3 === 0 ? "precise" : "comprehensive",
            affectsProfile: false,
          }),
        }),
      ),
    ),
  );
  const burstWallMs = performance.now() - burstStarted;

  const readPaths = [
    "/api/library",
    "/api/trends?window=7d",
    `/api/repositories/${encodeURIComponent(coldFeed.result.body.items[0].repository.owner)}/${encodeURIComponent(coldFeed.result.body.items[0].repository.name)}`,
  ];
  const readTimes = [];
  for (const path of readPaths)
    readTimes.push(await timed(path, () => request(path)));

  function summarize(values) {
    return {
      count: values.length,
      p50Ms: +percentile(values, 0.5).toFixed(2),
      p95Ms: +percentile(values, 0.95).toFixed(2),
      p99Ms: +percentile(values, 0.99).toFixed(2),
      maxMs: +Math.max(...values).toFixed(2),
    };
  }

  scenarios.feedColdMs = +coldFeed.durationMs.toFixed(2);
  scenarios.feedWarm = summarize(cachedFeedTimes);
  scenarios.feedNext = summarize(nextFeedTimes);
  scenarios.feedback = summarize(feedbackTimes);
  scenarios.searchColdMs = +coldSearch.durationMs.toFixed(2);
  scenarios.searchWarm = summarize(warmSearchTimes);
  scenarios.searchBurst = {
    ...summarize(burst.map((item) => item.durationMs)),
    concurrency: 10,
    wallMs: +burstWallMs.toFixed(2),
    throughputRps: +(10 / (burstWallMs / 1000)).toFixed(2),
    errors: 0,
  };
  scenarios.readEndpoints = Object.fromEntries(
    readTimes.map((item) => [item.label, +item.durationMs.toFixed(2)]),
  );

  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    runtime: process.env.GPS_RUNTIME_STORE ?? "server-configured",
    scenarios,
    process: {
      node: process.version,
      rssMb: +(process.memoryUsage().rss / 1024 / 1024).toFixed(1),
    },
  };
  const outputPath = argument("--output");
  if (outputPath)
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
