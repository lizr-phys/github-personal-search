import type { InterestProfile } from "@/domain/types";

export type SearchEvaluationCase = {
  id: string;
  query: string;
  mode?: "comprehensive" | "precise" | "inspiration" | "latest";
  relevance: Record<string, 1 | 2 | 3>;
  profile?: Partial<InterestProfile>;
  expectedEmpty?: boolean;
};

/**
 * Small, reviewable golden set for deterministic offline evaluation.
 * Grade 3 = highly relevant, 2 = relevant, 1 = useful exploration.
 */
export const SEARCH_EVALUATION_CASES: SearchEvaluationCase[] = [
  {
    id: "zh-quantum-visualization",
    query: "量子力学波函数可视化网站",
    relevance: {
      "qmsolve-qmsolve": 3,
      "qutip-qutip": 2,
      "phetsims-energy-skate-park": 1,
      "manimcommunity-manim": 1,
    },
  },
  {
    id: "zh-physics-learning",
    query: "适合物理学习的交互式模拟项目",
    relevance: {
      "phetsims-energy-skate-park": 3,
      "falstad-circuitjs1": 3,
      "geogebra-geogebra": 2,
      "qmsolve-qmsolve": 2,
    },
  },
  {
    id: "mixed-pkm-self-hosted",
    query: "自托管并支持 PDF 和 Markdown 的 personal knowledge base",
    relevance: {
      "laurent22-joplin": 3,
      "siyuan-note-siyuan": 3,
      "triliumnext-trilium": 2,
      "toeverything-affine": 2,
      "foambubble-foam": 1,
    },
  },
  {
    id: "webgpu-science",
    query: "用 WebGPU 做 scientific computing 或物理模拟",
    relevance: {
      "webgpu-webgpu-samples": 3,
      "gfx-rs-wgpu": 2,
      "gpuweb-gpuweb": 2,
      "tensorflow-tfjs": 1,
      "mrdoob-three-js": 1,
    },
  },
  {
    id: "agent-extensible",
    query: "适合二次开发、可扩展的 AI Agent framework",
    relevance: {
      "langchain-ai-langgraph": 3,
      "microsoft-autogen": 3,
      "crewaiinc-crewai": 2,
      "all-hands-ai-openhands": 2,
      "browser-use-browser-use": 2,
    },
  },
  {
    id: "react-visualization-library",
    query: "React data visualization library",
    mode: "precise",
    relevance: {
      "recharts-recharts": 3,
      "observablehq-plot": 2,
      "d3-d3": 2,
      "apache-echarts": 2,
    },
  },
  {
    id: "latest-self-hosted-photo",
    query: "最新的 self-hosted photo management application",
    mode: "latest",
    relevance: { "immich-app-immich": 3 },
  },
  {
    id: "go-rss",
    query: "Go self-hosted RSS reader binary",
    mode: "precise",
    relevance: { "miniflux-v2": 3 },
  },
  {
    id: "browser-agent",
    query: "browser automation AI agent with Playwright",
    relevance: { "browser-use-browser-use": 3, "all-hands-ai-openhands": 1 },
  },
  {
    id: "beginner-python-algorithms",
    query: "适合入门的 Python algorithms tutorial",
    relevance: {
      "thealgorithms-python": 3,
      "codecrafters-io-build-your-own-x": 2,
      "freecodecamp-freecodecamp": 1,
    },
  },
  {
    id: "vue-api-self-hosted",
    query: "Vue self-hosted API testing application",
    mode: "precise",
    relevance: { "hoppscotch-hoppscotch": 3 },
  },
  {
    id: "go-git-service",
    query: "golang self hosted git service",
    mode: "precise",
    relevance: { "go-gitea-gitea": 3 },
  },
  {
    id: "typo-webgpu",
    query: "webgup comput shder examples",
    relevance: {
      "webgpu-webgpu-samples": 3,
      "gpuweb-gpuweb": 2,
      "gfx-rs-wgpu": 2,
    },
  },
  {
    id: "negative-react",
    query: "self-hosted knowledge base，不要 React",
    mode: "precise",
    relevance: {
      "siyuan-note-siyuan": 3,
      "triliumnext-trilium": 2,
      "foambubble-foam": 1,
    },
  },
  {
    id: "classic-js-visualization",
    query: "classic JavaScript visualization library",
    relevance: {
      "d3-d3": 3,
      "mrdoob-three-js": 2,
      "apache-echarts": 2,
      "observablehq-plot": 2,
    },
  },
  {
    id: "niche-science",
    query: "小众但高质量的 scientific visualization project",
    mode: "inspiration",
    relevance: {
      "qmsolve-qmsolve": 3,
      "observablehq-plot": 3,
      "scikit-image-scikit-image": 2,
      "phetsims-energy-skate-park": 2,
    },
  },
  {
    id: "temporary-interest-conflict",
    query: "TypeScript design system tool",
    relevance: { "storybookjs-storybook": 3, "shadcn-ui-ui": 3 },
    profile: {
      longTerm: { quantum: 5, physics: 4 },
      shortTerm: { "physics-education": 3 },
    },
  },
  {
    id: "mobile-cross-platform",
    query: "cross-platform mobile application UI framework Dart",
    mode: "precise",
    relevance: { "flutter-flutter": 3 },
  },
  {
    id: "cloud-infrastructure-as-code",
    query: "infrastructure as code tool for cloud and Kubernetes",
    relevance: {
      "hashicorp-terraform": 3,
      "kubernetes-kubernetes": 2,
    },
  },
  {
    id: "data-workflow-python",
    query: "Python workflow orchestration for data pipelines",
    relevance: { "apache-airflow": 3, "dbt-labs-dbt-core": 1 },
  },
  {
    id: "analytics-sql-transform",
    query: "SQL analytics data transformation command line tool",
    mode: "precise",
    relevance: { "dbt-labs-dbt-core": 3, "postgres-postgres": 1 },
  },
  {
    id: "relational-database",
    query: "open source relational SQL database backend",
    mode: "precise",
    relevance: { "postgres-postgres": 3 },
  },
  {
    id: "game-engine",
    query: "open source 2D and 3D game engine",
    relevance: { "godotengine-godot": 3 },
  },
  {
    id: "creative-3d-suite",
    query: "3D modeling animation rendering creative suite",
    relevance: { "blender-blender": 3 },
  },
  {
    id: "application-security-guide",
    query: "web application security cheat sheets and secure coding guide",
    relevance: { "owasp-cheatsheetseries": 3 },
  },
  {
    id: "smart-home-automation",
    query: "Python smart home automation platform self-hosted",
    relevance: { "home-assistant-core": 3 },
  },
  {
    id: "no-quality-result",
    query: "COBOL quantum mobile game engine for Palm OS",
    relevance: {},
    expectedEmpty: true,
  },
];
