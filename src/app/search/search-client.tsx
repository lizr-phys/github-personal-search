"use client";

import {
  BookmarkPlus,
  ChevronRight,
  Layers3,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type { RankedRepository, SearchIntent } from "@/domain/types";
import { DemoNotice, EmptyState, ErrorState } from "@/components/states";
import { useI18n } from "@/i18n/i18n-provider";
import { apiFetch } from "@/lib/client-api";

type SearchMode = "comprehensive" | "precise" | "inspiration" | "latest";
type Response = {
  id: string;
  intent: SearchIntent;
  mode: SearchMode;
  results: RankedRepository[];
  clusters: Array<{ name: string; count: number; repositories: string[] }>;
  timing: { totalMs: number };
  dataUpdatedAt: string;
  semanticMode: string;
  catalog: {
    mode: "demo" | "hybrid" | "github";
    githubCount: number;
    demoCount: number;
    dataUpdatedAt: string;
  };
};

const modes: Array<{ id: SearchMode; zh: string; en: string }> = [
  { id: "comprehensive", zh: "综合", en: "Balanced" },
  { id: "precise", zh: "精确", en: "Precise" },
  { id: "inspiration", zh: "灵感", en: "Inspiration" },
  { id: "latest", zh: "最新", en: "Latest" },
];

export function SearchClient() {
  const { locale } = useI18n();
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [mode, setMode] = useState<SearchMode>("comprehensive");
  const [affectsProfile, setAffectsProfile] = useState(true);
  const [response, setResponse] = useState<Response>();
  const [intentDraft, setIntentDraft] = useState<SearchIntent>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>();
  const [visibleClusterCount, setVisibleClusterCount] = useState(4);

  async function search(
    override?: SearchIntent,
    nextMode = mode,
    nextQuery = query,
  ) {
    if (!nextQuery.trim()) return;
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const result = await apiFetch<Response>("/api/search", {
        method: "POST",
        body: JSON.stringify({
          query: nextQuery,
          mode: nextMode,
          affectsProfile,
          intentOverride: override,
        }),
      });
      setQuery(nextQuery);
      setResponse(result);
      setIntentDraft(result.intent);
      setVisibleClusterCount(4);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initial) void search();
  }, []); // intentional initial query only

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuery = String(
      new FormData(event.currentTarget).get("query") ?? query,
    );
    void search(undefined, mode, submittedQuery);
  }

  function updateCsv(
    field: keyof Pick<
      SearchIntent,
      "technologies" | "languages" | "deployment" | "negativeConstraints"
    >,
    value: string,
  ) {
    setIntentDraft((current) =>
      current
        ? {
            ...current,
            [field]: value
              .split(/[,，]/)
              .map((item) => item.trim())
              .filter(Boolean),
          }
        : current,
    );
  }

  async function saveSubscription() {
    if (!response) return;
    try {
      await apiFetch("/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          name: response.intent.task.slice(0, 60),
          rawQuery: response.intent.rawQuery,
          intent: response.intent,
          frequency: "weekly",
          minRelevance: 0.45,
          minQuality: 0.7,
          heatThreshold: 0,
        }),
      });
      setSaved(true);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function syncGitHub() {
    if (!query.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await apiFetch<{ added: number; indexed: number }>(
        "/api/github/discover",
        { method: "POST", body: JSON.stringify({ query, limit: 8 }) },
      );
      setSyncMessage(
        l(
          `已从 GitHub 拉取 ${result.added} 个候选，实时索引共 ${result.indexed} 个。`,
          `Fetched ${result.added} candidates from GitHub; the live index now has ${result.indexed}.`,
        ),
      );
    } catch (reason) {
      setError((reason as Error).message);
      setBusy(false);
      return;
    }
    setBusy(false);
    await search();
  }

  const clusterGroups = useMemo(
    () =>
      response?.clusters.map((cluster) => ({
        ...cluster,
        items: response.results.filter((item) =>
          cluster.repositories.includes(item.repository.id),
        ),
      })) ?? [],
    [response],
  );

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{l("项目搜索", "Project search")}</p>
          <h1 className="page-title">
            {l("你想做什么？", "What do you want to build?")}
          </h1>
          <p className="page-description">
            {l(
              "描述需求，也可以只输入关键词、技术栈或限制条件。",
              "Describe the outcome, or enter a keyword, stack, or constraint.",
            )}
          </p>
        </div>
      </div>
      <section className={`search-hero ${busy ? "is-searching" : ""}`}>
        <form className="search-form" onSubmit={submit} aria-busy={busy}>
          <input
            name="query"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={l(
              "例如：可自托管的照片与视频管理工具",
              "For example: a self-hosted photo and video manager",
            )}
            aria-label={l("搜索项目", "Search projects")}
            data-testid="search-input"
          />
          <button
            className="button button-primary"
            disabled={busy}
            data-testid="search-submit"
          >
            <Search size={17} />
            {busy ? l("正在理解…", "Parsing…") : l("搜索", "Search")}
          </button>
          <button
            className="button"
            type="button"
            disabled={busy || !query.trim()}
            onClick={syncGitHub}
            data-testid="github-live-search"
          >
            <RefreshCw size={16} />
            {l("拉取 GitHub", "Fetch GitHub")}
          </button>
        </form>
        <div
          className="search-suggestions"
          aria-label={l("搜索建议", "Search suggestions")}
        >
          <span>{l("试试", "Try")}</span>
          {(locale === "zh"
            ? ["跨平台移动应用", "数据工作流", "自托管服务"]
            : [
                "cross-platform mobile app",
                "data workflow",
                "self-hosted service",
              ]
          ).map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => void search(undefined, mode, suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
        {syncMessage && (
          <div className="notice" role="status" style={{ marginTop: 12 }}>
            {syncMessage}
          </div>
        )}
        <label
          style={{
            display: "inline-flex",
            gap: 8,
            alignItems: "center",
            marginTop: 13,
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          <input
            type="checkbox"
            checked={affectsProfile}
            onChange={(event) => setAffectsProfile(event.target.checked)}
          />
          {l("用于调整近期推荐", "Use this search for recent interests")}
        </label>
      </section>
      {error && (
        <div style={{ marginBottom: 18 }}>
          <ErrorState message={error} retry={() => search()} />
        </div>
      )}
      {response && intentDraft && (
        <div className="search-layout" key={response.id}>
          <div>
            <section
              className="intent-panel reveal"
              data-testid="query-understanding"
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div>
                  <p className="eyebrow" style={{ marginBottom: 4 }}>
                    {l("查询条件", "Query intent")}
                  </p>
                  <strong>{intentDraft.task}</strong>
                </div>
              </div>
              <p className="intent-summary">
                {l("方向：", "Domains: ")}
                <strong>
                  {intentDraft.domains.join("、") ||
                    l("与目标任务相关", "related to the target task")}
                </strong>
                {l(" · 形态：", " · Form: ")}
                {intentDraft.projectTypes.join("、") ||
                  l("开源项目", "open-source project")}
                {intentDraft.deployment.length
                  ? `${l(" · 部署：", " · Deployment: ")}${intentDraft.deployment.join("、")}`
                  : ""}
              </p>
              <details className="intent-advanced">
                <summary>
                  {l(
                    "查看并编辑结构化条件",
                    "Review and edit structured constraints",
                  )}
                </summary>
                <div className="intent-primary-chips">
                  <IntentGroup
                    label={l("技术领域", "Domains")}
                    values={intentDraft.domains}
                    locale={locale}
                  />
                  <IntentGroup
                    label={l("项目形态", "Project forms")}
                    values={intentDraft.projectTypes}
                    locale={locale}
                  />
                  <IntentGroup
                    label={l("时间意图", "Time intent")}
                    values={[intentDraft.timeIntent ?? "any"]}
                    locale={locale}
                  />
                </div>
                <div className="intent-grid">
                  <EditableIntent
                    label={l("技术偏好", "Technology preferences")}
                    value={intentDraft.technologies.join(", ")}
                    onChange={(value) => updateCsv("technologies", value)}
                    locale={locale}
                  />
                  <EditableIntent
                    label={l("语言", "Languages")}
                    value={intentDraft.languages.join(", ")}
                    onChange={(value) => updateCsv("languages", value)}
                    locale={locale}
                  />
                  <EditableIntent
                    label={l("平台与部署", "Platform and deployment")}
                    value={intentDraft.deployment.join(", ")}
                    onChange={(value) => updateCsv("deployment", value)}
                    locale={locale}
                  />
                  <IntentGroup
                    label={l("成熟度与难度", "Maturity and difficulty")}
                    values={
                      [intentDraft.maturity, intentDraft.difficulty].filter(
                        Boolean,
                      ) as string[]
                    }
                    locale={locale}
                  />
                  <EditableIntent
                    label={l("排除条件", "Exclusions")}
                    value={intentDraft.negativeConstraints.join(", ")}
                    onChange={(value) =>
                      updateCsv("negativeConstraints", value)
                    }
                    locale={locale}
                  />
                </div>
                <button
                  type="button"
                  className="button"
                  onClick={() => search(intentDraft)}
                >
                  {l("应用修改并重新搜索", "Apply and search again")}
                </button>
              </details>
            </section>
            <div className="tabs" role="tablist">
              {modes.map((item) => (
                <button
                  type="button"
                  className={`tab ${mode === item.id ? "active" : ""}`}
                  role="tab"
                  aria-selected={mode === item.id}
                  onClick={() => {
                    setMode(item.id);
                    void search(intentDraft, item.id);
                  }}
                  key={item.id}
                >
                  {locale === "zh" ? item.zh : item.en}
                </button>
              ))}
            </div>
            {response.results.length ? (
              <div className="result-list" data-testid="search-results">
                {clusterGroups.slice(0, visibleClusterCount).map((cluster) => (
                  <section className="result-cluster" key={cluster.name}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        margin: "22px 0 10px",
                      }}
                    >
                      <Layers3 size={17} color="var(--green)" />
                      <h2 style={{ margin: 0, fontSize: 17 }}>
                        {cluster.name}
                      </h2>
                      <span className="chip">
                        {cluster.count} {l("个", "projects")}
                      </span>
                    </div>
                    {cluster.items.map((item) => (
                      <SearchResultCard
                        item={item}
                        locale={locale}
                        key={item.repository.id}
                      />
                    ))}
                  </section>
                ))}
                {clusterGroups.length > visibleClusterCount && (
                  <button
                    type="button"
                    className="route-expander"
                    onClick={() =>
                      setVisibleClusterCount((current) => current + 4)
                    }
                  >
                    <Layers3 size={16} aria-hidden="true" />
                    {l("再看", "Show")}{" "}
                    {Math.min(4, clusterGroups.length - visibleClusterCount)}
                    {l("条路线", " more routes")}
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : (
              <EmptyState
                title={l("没有合适的结果", "No suitable results")}
                message={l(
                  "换个说法，或减少限制条件后重试。",
                  "Try different wording or relax a constraint.",
                )}
              />
            )}
          </div>
          <aside className="side-stack">
            <DemoNotice
              mode={response.catalog.mode}
              githubCount={response.catalog.githubCount}
              demoCount={response.catalog.demoCount}
            />
            <div className="panel">
              <h2 className="side-title">{l("本次搜索", "This search")}</h2>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  lineHeight: 1.65,
                }}
              >
                {l("耗时", "Latency")} {response.timing.totalMs.toFixed(0)} ms
                <br />
                {l("更新时间", "Updated")} {response.dataUpdatedAt.slice(0, 10)}
                <br />
                {l("结果", "Results")} {response.results.length} ·{" "}
                {response.clusters.length} {l("条路线", "routes")}
                <br />
                {l("GitHub 实时索引", "Live GitHub index")}{" "}
                {response.catalog.githubCount}
              </p>
            </div>
            <div className="panel">
              <h2 className="side-title">{l("保存搜索", "Save search")}</h2>
              <button
                type="button"
                className="button button-primary"
                onClick={saveSubscription}
                style={{ width: "100%" }}
              >
                <BookmarkPlus size={16} />
                {saved ? l("已保存", "Saved") : l("每周提醒", "Weekly alert")}
              </button>
            </div>
          </aside>
        </div>
      )}
      {!response && !busy && (
        <section className="starter-queries">
          <p className="eyebrow">{l("可以这样搜", "Try a search")}</p>
          {(locale === "zh"
            ? [
                "可自托管的照片与视频管理",
                "适合移动端的跨平台 UI 框架",
                "用 SQL 管理数据转换流程",
              ]
            : [
                "self-hosted photo and video management",
                "cross-platform UI framework for mobile",
                "manage data transformations with SQL",
              ]
          ).map((example) => (
            <button
              className="starter-query"
              type="button"
              key={example}
              onClick={() => {
                setQuery(example);
                void search(undefined, mode, example);
              }}
            >
              <span>{example}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function IntentGroup({
  label,
  values,
  locale,
}: {
  label: string;
  values: string[];
  locale: "zh" | "en";
}) {
  return (
    <div className="intent-group">
      <strong>{label}</strong>
      <div className="chip-row">
        {values.length ? (
          values.map((value) => (
            <span className="chip" key={value}>
              {value}
            </span>
          ))
        ) : (
          <span className="chip">{locale === "zh" ? "未指定" : "Any"}</span>
        )}
      </div>
    </div>
  );
}

function EditableIntent({
  label,
  value,
  onChange,
  locale,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: "zh" | "en";
}) {
  return (
    <div className="intent-group">
      <strong>
        {label} {locale === "zh" ? "（逗号分隔）" : "(comma-separated)"}
      </strong>
      <input
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={locale === "zh" ? "未指定" : "Any"}
      />
    </div>
  );
}

function SearchResultCard({
  item,
  locale,
}: {
  item: RankedRepository;
  locale: "zh" | "en";
}) {
  const features = [
    {
      label: locale === "zh" ? "语义" : "Semantic",
      value: item.features.semantic,
    },
    {
      label: locale === "zh" ? "词法" : "Lexical",
      value: item.features.lexical,
    },
    {
      label: locale === "zh" ? "约束" : "Constraints",
      value: item.features.constraints,
    },
    {
      label: locale === "zh" ? "质量" : "Quality",
      value: item.features.quality,
    },
  ];
  const tags = [
    ...new Set([
      ...(item.candidateType === "sponsored"
        ? [locale === "zh" ? "赞助项目" : "Sponsored"]
        : []),
      item.repository.dataSource === "github"
        ? locale === "zh"
          ? "GitHub 实时"
          : "Live GitHub"
        : locale === "zh"
          ? "演示快照"
          : "Demo snapshot",
      item.repository.language,
      item.repository.projectType,
      ...item.repository.topics,
    ]),
  ].slice(0, 5);
  return (
    <article className="card result-card">
      <div className="result-rank">{Math.round(item.score * 100)}</div>
      <div>
        <div className="result-header">
          <div>
            <Link
              href={`/repository/${item.repository.owner}/${item.repository.name}`}
            >
              <strong>
                {locale === "zh"
                  ? item.repository.chineseTitle
                  : item.repository.name}
              </strong>
            </Link>
            <div className="repo-path" style={{ marginTop: 4 }}>
              {item.repository.fullName}
            </div>
          </div>
          <div className="metric">
            <Star size={13} />
            {Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
              notation: "compact",
            }).format(item.repository.stars)}
          </div>
        </div>
        <p className="repo-summary" style={{ margin: "10px 0" }}>
          {item.repository.description}
        </p>
        <div className="chip-row">
          {tags.map((tag) => (
            <span
              className={`chip ${tag === "赞助项目" || tag === "Sponsored" ? "chip-sponsored" : ""}`}
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="reason" style={{ marginTop: 12 }}>
          <Sparkles size={14} />
          <span>
            {locale === "zh"
              ? item.explanation
              : `Matched ${item.repository.domains.slice(0, 2).join(" and ")}; quality ${Math.round(item.repository.quality * 100)}% with ${item.repository.stars.toLocaleString("en-US")} Stars.`}
          </span>
        </div>
        <details style={{ marginTop: 12 }}>
          <summary
            style={{ color: "var(--muted)", fontSize: 12, cursor: "pointer" }}
          >
            {locale === "zh"
              ? "查看得分构成与召回源"
              : "View score and retrieval sources"}
          </summary>
          <div className="score-parts" style={{ marginTop: 10 }}>
            {features.map((feature) => (
              <div className="score-line" key={feature.label}>
                <span>{feature.label}</span>
                <div className="bar">
                  <span style={{ width: `${feature.value * 100}%` }} />
                </div>
                <b>{Math.round(feature.value * 100)}</b>
              </div>
            ))}
          </div>
          <div className="chip-row" style={{ marginTop: 10 }}>
            {item.retrievalSources.map((source) => (
              <span className="chip" key={source}>
                {source}
              </span>
            ))}
          </div>
        </details>
        <div className="repo-actions">
          <Link
            className="button button-primary"
            href={`/repository/${item.repository.owner}/${item.repository.name}`}
          >
            {locale === "zh" ? "查看详情" : "View details"}
            <ChevronRight size={15} />
          </Link>
          <span className="metric trend-value">
            <TrendingUp size={14} />+{item.repository.trend7d.stars} / 7d
          </span>
        </div>
      </div>
    </article>
  );
}
