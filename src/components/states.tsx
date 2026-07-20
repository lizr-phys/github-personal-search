"use client";

import {
  AlertTriangle,
  Database,
  Inbox,
  LoaderCircle,
  WifiOff,
} from "lucide-react";

import { useI18n } from "@/i18n/i18n-provider";

export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="page" aria-label="正在加载">
      <div
        className="skeleton"
        style={{ width: 180, height: 18, marginBottom: 12 }}
      />
      <div
        className="skeleton"
        style={{ width: "55%", height: 42, marginBottom: 30 }}
      />
      <div className="grid-cards">
        {Array.from({ length: cards }).map((_, index) => (
          <div className="card" key={index} style={{ padding: 18 }}>
            <div
              className="skeleton"
              style={{ height: 150, marginBottom: 16 }}
            />
            <div
              className="skeleton"
              style={{ height: 18, width: "60%", marginBottom: 10 }}
            />
            <div className="skeleton" style={{ height: 60 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="panel"
      style={{ textAlign: "center", padding: "48px 24px" }}
    >
      <Inbox
        size={32}
        aria-hidden
        style={{ margin: "0 auto 12px", color: "#6d7a74" }}
      />
      <h2 style={{ margin: "0 0 8px" }}>{title}</h2>
      <p className="page-description" style={{ margin: "0 auto 18px" }}>
        {message}
      </p>
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const { locale } = useI18n();
  return (
    <div className="error-box" role="alert">
      <AlertTriangle size={20} aria-hidden />
      <strong style={{ display: "block", margin: "8px 0 4px" }}>
        {locale === "zh" ? "加载失败" : "Unable to load"}
      </strong>
      <span>{message}</span>
      {retry && (
        <button
          className="button button-danger"
          style={{ marginTop: 12 }}
          onClick={retry}
        >
          {locale === "zh" ? "重试" : "Retry"}
        </button>
      )}
    </div>
  );
}

export function InlineLoading({ label = "处理中" }: { label?: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
      <LoaderCircle size={15} className="animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function DemoNotice({
  mode = "demo",
  githubCount = 0,
  demoCount,
}: {
  mode?: "demo" | "hybrid" | "github";
  githubCount?: number;
  demoCount?: number;
}) {
  const { locale } = useI18n();
  if (mode !== "demo")
    return (
      <div className="notice">
        <Database
          size={15}
          aria-hidden
          style={{ display: "inline", marginRight: 7 }}
        />
        {locale === "zh" ? "已加入" : "Indexed"} {githubCount} GitHub{" "}
        {locale === "zh" ? "个项目" : "projects"}
        {typeof demoCount === "number" && demoCount > 0
          ? locale === "zh"
            ? `；另有 ${demoCount} 个演示条目`
            : `, plus ${demoCount} demo entries`
          : ""}
        {locale === "zh" ? "。" : "."}
      </div>
    );
  return (
    <div className="notice notice-warn">
      <WifiOff
        size={15}
        aria-hidden
        style={{ display: "inline", marginRight: 7 }}
      />
      {locale === "zh"
        ? "当前为演示数据。需要最新结果时，可在搜索中拉取 GitHub。"
        : "This is demo data. Fetch GitHub from search when you need current results."}
    </div>
  );
}
