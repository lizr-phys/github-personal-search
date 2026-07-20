import { z } from "zod";

import type { Repository } from "@/domain/types";
import { TtlLruCache } from "@/lib/ttl-cache";

export type Locale = "zh" | "en";
export type ChatMessage = { role: "user" | "assistant"; content: string };

export const RepositoryBriefSchema = z.object({
  title: z.string().min(2).max(90),
  oneLine: z.string().min(10).max(180),
  overview: z.string().min(30).max(520),
  highlights: z.array(z.string().min(3).max(100)).min(2).max(4),
  suitableFor: z.string().min(5).max(160),
  caveat: z.string().min(3).max(160),
});
export type RepositoryBriefContent = z.infer<typeof RepositoryBriefSchema>;
export type RepositoryBrief = RepositoryBriefContent & {
  provider: "deepseek" | "local";
  model: string;
  evidence: string[];
  confidence: number;
};

const AgentActionSchema = z.object({
  type: z.enum(["navigate", "search"]),
  label: z.string().min(2).max(40),
  href: z.string().startsWith("/").max(500),
});
export const AgentResponseSchema = z.object({
  reply: z.string().min(2).max(1_200),
  actions: z.array(AgentActionSchema).max(3).default([]),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema> & {
  provider: "deepseek" | "local";
  model: string;
};

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

class DeepSeekProvider {
  readonly name = "deepseek";
  readonly model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  private readonly apiKey = process.env.DEEPSEEK_API_KEY;
  private readonly baseUrl =
    process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

  get available(): boolean {
    return Boolean(this.apiKey);
  }

  async json<T>(input: {
    system: string;
    messages: ChatMessage[];
    schema: z.ZodType<T>;
    maxTokens?: number;
  }): Promise<T> {
    if (!this.apiKey) throw new Error("AI provider is not configured");
    const endpoint = new URL("/chat/completions", this.baseUrl);
    if (endpoint.protocol !== "https:")
      throw new Error("AI provider URL must use HTTPS");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: input.system },
            ...input.messages,
          ],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          temperature: 0.25,
          max_tokens: input.maxTokens ?? 800,
          stream: false,
        }),
      });
      if (!response.ok)
        throw new Error(`AI provider returned ${response.status}`);
      const payload = (await response.json()) as DeepSeekResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI provider returned an empty response");
      return input.schema.parse(JSON.parse(content));
    } finally {
      clearTimeout(timeout);
    }
  }
}

const provider = new DeepSeekProvider();
const briefCache = new TtlLruCache<Promise<RepositoryBrief>>(
  300,
  24 * 60 * 60 * 1_000,
);

const ENGLISH_DOMAIN: Record<string, string> = {
  "web-development": "web development",
  "developer-tools": "developer tooling",
  "machine-learning": "machine learning",
  "data-engineering": "data engineering",
  database: "databases",
  devops: "cloud and operations",
  mobile: "mobile development",
  "game-development": "game development",
  security: "application security",
  "self-hosted": "self-hosting",
  "knowledge-base": "knowledge management",
  "scientific-computing": "scientific computing",
};

