import type { ProjectType, SearchIntent } from "@/domain/types";
import { SearchIntentSchema } from "@/domain/types";
import { ALGORITHM_VERSIONS } from "@/config/algorithms";
import { TtlLruCache } from "@/lib/ttl-cache";
import { normalizeText, tokenize } from "./text";

const queryIntentCache = new TtlLruCache<SearchIntent>(2_000, 60 * 60 * 1000);

type Expansion = {
  triggers: string[];
  domains?: string[];
  technologies?: string[];
  terms: string[];
};

const EXPANSIONS: Expansion[] = [
  {
    triggers: ["量子", "quantum", "波函数", "wavefunction", "薛定谔"],
    domains: ["quantum", "physics", "physics-education"],
    technologies: ["Schrödinger equation"],
    terms: [
      "quantum mechanics",
      "wavefunction",
      "schrodinger",
      "physics simulation",
      "科学可视化",
      "scientific visualization",
    ],
  },
  {
    triggers: ["物理学习", "物理模拟", "physics simulation", "交互式模拟"],
    domains: ["physics-education", "interactive-simulation"],
    terms: [
      "interactive simulation",
      "physics education",
      "scientific visualization",
      "browser demo",
    ],
  },
  {
    triggers: ["知识库", "笔记", "knowledge base", "second brain", "wiki"],
    domains: ["knowledge-base", "productivity"],
    terms: [
      "personal knowledge management",
      "PKM",
      "notes",
      "wiki",
      "second brain",
    ],
  },
  {
    triggers: ["自托管", "self hosted", "self-hosted"],
    domains: ["self-hosted"],
    technologies: ["Docker"],
    terms: ["self-hosted", "on-premise", "docker", "local-first"],
  },
  {
    triggers: ["pdf"],
    terms: ["PDF annotation", "document management", "reader"],
  },
  {
    triggers: ["markdown", "md"],
    technologies: ["Markdown"],
    terms: ["markdown", "plain text", "md"],
  },
  {
    triggers: ["webgpu", "gpu"],
    domains: ["webgpu", "scientific-computing", "graphics"],
    technologies: ["WebGPU", "WGSL"],
    terms: ["compute shader", "GPU compute", "browser GPU", "wgsl"],
  },
  {
    triggers: ["科学计算", "scientific computing"],
    domains: ["scientific-computing"],
    terms: ["numerical computing", "simulation", "scientific visualization"],
  },
  {
    triggers: ["agent", "智能体", "代理"],
    domains: ["ai-agent", "automation"],
    technologies: ["LLM"],
    terms: ["AI agent", "tool calling", "workflow", "multi-agent"],
  },
  {
    triggers: ["二次开发", "可扩展", "extensible"],
    terms: ["framework", "plugin", "SDK", "self-hosted", "customizable"],
  },
  {
    triggers: ["数据可视化", "可视化", "visualization", "图表"],
    domains: ["visualization"],
    terms: [
      "data visualization",
      "interactive charts",
      "dashboard",
      "plotting",
    ],
  },
  {
    triggers: ["学习", "教程", "入门", "tutorial"],
    domains: ["education", "learning"],
    terms: ["tutorial", "learning project", "examples", "beginner-friendly"],
  },
  {
    triggers: ["rss", "feed reader", "订阅阅读"],
    domains: ["rss", "productivity"],
    terms: ["rss reader", "atom feed", "feed reader"],
  },
  {
    triggers: ["照片管理", "图片管理", "photo management", "photos"],
    domains: ["photos", "self-hosted"],
    terms: ["photo library", "media backup", "gallery"],
  },
  {
    triggers: ["api 测试", "api testing", "api client"],
    domains: ["api", "developer-tools"],
    terms: ["REST client", "GraphQL client", "API workbench"],
  },
  {
    triggers: ["设计系统", "design system", "组件库"],
    domains: ["design-system", "web-development"],
    terms: ["component library", "UI components", "storybook"],
  },
  {
    triggers: ["git 服务", "git service", "代码托管"],
    domains: ["devops", "developer-tools", "self-hosted"],
    terms: ["git hosting", "repository service", "forge"],
  },
  {
    triggers: [
      "基础设施即代码",
      "infrastructure as code",
      "cloud infrastructure",
      "kubernetes",
    ],
    domains: ["devops", "cloud-native"],
    technologies: ["Kubernetes"],
    terms: ["IaC", "terraform", "containers", "cloud automation"],
  },
  {
    triggers: [
      "数据管道",
      "数据工作流",
      "data pipeline",
      "workflow orchestration",
      "etl",
    ],
    domains: ["data-engineering", "workflow"],
    terms: ["data orchestration", "DAG", "ETL", "analytics engineering"],
  },
  {
    triggers: [
      "关系型数据库",
      "relational database",
      "sql database",
      "postgresql",
    ],
    domains: ["database", "backend"],
    technologies: ["SQL"],
    terms: ["relational database", "postgres", "SQL", "database server"],
  },
  {
    triggers: [
      "数据转换",
      "data transformation",
      "analytics engineering",
      "dbt",
    ],
    domains: ["data-engineering", "analytics"],
    technologies: ["SQL"],
    terms: ["dbt", "SQL transformation", "data modeling", "analytics"],
  },
  {
    triggers: [
      "机器学习",
      "深度学习",
      "machine learning",
      "deep learning",
      "neural network",
    ],
    domains: ["machine-learning", "ai"],
    terms: ["deep learning", "neural networks", "model training", "pytorch"],
  },
  {
    triggers: [
      "跨平台移动",
      "移动应用",
      "cross-platform mobile",
      "mobile application",
      "flutter",
    ],
    domains: ["mobile", "cross-platform"],
    technologies: ["Flutter"],
    terms: ["mobile UI", "iOS", "Android", "Dart", "cross-platform"],
  },
  {
    triggers: ["游戏引擎", "游戏开发", "game engine", "game development"],
    domains: ["game-development", "graphics"],
    terms: ["2D engine", "3D engine", "game editor", "Godot"],
  },
  {
    triggers: [
      "三维建模",
      "3d modeling",
      "creative suite",
      "animation rendering",
    ],
    domains: ["creative", "3d", "graphics"],
    terms: ["Blender", "3D creation", "animation", "rendering"],
  },
  {
    triggers: [
      "应用安全",
      "安全编码",
      "application security",
      "secure coding",
      "owasp",
    ],
    domains: ["security"],
    terms: ["OWASP", "security cheat sheet", "secure coding", "AppSec"],
  },
  {
    triggers: [
      "智能家居",
      "家庭自动化",
      "smart home",
      "home automation",
      "iot",
    ],
    domains: ["iot", "home-automation", "self-hosted"],
    terms: ["Home Assistant", "smart devices", "local control", "IoT"],
  },
];

