import { eq } from "drizzle-orm";

import { ALGORITHM_VERSIONS, FEED_WEIGHTS, INTERACTION_WEIGHTS, SEARCH_WEIGHTS } from "../src/config/algorithms";
import { DEMO_REPOSITORIES, DEMO_SNAPSHOT_DATE } from "../src/data/demo-repositories";
import { createDatabase } from "./client";
import { algorithmVersions, collections, repositories, repositoryDocuments, repositorySnapshots, userProfiles, users } from "./schema";

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEFAULT_COLLECTION_ID = "00000000-0000-4000-8000-000000000002";

const { db, client } = createDatabase();

try {
  await db
    .insert(users)
    .values({ id: DEMO_USER_ID, displayName: "GPS 演示用户", isDemo: true, onboardingCompletedAt: new Date(DEMO_SNAPSHOT_DATE) })
    .onConflictDoUpdate({ target: users.id, set: { displayName: "GPS 演示用户", isDemo: true, updatedAt: new Date() } });

  await db
    .insert(userProfiles)
    .values({
      userId: DEMO_USER_ID,
      longTerm: { "scientific-computing": 2.5, visualization: 2.2, "knowledge-base": 1.8, webgpu: 1.5 },
      shortTerm: { "physics-education": 1.3, webgpu: 1.1 },
      capability: { difficulty: "medium", languages: { TypeScript: 2.2, Python: 2 } },
      negativePreferences: { languages: [], organizations: [], projectTypes: [] },
      exposureMemory: {},
      version: 1
    })
    .onConflictDoUpdate({ target: userProfiles.userId, set: { updatedAt: new Date() } });

  await db
    .insert(collections)
    .values({ id: DEFAULT_COLLECTION_ID, userId: DEMO_USER_ID, name: "我的项目", description: "默认知识库合集", isDefault: true })
    .onConflictDoUpdate({ target: collections.id, set: { updatedAt: new Date() } });

  const algorithms = [
    { name: "search", version: ALGORITHM_VERSIONS.search, kind: "ranker", config: SEARCH_WEIGHTS },
    { name: "feed", version: ALGORITHM_VERSIONS.feed, kind: "ranker", config: FEED_WEIGHTS },
    { name: "interaction", version: "behavior-weights-v1", kind: "profile", config: INTERACTION_WEIGHTS },
    { name: "trend", version: ALGORITHM_VERSIONS.trend, kind: "calculator", config: { star: 0.38, fork: 0.15, activity: 0.15, issuePr: 0.12, release: 0.1, novelty: 0.1 } }
  ];
  for (const algorithm of algorithms) {
    await db.insert(algorithmVersions).values(algorithm).onConflictDoUpdate({ target: [algorithmVersions.name, algorithmVersions.version], set: { config: algorithm.config, active: true, updatedAt: new Date() } });
  }

  for (const repository of DEMO_REPOSITORIES) {
    const [stored] = await db
      .insert(repositories)
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
        archived: repository.archived,
        mirror: repository.mirror,
        fork: repository.fork,
        hasReadme: repository.hasReadme,
        qualityScore: repository.quality,
        dataSource: repository.dataSource,
        dataUpdatedAt: new Date(repository.dataUpdatedAt),
        pushedAt: new Date(repository.pushedAt),
        releasedAt: repository.releasedAt ? new Date(repository.releasedAt) : null,
        repoCreatedAt: new Date(repository.createdAt)
      })
      .onConflictDoUpdate({
        target: repositories.fullName,
        set: {
          description: repository.description,
          chineseTitle: repository.chineseTitle,
          summary: repository.summary,
          topics: repository.topics,
          domains: repository.domains,
          stars: repository.stars,
          forks: repository.forks,
          qualityScore: repository.quality,
          dataUpdatedAt: new Date(repository.dataUpdatedAt),
          updatedAt: new Date()
        }
      })
      .returning({ id: repositories.id });
    const repositoryId = stored?.id ?? (await db.select({ id: repositories.id }).from(repositories).where(eq(repositories.fullName, repository.fullName)).limit(1))[0]?.id;
    if (!repositoryId) throw new Error(`Failed to seed ${repository.fullName}`);

    await db
      .insert(repositoryDocuments)
      .values({
        repositoryId,
        documentType: "semantic",
        content: [repository.fullName, repository.description, repository.readmeSummary, ...repository.topics, ...repository.technologies].join("\n"),
        readmeSummary: repository.readmeSummary,
        coreFeatures: repository.coreFeatures,
        targetUsers: repository.targetUsers,
        technologies: repository.technologies,
        dependencies: [],
        sourceUrl: `${repository.githubUrl}#readme`,
        parserVersion: "demo-extractive-v1",
        confidence: 0.84
      })
      .onConflictDoUpdate({ target: [repositoryDocuments.repositoryId, repositoryDocuments.documentType], set: { content: repository.readmeSummary, readmeSummary: repository.readmeSummary, updatedAt: new Date() } });

    const current = new Date(DEMO_SNAPSHOT_DATE);
    const snapshots = [
      { days: 30, trend: repository.trend30d },
      { days: 7, trend: repository.trend7d },
      { days: 1, trend: repository.trend1d },
      { days: 0, trend: { stars: 0, forks: 0, activity: 0, issuesAndPrs: 0 } }
    ];
    for (const snapshot of snapshots) {
      const capturedAt = new Date(current.getTime() - snapshot.days * 24 * 60 * 60 * 1000);
      await db
        .insert(repositorySnapshots)
        .values({
          repositoryId,
          capturedAt,
          stars: Math.max(0, repository.stars - snapshot.trend.stars),
          forks: Math.max(0, repository.forks - snapshot.trend.forks),
          commits: Math.max(0, repository.trend30d.activity - snapshot.trend.activity),
          openIssues: snapshot.trend.issuesAndPrs,
          openPullRequests: Math.round(snapshot.trend.issuesAndPrs * 0.35),
          contributors: Math.max(1, Math.round(Math.log10(repository.stars + 1) * 12)),
          releaseCount: repository.releasedAt && snapshot.days === 0 ? 1 : 0
        })
        .onConflictDoNothing();
    }
  }
  console.log(`Seeded ${DEMO_REPOSITORIES.length} demo repositories and algorithm versions.`);
} finally {
  await client.end();
}
