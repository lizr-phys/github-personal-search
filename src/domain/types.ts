import { z } from "zod";

export const ProjectTypeSchema = z.enum([
  "application",
  "library",
  "framework",
  "template",
  "tutorial",
  "tool",
]);
export type ProjectType = z.infer<typeof ProjectTypeSchema>;

export const SearchIntentSchema = z.object({
  rawQuery: z.string().min(1).max(300),
  normalizedQuery: z.string().min(1).max(500),
  task: z.string().max(300),
  domains: z.array(z.string()).max(20),
  projectTypes: z.array(ProjectTypeSchema).max(6),
  technologies: z.array(z.string()).max(30),
  languages: z.array(z.string()).max(20),
  platforms: z.array(z.string()).max(20),
  deployment: z.array(z.string()).max(20),
  maturity: z.string().optional(),
  difficulty: z.string().optional(),
  licenses: z.array(z.string()).max(20).optional(),
  negativeConstraints: z.array(z.string()).max(30),
  timeIntent: z.enum(["latest", "recent", "classic", "any"]).optional(),
  generatedTerms: z.array(z.string()).max(60),
  confidence: z
    .object({
      overall: z.number().min(0).max(1),
      domains: z.number().min(0).max(1),
      technologies: z.number().min(0).max(1),
      projectTypes: z.number().min(0).max(1),
      constraints: z.number().min(0).max(1),
    })
    .optional(),
  corrections: z
    .array(z.object({ from: z.string().max(60), to: z.string().max(60) }))
    .max(20)
    .optional(),
});
export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export type Evidence = {
  type: "metadata" | "readme" | "topic" | "release" | "interaction" | "profile";
  label: string;
  source: string;
  confidence: number;
};

export type TrendWindow = {
  stars: number;
  forks: number;
  activity: number;
  issuesAndPrs: number;
  heat: number;
};

export type Repository = {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  githubUrl: string;
  homepageUrl?: string;
  demoUrl?: string;
  chineseTitle: string;
  description: string;
  summary: string;
  problem: string;
  targetUsers: string[];
  coreFeatures: string[];
  technologies: string[];
  language: string;
  languages: string[];
  topics: string[];
  domains: string[];
  cluster: string;
  projectType: ProjectType;
  deployment: string[];
  difficulty: "beginner" | "medium" | "advanced";
  maturity: "experimental" | "growing" | "stable";
  maintenance: "active" | "slower" | "unknown";
  license: string;
  stars: number;
  forks: number;
  /** GitHub repository subscribers/watchers when available. */
  watchers?: number;
  /** Public followers of the repository owner when fetched from GitHub. */
  ownerFollowers?: number;
  trend1d: TrendWindow;
  trend7d: TrendWindow;
  trend30d: TrendWindow;
  pushedAt: string;
  releasedAt?: string;
  createdAt: string;
  readmeSummary: string;
  quality: number;
  novelty: number;
  archived: boolean;
  mirror: boolean;
  fork: boolean;
  hasReadme: boolean;
  dataSource: "demo" | "github";
  dataUpdatedAt: string;
  evidence: Evidence[];
  similar: string[];
};

export type InterestProfile = {
  completed: boolean;
  longTerm: Record<string, number>;
  shortTerm: Record<string, number>;
  languages: Record<string, number>;
  difficulty: "beginner" | "medium" | "advanced";
  blockedLanguages: string[];
  blockedOrganizations: string[];
  blockedTypes: ProjectType[];
  searchAffectsProfile: boolean;
  sources: Array<{ label: string; detail: string; at: string }>;
};

export type InteractionType =
  | "interested"
  | "favorite"
  | "open_github"
  | "open_demo"
  | "learn"
  | "ran"
  | "reproduced"
  | "used"
  | "not_interested"
  | "seen"
  | "too_complex"
  | "language_mismatch"
  | "unmaintained"
  | "block_similar"
  | "dwell"
  | "expand";

export type RankingFeatures = {
  semantic: number;
  lexical: number;
  constraints: number;
  quality: number;
  freshness: number;
  personal: number;
  novelty: number;
  longTerm: number;
  shortTerm: number;
  collaborative: number;
  exploration: number;
  penalty: number;
};

export type RankedRepository = {
  repository: Repository;
  score: number;
  features: RankingFeatures;
  retrievalSources: string[];
  explanation: string;
  explanationEvidence: Evidence[];
  candidateType:
    | "strong"
    | "short_term"
    | "trending"
    | "niche"
    | "exploration"
    | "sponsored";
};
