import { NextResponse, type NextRequest } from "next/server";

import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { isRecommendationEligible } from "@/recommendation/quality-policy";

export async function GET(request: NextRequest) {
  const catalog = await getRepositoryCatalog();
  const window = (
    ["1d", "7d", "30d"].includes(
      request.nextUrl.searchParams.get("window") ?? "",
    )
      ? request.nextUrl.searchParams.get("window")
      : "7d"
  ) as "1d" | "7d" | "30d";
  const language = request.nextUrl.searchParams.get("language");
  const domain = request.nextUrl.searchParams.get("domain");
  const kind = request.nextUrl.searchParams.get("kind") ?? "rising";
  const age = request.nextUrl.searchParams.get("age") ?? "any";
  const trendKey =
    window === "1d" ? "trend1d" : window === "30d" ? "trend30d" : "trend7d";
  const now = Date.now();
  const items = catalog.repositories
    .filter(isRecommendationEligible)
    .filter((item) => !language || item.language === language)
    .filter((item) => !domain || item.domains.includes(domain))
    .filter((item) => {
      if (age === "new")
        return (
          now - new Date(item.createdAt).getTime() < 365 * 24 * 60 * 60 * 1000
        );
      if (age === "young")
        return (
          now - new Date(item.createdAt).getTime() <
          3 * 365 * 24 * 60 * 60 * 1000
        );
      return true;
    })
    .filter((item) => kind !== "updates" || item.releasedAt)
    .sort((left, right) =>
      kind === "new"
        ? new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
        : right[trendKey].heat - left[trendKey].heat,
    )
    .slice(0, 30);
  return NextResponse.json({
    items,
    window,
    kind,
    dataUpdatedAt: catalog.dataUpdatedAt,
    demo: catalog.mode === "demo",
    catalog: {
      mode: catalog.mode,
      githubCount: catalog.githubCount,
      demoCount: catalog.demoCount,
    },
    available: {
      languages: [
        ...new Set(catalog.repositories.map((item) => item.language)),
      ].sort(),
      domains: [
        ...new Set(catalog.repositories.flatMap((item) => item.domains)),
      ].sort(),
    },
  });
}
