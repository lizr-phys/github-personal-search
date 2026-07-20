"use client";

import {
  Ban,
  History,
  PauseCircle,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { InterestProfile } from "@/domain/types";
import { ErrorState, PageSkeleton } from "@/components/states";
import { apiFetch } from "@/lib/client-api";

type Response = {
  profile: InterestProfile;
  recentChanges: Array<{ label: string; detail: string; at: string }>;
  interactions: Array<{ type: string; repositoryId: string; at: string }>;
};

export default function InterestsPage() {
  const [data, setData] = useState<Response>();
  const [error, setError] = useState<string>();

  async function load() {
    try {
      setData(await apiFetch<Response>("/api/profile"));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function patch(input: Record<string, unknown>) {
    try {
      const result = await apiFetch<{ profile: InterestProfile }>(
        "/api/profile",
        { method: "PATCH", body: JSON.stringify(input) },
      );
      setData((current) =>
        current ? { ...current, profile: result.profile } : current,
      );
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  if (!data && !error) return <PageSkeleton cards={4} />;
  if (!data)
    return (
      <div className="page">
        <ErrorState message={error ?? "无法加载画像"} retry={load} />
      </div>
    );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Editable interest graph</p>
          <h1 className="page-title">兴趣画像中心</h1>
          <p className="page-description">
            长期偏好、短期任务、能力与成本、负面偏好和曝光记忆彼此分离，你可以随时修正。
          </p>
        </div>
        <button className="button" onClick={() => patch({ paused: true })}>
          <PauseCircle size={16} />
          暂停画像更新
        </button>
      </div>
      {error && <ErrorState message={error} />}
      <div
        className="grid-cards"
        style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}
      >
        <InterestPanel
          title="长期兴趣"
          icon={<SlidersHorizontal size={17} />}
          values={data.profile.longTerm}
          onRemove={(value) => patch({ removeLongTerm: value })}
        />
        <InterestPanel
          title="短期兴趣"
          icon={<History size={17} />}
          values={data.profile.shortTerm}
          onRemove={(value) => patch({ removeShortTerm: value })}
        />
        <InterestPanel
          title="技术偏好"
          icon={<SlidersHorizontal size={17} />}
          values={data.profile.languages}
        />
        <section className="panel">
          <h2 className="side-title">
            <Ban size={17} style={{ display: "inline", marginRight: 8 }} />
            负面偏好与屏蔽
          </h2>
          <label className="label" htmlFor="blocked-languages">
            屏蔽语言（逗号分隔）
          </label>
          <input
            id="blocked-languages"
            className="input"
            value={data.profile.blockedLanguages.join(", ")}
            onChange={(event) =>
              setData({
                ...data,
                profile: {
                  ...data.profile,
                  blockedLanguages: event.target.value
                    .split(/[,，]/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                },
              })
            }
            onBlur={() =>
              patch({ blockedLanguages: data.profile.blockedLanguages })
            }
          />
          <label
            className="label"
            htmlFor="blocked-organizations"
            style={{ marginTop: 12 }}
          >
            屏蔽组织（逗号分隔）
          </label>
          <input
            id="blocked-organizations"
            className="input"
            value={data.profile.blockedOrganizations.join(", ")}
            onChange={(event) =>
              setData({
                ...data,
                profile: {
                  ...data.profile,
                  blockedOrganizations: event.target.value
                    .split(/[,，]/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                },
              })
            }
            onBlur={() =>
              patch({ blockedOrganizations: data.profile.blockedOrganizations })
            }
          />
        </section>
      </div>
      <div className="two-column" style={{ marginTop: 22 }}>
        <section className="panel">
          <h2 className="side-title">画像数据来源与最近变化</h2>
          <div className="result-list">
            {data.recentChanges.map((change, index) => (
              <div
                key={`${change.at}-${index}`}
                style={{
                  borderBottom: "1px solid var(--line)",
                  padding: "10px 0",
                }}
              >
                <strong style={{ fontSize: 13 }}>{change.label}</strong>
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: 12,
                    margin: "4px 0",
                  }}
                >
                  {change.detail}
                </p>
                <time style={{ color: "#8b9691", fontSize: 10 }}>
                  {change.at.slice(0, 16).replace("T", " ")}
                </time>
              </div>
            ))}
          </div>
        </section>
        <aside className="panel">
          <h2 className="side-title">搜索对画像的影响</h2>
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={data.profile.searchAffectsProfile}
              onChange={(event) =>
                patch({ searchAffectsProfile: event.target.checked })
              }
            />
            允许明确选择的搜索写入短期兴趣
          </label>
          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
            即使总开关打开，搜索页仍可逐次关闭；临时查询不会写入长期画像。
          </p>
          <div className="divider" />
          <h2 className="side-title">复杂度偏好</h2>
          <span className="chip chip-accent">
            {data.profile.difficulty === "beginner"
              ? "入门"
              : data.profile.difficulty === "advanced"
                ? "进阶"
                : "中等"}
          </span>
          <div className="divider" />
          <button
            className="button button-danger"
            onClick={() =>
              apiFetch("/api/privacy", {
                method: "POST",
                body: JSON.stringify({ action: "reset_profile" }),
              }).then(() => window.location.assign("/onboarding"))
            }
          >
            <RotateCcw size={15} />
            重置画像
          </button>
        </aside>
      </div>
    </div>
  );
}

function InterestPanel({
  title,
  icon,
  values,
  onRemove,
}: {
  title: string;
  icon: React.ReactNode;
  values: Record<string, number>;
  onRemove?: (value: string) => void;
}) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  return (
    <section className="panel">
      <h2 className="side-title">
        {icon}
        <span style={{ marginLeft: 8 }}>{title}</span>
      </h2>
      {entries.length ? (
        entries.map(([value, weight]) => (
          <div className="interest-line" key={value}>
            <div>
              <span>{value}</span>
              <div className="bar">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(4, Math.abs(weight) * 15))}%`,
                    background: weight < 0 ? "var(--danger)" : undefined,
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <strong>{weight.toFixed(1)}</strong>
              {onRemove && (
                <button
                  className="button button-quiet button-icon"
                  aria-label={`删除 ${value}`}
                  onClick={() => onRemove(value)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 12 }}>暂无数据</p>
      )}
    </section>
  );
}
