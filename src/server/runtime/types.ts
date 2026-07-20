import type {
  InterestProfile,
  InteractionType,
  RankingFeatures,
  Repository,
  SearchIntent,
} from "@/domain/types";

export type RuntimeInteraction = {
  id: string;
  repositoryId: string;
  type: InteractionType;
  reason?: string;
  weight: number;
  surface: string;
  sessionId: string;
  algorithmVersion: string;
  exposureId?: string;
  at: string;
  undoneAt?: string;
};

export type RuntimeExposure = {
  id: string;
  repositoryId: string;
  surface: "feed" | "search" | "trends" | "email";
  batchId?: string;
  searchId?: string;
  position: number;
  retrievalSources: string[];
  algorithmVersion: string;
  features: RankingFeatures;
  at: string;
};

export type RuntimeBatchItem = {
  repositoryId: string;
  score: number;
  candidateType: string;
  retrievalSources: string[];
  features: RankingFeatures;
  explanation: string;
  explanationEvidence: Array<{
    type: string;
    label: string;
    source: string;
    confidence: number;
  }>;
};

export type RuntimeBatch = {
  id: string;
  sessionId: string;
  batchNumber: number;
  items: RuntimeBatchItem[];
  createdAt: string;
  algorithmVersion: string;
};

export type RuntimeWarmQueue = {
  userId: string;
  date: string;
  generatedAt: string;
  algorithmVersion: string;
  catalogUpdatedAt: string;
  repositoryIds: string[];
};

export type RuntimeSearch = {
  id: string;
  query: string;
  intent: SearchIntent;
  mode: string;
  affectsProfile: boolean;
  resultIds: string[];
  timingMs: number;
  createdAt: string;
};

export type LibraryStatus =
  | "read_later"
  | "learning"
  | "ran"
  | "reproduced"
  | "used"
  | "paused"
  | "outdated";

export type LibraryEntry = {
  repositoryId: string;
  collectionId: string;
  status: LibraryStatus;
  tags: string[];
  note: string;
  addedAt: string;
  updatedAt: string;
};

export type RuntimeSubscription = {
  id: string;
  name: string;
  rawQuery: string;
  intent: SearchIntent;
  queryVector: number[];
  frequency: "daily" | "weekly" | "monthly";
  minRelevance: number;
  minQuality: number;
  heatThreshold: number;
  enabled: boolean;
  deliveredRepositoryIds: Array<{
    repositoryId: string;
    deliveredAt: string;
    majorUpdateKey?: string;
  }>;
  createdAt: string;
};

export type RuntimeEmail = {
  id: string;
  subscriptionId?: string;
  subject: string;
  html: string;
  repositoryIds: string[];
  status: "preview" | "sent" | "skipped";
  createdAt: string;
};

export type RuntimeRepositorySnapshot = {
  repositoryId: string;
  stars: number;
  forks: number;
  capturedAt: string;
  releaseTag?: string;
};

export type RuntimeState = {
  schemaVersion: 1;
  user: {
    id: string;
    displayName: string;
    isDemo: boolean;
    githubLogin?: string;
    githubScopes: string[];
    importedStars: string[];
    githubTokenEncrypted?: string;
    githubConnectedAt?: string;
  };
  profile: InterestProfile;
  interactions: RuntimeInteraction[];
  exposures: RuntimeExposure[];
  batches: RuntimeBatch[];
  warmQueues: RuntimeWarmQueue[];
  searches: RuntimeSearch[];
  repositories: Repository[];
  repositorySnapshots: RuntimeRepositorySnapshot[];
  githubSync: {
    status: "idle" | "running" | "succeeded" | "partial" | "failed";
    lastStartedAt?: string;
    lastCompletedAt?: string;
    lastError?: string;
    indexedCount: number;
    source: "none" | "public" | "oauth" | "webhook";
  };
  collections: Array<{
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
    createdAt: string;
  }>;
  library: LibraryEntry[];
  learningLogs: Array<{
    id: string;
    repositoryId: string;
    status: LibraryStatus;
    minutes: number;
    note?: string;
    at: string;
  }>;
  relations: Array<{
    fromRepositoryId: string;
    toRepositoryId: string;
    type: string;
    note?: string;
    at: string;
  }>;
  subscriptions: RuntimeSubscription[];
  emails: RuntimeEmail[];
  metrics: {
    cacheHits: number;
    cacheMisses: number;
    searchCount: number;
    feedGenerations: number;
    negativeFeedback: number;
    githubRemaining?: number;
    githubResetAt?: string;
    fetchSuccess: number;
    fetchFailure: number;
    aiCalls?: number;
    aiFallbacks?: number;
  };
};
