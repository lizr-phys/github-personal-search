"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/i18n/i18n-provider";
import { apiFetch } from "@/lib/client-api";

type Brief = {
  title: string;
  oneLine: string;
  overview: string;
  highlights: string[];
  suitableFor: string;
  caveat: string;
  provider: "deepseek" | "local";
  model: string;
  evidence: string[];
  confidence: number;
};

export function AiRepositoryBrief({
  repositoryId,
  fallback,
  expanded = false,
}: {
  repositoryId: string;
  fallback: string;
  expanded?: boolean;
}) {
  const { locale, t } = useI18n();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<Brief>("/api/ai/repository-brief", {
      method: "POST",
      body: JSON.stringify({ repositoryId, locale }),
    })
      .then((value) => {
        if (active) setBrief(value);
      })
      .catch(() => {
        if (active) setBrief(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [locale, repositoryId]);

  return (
    <div className={`ai-brief ${expanded ? "ai-brief-expanded" : ""}`}>
      <div className="ai-brief-label">
        <Sparkles size={14} aria-hidden />
        <span>{t("aiBrief")}</span>
        <em>
          {brief?.provider === "deepseek" ? t("aiGenerated") : t("aiEvidence")}
        </em>
      </div>
      <p className={`repo-summary ${loading ? "brief-loading" : ""}`}>
        {brief?.oneLine ?? fallback}
      </p>
      <details className="brief-disclosure" open={expanded || undefined}>
        <summary>{t("expandBrief")}</summary>
        {brief ? (
          <div className="brief-detail">
            <p>{brief.overview}</p>
            <ul>
              {brief.highlights.map((highlight) => (
                <li key={highlight}>
                  <CheckCircle2 size={14} aria-hidden />
                  {highlight}
                </li>
              ))}
            </ul>
            <p>
              <strong>{t("suitableFor")}：</strong>
              {brief.suitableFor}
            </p>
            <p className="brief-caveat">
              <strong>{t("caveat")}：</strong>
              {brief.caveat}
            </p>
            <small>
              {brief.evidence.length
                ? `${t("aiEvidence")}: ${brief.evidence.join(" · ")}`
                : t("aiEvidence")}
            </small>
          </div>
        ) : null}
      </details>
    </div>
  );
}
