import { NextResponse, type NextRequest } from "next/server";

import { GitHubClient, type GitHubStarredRepository } from "@/github/client";
import {
  mapGitHubRepository,
  storeGitHubRepositories,
} from "@/github/repository-sync";
import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { decryptSecret } from "@/server/security/crypto";
import { runtimeStore } from "@/server/runtime/store";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    const state = await runtimeStore.read();
    if (!state.user.githubTokenEncrypted)
      return NextResponse.json(
        { error: { code: "NOT_CONNECTED", message: "请先连接 GitHub。" } },
        { status: 409 },
      );
    const github = new GitHubClient(
      decryptSecret(state.user.githubTokenEncrypted),
    );
    const imported: GitHubStarredRepository[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const response = await github.request<GitHubStarredRepository[]>(
        `/user/starred?per_page=100&page=${page}`,
        { cacheSeconds: 60 },
      );
      imported.push(...response.data);
      if (response.data.length < 100) break;
    }
    await runtimeStore.mutate((runtime) => {
      runtime.user.importedStars = [
        ...new Set(imported.map((item) => item.full_name)),
      ];
      const languageCounts: Record<string, number> = {};
      for (const item of imported)
        if (item.language)
          languageCounts[item.language] =
            (languageCounts[item.language] ?? 0) + 1;
      for (const [language, count] of Object.entries(languageCounts))
        runtime.profile.languages[language] = Math.min(
          8,
          (runtime.profile.languages[language] ?? 0) + Math.log1p(count),
        );
      runtime.profile.sources.unshift({
        label: "GitHub Stars 导入",
        detail: `读取 ${imported.length} 个公开 Star 仓库`,
        at: new Date().toISOString(),
      });
    });
    const mapped = imported.map((repository) =>
      mapGitHubRepository(repository),
    );
    const indexed = await storeGitHubRepositories(mapped, "oauth");
    return NextResponse.json({
      ok: true,
      imported: imported.length,
      indexed,
      dataScope: [
        "public Stars",
        "repository metadata",
        "primary language",
        "topics when available",
      ],
    });
  } catch (error) {
    return apiError(error, "GITHUB_IMPORT_FAILED", 502);
  }
}
