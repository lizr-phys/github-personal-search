"use client";

import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorState, PageSkeleton } from "@/components/states";
import { apiFetch } from "@/lib/client-api";

type Options = {
  interests: Array<{ id: string; label: string }>;
  languages: string[];
  seeds: Array<{
    id: string;
    fullName: string;
    title: string;
    cluster: string;
  }>;
};
type Feedback = "interested" | "not_interested" | "seen" | "learn";

const feedbackLabels: Record<Feedback, string> = {
  interested: "感兴趣",
  learn: "想学习",
  seen: "已了解",
  not_interested: "不感兴趣",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [options, setOptions] = useState<Options>();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([
    "TypeScript",
    "Python",
  ]);
  const [difficulty, setDifficulty] = useState<
    "beginner" | "medium" | "advanced"
  >("medium");
  const [seedRepositories, setSeedRepositories] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<Options>("/api/onboarding")
      .then(setOptions)
      .catch((reason) => setError(reason.message));
  }, []);

  function toggle(
    value: string,
    values: string[],
    setValues: (values: string[]) => void,
    max = 8,
  ) {
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : values.length < max
          ? [...values, value]
          : values,
    );
  }

  const feedbackCount = Object.keys(feedback).length;
  const canContinue =
    step === 0
      ? interests.length >= 2 && languages.length >= 1
      : step === 1
        ? seedRepositories.length >= 1
        : feedbackCount >= 10;
  const feedbackSeeds = useMemo(
    () => options?.seeds.slice(0, 12) ?? [],
    [options],
  );

  async function finish() {
    setBusy(true);
    setError(undefined);
    try {
      await apiFetch("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          interests,
          languages,
          difficulty,
          seedRepositories,
          feedback: Object.entries(feedback).map(([repositoryId, type]) => ({
            repositoryId,
            type,
          })),
        }),
      });
      router.push("/");
      router.refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!options && !error) return <PageSkeleton cards={2} />;

  return (
    <div className="page onboarding-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">设置偏好 · {step + 1} / 3</p>
          <h1 className="page-title">
            {step === 0
              ? "你平时关注什么？"
              : step === 1
                ? "挑几个熟悉的项目"
                : "快速判断这些项目"}
          </h1>
          <p className="page-description">
            {step === 0
              ? "至少选择两个方向，之后随时可以修改。"
              : step === 1
                ? "它们只用于找到第一批项目。"
                : "完成 10 个判断，就可以开始浏览。"}
          </p>
        </div>
      </div>
      <div className="stepper" aria-label={`步骤 ${step + 1} / 3`}>
        {[0, 1, 2].map((value) => (
          <span
            className={`step-dot ${value <= step ? "active" : ""}`}
            key={value}
          />
        ))}
      </div>
      {error && (
        <div style={{ marginBottom: 18 }}>
          <ErrorState message={error} />
        </div>
      )}
      <section className="panel" style={{ padding: 26 }}>
        {step === 0 && (
          <>
            <h2 style={{ marginTop: 0, fontSize: 17 }}>选择 2—8 个领域</h2>
            <div className="choice-grid">
              {options?.interests.map((item) => (
                <button
                  type="button"
                  className={`choice ${interests.includes(item.id) ? "selected" : ""}`}
                  onClick={() => toggle(item.id, interests, setInterests)}
                  key={item.id}
                >
                  {interests.includes(item.id) && (
                    <Check size={15} aria-hidden style={{ float: "right" }} />
                  )}
                  {item.label}
                </button>
              ))}
            </div>
            <div className="divider" />
            <h2 style={{ fontSize: 17 }}>常用语言</h2>
            <div className="chip-row">
              {options?.languages.map((language) => (
                <button
                  type="button"
                  className={`chip chip-button ${languages.includes(language) ? "selected" : ""}`}
                  onClick={() => toggle(language, languages, setLanguages)}
                  key={language}
                >
                  {language}
                </button>
              ))}
            </div>
            <div className="divider" />
            <label className="label" htmlFor="difficulty">
              更适合你的项目复杂度
            </label>
            <select
              id="difficulty"
              className="select"
              style={{ maxWidth: 260 }}
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as typeof difficulty)
              }
            >
              <option value="beginner">入门：快速运行与学习</option>
              <option value="medium">中等：可二次开发</option>
              <option value="advanced">进阶：框架与系统级项目</option>
            </select>
          </>
        )}
        {step === 1 && (
          <>
            <div className="choice-grid">
              {options?.seeds.map((item) => (
                <button
                  type="button"
                  className={`choice ${seedRepositories.includes(item.id) ? "selected" : ""}`}
                  onClick={() =>
                    toggle(item.id, seedRepositories, setSeedRepositories, 5)
                  }
                  key={item.id}
                >
                  <span
                    style={{
                      display: "block",
                      color: "var(--muted)",
                      fontSize: 10,
                      marginBottom: 6,
                    }}
                  >
                    {item.cluster}
                  </span>
                  {item.title}
                  <span
                    style={{
                      display: "block",
                      fontSize: 10,
                      color: "var(--muted)",
                      marginTop: 6,
                    }}
                  >
                    {item.fullName}
                  </span>
                </button>
              ))}
            </div>
            <p className="notice" style={{ marginTop: 18 }}>
              最多选择 5 个。演示仓库只是兴趣锚点，Stars
              数值不会直接作为个人偏好。
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <strong>已完成 {feedbackCount} / 10（最多 12）</strong>
              <span className="chip chip-accent">
                <Sparkles size={13} />
                快速反馈
              </span>
            </div>
            <div className="feedback-list">
              {feedbackSeeds.map((item) => (
                <div className="feedback-item" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: 11,
                        marginTop: 4,
                      }}
                    >
                      {item.fullName} · {item.cluster}
                    </div>
                  </div>
                  <div className="segmented">
                    {(Object.keys(feedbackLabels) as Feedback[]).map((type) => (
                      <button
                        className={`segment ${feedback[item.id] === type ? "selected" : ""}`}
                        onClick={() =>
                          setFeedback((current) => ({
                            ...current,
                            [item.id]: type,
                          }))
                        }
                        key={type}
                      >
                        {feedbackLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 18,
        }}
      >
        <button
          className="button"
          disabled={step === 0 || busy}
          onClick={() => setStep((value) => value - 1)}
        >
          <ArrowLeft size={16} />
          上一步
        </button>
        {step < 2 ? (
          <button
            className="button button-primary"
            disabled={!canContinue}
            onClick={() => setStep((value) => value + 1)}
          >
            下一步
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="button button-primary"
            disabled={!canContinue || busy}
            onClick={finish}
            data-testid="finish-onboarding"
          >
            {busy ? "正在生成首批项目…" : "完成并查看首批 10 个"}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