function localBrief(repository: Repository, locale: Locale): RepositoryBrief {
  const evidence = repository.evidence.slice(0, 4).map((item) => item.label);
  if (locale === "en") {
    const purpose = repository.domains
      .slice(0, 2)
      .map((item) => ENGLISH_DOMAIN[item] ?? item.replaceAll("-", " "))
      .join(" and ");
    return {
      title: `${repository.name} · ${purpose || "open-source project"}`,
      oneLine: `An open-source ${repository.projectType} for ${purpose || "software development"}, built primarily with ${repository.language}.`,
      overview: `${repository.fullName} focuses on ${purpose || "an open-source workflow"}. Available metadata shows ${repository.stars.toLocaleString("en-US")} Stars, ${repository.license} licensing, and ${repository.maintenance === "active" ? "active maintenance" : "a slower maintenance cadence"}. Review the linked README before adopting it in production.`,
      highlights: [
        `Primary language: ${repository.language}`,
        `Project form: ${repository.projectType}`,
        `Deployment: ${repository.deployment.join(", ") || "source"}`,
      ],
      suitableFor: `Developers evaluating ${purpose || repository.cluster}.`,
      caveat: repository.hasReadme
        ? "Capabilities are limited to repository metadata and README evidence."
        : "README evidence is incomplete; verify capabilities on GitHub.",
      provider: "local",
      model: "evidence-template-en-v1",
      evidence,
      confidence: repository.hasReadme ? 0.78 : 0.58,
    };
  }
  return {
    title: repository.chineseTitle,
    oneLine: repository.summary,
    overview: `${repository.fullName} 主要面向${repository.targetUsers.join("、")}，聚焦 ${repository.domains.slice(0, 3).join("、")}。当前可核验信息包括 ${repository.stars.toLocaleString("zh-CN")} Stars、${repository.license} 许可证与${repository.maintenance === "active" ? "活跃维护" : "较慢维护节奏"}；采用前仍应阅读原始 README。`,
    highlights: repository.coreFeatures.slice(0, 3),
    suitableFor: repository.targetUsers.join("、"),
    caveat: repository.hasReadme
      ? "简介只归纳仓库元数据与 README 证据，不推断未声明能力。"
      : "README 证据不足，请在 GitHub 核验功能与安装方式。",
    provider: "local",
    model: "evidence-template-zh-v1",
    evidence,
    confidence: repository.hasReadme ? 0.8 : 0.58,
  };
}

export async function generateRepositoryBrief(
  repository: Repository,
  locale: Locale,
): Promise<RepositoryBrief> {
  const key = [
    repository.id,
    repository.dataUpdatedAt,
    locale,
    provider.model,
  ].join(":");
  return briefCache.getOrCreate(key, async () => {
    if (!provider.available) return localBrief(repository, locale);
    try {
      const evidence = {
        fullName: repository.fullName,
        originalDescription: repository.description,
        readmeSummary: repository.readmeSummary,
        topics: repository.topics,
        domains: repository.domains,
        technologies: repository.technologies,
        deployment: repository.deployment,
        targetUsers: repository.targetUsers,
        coreFeatures: repository.coreFeatures,
        language: repository.language,
        stars: repository.stars,
        license: repository.license,
        maintenance: repository.maintenance,
        pushedAt: repository.pushedAt,
      };
      const content = await provider.json({
        system: `You write concise, evidence-grounded open-source repository briefs. Return JSON only with keys title, oneLine, overview, highlights, suitableFor, caveat. Write every field in ${locale === "zh" ? "Simplified Chinese" : "English"}. Never invent features, users, maintenance, installation methods, or claims absent from the supplied evidence. State uncertainty in caveat.`,
        messages: [{ role: "user", content: JSON.stringify(evidence) }],
        schema: RepositoryBriefSchema,
        maxTokens: 700,
      });
      return {
        ...content,
        provider: "deepseek",
        model: provider.model,
        evidence: repository.evidence.slice(0, 4).map((item) => item.label),
        confidence: repository.hasReadme ? 0.88 : 0.62,
      };
    } catch {
      return localBrief(repository, locale);
    }
  });
}

export function filterAgentActions(
  actions: z.infer<typeof AgentActionSchema>[],
) {
  const allowed = [
    "/search",
    "/library",
    "/trends",
    "/subscriptions",
    "/profile/interests",
    "/settings",
    "/repository/",
  ];
  return actions.filter(
    (action) =>
      action.href === "/" ||
      allowed.some(
        (prefix) =>
          action.href === prefix ||
          (prefix.endsWith("/") && action.href.startsWith(prefix)) ||
          action.href.startsWith(`${prefix}?`),
      ),
  );
}

