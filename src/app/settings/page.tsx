"use client";

import {
  Activity,
  Code2 as Github,
  Database,
  KeyRound,
  RefreshCw,
  Shield,
  Trash2,
  Unplug,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorState, PageSkeleton } from "@/components/states";
import { apiFetch } from "@/lib/client-api";

type Session = {
  authenticated: boolean;
  mode: string;
  user: {
    displayName: string;
    githubLogin?: string;
    githubScopes: string[];
    importedStarsCount: number;
  };
  dataScope: string[];
  catalog: {
    mode: "demo" | "hybrid" | "github";
    githubCount: number;
    demoCount: number;
    dataUpdatedAt: string;
  };
  githubSync: {
    status: string;
    lastCompletedAt?: string;
    lastError?: string;
    indexedCount: number;
    source: string;
  };
};
type Observability = {
  metrics: Record<string, number | string | undefined>;
  recentSearchLatency: number[];
  mode: string;
  dataUpdatedAt: string;
};

export default function SettingsPage() {
  const [session, setSession] = useState<Session>();
  const [observability, setObservability] = useState<Observability>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function load() {
    try {
      const [nextSession, metrics] = await Promise.all([
        apiFetch<Session>("/api/session"),
        apiFetch<Observability>("/api/observability"),
      ]);
      setSession(nextSession);
      setObservability(metrics);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function privacy(action: string, label: string) {
    if (
      (action === "delete_account" || action === "reset_profile") &&
      !window.confirm(`确认${label}？此操作不可撤销。`)
    )
      return;
    try {
      await apiFetch("/api/privacy", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setMessage(`${label}已完成`);
      if (action === "delete_account") window.location.assign("/");
      else await load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function importStars() {
    try {
      const result = await apiFetch<{ imported: number }>("/api/github/stars", {
        method: "POST",
        body: "{}",
      });
      setMessage(`已导入 ${result.imported} 个公开 Stars`);
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function importPublicSamples() {
    try {
      const result = await apiFetch<{ added: number; indexed: number }>(
        "/api/github/discover",
        {
          method: "POST",
          body: JSON.stringify({ query: "visualization", limit: 8 }),
        },
      );
      setMessage(
        `已拉取 ${result.added} 个真实 GitHub 仓库，实时索引共 ${result.indexed} 个`,
      );
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  if (!session && !error) return <PageSkeleton cards={4} />;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Authorization · privacy · operations</p>
          <h1 className="page-title">设置、隐私与系统状态</h1>
          <p className="page-description">
            查看实际读取范围，管理 GitHub 授权、历史、画像、导入数据和账户数据。
          </p>
        </div>
      </div>
      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={error} retry={load} />
        </div>
      )}
      {message && (
        <div className="notice" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}
      <div
        className="grid-cards"
        style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}
      >
        <section className="panel">
          <h2 className="side-title">
            <Github size={17} style={{ display: "inline", marginRight: 8 }} />
            GitHub 授权
          </h2>
          {session?.user.githubLogin ? (
            <>
              <p>
                <strong>@{session.user.githubLogin}</strong>
              </p>
              <div className="chip-row">
                {session.user.githubScopes.map((scope) => (
                  <span className="chip" key={scope}>
                    <KeyRound size={12} />
                    {scope}
                  </span>
                ))}
              </div>
              <p style={{ color: "var(--muted)", fontSize: 12 }}>
                已导入 {session.user.importedStarsCount} 个公开 Stars。
              </p>
              <div className="repo-actions">
                <button className="button button-primary" onClick={importStars}>
                  <RefreshCw size={15} />
                  同步公开 Stars
                </button>
                <button
                  className="button button-danger"
                  onClick={() => privacy("revoke_github", "撤销本地授权")}
                >
                  <Unplug size={15} />
                  撤销授权
                </button>
              </div>
            </>
          ) : (
            <>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: 13,
                  lineHeight: 1.65,
                }}
              >
                不连接账号也可以读取公开 GitHub 仓库。配置 OAuth
                后可额外导入个人公开 Stars；仅请求 <code>read:user</code>。
              </p>
              <div className="repo-actions">
                <button
                  className="button button-primary"
                  onClick={importPublicSamples}
                >
                  <RefreshCw size={15} />
                  拉取公开仓库样本
                </button>
                <a className="button" href="/api/github/login">
                  <Github size={15} />
                  连接 GitHub
                </a>
              </div>
            </>
          )}
        </section>
        <section className="panel">
          <h2 className="side-title">
            <Database size={17} style={{ display: "inline", marginRight: 8 }} />
            实际读取的数据范围
          </h2>
          <ul style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.8 }}>
            {session?.dataScope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="chip-row">
            <span className="chip chip-accent">
              真实 GitHub {session?.catalog.githubCount ?? 0}
            </span>
            <span className="chip">
              演示补充 {session?.catalog.demoCount ?? 0}
            </span>
            <span className="chip">
              同步 {session?.githubSync.status ?? "idle"}
            </span>
          </div>
          {session?.githubSync.lastError && (
            <p className="notice notice-warn">
              最近同步：{session.githubSync.lastError}
            </p>
          )}
          <p className="notice notice-warn">
            GPS 默认不读取私有仓库，也不批量抓取公开 stargazer 身份。
          </p>
        </section>
        <section className="panel">
          <h2 className="side-title">
            <Shield size={17} style={{ display: "inline", marginRight: 8 }} />
            隐私控制
          </h2>
          <div className="result-list">
            <PrivacyButton
              label="清除搜索与曝光历史"
              detail="删除搜索会话、推荐批次、曝光和反馈记录"
              onClick={() => privacy("clear_history", "清除历史")}
            />
            <PrivacyButton
              label="重置兴趣画像"
              detail="删除长期/短期兴趣与屏蔽项，重新冷启动"
              danger
              onClick={() => privacy("reset_profile", "重置画像")}
            />
            <PrivacyButton
              label="清除导入的 Stars"
              detail="只删除导入关系，不删除 GitHub 上的 Star"
              onClick={() => privacy("clear_imports", "清除导入数据")}
            />
            <PrivacyButton
              label="删除全部账户数据"
              detail="清空账户、画像、知识库、订阅和邮件记录"
              danger
              onClick={() => privacy("delete_account", "删除账户数据")}
            />
          </div>
        </section>
        <section className="panel">
          <h2 className="side-title">
            <Activity size={17} style={{ display: "inline", marginRight: 8 }} />
            可观测性
          </h2>
          <div className="stats-grid">
            <Metric label="曝光" value={observability?.metrics.exposureCount} />
            <Metric
              label="反馈"
              value={observability?.metrics.interactionCount}
            />
            <Metric
              label="负反馈率"
              value={
                typeof observability?.metrics.negativeFeedbackRate === "number"
                  ? `${(observability.metrics.negativeFeedbackRate * 100).toFixed(1)}%`
                  : "0%"
              }
            />
            <Metric
              label="缓存命中率"
              value={
                typeof observability?.metrics.cacheHitRate === "number"
                  ? `${(observability.metrics.cacheHitRate * 100).toFixed(1)}%`
                  : "0%"
              }
            />
            <Metric
              label="GitHub 索引"
              value={observability?.metrics.githubIndexedRepositories ?? 0}
            />
            <Metric
              label="GitHub 配额"
              value={observability?.metrics.githubRemaining ?? "未连接"}
            />
            <Metric
              label="队列长度"
              value={observability?.metrics.queueLength ?? 0}
            />
          </div>
          <p style={{ color: "var(--muted)", fontSize: 11 }}>
            索引延迟 {String(observability?.metrics.indexDelayHours ?? 0)}h ·
            模型调用 {String(observability?.metrics.modelCalls ?? 0)} ·
            本地语义不产生外部模型成本。
          </p>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2 className="side-title">安全与合规说明</h2>
        <div
          className="grid-cards"
          style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}
        >
          {[
            "OAuth state、SameSite Cookie 与 CSRF Token",
            "AES-256-GCM Token 加密与敏感日志脱敏",
            "Webhook HMAC 验签、API 限流与 Zod 输入校验",
            "图片代理 HTTPS/域名/IP/类型/大小/超时限制",
            "用户可撤销授权、清除历史、重置画像并删除账户",
            "GPS 是独立第三方项目，不代表 GitHub 官方立场",
          ].map((item) => (
            <div className="notice" key={item}>
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PrivacyButton({
  label,
  detail,
  danger,
  onClick,
}: {
  label: string;
  detail: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        alignItems: "center",
        borderBottom: "1px solid var(--line)",
        padding: "10px 0",
      }}
    >
      <div>
        <strong style={{ fontSize: 13 }}>{label}</strong>
        <p style={{ margin: "3px 0", color: "var(--muted)", fontSize: 11 }}>
          {detail}
        </p>
      </div>
      <button
        className={`button button-icon ${danger ? "button-danger" : ""}`}
        aria-label={label}
        onClick={onClick}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <strong>{String(value ?? 0)}</strong>
    </div>
  );
}
