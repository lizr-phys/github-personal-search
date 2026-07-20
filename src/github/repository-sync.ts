import { embeddingProvider } from "@/ai/providers";
import type { ProjectType, Repository, TrendWindow } from "@/domain/types";
import {
  GitHubClient,
  type GitHubOwnerProfile,
  type GitHubReadme,
  type GitHubRelease,
  type GitHubRepository,
  type GitHubSearchResponse,
} from "@/github/client";
import { runtimeStore } from "@/server/runtime/store";

const DAY = 24 * 60 * 60 * 1000;
const DOMAIN_RULES: Array<{
  domain: string;
  cluster: string;
  chinese: string;
  terms: string[];
}> = [
  {
    domain: "ai-agent",
    cluster: "AI Agent",
    chinese: "AI Agent 开发",
    terms: ["agent", "llm", "autogen", "langchain", "tool calling"],
  },
  {
    domain: "machine-learning",
    cluster: "机器学习",
    chinese: "机器学习",
    terms: ["machine learning", "deep learning", "neural", "pytorch"],
  },
  {
    domain: "data-engineering",
    cluster: "数据工程",
    chinese: "数据工程",
    terms: ["data pipeline", "workflow", "etl", "analytics engineering"],
  },
  {
    domain: "cloud-native",
    cluster: "云与基础设施",
    chinese: "云与基础设施",
    terms: ["cloud-native", "kubernetes", "infrastructure as code", "devops"],
  },
  {
    domain: "database",
    cluster: "数据库",
    chinese: "数据库",
    terms: ["database", "postgresql", "relational", "sql engine"],
  },
  {
    domain: "mobile",
    cluster: "移动开发",
    chinese: "移动开发",
    terms: ["mobile", "android", "ios", "flutter"],
  },
  {
    domain: "game-development",
    cluster: "游戏开发",
    chinese: "游戏开发",
    terms: ["game engine", "game development", "godot"],
  },
  {
    domain: "security",
    cluster: "应用安全",
    chinese: "应用安全",
    terms: ["security", "owasp", "secure coding", "appsec"],
  },
  {
    domain: "creative",
    cluster: "创意工具",
    chinese: "创意工具",
    terms: ["3d creation", "3d modeling", "animation", "blender"],
  },
  {
    domain: "home-automation",
    cluster: "智能家居",
    chinese: "智能家居",
    terms: ["home automation", "smart home", "home assistant", "iot"],
  },
  {
    domain: "scientific-computing",
    cluster: "科学计算",
    chinese: "科学计算",
    terms: ["scientific", "simulation", "physics", "quantum", "numerical"],
  },
  {
    domain: "visualization",
    cluster: "数据可视化",
    chinese: "数据可视化",
    terms: ["visualization", "chart", "graph", "dashboard", "webgpu"],
  },
  {
    domain: "knowledge-base",
    cluster: "个人知识库",
    chinese: "知识管理",
    terms: ["knowledge", "notes", "wiki", "markdown", "pkm"],
  },
  {
    domain: "self-hosted",
    cluster: "自托管应用",
    chinese: "自托管应用",
    terms: ["self-hosted", "selfhosted", "docker", "homelab"],
  },
  {
    domain: "developer-tools",
    cluster: "开发工具",
    chinese: "开发者工具",
    terms: ["developer", "cli", "tool", "devtools", "api"],
  },
  {
    domain: "education",
    cluster: "学习资源",
    chinese: "技术学习",
    terms: ["education", "learning", "tutorial", "course"],
  },
  {
    domain: "web-development",
    cluster: "Web 开发",
    chinese: "Web 开发",
    terms: ["web", "react", "vue", "frontend", "backend"],
  },
];

