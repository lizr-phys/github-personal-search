"use client";

import {
  ArrowUpRight,
  Clock3,
  Flame,
  GitFork,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Repository } from "@/domain/types";
import { DemoNotice, ErrorState, PageSkeleton } from "@/components/states";
import { apiFetch } from "@/lib/client-api";

type Response = {
  items: Repository[];
  window: "1d" | "7d" | "30d";
  kind: string;
  dataUpdatedAt: string;
  catalog: {
    mode: "demo" | "hybrid" | "github";
    githubCount: number;
    demoCount: number;
  };
  available: { languages: string[]; domains: string[] };
};

export default function TrendsPage() {
  const [windowValue, setWindow] = useState("7d");
  const [kind, setKind] = useState("rising");
  const [language, setLanguage] = useState("");
  const [domain, setDomain] = useState("");
  const [age, setAge] = useState("any");
  const [data, setData] = useState<Response>();
  const [error, setError] = useState<string>();

  async function load() {
    try {
      const query = new URLSearchParams({ window: windowValue, kind, age });
      if (language) query.set("language", language);
      if (domain) query.set("domain", domain);
      setData(await apiFetch<Response>(`/api/trends?${query}`));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [windowValue, kind, language, domain, age]);
  if (!data && !error) return <PageSkeleton cards={6} />;
  const trendKey =
    windowValue === "1d"
      ? "trend1d"
      : windowValue === "30d"
        ? "trend30d"
        : "trend7d";
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Velocity, not popularity</p>
          <h1 className="page-title">趋势中心</h1>
          <p className="page-description">
            按同领域、年龄和规模理解增长；总 Star 只用于展示，不代替热度。
          </p>
        </div>
        <span className="chip chip-accent">
          <Flame size={14} />
          {windowValue.replace("d", " 日")}窗口
        </span>
      </div>
      <div className="filters">
        <select
          className="select"
          aria-label="趋势类型"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="rising">快速上升</option>
          <option value="new">新项目</option>
          <option value="updates">重大更新</option>
        </select>
        <select
          className="select"
          aria-label="趋势时间窗口"
          value={windowValue}
          onChange={(event) => setWindow(event.target.value)}
          data-testid="trend-window"
        >
          <option value="1d">1 日</option>
          <option value="7d">7 日</option>
          <option value="30d">30 日</option>
        </select>
        <select
          className="select"
          aria-label="按语言筛选"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          <option value="">全部语言</option>
          {data?.available.languages.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label="按领域筛选"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
        >
          <option value="">全部领域</option>
          {data?.available.domains.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label="按项目年龄筛选"
          value={age}
          onChange={(event) => setAge(event.target.value)}
        >
          <option value="any">全部年龄</option>
          <option value="new">1 年内</option>
          <option value="young">3 年内</option>
        </select>
      </div>
      {error && <ErrorState message={error} retry={load} />}
      <div className="grid-cards" data-testid="trends-grid">
        {data?.items.map((repository, index) => (
          <article className="card mini-repo" key={repository.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span className="chip chip-accent">
                #{index + 1} · {repository.cluster}
              </span>
              <strong className="trend-value">
                {repository[trendKey].heat.toFixed(2)}
              </strong>
            </div>
            <h3>{repository.chineseTitle}</h3>
            <div className="repo-path">{repository.fullName}</div>
            <p>{repository.description}</p>
            <div className="metric-row">
              <span className="metric">
                <Star size={13} />
                {Intl.NumberFormat("zh-CN", { notation: "compact" }).format(
                  repository.stars,
                )}
              </span>
              <span className="metric trend-value">
                <ArrowUpRight size={13} />+{repository[trendKey].stars}
              </span>
              <span className="metric">
                <GitFork size={13} />+{repository[trendKey].forks}
              </span>
            </div>
            <div className="repo-actions">
              <Link
                className="button"
                href={`/repository/${repository.owner}/${repository.name}`}
              >
                查看详情
              </Link>
              {repository.releasedAt && (
                <span className="chip">
                  <Sparkles size={12} />
                  {repository.releasedAt.slice(0, 10)} Release
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <DemoNotice
          mode={data?.catalog.mode}
          githubCount={data?.catalog.githubCount}
          demoCount={data?.catalog.demoCount}
        />
        <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 8 }}>
          <Clock3 size={12} style={{ display: "inline" }} /> 数据更新时间：
          {data?.dataUpdatedAt.slice(0, 16).replace("T", " ")}
          ；真实仓库的增量来自本地时间序列快照，首次同步时增量为 0。
        </p>
      </div>
    </div>
  );
}
