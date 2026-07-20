import { SUBSCRIPTION_DEDUP_DAYS } from "@/config/algorithms";
import type { SearchIntent } from "@/domain/types";
import { embeddingProvider } from "@/ai/providers";
import { signEmailFeedback } from "@/mail/feedback-token";
import { renderDigest } from "@/mail/template";
import { runtimeStore } from "@/server/runtime/store";
import { getRepositoryCatalog } from "@/server/repositories/catalog";
import { searchRepositories } from "@/search/service";

export function isSubscriptionDeliveryEligible(
  repositoryId: string,
  delivered: Array<{
    repositoryId: string;
    deliveredAt: string;
    majorUpdateKey?: string;
  }>,
  now = Date.now(),
  majorUpdateKey?: string,
): boolean {
  const cutoff = now - SUBSCRIPTION_DEDUP_DAYS * 24 * 60 * 60 * 1000;
  return !delivered.some(
    (item) =>
      item.repositoryId === repositoryId &&
      new Date(item.deliveredAt).getTime() >= cutoff &&
      (!majorUpdateKey || item.majorUpdateKey === majorUpdateKey),
  );
}

export async function createSubscription(input: {
  name: string;
  rawQuery: string;
  intent: SearchIntent;
  frequency: "daily" | "weekly" | "monthly";
  minRelevance: number;
  minQuality: number;
  heatThreshold: number;
}) {
  const queryVector = await embeddingProvider.embed(
    [input.intent.normalizedQuery, ...input.intent.generatedTerms].join(" "),
  );
  return runtimeStore.mutate((state) => {
    const subscription = {
      id: crypto.randomUUID(),
      ...input,
      queryVector,
      enabled: true,
      deliveredRepositoryIds: [],
      createdAt: new Date().toISOString(),
    };
    state.subscriptions.push(subscription);
    return subscription;
  });
}

export async function listSubscriptions() {
  return (await runtimeStore.read()).subscriptions;
}

export async function updateSubscription(
  id: string,
  input: { enabled?: boolean; frequency?: "daily" | "weekly" | "monthly" },
) {
  return runtimeStore.mutate((state) => {
    const subscription = state.subscriptions.find((item) => item.id === id);
    if (!subscription) return undefined;
    if (input.enabled !== undefined) subscription.enabled = input.enabled;
    if (input.frequency) subscription.frequency = input.frequency;
    return subscription;
  });
}

export async function buildEmailPreview(subscriptionId?: string) {
  const state = await runtimeStore.read();
  const catalog = await getRepositoryCatalog();
  const subscription = subscriptionId
    ? state.subscriptions.find((item) => item.id === subscriptionId)
    : state.subscriptions[0];
  const intent = subscription?.intent ?? {
    rawQuery: "可自托管的家庭照片管理与备份",
    normalizedQuery: "自托管 家庭照片 管理 备份",
    task: "发现可自托管的照片管理与备份项目",
    domains: ["self-hosted", "knowledge-base"],
    projectTypes: [],
    technologies: [],
    languages: [],
    platforms: ["web"],
    deployment: [],
    negativeConstraints: ["archived"],
    timeIntent: "recent" as const,
    generatedTerms: ["self-hosted photo management", "photo backup", "gallery"],
  };
  const search = await searchRepositories({
    query: intent.rawQuery,
    profile: state.profile,
    repositories: catalog.repositories,
    intentOverride: intent,
  });
  const eligible = search.results
    .filter(
      (item) =>
        isSubscriptionDeliveryEligible(
          item.repository.id,
          subscription?.deliveredRepositoryIds ?? [],
        ) &&
        item.score >= (subscription?.minRelevance ?? 0.25) &&
        item.repository.quality >= (subscription?.minQuality ?? 0.75),
    )
    .slice(0, 10);
  const repositories = eligible.map((item) => item.repository);
  const sections = [
    {
      name: "新出现",
      repositories: repositories
        .filter((item) => item.novelty > 0.7)
        .slice(0, 3),
    },
    {
      name: "快速上升",
      repositories: [...repositories]
        .sort((a, b) => b.trend7d.heat - a.trend7d.heat)
        .slice(0, 3),
    },
    {
      name: "重大更新",
      repositories: repositories.filter((item) => item.releasedAt).slice(0, 2),
    },
    { name: "为你发现", repositories: repositories.slice(-3) },
  ];
  const emailId = crypto.randomUUID();
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const repositoryLinks = Object.fromEntries(
    repositories.map((repository) => {
      const link = (action: "expand" | "favorite" | "not_interested") =>
        `${appUrl}/api/mail/feedback?token=${encodeURIComponent(signEmailFeedback({ emailId, repositoryId: repository.id, action, expiresAt }))}`;
      return [
        repository.id,
        {
          view: link("expand"),
          favorite: link("favorite"),
          notRelevant: link("not_interested"),
        },
      ];
    }),
  );
  const html = renderDigest({
    title: subscription?.name ?? "本周开源项目发现",
    sections,
    unsubscribeUrl: `${appUrl}/settings#email`,
    repositoryLinks,
  });
  return runtimeStore.mutate((current) => {
    const email = {
      id: emailId,
      subscriptionId: subscription?.id,
      subject: `GPS · ${subscription?.name ?? "本周开源项目发现"}`,
      html,
      repositoryIds: repositories.map((item) => item.id),
      status: repositories.length ? ("preview" as const) : ("skipped" as const),
      createdAt: new Date().toISOString(),
    };
    current.emails.push(email);
    return { email, sections, skipped: !repositories.length };
  });
}
