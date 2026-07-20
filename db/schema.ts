import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const dataSourceEnum = pgEnum("data_source", ["demo", "github", "user"]);
export const interactionTypeEnum = pgEnum("interaction_type", [
  "interested",
  "favorite",
  "open_github",
  "open_demo",
  "learn",
  "ran",
  "reproduced",
  "used",
  "not_interested",
  "seen",
  "too_complex",
  "language_mismatch",
  "unmaintained",
  "block_similar",
  "dwell",
  "expand",
]);
export const libraryStatusEnum = pgEnum("library_status", [
  "read_later",
  "learning",
  "ran",
  "reproduced",
  "used",
  "paused",
  "outdated",
]);
export const subscriptionFrequencyEnum = pgEnum("subscription_frequency", [
  "daily",
  "weekly",
  "monthly",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "dead",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubLogin: text("github_login"),
    displayName: text("display_name").notNull(),
    email: text("email"),
    isDemo: boolean("is_demo").notNull().default(false),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
    }),
    searchAffectsProfile: boolean("search_affects_profile")
      .notNull()
      .default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_github_login_unique").on(table.githubLogin)],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    encryptedAccessToken: text("encrypted_access_token"),
    tokenKeyVersion: integer("token_key_version").notNull().default(1),
    scopes: text("scopes").array().notNull().default([]),
    importedStarsCount: integer("imported_stars_count").notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    index("auth_accounts_user_idx").on(table.userId),
  ],
);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubId: bigint("github_id", { mode: "number" }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    url: text("url").notNull(),
    homepageUrl: text("homepage_url"),
    demoUrl: text("demo_url"),
    description: text("description"),
    chineseTitle: text("chinese_title").notNull(),
    summary: text("summary").notNull(),
    primaryLanguage: text("primary_language"),
    languages: text("languages").array().notNull().default([]),
    topics: text("topics").array().notNull().default([]),
    domains: text("domains").array().notNull().default([]),
    projectType: text("project_type").notNull(),
    deployment: text("deployment").array().notNull().default([]),
    difficulty: text("difficulty").notNull().default("medium"),
    maturity: text("maturity").notNull().default("stable"),
    licenseSpdx: text("license_spdx"),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    watchers: integer("watchers"),
    ownerFollowers: integer("owner_followers"),
    archived: boolean("archived").notNull().default(false),
    mirror: boolean("mirror").notNull().default(false),
    fork: boolean("fork").notNull().default(false),
    hasReadme: boolean("has_readme").notNull().default(true),
    qualityScore: real("quality_score").notNull().default(0),
    dataSource: dataSourceEnum("data_source").notNull().default("demo"),
    dataUpdatedAt: timestamp("data_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    repoCreatedAt: timestamp("repo_created_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("repositories_full_name_unique").on(table.fullName),
    uniqueIndex("repositories_github_id_unique").on(table.githubId),
    index("repositories_language_idx").on(table.primaryLanguage),
    index("repositories_type_idx").on(table.projectType),
    index("repositories_updated_idx").on(table.dataUpdatedAt),
  ],
);

export const repositorySnapshots = pgTable(
  "repository_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    stars: integer("stars").notNull(),
    forks: integer("forks").notNull(),
    commits: integer("commits").notNull().default(0),
    openIssues: integer("open_issues").notNull().default(0),
    openPullRequests: integer("open_pull_requests").notNull().default(0),
    contributors: integer("contributors").notNull().default(0),
    releaseCount: integer("release_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("repository_snapshots_repo_time_unique").on(
      table.repositoryId,
      table.capturedAt,
    ),
    index("repository_snapshots_time_idx").on(table.capturedAt),
  ],
);

export const repositoryDocuments = pgTable(
  "repository_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull().default("semantic"),
    content: text("content").notNull(),
    readmeSummary: text("readme_summary"),
    coreFeatures: text("core_features").array().notNull().default([]),
    targetUsers: text("target_users").array().notNull().default([]),
    technologies: text("technologies").array().notNull().default([]),
    dependencies: text("dependencies").array().notNull().default([]),
    sourceUrl: text("source_url"),
    etag: text("etag"),
    parserVersion: text("parser_version").notNull(),
    confidence: real("confidence").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("repository_documents_repo_type_unique").on(
      table.repositoryId,
      table.documentType,
    ),
    index("repository_documents_repo_idx").on(table.repositoryId),
  ],
);