const SPELLING_CORRECTIONS: Record<string, string> = {
  webgup: "webgpu",
  comput: "compute",
  shder: "shader",
  pythn: "python",
  typesript: "typescript",
  javasript: "javascript",
  golagn: "golang",
  postgress: "postgresql",
  kubernetees: "kubernetes",
};

const ABBREVIATION_EXPANSIONS: Record<string, string[]> = {
  pkm: ["personal knowledge management", "knowledge base", "second brain"],
  llm: ["large language model", "AI agent"],
  rag: ["retrieval augmented generation", "vector search"],
  gpu: ["graphics processing unit", "compute shader"],
  wasm: ["webassembly"],
  k8s: ["kubernetes"],
  ts: ["typescript"],
  js: ["javascript"],
};

export const LANGUAGE_ALIASES: Record<string, string> = {
  python: "Python",
  rust: "Rust",
  go: "Go",
  golang: "Go",
  typescript: "TypeScript",
  ts: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  java: "Java",
  csharp: "C#",
  "c#": "C#",
  cobol: "COBOL",
  dart: "Dart",
  vue: "Vue",
};

export function canonicalLanguage(value: string): string | undefined {
  return LANGUAGE_ALIASES[normalizeText(value)];
}

const TYPE_PATTERNS: Array<[ProjectType, RegExp]> = [
  [
    "application",
    /(?:完整应用|应用程序|standalone\s+app|application\s+(?:project|tool|platform))/i,
  ],
  ["library", /(?:代码库|函数库|依赖库|library|sdk)/i],
  ["framework", /(?:框架|framework)/i],
  ["template", /(?:模板|脚手架|template|starter)/i],
  ["tutorial", /(?:教程|学习项目|tutorial|course)/i],
  ["tool", /(?:工具|tool|cli)/i],
];

function includesAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(normalizeText(value)));
}

