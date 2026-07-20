"use client";

import {
  BookOpen,
  CheckCircle2,
  Code2 as Github,
  ExternalLink,
  Heart,
  Play,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AiRepositoryBrief } from "@/components/ai-repository-brief";
import { DemoNotice, ErrorState, PageSkeleton } from "@/components/states";
import type { InteractionType, Repository } from "@/domain/types";
import { useI18n } from "@/i18n/i18n-provider";
import { apiFetch } from "@/lib/client-api";

type DetailResponse = {
  repository: Repository;
  related: Repository[];
  library?: { status: string; tags: string[]; note: string };
  demo: boolean;
  evidencePolicy: string;
};

export function RepositoryDetailClient({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const { locale } = useI18n();
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const [data, setData] = useState<DetailResponse>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function load() {
    try {
      setData(
        await apiFetch<DetailResponse>(
          `/api/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        ),
      );
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [owner, repo]);

  async function action(type: InteractionType) {
    if (!data) return;
    try {
      await apiFetch("/api/interactions", {
        method: "POST",
        body: JSON.stringify({
          repositoryId: data.repository.id,
          type,
          surface: "repository",
        }),
      });
      setMessage(
        type === "favorite"
          ? l("已收藏到知识库", "Saved to your library")
          : type === "learn"
            ? l("已加入学习计划", "Added to your learning plan")
            : type === "ran"
              ? l("已标记为运行", "Marked as run")
              : type === "reproduced"
                ? l("已标记为复现", "Marked as reproduced")
                : type === "used"
                  ? l("已标记为用于项目", "Marked as used in a project")
                  : l("反馈已记录", "Feedback recorded"),
      );
      void load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  if (!data && !error) return <PageSkeleton cards={3} />;
  if (!data)
    return (
      <div className="page">
        <ErrorState
          message={error ?? l("未找到项目", "Repository not found")}
          retry={load}
        />
      </div>
    );
  const repository = data.repository;
  const metadataTags = [
    ...new Set([
      repository.language,
      repository.projectType,
      repository.difficulty,
      repository.maturity,
    ]),
  ];
  const stackTags = [
    ...new Set([
      ...repository.technologies,
      ...repository.languages,
      ...repository.deployment,
    ]),
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Repository intelligence</p>
          <div className="repo-path">{repository.fullName}</div>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            {locale === "zh" ? repository.chineseTitle : repository.name}
          </h1>
          <p className="page-description">{repository.description}</p>
        </div>
        <div className="chip-row">
          <span className="chip chip-accent">
            {repository.maintenance === "active"
              ? l("活跃维护", "Actively maintained")
              : repository.maintenance === "slower"
                ? l("维护节奏较慢", "Slower maintenance")
                : l("信息不足", "Limited evidence")}
          </span>
          <span className="chip">{repository.license}</span>
        </div>
      </div>
      {message && (
        <div className="notice" style={{ marginBottom: 18 }} role="status">
          <CheckCircle2
            size={15}
            style={{ display: "inline", marginRight: 7 }}
          />
          {message}
        </div>
      )}
      <div className="detail-hero">
        <div
          className="repo-cover detail-cover"
          data-tone={(repository.id.length + repository.owner.length) % 4}
        >
          <div className="cover-grid" />
          <span className="cover-badge">
            {repository.dataSource === "demo"
              ? l("演示封面", "Demo cover")
              : l("GitHub 元数据", "GitHub metadata")}
          </span>
          <div className="cover-content">
            <div className="cover-kicker">{repository.cluster}</div>
            <h2 className="cover-title">
              {locale === "zh" ? repository.chineseTitle : repository.name}
            </h2>
          </div>
        </div>
        <aside className="detail-meta">
          <div className="chip-row">
            {metadataTags.map((tag) => (
              <span className="chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span className="label">Stars</span>
              <strong>
                {Intl.NumberFormat("zh-CN", { notation: "compact" }).format(
                  repository.stars,
                )}
              </strong>
            </div>
            <div className="stat">
              <span className="label">{l("7 日增量", "7-day growth")}</span>
              <strong className="trend-value">
                +{repository.trend7d.stars}
              </strong>
            </div>
            <div className="stat">
              <span className="label">{l("30 日增量", "30-day growth")}</span>
              <strong>+{repository.trend30d.stars}</strong>
            </div>
          </div>
          <div className="metric-row" style={{ display: "grid", gap: 8 }}>
            <span>
              {l("最近 Push", "Last push")}：{repository.pushedAt.slice(0, 10)}
            </span>
            <span>
              {l("最近 Release", "Last release")}：
              {repository.releasedAt?.slice(0, 10) ?? l("信息不足", "Unknown")}
            </span>
            <span>
              {l("部署", "Deployment")}：{repository.deployment.join(" · ")}
            </span>
          </div>
          <div className="repo-actions">
            <button
              className="button button-primary"
              onClick={() => action("favorite")}
            >
              <Heart size={16} />
              {l("收藏", "Save")}
            </button>
            <button
              className="button"
              onClick={() => action("learn")}
              data-testid="detail-learn"
            >
              <BookOpen size={16} />
              {l("加入学习", "Learn")}
            </button>
            <a
              className="button"
              href={repository.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void action("open_github")}
            >
              <Github size={16} />
              GitHub
              <ExternalLink size={13} />
            </a>
            {repository.demoUrl && (
              <a
                className="button"
                href={repository.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void action("open_demo")}
              >
                <Play size={16} />
                Demo
              </a>
            )}
          </div>
          <div className="divider" />
          <span className="label">{l("实践状态", "Practice status")}</span>
          <div className="chip-row">
            <button className="chip chip-button" onClick={() => action("ran")}>
              {l("已运行", "Run")}
            </button>
            <button
              className="chip chip-button"
              onClick={() => action("reproduced")}
            >
              {l("已复现", "Reproduced")}
            </button>
            <button className="chip chip-button" onClick={() => action("used")}>
              {l("已用于项目", "Used")}
            </button>
          </div>
        </aside>
      </div>
      <div className="two-column">
        <div>
          <section className="content-section detail-introduction">
            <AiRepositoryBrief
              repositoryId={repository.id}
              fallback={
                locale === "zh" ? repository.summary : repository.description
              }
              expanded
            />
            <h2>{l("项目解决的问题", "Problem it solves")}</h2>
            <p>{repository.problem}</p>
            <h2>{l("目标用户", "Who it is for")}</h2>
            <div className="chip-row">
              {repository.targetUsers.map((item) => (
                <span className="chip" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </section>
          <details className="content-section content-disclosure">
            <summary>
              {l("核心能力与 README 证据", "Capabilities and README evidence")}
            </summary>
            <h2>{l("核心功能", "Core capabilities")}</h2>
            <ul>
              {repository.coreFeatures.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <h2>{l("README 提取式摘要", "Extractive README summary")}</h2>
            <p>{repository.readmeSummary}</p>
            <div className="notice notice-warn">
              {locale === "en"
                ? `This summary uses ${repository.hasReadme ? "GitHub README evidence" : "GitHub repository metadata"}, updated ${repository.dataUpdatedAt.slice(0, 16).replace("T", " ")}. Weak evidence is not presented as a strong claim.`
                : repository.dataSource === "github"
                  ? `功能说明来自 ${repository.hasReadme ? "GitHub README 提取内容" : "GitHub 仓库元数据"}，更新时间 ${repository.dataUpdatedAt.slice(0, 16).replace("T", " ")}；证据不足时不作强结论。`
                  : "功能说明来自演示 README 摘要；配置真实数据后以对应抓取来源和时间为准。"}
            </div>
          </details>
          <details className="content-section content-disclosure">
            <summary>{l("技术栈与部署", "Technology and deployment")}</summary>
            <div className="chip-row">
              {stackTags.map((item) => (
                <span className="chip" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </details>
        </div>
        <aside>
          <details
            className="panel evidence-panel"
            style={{ marginBottom: 16 }}
          >
            <summary>
              <Sparkles size={15} aria-hidden />
              {l("推荐依据与证据", "Recommendation evidence")}
            </summary>
            <h2 className="side-title">
              <Sparkles
                size={15}
                style={{ display: "inline", marginRight: 7 }}
              />
              {l("推荐依据与证据", "Recommendation evidence")}
            </h2>
            <p
              style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.65 }}
            >
              {l(
                "该项目进入详情候选的依据来自项目主题、主要语言、README 摘要与已保存的用户行为；无证据时不显示强结论。",
                "Candidate evidence comes from topics, language, README summaries, and saved user behavior. GPS avoids strong claims without evidence.",
              )}
            </p>
            {repository.evidence.map((evidence) => (
              <div
                key={evidence.source}
                style={{
                  borderTop: "1px solid var(--line)",
                  padding: "10px 0",
                  fontSize: 12,
                }}
              >
                <strong>{evidence.label}</strong>
                <div style={{ color: "var(--muted)", marginTop: 3 }}>
                  {l("置信度", "Confidence")}{" "}
                  {Math.round(evidence.confidence * 100)}% · {evidence.type}
                </div>
              </div>
            ))}
          </details>
          <section className="panel">
            <h2 className="side-title">{l("趋势窗口", "Trend windows")}</h2>
            {(["trend1d", "trend7d", "trend30d"] as const).map((key, index) => (
              <div className="interest-line" key={key}>
                <span>
                  {locale === "zh"
                    ? ["1 日", "7 日", "30 日"][index]
                    : ["1 day", "7 days", "30 days"][index]}
                </span>
                <strong>
                  <TrendingUp size={12} style={{ display: "inline" }} />{" "}
                  {repository[key].heat.toFixed(2)}
                </strong>
              </div>
            ))}
          </section>
        </aside>
      </div>
      <details className="related-disclosure" style={{ marginTop: 28 }}>
        <summary>
          {l("相似项目", "Similar projects")} · {data.related.length}
        </summary>
        <div className="grid-cards">
          {data.related.map((item) => (
            <article className="card mini-repo" key={item.id}>
              <span className="chip chip-accent">{item.cluster}</span>
              <h3>{locale === "zh" ? item.chineseTitle : item.name}</h3>
              <div className="repo-path">{item.fullName}</div>
              <p>{item.description}</p>
              <div className="repo-actions">
                <Link
                  className="button"
                  href={`/repository/${item.owner}/${item.name}`}
                >
                  {l("查看详情", "View details")}
                </Link>
                <span className="metric">
                  <Star size={13} />
                  {Intl.NumberFormat("zh-CN", { notation: "compact" }).format(
                    item.stars,
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>
      </details>
      <div style={{ marginTop: 22 }}>
        <DemoNotice />
      </div>
    </div>
  );
}