export const repositoryEmbeddings = pgTable(
  "repository_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => repositoryDocuments.id, {
      onDelete: "cascade",
    }),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    embedding: vector("embedding", { dimensions: 384 }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("repository_embeddings_repo_model_unique").on(
      table.repositoryId,
      table.model,
    ),
    index("repository_embeddings_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const repositoryRelations = pgTable(
  "repository_relations",
  {
    fromRepositoryId: uuid("from_repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    toRepositoryId: uuid("to_repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    weight: real("weight").notNull().default(1),
    evidence: text("evidence"),
    source: dataSourceEnum("source").notNull().default("github"),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [
        table.fromRepositoryId,
        table.toRepositoryId,
        table.relationType,
      ],
    }),
    index("repository_relations_to_idx").on(table.toRepositoryId),
  ],
);

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  longTerm: jsonb("long_term").notNull().default({}),
  shortTerm: jsonb("short_term").notNull().default({}),
  capability: jsonb("capability").notNull().default({}),
  negativePreferences: jsonb("negative_preferences").notNull().default({}),
  exposureMemory: jsonb("exposure_memory").notNull().default({}),
  version: integer("version").notNull().default(1),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  ...timestamps,
});

export const userInterestItems = pgTable(
  "user_interest_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    scope: text("scope").notNull(),
    weight: real("weight").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_interest_items_unique").on(
      table.userId,
      table.kind,
      table.value,
      table.scope,
    ),
    index("user_interest_items_user_idx").on(table.userId),
  ],
);

export const algorithmVersions = pgTable(
  "algorithm_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    kind: text("kind").notNull(),
    config: jsonb("config").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("algorithm_versions_name_version_unique").on(
      table.name,
      table.version,
    ),
  ],
);

export const searchSessions = pgTable(
  "search_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawQuery: text("raw_query").notNull(),
    normalizedQuery: text("normalized_query").notNull(),
    intent: jsonb("intent").notNull(),
    mode: text("mode").notNull().default("comprehensive"),
    affectsProfile: boolean("affects_profile").notNull().default(true),
    algorithmVersionId: uuid("algorithm_version_id").references(
      () => algorithmVersions.id,
    ),
    parserVersion: text("parser_version").notNull(),
    latencyMs: integer("latency_ms"),
    resultCount: integer("result_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("search_sessions_user_time_idx").on(table.userId, table.createdAt),
  ],
);

export const searchResults = pgTable(
  "search_results",
  {
    searchSessionId: uuid("search_session_id")
      .notNull()
      .references(() => searchSessions.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    score: real("score").notNull(),
    cluster: text("cluster").notNull(),
    retrievalSources: text("retrieval_sources").array().notNull(),
    features: jsonb("features").notNull(),
    explanation: jsonb("explanation").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.searchSessionId, table.repositoryId] }),
    uniqueIndex("search_results_session_position_unique").on(
      table.searchSessionId,
      table.position,
    ),
  ],
);

export const feedQueues = pgTable(
  "feed_queues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    queueDate: timestamp("queue_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("warm"),
    algorithmVersionId: uuid("algorithm_version_id").references(
      () => algorithmVersions.id,
    ),
    candidateCount: integer("candidate_count").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("feed_queues_user_date_unique").on(
      table.userId,
      table.queueDate,
    ),
  ],
);

export const feedQueueItems = pgTable(
  "feed_queue_items",
  {
    queueId: uuid("queue_id")
      .notNull()
      .references(() => feedQueues.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    initialPosition: integer("initial_position").notNull(),
    candidateType: text("candidate_type").notNull(),
    score: real("score").notNull(),
    retrievalSources: text("retrieval_sources").array().notNull(),
    features: jsonb("features").notNull(),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.queueId, table.repositoryId] })],
);

export const feedBatches = pgTable(
  "feed_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queueId: uuid("queue_id")
      .notNull()
      .references(() => feedQueues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    batchNumber: integer("batch_number").notNull(),
    sessionId: text("session_id").notNull(),
    repositoryIds: uuid("repository_ids").array().notNull(),
    rerankContext: jsonb("rerank_context").notNull(),
    algorithmVersionId: uuid("algorithm_version_id").references(
      () => algorithmVersions.id,
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("feed_batches_queue_number_unique").on(
      table.queueId,
      table.batchNumber,
    ),
    index("feed_batches_user_time_idx").on(table.userId, table.createdAt),
  ],
);

export const exposures = pgTable(
  "exposures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    surface: text("surface").notNull(),
    feedBatchId: uuid("feed_batch_id").references(() => feedBatches.id, {
      onDelete: "set null",
    }),
    searchSessionId: uuid("search_session_id").references(
      () => searchSessions.id,
      { onDelete: "set null" },
    ),
    position: integer("position").notNull(),
    retrievalSources: text("retrieval_sources").array().notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    modelFeatures: jsonb("model_features").notNull(),
    exposedAt: timestamp("exposed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updateKind: text("update_kind").notNull().default("normal"),
    ...timestamps,
  },
  (table) => [
    index("exposures_user_repo_time_idx").on(
      table.userId,
      table.repositoryId,
      table.exposedAt,
    ),
    index("exposures_batch_idx").on(table.feedBatchId),
  ],
);

export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    exposureId: uuid("exposure_id").references(() => exposures.id, {
      onDelete: "set null",
    }),
    type: interactionTypeEnum("type").notNull(),
    reason: text("reason"),
    weight: real("weight").notNull(),
    surface: text("surface").notNull(),
    sessionId: text("session_id").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("interactions_user_time_idx").on(table.userId, table.occurredAt),
    index("interactions_repo_type_idx").on(table.repositoryId, table.type),
  ],
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("collections_user_name_unique").on(table.userId, table.name),
  ],
);

