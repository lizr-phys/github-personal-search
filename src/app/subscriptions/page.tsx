"use client";

import { Mail, Pause, Play, Plus, RefreshCw, Rss } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import type { SearchIntent } from "@/domain/types";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { apiFetch } from "@/lib/client-api";

type Subscription = {
  id: string;
  name: string;
  rawQuery: string;
  intent: SearchIntent;
  frequency: "daily" | "weekly" | "monthly";
  minRelevance: number;
  minQuality: number;
  heatThreshold: number;
  enabled: boolean;
  deliveredRepositoryIds: unknown[];
  createdAt: string;
};
type SearchResponse = { intent: SearchIntent };
type PreviewResponse = {
  email: {
    subject: string;
    html: string;
    repositoryIds: string[];
    status: string;
  };
  skipped: boolean;
};

export default function SubscriptionsPage() {
  const [items, setItems] = useState<Subscription[]>();
  const [query, setQuery] = useState("自托管家庭照片管理与备份");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const [preview, setPreview] = useState<PreviewResponse>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const response = await apiFetch<{ items: Subscription[] }>(
        "/api/subscriptions",
      );
      setItems(response.items);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const search = await apiFetch<SearchResponse>("/api/search", {
        method: "POST",
        body: JSON.stringify({
          query,
          mode: "comprehensive",
          affectsProfile: false,
        }),
      });
      await apiFetch("/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          name: query.slice(0, 60),
          rawQuery: query,
          intent: search.intent,
          frequency,
          minRelevance: 0.45,
          minQuality: 0.7,
          heatThreshold: 0,
        }),
      });
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: Subscription) {
    await apiFetch(`/api/subscriptions/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    await load();
  }

  async function buildPreview(id?: string) {
    try {
      setPreview(
        await apiFetch<PreviewResponse>("/api/mail/preview", {
          method: "POST",
          body: JSON.stringify({ subscriptionId: id }),
        }),
      );
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  if (!items && !error) return <PageSkeleton cards={3} />;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Semantic topic radar</p>
          <h1 className="page-title">语义订阅与邮件摘要</h1>
          <p className="page-description">
            保存完整查询意图、必要条件、排除项和质量阈值。30
            日内不重复推送，重大更新除外。
          </p>
        </div>
        <button className="button" onClick={() => buildPreview(items?.[0]?.id)}>
          <Mail size={16} />
          预览邮件
        </button>
      </div>
      <div className="two-column">
        <div>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <ErrorState message={error} />
            </div>
          )}
          <section className="panel" style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>
              <Plus size={17} style={{ display: "inline", marginRight: 8 }} />
              新建语义主题
            </h2>
            <form onSubmit={create}>
              <label className="label" htmlFor="subscription-query">
                用自然语言描述持续关注的方向
              </label>
              <input
                id="subscription-query"
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px auto",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <select
                  className="select"
                  value={frequency}
                  onChange={(event) =>
                    setFrequency(event.target.value as typeof frequency)
                  }
                >
                  <option value="daily">每日</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
                <button className="button button-primary" disabled={busy}>
                  <Rss size={16} />
                  保存主题
                </button>
              </div>
            </form>
          </section>
          {items?.length ? (
            <div className="result-list">
              {items.map((item) => (
                <article className="card" style={{ padding: 20 }} key={item.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <div>
                      <span
                        className={`chip ${item.enabled ? "chip-accent" : ""}`}
                      >
                        {item.enabled ? "订阅中" : "已暂停"}
                      </span>
                      <h2 style={{ fontSize: 18, margin: "10px 0 5px" }}>
                        {item.name}
                      </h2>
                      <div className="repo-path">
                        {item.frequency === "daily"
                          ? "每日"
                          : item.frequency === "weekly"
                            ? "每周"
                            : "每月"}{" "}
                        · 相关度 ≥ {item.minRelevance} · 质量 ≥{" "}
                        {item.minQuality}
                      </div>
                    </div>
                    <button
                      className="button button-icon"
                      aria-label={item.enabled ? "暂停订阅" : "启用订阅"}
                      onClick={() => toggle(item)}
                    >
                      {item.enabled ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                  </div>
                  <div className="chip-row" style={{ marginTop: 14 }}>
                    {[
                      ...item.intent.domains,
                      ...item.intent.technologies,
                      ...item.intent.negativeConstraints.map(
                        (value) => `排除 ${value}`,
                      ),
                    ]
                      .slice(0, 8)
                      .map((value) => (
                        <span className="chip" key={value}>
                          {value}
                        </span>
                      ))}
                  </div>
                  <div className="repo-actions">
                    <button
                      className="button"
                      onClick={() => buildPreview(item.id)}
                    >
                      <Mail size={15} />
                      预览本期邮件
                    </button>
                    <span className="metric">
                      已推送记录 {item.deliveredRepositoryIds.length}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="还没有订阅"
              message="可从搜索结果一键保存，或在上方直接描述一个语义主题。"
            />
          )}
        </div>
        <aside className="panel" style={{ position: "sticky", top: 96 }}>
          <h2 className="side-title">邮件规则</h2>
          <ul
            style={{
              paddingLeft: 18,
              color: "var(--muted)",
              fontSize: 12,
              lineHeight: 1.8,
            }}
          >
            <li>每封最多 5—10 个项目</li>
            <li>质量不足时减少或跳过</li>
            <li>新出现、快速上升、重大更新、为你发现</li>
            <li>点击、收藏和不相关反馈回写画像</li>
          </ul>
          <button
            className="button"
            style={{ width: "100%" }}
            onClick={() => buildPreview(items?.[0]?.id)}
          >
            <RefreshCw size={15} />
            生成最新预览
          </button>
        </aside>
      </div>
      {preview && (
        <section className="card" style={{ marginTop: 24, padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div>
              <p className="eyebrow">本地邮件预览</p>
              <h2 style={{ margin: 0 }}>{preview.email.subject}</h2>
            </div>
            <span className="chip chip-accent">
              {preview.email.repositoryIds.length} 个项目
            </span>
          </div>
          {preview.skipped ? (
            <p className="notice notice-warn">
              本期没有足够高质量项目，系统选择跳过发送。
            </p>
          ) : (
            <iframe
              title="GPS 邮件摘要预览"
              srcDoc={preview.email.html}
              style={{
                width: "100%",
                minHeight: 720,
                border: "1px solid var(--line)",
                borderRadius: 14,
                marginTop: 18,
                background: "white",
              }}
              sandbox="allow-popups"
            />
          )}
        </section>
      )}
    </div>
  );
}