function parseNegativeConstraints(normalized: string): string[] {
  const constraints: string[] = [];
  const matchers = [
    /(?:排除|不要|不含|避免使用|不用)\s*([a-z0-9+#.\-]{1,40})/gi,
    /(?:without|exclude|not)\s+([a-z0-9+#.\-]{1,40})/gi,
    /(?:非|not-)\s*([a-z+#.\-]+)/gi,
  ];
  for (const matcher of matchers) {
    for (const match of normalized.matchAll(matcher)) {
      const value = match[1]?.trim();
      if (value) constraints.push(value);
    }
  }
  if (/排除.*(?:saas|商业服务)/i.test(normalized))
    constraints.push("commercial-saas");
  if (/排除.*(?:归档|停止维护)|不要.*(?:归档|停止维护)/i.test(normalized))
    constraints.push("archived");
  return [...new Set(constraints)];
}

export class RuleQueryParser {
  readonly version = ALGORITHM_VERSIONS.queryParser;

  parse(rawQuery: string): SearchIntent {
    const cacheKey = rawQuery.trim();
    const cached = queryIntentCache.get(cacheKey);
    if (cached) return cached;
    const normalizedInput = normalizeText(rawQuery);
    const corrections: Array<{ from: string; to: string }> = [];
    const normalizedQuery = normalizedInput
      .split(" ")
      .map((token) => {
        const replacement = SPELLING_CORRECTIONS[token];
        if (replacement) corrections.push({ from: token, to: replacement });
        return replacement ?? token;
      })
      .join(" ");
    const domains = new Set<string>();
    const technologies = new Set<string>();
    const generatedTerms = new Set<string>(tokenize(normalizedQuery));

    for (const [abbreviation, terms] of Object.entries(
      ABBREVIATION_EXPANSIONS,
    )) {
      if (
        !new RegExp(`(^|\\s)${abbreviation}(?=\\s|$)`, "i").test(
          normalizedQuery,
        )
      )
        continue;
      terms.forEach((term) => generatedTerms.add(term));
    }

    for (const expansion of EXPANSIONS) {
      if (!includesAny(normalizedQuery, expansion.triggers)) continue;
      expansion.domains?.forEach((value) => domains.add(value));
      expansion.technologies?.forEach((value) => technologies.add(value));
      expansion.terms.forEach((value) => generatedTerms.add(value));
    }

    const negativeConstraints = parseNegativeConstraints(normalizedQuery);
    const negativeLanguages = new Set(
      negativeConstraints
        .map(canonicalLanguage)
        .filter((value): value is string => Boolean(value)),
    );
    const languages = Object.entries(LANGUAGE_ALIASES)
      .filter(([alias]) =>
        new RegExp(
          `(^|[^a-z0-9+#])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#]|$)`,
          "i",
        ).test(normalizedQuery),
      )
      .filter(([, language]) => !negativeLanguages.has(language))
      .map(([, language]) => language);
    const projectTypes = TYPE_PATTERNS.filter(([, pattern]) =>
      pattern.test(normalizedQuery),
    ).map(([type]) => type);
    const platforms = [
      ...(includesAny(normalizedQuery, ["浏览器", "网站"]) ||
      /(^|\s)web(?=\s|$)/i.test(normalizedQuery)
        ? ["web"]
        : []),
      ...(includesAny(normalizedQuery, ["桌面", "desktop"]) ? ["desktop"] : []),
      ...(includesAny(normalizedQuery, ["移动", "mobile"]) ? ["mobile"] : []),
    ];
    const deployment = [
      ...(includesAny(normalizedQuery, ["自托管", "self hosted", "self-hosted"])
        ? ["self-hosted"]
        : []),
      ...(includesAny(normalizedQuery, ["docker", "容器"]) ? ["docker"] : []),
      ...(includesAny(normalizedQuery, ["静态", "static"]) ? ["static"] : []),
    ];
    const licenses = ["mit", "apache-2.0", "gpl-3.0", "bsd-3-clause"].filter(
      (license) => normalizedQuery.includes(license),
    );
    const timeIntent = includesAny(normalizedQuery, [
      "最新",
      "最近",
      "近期",
      "new",
      "latest",
    ])
      ? "latest"
      : includesAny(normalizedQuery, ["经典", "成熟", "classic"])
        ? "classic"
        : "any";
    const difficulty = includesAny(normalizedQuery, [
      "入门",
      "简单",
      "beginner",
    ])
      ? "beginner"
      : includesAny(normalizedQuery, ["高级", "复杂", "advanced"])
        ? "advanced"
        : undefined;

    const constraintsDetected =
      languages.length +
      projectTypes.length +
      platforms.length +
      deployment.length +
      licenses.length +
      negativeConstraints.length;
    const parsed = SearchIntentSchema.parse({
      rawQuery,
      normalizedQuery,
      task: rawQuery.trim(),
      domains: [...domains],
      projectTypes,
      technologies: [...technologies],
      languages: [...new Set(languages)],
      platforms: [...new Set(platforms)],
      deployment: [...new Set(deployment)],
      maturity: includesAny(normalizedQuery, ["成熟", "稳定", "stable"])
        ? "stable"
        : undefined,
      difficulty,
      licenses: licenses.length
        ? licenses.map((item) => item.toUpperCase())
        : undefined,
      negativeConstraints,
      timeIntent,
      generatedTerms: [...generatedTerms].slice(0, 60),
      confidence: {
        overall: corrections.length ? 0.78 : 0.88,
        domains: domains.size ? 0.9 : 0.55,
        technologies: technologies.size || languages.length ? 0.92 : 0.5,
        projectTypes: projectTypes.length ? 0.94 : 0.5,
        constraints: constraintsDetected ? 0.95 : 0.55,
      },
      corrections,
    });
    return queryIntentCache.set(cacheKey, parsed);
  }
}

export const queryParser = new RuleQueryParser();
