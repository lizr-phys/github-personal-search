"use client";

import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Code2,
  Compass,
  Circle,
  Database,
  Globe2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  InteractionType,
  InterestProfile,
  RankedRepository,
} from "@/domain/types";
import { RepositoryCard } from "@/components/repository-card";
import { DemoNotice, ErrorState, PageSkeleton } from "@/components/states";
import { useI18n } from "@/i18n/i18n-provider";
import { apiFetch } from "@/lib/client-api";

type SessionResponse = {
  authenticated: boolean;
  mode: string;
  profile?: InterestProfile;
  user?: { displayName: string };
};
type FeedResponse = {
  items: RankedRepository[];
  batch: { id: string; batchNumber: number };
  warmQueueSize: number;
  cache: string;
  demo: boolean;
  catalog: {
    mode: "demo" | "hybrid" | "github";
    githubCount: number;
    demoCount: number;
  };
};

export default function DiscoverPage() {
  const { locale } = useI18n();
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse>();
  const [feed, setFeed] = useState<FeedResponse>();
  const [batchNumber, setBatchNumber] = useState(0);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<{
    message: string;
    interactionId?: string;
  }>();

  const loadSession = useCallback(async () => {
    try {
      setError(undefined);
      setSession(await apiFetch<SessionResponse>("/api/session"));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }, []);

  const loadFeed = useCallback(async (number: number) => {
    try {
      setBusy(true);
      setError(undefined);
      const response = await apiFetch<FeedResponse>(
        `/api/feed?batch=${number}`,
      );
      setFeed(response);
      setIndex(0);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);
  useEffect(() => {
    if (session?.authenticated && session.profile?.completed)
      void loadFeed(batchNumber);
  }, [
    session?.authenticated,
    session?.profile?.completed,
    batchNumber,
    loadFeed,
  ]);

  async function startDemo() {
    setBusy(true);
    try {
      const response = await fetch("/api/demo/start", { method: "POST" });
      const payload = (await response.json()) as { redirect?: string };
      router.push(payload.redirect ?? "/onboarding");
    } finally {
      setBusy(false);
    }
  }

  async function action(type: InteractionType, reason?: string) {
    const item = feed?.items[index];
    if (!item) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ interaction: { id: string } }>(
        "/api/interactions",
        {
          method: "POST",
          body: JSON.stringify({
            repositoryId: item.repository.id,
            type,
            reason,
            surface: "feed",
          }),
        },
      );
      setToast({
        message:
          type === "favorite"
            ? "已收藏到知识库"
            : type === "learn"
              ? "已加入学习计划"
              : type === "seen"
                ? "将抑制近期重复"
                : type.includes("not_") ||
                    [
                      "too_complex",
                      "language_mismatch",
                      "unmaintained",
                      "block_similar",
                    ].includes(type)
                  ? "已记录负反馈"
                  : "反馈已写入画像",
        interactionId: result.interaction.id,
      });
      setIndex((current) => current + 1);
      void loadSession();
    } catch (reasonValue) {
      setError((reasonValue as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!toast?.interactionId) return;
    try {
      await apiFetch(`/api/interactions/${toast.interactionId}`, {
        method: "DELETE",
      });
      setIndex((current) => Math.max(0, current - 1));
      setToast({ message: "反馈已撤销" });
      void loadSession();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  const interests = useMemo(
    () =>
      Object.entries(session?.profile?.longTerm ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [session?.profile?.longTerm],
  );

  if (!session && !error) return <PageSkeleton cards={2} />;
  if (error && !session)
    return (
      <div className="page">
        <ErrorState message={error} retry={loadSession} />
      </div>
    );

  if (!session?.authenticated) {
    const previews =
      locale === "zh"
        ? [
            {
              icon: Database,
              kicker: "数据与工作流",
              title: "从分析引擎到可视化工具",
              meta: "Python · SQL · 12.4k+ Stars",
            },
            {
              icon: Code2,
              kicker: "开发者工具",
              title: "更快搭建、调试和发布产品",
              meta: "TypeScript · Rust · 活跃维护",
            },
            {
              icon: Globe2,
              kicker: "自托管与应用",
              title: "把数据和服务掌握在自己手里",
              meta: "Docker · Web · 可本地部署",
            },
          ]
        : [
            {
              icon: Database,
              kicker: "Data & workflow",
              title: "From analytics engines to visual tools",
              meta: "Python · SQL · 12.4k+ Stars",
            },
            {
              icon: Code2,
              kicker: "Developer tools",
              title: "Build, debug, and ship products faster",
              meta: "TypeScript · Rust · Actively maintained",
            },
            {
              icon: Globe2,
              kicker: "Self-hosted apps",
              title: "Keep your data and services under control",
              meta: "Docker · Web · Local deployment",
            },
          ];
    return (
      <div className="page welcome-page">
        <section className="welcome">
          <div className="welcome-main">
            <div className="welcome-proof">
              <span>
                <Star size={13} aria-hidden />
                {l("优先推荐高质量项目", "Quality projects first")}
              </span>
              <span>{l("覆盖全部技术领域", "Across every technical field")}</span>
            </div>
            <p className="eyebrow">GitHub Personal Search · GPS</p>
            <h1>
              {l("找到真正", "Find open source")}
              <span>{l("值得投入的开源项目", "worth your time")}</span>
            </h1>
            <p className="welcome-copy">
              {l(
                "说清楚你要解决的问题。GPS 会理解需求、比较路线，并根据你的反馈持续调整推荐。",
                "Describe the problem you need to solve. GPS understands the intent, compares approaches, and adapts every recommendation to your feedback.",
              )}
            </p>
            <div className="welcome-actions">
              <button
                className="button button-primary"
                onClick={startDemo}
                disabled={busy}
                data-testid="start-demo"
              >
                <Compass size={18} aria-hidden />
                {l("进入演示", "Explore the demo")}
                <ArrowRight size={16} aria-hidden />
              </button>
              <a className="button" href="/api/github/login">
                <ShieldCheck size={17} aria-hidden />
                {l("使用 GitHub 登录", "Continue with GitHub")}
              </a>
            </div>
            <p className="welcome-privacy">
              {l(
                "只读取公开资料与 Stars · 随时撤销 · 不配置密钥也能运行",
                "Public profile and Stars only · Revoke anytime · Works without API keys",
              )}
            </p>
          </div>
          <div className="welcome-preview">
            <div className="preview-heading">
              <div>
                <p className="eyebrow">{l("今日探索", "Explore today")}</p>
                <h2>{l("不止一种热门方向", "More than one popular category")}</h2>
              </div>
              <span className="preview-count">60+</span>
            </div>
            <div className="preview-list">
              {previews.map(({ icon: Icon, kicker, title, meta }, index) => (
                <div className="preview-item" key={kicker}>
                  <span className="preview-icon">
                    <Icon size={18} aria-hidden />
                  </span>
                  <div>
                    <span>{kicker}</span>
                    <strong>{title}</strong>
                    <small>{meta}</small>
                  </div>
                  <span className="preview-index">0{index + 1}</span>
                </div>
              ))}
            </div>
            <div className="preview-footer">
              <Boxes size={17} aria-hidden />
              <span>
                {l(
                  "每批 10 个项目，反馈后立即重排",
                  "10 projects per batch, reranked after every signal",
                )}
              </span>
              <ArrowRight size={15} aria-hidden />
            </div>
          </div>
        </section>
        <section className="welcome-topics" aria-label={l("覆盖领域", "Covered fields") }>
          <span>{l("面向所有方向", "Built for every field")}</span>
          <div>
            {(locale === "zh"
              ? ["Web", "AI 与数据", "DevOps", "安全", "移动端", "设计工具", "科研计算", "游戏", "知识管理"]
              : ["Web", "AI & Data", "DevOps", "Security", "Mobile", "Design tools", "Scientific computing", "Games", "Knowledge"]
            ).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!session.profile?.completed) {
    return (
      <div className="page page-narrow">
        <div className="page-heading">
          <div>
            <p className="eyebrow">约 2 分钟</p>
            <h1 className="page-title">先选几个感兴趣的方向</h1>
            <p className="page-description">
              完成 10 个快速判断，就能看到第一批项目。
            </p>
          </div>
        </div>
        <DemoNotice />
        <div className="panel" style={{ marginTop: 20, padding: 28 }}>
          <h2 style={{ marginTop: 0 }}>还差一步</h2>
          <Link
            className="button button-primary"
            href="/onboarding"
            data-testid="continue-onboarding"
          >
            开始初始化
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  if (!feed && !error) return <PageSkeleton cards={2} />;
  const finished = index >= (feed?.items.length ?? 0);
  const current = feed?.items[index];

  return (
    <div className="page feed-page">
      <div className="page-heading feed-heading">
        <div>
          <p className="eyebrow">
            {l(`第 ${batchNumber + 1} 批`, `Batch ${batchNumber + 1}`)}
          </p>
          <h1 className="page-title">
            {l(
              `今天的 ${feed?.items.length ?? 10} 个项目`,
              `${feed?.items.length ?? 10} projects for today`,
            )}
          </h1>
          <p className="page-description">
            {l(
              "每次看 10 个。你的反馈会调整下一批。",
              "Review ten at a time. Your feedback reshapes the next batch.",
            )}
          </p>
        </div>
      </div>
      {error && (
        <div style={{ marginBottom: 18 }}>
          <ErrorState message={error} retry={() => loadFeed(batchNumber)} />
        </div>
      )}
      <div className="feed-layout">
        <section className="feed-stage" aria-live="polite" aria-busy={busy}>
          <div
            className="batch-rhythm"
            aria-label={l(
              `批次进度 ${Math.min(index + 1, 10)} / 10`,
              `Batch progress ${Math.min(index + 1, 10)} / 10`,
            )}
          >
            <div>
              <span className="batch-label">
                {l("本批主题", "Batch theme")}
              </span>
              <strong>
                {current?.repository.cluster ?? l("批次回顾", "Batch recap")}
              </strong>
            </div>
            <div className="batch-dots" aria-hidden>
              {Array.from({ length: 10 }, (_, dot) => (
                <Circle
                  key={dot}
                  className={
                    dot < index
                      ? "done"
                      : dot === index && !finished
                        ? "current"
                        : ""
                  }
                  size={10}
                />
              ))}
            </div>
          </div>
          {current && !finished ? (
            <RepositoryCard
              key={current.repository.id}
              item={current}
              onAction={action}
              busy={busy}
            />
          ) : (
            <div className="batch-finale reveal" data-testid="batch-complete">
              <CheckCircle2
                size={44}
                color="var(--green)"
                style={{ margin: "0 auto 14px" }}
              />
              <p className="eyebrow">10 / 10 · {l("本批完成", "Complete")}</p>
              <h2>{l("这一批看完了", "You finished this batch")}</h2>
              <p className="page-description" style={{ margin: "0 auto 22px" }}>
                {l(
                  "下一批会参考刚才的选择。",
                  "The next batch will reflect your recent choices.",
                )}
              </p>
              {batchNumber < 3 ? (
                <button
                  className="button button-primary"
                  onClick={() => setBatchNumber((value) => value + 1)}
                  disabled={busy}
                  data-testid="more-ten"
                >
                  {l("再来 10 个", "Show 10 more")}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <Link className="button button-primary" href="/search">
                  {l("去搜索新方向", "Search a new direction")}
                  <SearchIcon />
                </Link>
              )}
            </div>
          )}
        </section>
        <aside className="side-stack">
          <div className="batch-side-summary">
            <span>{l("本批进度", "Batch progress")}</span>
            <strong>{finished ? "10 / 10" : `${Math.min(index + 1, 10)} / 10`}</strong>
            <div className="batch-side-track" aria-hidden>
              <span style={{ width: `${finished ? 100 : Math.max(10, (index + 1) * 10)}%` }} />
            </div>
            <small>
              {finished
                ? l("已完成，可载入下一批", "Complete — ready for the next batch")
                : l(`还剩 ${Math.max(0, 10 - index - 1)} 个`, `${Math.max(0, 10 - index - 1)} remaining`)}
            </small>
          </div>
          <div className="panel">
            <h2 className="side-title">{l("你的方向", "Your directions")}</h2>
            {interests.map(([term, weight]) => (
              <div className="interest-line" key={term}>
                <div>
                  <span>{term}</span>
                  <div className="bar">
                    <span
                      style={{
                        width: `${Math.min(100, Math.max(8, weight * 18))}%`,
                      }}
                    />
                  </div>
                </div>
                <strong>{weight.toFixed(1)}</strong>
              </div>
            ))}
            <Link
              className="button button-quiet"
              href="/profile/interests"
              style={{ width: "100%", marginTop: 8 }}
            >
              {l("调整偏好", "Edit preferences")}
            </Link>
          </div>
          <DemoNotice {...feed?.catalog} />
        </aside>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.interactionId && (
            <button onClick={undo}>
              <RotateCcw size={13} aria-hidden /> {l("撤销", "Undo")}
            </button>
          )}
          <button aria-label="关闭提示" onClick={() => setToast(undefined)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return <Sparkles size={16} aria-hidden />;
}
