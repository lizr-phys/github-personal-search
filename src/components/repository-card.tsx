"use client";

import {
  Bookmark,
  BookOpen,
  Code2 as Github,
  ExternalLink,
  Heart,
  Info,
  Sparkles,
  Star,
  ThumbsDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AiRepositoryBrief } from "@/components/ai-repository-brief";
import type { InteractionType, RankedRepository } from "@/domain/types";
import { useI18n } from "@/i18n/i18n-provider";
import { evaluateRepositoryAttention } from "@/recommendation/quality-policy";

export function RepositoryCard({
  item,
  onAction,
  busy = false,
}: {
  item: RankedRepository;
  onAction: (type: InteractionType, reason?: string) => Promise<void>;
  busy?: boolean;
}) {
  const { locale, t } = useI18n();
  const [negativeReason, setNegativeReason] =
    useState<InteractionType>("not_interested");
  const { repository } = item;
  const attention = evaluateRepositoryAttention(repository);
  const difficultyLabel =
    locale === "zh"
      ? { beginner: "入门", medium: "中等", advanced: "进阶" }
      : { beginner: "Beginner", medium: "Intermediate", advanced: "Advanced" };
  const typeLabel =
    locale === "zh"
      ? {
          application: "应用",
          library: "库",
          framework: "框架",
          template: "模板",
          tutorial: "教程",
          tool: "工具",
        }
      : {
          application: "Application",
          library: "Library",
          framework: "Framework",
          template: "Template",
          tutorial: "Tutorial",
          tool: "Tool",
        };
  const coverTone = (repository.id.length + repository.owner.length) % 4;
  const cardTags = [
    ...new Set([
      repository.language,
      typeLabel[repository.projectType],
      difficultyLabel[repository.difficulty],
      ...repository.topics,
    ]),
  ].slice(0, 5);
  return (
    <article className="card repo-card reveal" data-testid="feed-card">
      <div
        className="repo-cover"
        data-tone={coverTone}
        aria-label={`${repository.fullName} 稳定占位封面`}
      >
        <div className="cover-grid" />
        <span className="cover-badge">
          {item.candidateType === "sponsored"
            ? "赞助项目"
            : repository.dataSource === "demo"
              ? "演示数据"
              : "GitHub 数据"}
        </span>
        <span className={`quality-seal ${attention.tier}`}>
          {attention.tier === "emerging"
            ? t("qualityEmerging")
            : t("qualityEstablished")}
          <small>{attention.reasons[0]}</small>
        </span>
        <div className="cover-content">
          <div className="cover-kicker">
            {repository.cluster} · {repository.language}
          </div>
          <h2 className="cover-title">
            {locale === "zh" ? repository.chineseTitle : repository.name}
          </h2>
        </div>
      </div>
      <div className="repo-body">
        <Link
          className="repo-path"
          href={`/repository/${repository.owner}/${repository.name}`}
        >
          {repository.fullName}
        </Link>
        <AiRepositoryBrief
          repositoryId={repository.id}
          fallback={
            locale === "zh" ? repository.summary : repository.description
          }
        />
        <div className="chip-row">
          {cardTags.map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="metric-row">
          <span className="metric">
            <Star size={14} aria-hidden />
            {Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
              notation: "compact",
            }).format(repository.stars)}
          </span>
          <span className="metric trend-value">
            <TrendingUp size={14} aria-hidden />+{repository.trend7d.stars} / 7d
          </span>
          <span className="metric">
            {t("lastPush")} {repository.pushedAt.slice(0, 10)}
          </span>
        </div>
        <div className="reason">
          <Sparkles
            size={16}
            aria-hidden
            style={{ flex: "0 0 auto", marginTop: 1 }}
          />
          <span>
            {locale === "zh"
              ? item.explanation
              : `Matches ${repository.domains.slice(0, 2).join(" and ")} interests, with ${repository.stars.toLocaleString("en-US")} Stars and ${repository.maintenance} maintenance evidence.`}
          </span>
        </div>
        <div className="repo-actions">
          <button
            type="button"
            className="button button-primary"
            disabled={busy}
            onClick={() => onAction("interested")}
            data-testid="action-interested"
          >
            <Heart size={16} aria-hidden />
            {t("interested")}
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => onAction("favorite")}
            data-testid="action-favorite"
          >
            <Bookmark size={16} aria-hidden />
            {t("favorite")}
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => onAction("learn")}
            data-testid="action-learn"
          >
            <BookOpen size={16} aria-hidden />
            {t("learn")}
          </button>
          <Link
            className="button"
            href={`/repository/${repository.owner}/${repository.name}`}
          >
            <Info size={16} aria-hidden />
            {t("details")}
          </Link>
          <a
            className="button button-quiet"
            href={repository.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void onAction("open_github")}
          >
            <Github size={16} aria-hidden />
            GitHub
            <ExternalLink size={13} aria-hidden />
          </a>
        </div>
        <details className="negative-feedback">
          <summary>
            <ThumbsDown size={14} aria-hidden />
            {t("unsuitable")}
          </summary>
          <div className="negative-row">
            <select
              className="select"
              value={negativeReason}
              onChange={(event) =>
                setNegativeReason(event.target.value as InteractionType)
              }
              aria-label={t("unsuitable")}
            >
              <option value="not_interested">{t("notInterested")}</option>
              <option value="seen">{t("seen")}</option>
              <option value="too_complex">{t("tooComplex")}</option>
              <option value="language_mismatch">{t("languageMismatch")}</option>
              <option value="unmaintained">{t("unmaintained")}</option>
              <option value="block_similar">{t("blockSimilar")}</option>
            </select>
            <button
              type="button"
              className="button button-danger"
              disabled={busy}
              onClick={() => onAction(negativeReason, negativeReason)}
              data-testid="action-negative"
            >
              {t("confirm")}
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}