export const collectionRepositories = pgTable(
  "collection_repositories",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    status: libraryStatusEnum("status").notNull().default("read_later"),
    tags: text("tags").array().notNull().default([]),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.repositoryId] }),
    index("collection_repositories_repo_idx").on(table.repositoryId),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [
    index("notes_user_repo_idx").on(table.userId, table.repositoryId),
  ],
);

export const learningLogs = pgTable(
  "learning_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    status: libraryStatusEnum("status").notNull(),
    minutes: integer("minutes").notNull().default(0),
    note: text("note"),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("learning_logs_user_time_idx").on(table.userId, table.loggedAt),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rawQuery: text("raw_query").notNull(),
    intent: jsonb("intent").notNull(),
    queryVector: real("query_vector").array().notNull().default([]),
    requiredConstraints: jsonb("required_constraints").notNull().default({}),
    negativeConstraints: text("negative_constraints")
      .array()
      .notNull()
      .default([]),
    timeRange: text("time_range").notNull().default("any"),
    minRelevance: real("min_relevance").notNull().default(0.55),
    minQuality: real("min_quality").notNull().default(0.55),
    heatThreshold: real("heat_threshold").notNull().default(0),
    frequency: subscriptionFrequencyEnum("frequency")
      .notNull()
      .default("weekly"),
    enabled: boolean("enabled").notNull().default(true),
    lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("subscriptions_user_name_unique").on(table.userId, table.name),
  ],
);

export const subscriptionMatches = pgTable(
  "subscription_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    score: real("score").notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    majorUpdateKey: text("major_update_key"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("subscription_matches_dedupe_unique").on(
      table.subscriptionId,
      table.repositoryId,
      table.majorUpdateKey,
    ),
    index("subscription_matches_time_idx").on(table.matchedAt),
  ],
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    repositoryIds: uuid("repository_ids").array().notNull(),
    status: text("status").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("email_deliveries_user_time_idx").on(table.userId, table.createdAt),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobType: text("job_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    payload: jsonb("payload").notNull().default({}),
    result: jsonb("result"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("job_runs_idempotency_unique").on(
      table.jobType,
      table.idempotencyKey,
    ),
    index("job_runs_status_created_idx").on(table.status, table.createdAt),
  ],
);

// Commercial delivery remains physically and analytically isolated from
// natural search/recommendation. These tables are dormant behind a feature flag.
export const sponsoredCandidates = pgTable(
  "sponsored_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: text("campaign_id").notNull(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"),
    relevanceFloor: real("relevance_floor").notNull().default(0.65),
    qualityFloor: real("quality_floor").notNull().default(0.75),
    safetyApproved: boolean("safety_approved").notNull().default(false),
    commercialScore: real("commercial_score").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sponsored_candidates_campaign_repo_unique").on(
      table.campaignId,
      table.repositoryId,
    ),
    index("sponsored_candidates_status_time_idx").on(
      table.status,
      table.startsAt,
      table.endsAt,
    ),
  ],
);

export const sponsoredExposures = pgTable(
  "sponsored_exposures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => sponsoredCandidates.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    surface: text("surface").notNull(),
    position: integer("position").notNull(),
    policyVersion: text("policy_version").notNull(),
    relevanceScore: real("relevance_score").notNull(),
    qualityScore: real("quality_score").notNull(),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    exposedAt: timestamp("exposed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("sponsored_exposures_user_time_idx").on(
      table.userId,
      table.exposedAt,
    ),
    index("sponsored_exposures_candidate_time_idx").on(
      table.candidateId,
      table.exposedAt,
    ),
  ],
);