function cleanMarkdown(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReadme(
  readme: string,
  fallback: string,
): { summary: string; features: string[] } {
  const lines = readme
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const prose = lines
    .filter(
      (line) =>
        !line.startsWith("[") &&
        !line.includes("shields.io") &&
        !/^#{1,6}\s/.test(line),
    )
    .map(cleanMarkdown)
    .filter((line) => line.length >= 24);
  const features = lines
    .filter((line) => /^[-*+]\s+/.test(line))
    .map((line) => cleanMarkdown(line.replace(/^[-*+]\s+/, "")))
    .filter((line) => line.length >= 12)
    .slice(0, 4);
  return {
    summary: (prose[0] || fallback || "README 未提供足够的可提取说明。").slice(
      0,
      360,
    ),
    features,
  };
}

function inferDomains(
  repository: GitHubRepository,
  readme: string,
): { domains: string[]; cluster: string; chinese: string } {
  const haystack = [
    repository.full_name,
    repository.description ?? "",
    ...(repository.topics ?? []),
    readme.slice(0, 4_000),
  ]
    .join(" ")
    .toLowerCase();
  const matched = DOMAIN_RULES.filter((rule) =>
    rule.terms.some((term) => haystack.includes(term)),
  );
  const primary = matched[0] ?? {
    domain: "open-source",
    cluster: "开源项目",
    chinese: "开源项目",
  };
  return {
    domains: [
      ...new Set(matched.map((rule) => rule.domain).concat(primary.domain)),
    ].slice(0, 5),
    cluster: primary.cluster,
    chinese: primary.chinese,
  };
}

function inferProjectType(
  repository: GitHubRepository,
  readme: string,
): ProjectType {
  const text = [
    ...(repository.topics ?? []),
    repository.description ?? "",
    readme.slice(0, 2_000),
  ]
    .join(" ")
    .toLowerCase();
  if (/template|starter|boilerplate/.test(text)) return "template";
  if (/tutorial|course|learn|awesome-list/.test(text)) return "tutorial";
  if (/framework/.test(text)) return "framework";
  if (/library|sdk|package|component/.test(text)) return "library";
  if (/cli|tool|developer-tool|command-line/.test(text)) return "tool";
  return "application";
}

function inferDeployment(readme: string, topics: string[]): string[] {
  const text = `${topics.join(" ")} ${readme.slice(0, 8_000)}`.toLowerCase();
  const values: string[] = [];
  if (/docker|docker-compose|container/.test(text))
    values.push("docker", "self-hosted");
  if (/kubernetes|helm chart/.test(text))
    values.push("kubernetes", "self-hosted");
  if (/web app|browser|website|frontend/.test(text)) values.push("web");
  if (/desktop|electron|tauri/.test(text)) values.push("desktop");
  if (/android|ios|mobile/.test(text)) values.push("mobile");
  return [...new Set(values.length ? values : ["source"])];
}

function trend(
  stars: number,
  forks: number,
  days: 1 | 7 | 30,
  pushedAt: string,
  releasedAt?: string,
): TrendWindow {
  const recencyDays = Math.max(
    0,
    (Date.now() - new Date(pushedAt).getTime()) / DAY,
  );
  const release =
    releasedAt && Date.now() - new Date(releasedAt).getTime() <= days * DAY
      ? 1
      : 0;
  const velocity = stars / days;
  const heat = Math.max(
    0,
    Math.min(
      1,
      (Math.log1p(velocity) / 8) * 0.45 +
        (Math.log1p(forks / days) / 7) * 0.18 +
        Math.exp(-recencyDays / 45) * 0.22 +
        release * 0.15,
    ),
  );
  return {
    stars: Math.max(0, stars),
    forks: Math.max(0, forks),
    activity: recencyDays <= days ? 1 : 0,
    issuesAndPrs: 0,
    heat: Number(heat.toFixed(3)),
  };
}

function novelty(createdAt: string): number {
  const ageDays = Math.max(
    1,
    (Date.now() - new Date(createdAt).getTime()) / DAY,
  );
  return Number(
    Math.max(0.15, Math.min(1, 1 - Math.log1p(ageDays) / 10)).toFixed(3),
  );
}

export function mapGitHubRepository(
  repository: GitHubRepository,
  extras: {
    readme?: string;
    languages?: string[];
    release?: GitHubRelease;
    ownerFollowers?: number;
    previous?: Array<{ stars: number; forks: number; capturedAt: string }>;
  } = {},
): Repository {
  const readme = extras.readme ?? "";
  const extracted = extractReadme(readme, repository.description ?? "");
  const domain = inferDomains(repository, readme);
  const now = new Date().toISOString();
  const pushedAge =
    (Date.now() - new Date(repository.pushed_at).getTime()) / DAY;
  const ageDays = Math.max(
    1,
    (Date.now() - new Date(repository.created_at).getTime()) / DAY,
  );
  const hasReadme = Boolean(readme);
  const license =
    repository.license?.spdx_id && repository.license.spdx_id !== "NOASSERTION"
      ? repository.license.spdx_id
      : "信息不足";
  const quality = Math.max(
    0,
    Math.min(
      1,
      0.28 +
        (repository.description ? 0.12 : 0) +
        (repository.topics?.length ? 0.1 : 0) +
        (hasReadme ? 0.16 : 0) +
        (license !== "信息不足" ? 0.08 : 0) +
        Math.min(0.18, Math.log10(repository.stargazers_count + 1) / 30) +
        Math.exp(-pushedAge / 180) * 0.12 -
        (repository.archived || repository.disabled ? 0.45 : 0),
    ),
  );
  const snapshots = extras.previous ?? [];
  const delta = (days: 1 | 7 | 30) => {
    const cutoff = Date.now() - days * DAY;
    const candidate =
      [...snapshots]
        .filter((item) => new Date(item.capturedAt).getTime() <= cutoff)
        .sort(
          (a, b) =>
            new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
        )[0] ??
      [...snapshots].sort(
        (a, b) =>
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
      )[0];
    return {
      stars: candidate ? repository.stargazers_count - candidate.stars : 0,
      forks: candidate ? repository.forks_count - candidate.forks : 0,
    };
  };
  const delta1 = delta(1);
  const delta7 = delta(7);
  const delta30 = delta(30);
  const technologies = [
    ...new Set(
      [
        repository.language,
        ...(extras.languages ?? []),
        ...(repository.topics ?? []).filter((topic) =>
          /react|vue|rust|python|typescript|javascript|go|webgpu|cuda|docker|kubernetes/i.test(
            topic,
          ),
        ),
      ].filter(Boolean) as string[],
    ),
  ].slice(0, 10);
  const releaseAt = extras.release?.published_at;
  return {
    id: `github-${repository.id}`,
    owner: repository.owner.login,
    name: repository.name,
    fullName: repository.full_name,
    githubUrl: repository.html_url,
    homepageUrl: repository.homepage || undefined,
    demoUrl: repository.homepage || undefined,
    chineseTitle: `${repository.name}：${domain.chinese}`,
    description: repository.description?.trim() || "GitHub 未提供仓库描述。",
    summary: extracted.summary,
    problem:
      repository.description?.trim() || "仓库元数据未提供足够的问题描述。",
    targetUsers: [
      "开发者",
      ...(domain.domains.includes("education") ? ["学习者"] : []),
    ],
    coreFeatures: extracted.features.length
      ? extracted.features
      : ["功能信息需查看 README 原文确认"],
    technologies,
    language: repository.language || "Unknown",
    languages: (extras.languages ?? [])
      .filter((language) => language !== repository.language)
      .slice(0, 5),
    topics: repository.topics ?? [],
    domains: domain.domains,
    cluster: domain.cluster,
    projectType: inferProjectType(repository, readme),
    deployment: inferDeployment(readme, repository.topics ?? []),
    difficulty: /docker|kubernetes|compile from source/i.test(readme)
      ? "advanced"
      : repository.size && repository.size > 100_000
        ? "advanced"
        : "medium",
    maturity:
      repository.stargazers_count >= 10_000 && ageDays > 365
        ? "stable"
        : repository.stargazers_count >= 500
          ? "growing"
          : "experimental",
    maintenance:
      pushedAge <= 90 ? "active" : pushedAge <= 365 ? "slower" : "unknown",
    license,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    watchers: repository.subscribers_count ?? repository.watchers_count,
    ownerFollowers: extras.ownerFollowers,
    trend1d: trend(
      delta1.stars,
      delta1.forks,
      1,
      repository.pushed_at,
      releaseAt,
    ),
    trend7d: trend(
      delta7.stars,
      delta7.forks,
      7,
      repository.pushed_at,
      releaseAt,
    ),
    trend30d: trend(
      delta30.stars,
      delta30.forks,
      30,
      repository.pushed_at,
      releaseAt,
    ),
    pushedAt: repository.pushed_at,
    releasedAt: releaseAt,
    createdAt: repository.created_at,
    readmeSummary: extracted.summary,
    quality: Number(quality.toFixed(3)),
    novelty: novelty(repository.created_at),
    archived: repository.archived || Boolean(repository.disabled),
    mirror: Boolean(repository.mirror_url),
    fork: repository.fork,
    hasReadme,
    dataSource: "github",
    dataUpdatedAt: now,
    evidence: [
      {
        type: "metadata",
        label: "GitHub 仓库元数据",
        source: `${repository.html_url} · ${repository.updated_at}`,
        confidence: 1,
      },
      ...(hasReadme
        ? [
            {
              type: "readme" as const,
              label: "README 提取式摘要",
              source: `${repository.html_url}#readme`,
              confidence: 0.82,
            },
          ]
        : []),
      ...((repository.topics?.length ?? 0)
        ? [
            {
              type: "topic" as const,
              label: (repository.topics ?? []).slice(0, 4).join(" · "),
              source: `${repository.html_url} · topics`,
              confidence: 0.95,
            },
          ]
        : []),
      ...(extras.release
        ? [
            {
              type: "release" as const,
              label: extras.release.tag_name,
              source: extras.release.html_url,
              confidence: 1,
            },
          ]
        : []),
    ],
    similar: [],
  };
}

async function optionalRequest<T>(
  request: () => Promise<{ data: T }>,
): Promise<T | undefined> {
  try {
    return (await request()).data;
  } catch {
    return undefined;
  }
}

export async function fetchGitHubRepository(
  client: GitHubClient,
  fullName: string,
): Promise<Repository> {
  const encoded = fullName.split("/").map(encodeURIComponent).join("/");
  const metadata = (
    await client.request<GitHubRepository>(`/repos/${encoded}`, {
      cacheSeconds: 300,
    })
  ).data;
  const [readmePayload, languageMap, release, ownerProfile] = await Promise.all(
    [
      optionalRequest(() =>
        client.request<GitHubReadme>(`/repos/${encoded}/readme`, {
          cacheSeconds: 1800,
        }),
      ),
      optionalRequest(() =>
        client.request<Record<string, number>>(`/repos/${encoded}/languages`, {
          cacheSeconds: 1800,
        }),
      ),
      optionalRequest(() =>
        client.request<GitHubRelease>(`/repos/${encoded}/releases/latest`, {
          cacheSeconds: 900,
        }),
      ),
      optionalRequest(() =>
        client.request<GitHubOwnerProfile>(
          `/users/${encodeURIComponent(metadata.owner.login)}`,
          { cacheSeconds: 3600 },
        ),
      ),
    ],
  );
  const readme =
    readmePayload?.encoding === "base64"
      ? Buffer.from(readmePayload.content.replace(/\s/g, ""), "base64")
          .toString("utf8")
          .slice(0, 200_000)
      : "";
  const state = await runtimeStore.read();
  const previous = state.repositorySnapshots.filter(
    (item) => item.repositoryId === `github-${metadata.id}`,
  );
  return mapGitHubRepository(metadata, {
    readme,
    languages: Object.keys(languageMap ?? {}),
    release,
    ownerFollowers: ownerProfile?.followers,
    previous,
  });
}

export async function discoverGitHubRepositories(
  client: GitHubClient,
  query: string,
  limit = 10,
): Promise<{ repositories: Repository[]; total: number; incomplete: boolean }> {
  const normalized = query
    .replace(/[^\p{L}\p{N}._+:#/ -]/gu, " ")
    .trim()
    .slice(0, 180);
  const payload = (
    await client.request<GitHubSearchResponse>(
      `/search/repositories?q=${encodeURIComponent(`${normalized} archived:false`)}&sort=updated&order=desc&per_page=${Math.min(20, Math.max(1, limit))}`,
      { cacheSeconds: 300, search: true },
    )
  ).data;
  const state = await runtimeStore.read();
  return {
    repositories: payload.items.map((item) =>
      mapGitHubRepository(item, {
        previous: state.repositorySnapshots.filter(
          (snapshot) => snapshot.repositoryId === `github-${item.id}`,
        ),
      }),
    ),
    total: payload.total_count,
    incomplete: payload.incomplete_results,
  };
}

export async function storeGitHubRepositories(
  repositories: Repository[],
  source: "public" | "oauth" | "webhook",
) {
  const now = new Date().toISOString();
  const stored = await runtimeStore.mutate((state) => {
    state.githubSync = {
      ...state.githubSync,
      status: "running",
      lastStartedAt: now,
      lastError: undefined,
      source,
    };
    for (const repository of repositories) {
      const existingIndex = state.repositories.findIndex(
        (item) =>
          item.id === repository.id ||
          item.fullName.toLowerCase() === repository.fullName.toLowerCase(),
      );
      if (existingIndex >= 0) state.repositories[existingIndex] = repository;
      else state.repositories.push(repository);
      const alreadyCaptured = state.repositorySnapshots.some(
        (snapshot) =>
          snapshot.repositoryId === repository.id &&
          snapshot.capturedAt.slice(0, 13) === now.slice(0, 13),
      );
      if (!alreadyCaptured)
        state.repositorySnapshots.push({
          repositoryId: repository.id,
          stars: repository.stars,
          forks: repository.forks,
          capturedAt: now,
          releaseTag: repository.evidence.find(
            (item) => item.type === "release",
          )?.label,
        });
    }
    if (repositories.length) state.batches = [];
    const cutoff = Date.now() - 120 * DAY;
    state.repositorySnapshots = state.repositorySnapshots.filter(
      (snapshot) => new Date(snapshot.capturedAt).getTime() >= cutoff,
    );
    state.githubSync = {
      status: "succeeded",
      lastStartedAt: state.githubSync.lastStartedAt,
      lastCompletedAt: now,
      indexedCount: state.repositories.length,
      source,
    };
    return state.repositories.length;
  });
  if (process.env.GPS_PERSIST_GITHUB_TO_POSTGRES === "true")
    await persistRepositoriesToPostgres(repositories).catch(async (error) => {
      await runtimeStore.mutate((state) => {
        state.githubSync.status = "partial";
        state.githubSync.lastError = `PostgreSQL: ${(error as Error).message}`;
      });
    });
  return stored;
}

async function persistRepositoriesToPostgres(
  repositoriesToPersist: Repository[],
) {
  const [{ eq }, { createDatabase }, schema] = await Promise.all([
    import("drizzle-orm"),
    import("../../db/client"),
    import("../../db/schema"),
  ]);
  const { db, client } = createDatabase();
  try {
    for (const repository of repositoriesToPersist) {
      const [row] = await db
        .insert(schema.repositories)
        .values({
          owner: repository.owner,
          name: repository.name,
          fullName: repository.fullName,
          url: repository.githubUrl,
          homepageUrl: repository.homepageUrl,
          demoUrl: repository.demoUrl,
          description: repository.description,
          chineseTitle: repository.chineseTitle,
          summary: repository.summary,
          primaryLanguage: repository.language,
          languages: repository.languages,
          topics: repository.topics,
          domains: repository.domains,
          projectType: repository.projectType,
          deployment: repository.deployment,
          difficulty: repository.difficulty,
          maturity: repository.maturity,
          licenseSpdx: repository.license,
          stars: repository.stars,
          forks: repository.forks,
          watchers: repository.watchers,
          ownerFollowers: repository.ownerFollowers,
          archived: repository.archived,
          mirror: repository.mirror,
          fork: repository.fork,
          hasReadme: repository.hasReadme,
          qualityScore: repository.quality,
          dataSource: "github",
          dataUpdatedAt: new Date(repository.dataUpdatedAt),
          pushedAt: new Date(repository.pushedAt),
          releasedAt: repository.releasedAt
            ? new Date(repository.releasedAt)
            : null,
          repoCreatedAt: new Date(repository.createdAt),
        })
        .onConflictDoUpdate({
          target: schema.repositories.fullName,
          set: {
            description: repository.description,
            summary: repository.summary,
            languages: repository.languages,
            topics: repository.topics,
            domains: repository.domains,
            stars: repository.stars,
            forks: repository.forks,
            watchers: repository.watchers,
            ownerFollowers: repository.ownerFollowers,
            hasReadme: repository.hasReadme,
            qualityScore: repository.quality,
            dataSource: "github",
            dataUpdatedAt: new Date(repository.dataUpdatedAt),
            pushedAt: new Date(repository.pushedAt),
            releasedAt: repository.releasedAt
              ? new Date(repository.releasedAt)
              : null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.repositories.id });
      const repositoryId =
        row?.id ??
        (
          await db
            .select({ id: schema.repositories.id })
            .from(schema.repositories)
            .where(eq(schema.repositories.fullName, repository.fullName))
            .limit(1)
        )[0]?.id;
      if (!repositoryId) continue;
      const content = [
        repository.fullName,
        repository.description,
        repository.readmeSummary,
        ...repository.topics,
        ...repository.technologies,
      ].join("\n");
      const [document] = await db
        .insert(schema.repositoryDocuments)
        .values({
          repositoryId,
          documentType: "semantic",
          content,
          readmeSummary: repository.readmeSummary,
          coreFeatures: repository.coreFeatures,
          targetUsers: repository.targetUsers,
          technologies: repository.technologies,
          sourceUrl: `${repository.githubUrl}#readme`,
          parserVersion: "github-extractive-v1",
          confidence: repository.hasReadme ? 0.82 : 0.55,
        })
        .onConflictDoUpdate({
          target: [
            schema.repositoryDocuments.repositoryId,
            schema.repositoryDocuments.documentType,
          ],
          set: {
            content,
            readmeSummary: repository.readmeSummary,
            coreFeatures: repository.coreFeatures,
            technologies: repository.technologies,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.repositoryDocuments.id });
      const embedding = await embeddingProvider.embed(content);
      await db
        .insert(schema.repositoryEmbeddings)
        .values({
          repositoryId,
          documentId: document?.id,
          model: embeddingProvider.name,
          dimensions: embeddingProvider.dimensions,
          embedding,
        })
        .onConflictDoUpdate({
          target: [
            schema.repositoryEmbeddings.repositoryId,
            schema.repositoryEmbeddings.model,
          ],
          set: { embedding, documentId: document?.id, updatedAt: new Date() },
        });
      await db
        .insert(schema.repositorySnapshots)
        .values({
          repositoryId,
          capturedAt: new Date(repository.dataUpdatedAt),
          stars: repository.stars,
          forks: repository.forks,
        })
        .onConflictDoNothing();
    }
  } finally {
    await client.end();
  }
}
