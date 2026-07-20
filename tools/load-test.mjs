import { writeFile } from "node:fs/promises";
import os from "node:os";
import { performance } from "node:perf_hooks";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const baseUrl = argument("--url") ?? "http://localhost:3000";
const outputPath = argument("--output");
const cookies = new Map();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

function headers(json = false) {
  const value = new Headers();
  if (cookies.size)
    value.set(
      "cookie",
      [...cookies].map(([key, item]) => `${key}=${item}`).join("; "),
    );
  if (json) {
    value.set("content-type", "application/json");
    value.set("origin", baseUrl);
    value.set("x-gps-csrf", decodeURIComponent(cookies.get("gps_csrf") ?? ""));
  }
  return value;
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: init.headers ?? headers(Boolean(init.body)),
  });
  ingestCookies(response.headers);
  const text = await response.text();
  if (!response.ok)
    throw new HttpError(
      response.status,
      `${init.method ?? "GET"} ${path} -> ${response.status}`,
    );
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function quantile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function summarize(values) {
  return {
    count: values.length,
    p50Ms: +quantile(values, 0.5).toFixed(2),
    p95Ms: +quantile(values, 0.95).toFixed(2),
    p99Ms: +quantile(values, 0.99).toFixed(2),
    maxMs: +Math.max(0, ...values).toFixed(2),
  };
}

async function initialize() {
  await request("/api/demo/start", {
    method: "POST",
    headers: new Headers({ origin: baseUrl }),
  });
  const onboarding = await request("/api/onboarding");
  await request("/api/onboarding", {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      interests: ["scientific-computing", "visualization", "webgpu"],
      languages: ["TypeScript", "Python"],
      difficulty: "medium",
      seedRepositories: onboarding.seeds.slice(0, 3).map((item) => item.id),
      feedback: onboarding.seeds.slice(0, 10).map((repository, index) => ({
        repositoryId: repository.id,
        type: index % 4 === 0 ? "learn" : "interested",
      })),
    }),
  });
  const feed = await request("/api/feed?batch=0");
  return feed.items[0].repository;
}

function operation(index, repository) {
  const variant = index % 10;
  if (variant <= 1)
    return {
      name: "search",
      path: "/api/search",
      init: {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({
          query:
            variant === 0
              ? "\u81ea\u6258\u7ba1 PDF Markdown \u4e2a\u4eba\u77e5\u8bc6\u5e93"
              : "WebGPU scientific simulation",
          mode: variant === 0 ? "comprehensive" : "precise",
          affectsProfile: false,
        }),
      },
    };
  if (variant === 2)
    return { name: "feed", path: "/api/feed?batch=0", init: {} };
  if (variant === 3)
    return { name: "feed-next", path: `/api/feed?batch=${1 + (index % 3)}`, init: {} };
  if (variant === 4)
    return { name: "library", path: "/api/library", init: {} };
  if (variant === 5)
    return { name: "trends", path: `/api/trends?window=${index % 2 ? "7d" : "30d"}`, init: {} };
  if (variant === 6)
    return {
      name: "detail",
      path: `/api/repositories/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`,
      init: {},
    };
  if (variant === 7)
    return {
      name: "feedback",
      path: "/api/interactions",
      init: {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({
          repositoryId: repository.id,
          type: "seen",
          surface: "feed",
        }),
      },
    };
  if (variant === 8)
    return { name: "profile", path: "/api/profile", init: {} };
  return { name: "observability", path: "/api/observability", init: {} };
}

async function scenario(name, concurrency, total, repository) {
  let cursor = 0;
  const samples = [];
  const throttles = [];
  const failures = [];
  const started = performance.now();
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= total) return;
      const item = operation(index, repository);
      const requestStarted = performance.now();
      try {
        await request(item.path, item.init);
        samples.push({ name: item.name, durationMs: performance.now() - requestStarted });
      } catch (error) {
        const failure = {
          name: item.name,
          message: String(error),
          durationMs: performance.now() - requestStarted,
        };
        if (error instanceof HttpError && error.status === 429)
          throttles.push(failure);
        else failures.push(failure);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const wallMs = performance.now() - started;
  const grouped = Object.groupBy(samples, (item) => item.name);
  return {
    name,
    concurrency,
    total,
    succeeded: samples.length,
    throttled: throttles.length,
    failed: failures.length,
    errorRate: +(failures.length / total).toFixed(4),
    throttleRate: +(throttles.length / total).toFixed(4),
    wallMs: +wallMs.toFixed(2),
    responseThroughputRps: +(total / (wallMs / 1000)).toFixed(2),
    acceptedThroughputRps: +(samples.length / (wallMs / 1000)).toFixed(2),
    latency: summarize(samples.map((item) => item.durationMs)),
    throttleLatency:
      throttles.length > 0
        ? summarize(throttles.map((item) => item.durationMs))
        : undefined,
    endpoints: Object.fromEntries(
      Object.entries(grouped).map(([key, values]) => [
        key,
        summarize(values.map((item) => item.durationMs)),
      ]),
    ),
    failureExamples: failures.slice(0, 5),
    throttleExamples: throttles.slice(0, 5),
  };
}

async function main() {
  const repository = await initialize();
  const scenarios = [];
  scenarios.push(await scenario("normal", 5, 100, repository));
  scenarios.push(await scenario("peak", 20, 300, repository));
  scenarios.push(await scenario("burst", 50, 250, repository));
  const observability = await request("/api/observability");
  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    host: {
      platform: `${os.platform()} ${os.release()}`,
      cpuCount: os.cpus().length,
      totalMemoryMb: +(os.totalmem() / 1024 / 1024).toFixed(1),
      node: process.version,
    },
    scenarios,
    observability,
  };
  if (outputPath)
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