function localAgent(
  message: string,
  locale: Locale,
  currentPath = "/",
): AgentResponse {
  const normalized = message.trim().replace(/\s+/g, " ");
  const greeting = /^(你好|您好|嗨|hello|hi|hey)[！!。.\s]*$/i.test(normalized);
  const wantsTrend = /趋势|上升|热门|最近|本周|trend|rising|popular|recent/i.test(
    normalized,
  );
  const wantsSubscription =
    /订阅|提醒|邮件|通知|subscribe|subscription|alert|email/i.test(normalized);
  const wantsProfile = /兴趣|偏好|画像|屏蔽|interest|preference|profile|block/i.test(
    normalized,
  );
  const wantsLibrary = /收藏|知识库|笔记|学习记录|library|saved|note/i.test(
    normalized,
  );
  const managesLibrary =
    wantsLibrary &&
    /我的|打开|查看|管理|整理|记录|已收藏|my|open|view|manage|organize|saved/i.test(
      normalized,
    );
  const buildsAgent =
    /(做|开发|构建|搭建|二次开发).{0,12}(agent|智能体)|(agent|智能体).{0,12}(框架|开发|工具调用|workflow)/i.test(
      normalized,
    );
  const wantsSearch =
    buildsAgent ||
    /找|搜索|推荐|项目|框架|工具|替代|方案|find|search|recommend|project|framework|tool|alternative/i.test(
      normalized,
    );

  if (greeting) {
    return {
      reply:
        locale === "zh"
          ? "你好。直接告诉我你要解决的问题就行，例如“找一个支持 Markdown 的自托管知识库”或“我想开发能调用工具的 Agent”。我会先整理条件，再把你带到对应结果。"
          : "Hello. Tell me the problem you need to solve—for example, “find a self-hosted Markdown knowledge base” or “I want to build an Agent with tool calling.” I’ll structure the constraints and take you to the right results.",
      actions: [
        {
          type: "navigate",
          label: locale === "zh" ? "看近期趋势" : "View recent trends",
          href: "/trends",
        },
        {
          type: "navigate",
          label: locale === "zh" ? "查看推荐" : "View recommendations",
          href: "/",
        },
      ],
      provider: "local",
      model: "gps-agent-rules-v2",
    };
  }

  if (
    wantsSubscription &&
    !/找|搜索|推荐|find|search|recommend/i.test(normalized)
  ) {
    return {
      reply:
        locale === "zh"
          ? "语义订阅保存的是完整需求，不只是一个关键词。先到订阅页查看已有主题；如果是新需求，建议先搜索并从结果页保存，这样技术栈、排除项和时间范围都会保留。"
          : "A semantic subscription stores the full intent, not just one keyword. Review existing topics first; for a new requirement, search and save it from the results so stack, exclusions, and time range are preserved.",
      actions: [
        {
          type: "navigate",
          label: locale === "zh" ? "管理订阅" : "Manage subscriptions",
          href: "/subscriptions",
        },
      ],
      provider: "local",
      model: "gps-agent-rules-v2",
    };
  }

  if (wantsTrend && !/找|搜索|推荐|find|search|recommend/i.test(normalized)) {
    return {
      reply:
        locale === "zh"
          ? "趋势中心会同时看 1、7、30 日增量，而不是只按总 Star 排名。你可以按领域、语言和项目年龄筛选；默认先看 7 日窗口，更容易发现正在上升的项目。"
          : "Trends compares 1-, 7-, and 30-day growth instead of ranking by total Stars alone. Filter by field, language, and project age; the 7-day view is a useful starting point for rising projects.",
      actions: [
        {
          type: "navigate",
          label: locale === "zh" ? "打开 7 日趋势" : "Open 7-day trends",
          href: "/trends",
        },
      ],
      provider: "local",
      model: "gps-agent-rules-v2",
    };
  }

  if (managesLibrary && !wantsSearch) {
    return {
      reply:
        locale === "zh"
          ? "知识库里可以按状态、标签和关键词管理项目，也能继续记录笔记与学习进度。打开后先从“正在学习”和最近访问开始，能最快找到需要继续处理的项目。"
          : "The library organizes projects by status, tags, and keywords, with notes and learning progress. Start with In progress and recently viewed to resume active work quickly.",
      actions: [
        {
          type: "navigate",
          label: locale === "zh" ? "打开知识库" : "Open library",
          href: "/library",
        },
      ],
      provider: "local",
      model: "gps-agent-rules-v2",
    };
  }

  if (wantsProfile && !wantsSearch) {
    return {
      reply:
        locale === "zh"
          ? "你可以在兴趣画像里分别调整长期兴趣、近期主题和屏蔽项。一次临时搜索不应改变长期偏好；搜索页也可以关闭“用于调整近期推荐”。"
          : "The interest profile separates long-term interests, recent intent, and blocks. A one-off search should not change long-term preferences; you can also disable its effect on recent recommendations from search.",
      actions: [
        {
          type: "navigate",
          label: locale === "zh" ? "调整兴趣画像" : "Edit interest profile",
          href: "/profile/interests",
        },
      ],
      provider: "local",
      model: "gps-agent-rules-v2",
    };
  }

  if (wantsSearch) {
    const searchQuery = buildsAgent
      ? locale === "zh"
        ? "适合二次开发的 AI Agent 框架，支持工具调用、工作流编排和可扩展插件"
        : "extensible AI Agent framework with tool calling, workflow orchestration, and plugins"
      : normalized.slice(0, 240);
    return {
      reply:
        locale === "zh"
          ? buildsAgent
            ? "我把需求拆成三条可比较路线：Agent 编排框架、工具调用 SDK、完整 Agent 应用。搜索会优先保留支持二次开发、文档完整且仍在维护的项目；进入结果后可再补语言、部署方式和排除项。"
            : `已把你的描述整理成项目需求：“${normalized.slice(0, 90)}”。下一步会同时做中英文概念扩展、约束过滤和质量排序，不要求仓库名称包含原句。`
          : buildsAgent
            ? "I split this into three comparable routes: Agent orchestration frameworks, tool-calling SDKs, and complete Agent applications. Search will favor extensible, documented, actively maintained projects; refine language, deployment, and exclusions in the results."
            : `I turned your description into a project requirement: “${normalized.slice(0, 100)}”. The next step applies bilingual expansion, constraint filtering, and quality ranking rather than requiring repositories to contain the exact phrase.`,
      actions: [
        {
          type: "search",
          label: locale === "zh" ? "查看匹配项目" : "View matching projects",
          href: `/search?q=${encodeURIComponent(searchQuery)}`,
        },
        ...(buildsAgent
          ? [
              {
                type: "navigate" as const,
                label: locale === "zh" ? "同时看近期趋势" : "Compare recent trends",
                href: "/trends",
              },
            ]
          : []),
      ],
      provider: "local",
      model: "gps-agent-rules-v2",
    };
  }

  const routeHint = currentPath.startsWith("/search")
    ? locale === "zh"
      ? "你正在搜索页。可以告诉我用途、技术栈、部署方式和排除条件，我会替你整理成更精确的查询。"
      : "You are on search. Tell me the use case, stack, deployment, and exclusions and I’ll turn them into a tighter query."
    : locale === "zh"
      ? "请直接说一个目标，例如“找适合团队使用的自托管文档工具”。我也可以带你去推荐、趋势、知识库、订阅或兴趣设置。"
      : "State an outcome such as “find a self-hosted documentation tool for a team.” I can also guide you to recommendations, trends, the library, subscriptions, or interest settings.";
  return {
    reply: routeHint,
    actions: [
      {
        type: "navigate",
        label: locale === "zh" ? "查看推荐" : "View recommendations",
        href: "/",
      },
    ],
    provider: "local",
    model: "gps-agent-rules-v2",
  };
}

export async function runSiteAgent(input: {
  messages: ChatMessage[];
  locale: Locale;
  currentPath: string;
  context: string;
}): Promise<AgentResponse> {
  const latest = input.messages.at(-1)?.content ?? "";
  if (!provider.available)
    return localAgent(latest, input.locale, input.currentPath);
  try {
    const response = await provider.json({
      system: `You are GPS Guide, an agent that helps users operate a GitHub project discovery website. Reply entirely in ${input.locale === "zh" ? "Simplified Chinese" : "English"}. Use only the supplied site context. Do not claim to click, save, subscribe, or modify data yourself. Return JSON only: {"reply":"...","actions":[{"type":"navigate|search","label":"...","href":"/safe-path"}]}. Keep at most 3 actions. Search hrefs may use /search?q=. Never output external URLs. Current path: ${input.currentPath}. Site context: ${input.context}`,
      messages: input.messages.slice(-10),
      schema: AgentResponseSchema,
      maxTokens: 650,
    });
    return {
      ...response,
      actions: filterAgentActions(response.actions),
      provider: "deepseek",
      model: provider.model,
    };
  } catch {
    return localAgent(latest, input.locale, input.currentPath);
  }
}
