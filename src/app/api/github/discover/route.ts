import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { GitHubClient } from "@/github/client";
import {
  discoverGitHubRepositories,
  fetchGitHubRepository,
  storeGitHubRepositories,
} from "@/github/repository-sync";
import { queryParser } from "@/search/query-parser";
import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { runtimeStore } from "@/server/runtime/store";
import { checkRateLimit } from "@/server/security/rate-limit";
import { decryptSecret } from "@/server/security/crypto";

const DiscoverSchema = z
  .object({
    query: z.string().trim().min(1).max(300).optional(),
    fullName: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
      .optional(),
    limit: z.number().int().min(1).max(12).default(8),
  })
  .refine((input) => Boolean(input.query || input.fullName), {
    message: "query or fullName is required",
  });

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const state = await runtimeStore.read();
  return NextResponse.json({
    sync: state.githubSync,
    repositories: state.repositories.map((repository) => ({
      id: repository.id,
      fullName: repository.fullName,
      stars: repository.stars,
      dataUpdatedAt: repository.dataUpdatedAt,
      hasReadme: repository.hasReadme,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  const rate = checkRateLimit(`github-discover:${user.userId}`, 8, 60_000);
  if (!rate.allowed)
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT",
          message: "GitHub 同步请求过于频繁。",
          resetAt: rate.resetAt,
        },
      },
      { status: 429 },
    );
  try {
    const input = DiscoverSchema.parse(await request.json());
    const state = await runtimeStore.read();
    const client = new GitHubClient(
      state.user.githubTokenEncrypted
        ? decryptSecret(state.user.githubTokenEncrypted)
        : undefined,
    );
    await runtimeStore.mutate((current) => {
      current.githubSync = {
        ...current.githubSync,
        status: "running",
        lastStartedAt: new Date().toISOString(),
        lastError: undefined,
        source: state.user.githubTokenEncrypted ? "oauth" : "public",
      };
    });
    let repositories;
    let total = 1;
    let incomplete = false;
    if (input.fullName)
      repositories = [await fetchGitHubRepository(client, input.fullName)];
    else {
      const intent = queryParser.parse(input.query!);
      const englishTerms = [
        ...intent.technologies,
        ...intent.languages,
        ...intent.generatedTerms,
        ...intent.domains,
      ]
        .filter((term) => /^[\x20-\x7E]+$/.test(term))
        .slice(0, 2);
      const githubQuery = englishTerms.length
        ? englishTerms.join(" ")
        : input.query!;
      const discovered = await discoverGitHubRepositories(
        client,
        githubQuery,
        input.limit,
      );
      const enrichCount = state.user.githubTokenEncrypted
        ? Math.min(4, discovered.repositories.length)
        : Math.min(2, discovered.repositories.length);
      repositories = await Promise.all(
        discovered.repositories.map((repository, index) =>
          index < enrichCount
            ? fetchGitHubRepository(client, repository.fullName).catch(
                () => repository,
              )
            : repository,
        ),
      );
      total = discovered.total;
      incomplete = discovered.incomplete;
    }
    const indexed = await storeGitHubRepositories(
      repositories,
      state.user.githubTokenEncrypted ? "oauth" : "public",
    );
    return NextResponse.json({
      ok: true,
      added: repositories.length,
      indexed,
      total,
      incomplete,
      repositories,
      source: state.user.githubTokenEncrypted ? "oauth" : "public",
    });
  } catch (error) {
    await runtimeStore.mutate((state) => {
      state.githubSync.status = "failed";
      state.githubSync.lastError = (error as Error).message;
      state.githubSync.lastCompletedAt = new Date().toISOString();
    });
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "GitHub 同步条件无效。",
            issues: error.issues,
          },
        },
        { status: 400 },
      );
    return apiError(error, "GITHUB_DISCOVERY_FAILED", 502);
  }
}
