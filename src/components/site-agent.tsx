"use client";

import {
  Bot,
  Compass,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n/i18n-provider";
import { apiFetch } from "@/lib/client-api";

type Message = { role: "user" | "assistant"; content: string };
type AgentAction = { type: "navigate" | "search"; label: string; href: string };
type AgentReply = {
  reply: string;
  actions: AgentAction[];
  provider: "deepseek" | "local";
  model: string;
};

export function SiteAgent() {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [provider, setProvider] = useState<"deepseek" | "local" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const quickPrompts =
    locale === "zh"
      ? [
          {
            label: "找 Agent 开发框架",
            prompt:
              "我想开发一个支持工具调用和工作流编排的 AI Agent，找适合二次开发的框架",
          },
          {
            label: "找自托管知识库",
            prompt: "找一个可自托管、支持 Markdown、适合团队协作的知识库",
          },
          {
            label: "看近期上升项目",
            prompt: "带我查看最近 7 天快速上升的高质量项目",
          },
        ]
      : [
          {
            label: "Find an Agent framework",
            prompt:
              "Find an extensible AI Agent framework with tool calling and workflow orchestration",
          },
          {
            label: "Find a self-hosted wiki",
            prompt:
              "Find a self-hosted team knowledge base with Markdown support",
          },
          {
            label: "See rising projects",
            prompt: "Show high-quality projects rising over the last 7 days",
          },
        ];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function sendMessage(contentValue: string) {
    const content = contentValue.trim();
    if (!content || busy) return;
    const nextMessages = [
      ...messages,
      { role: "user" as const, content },
    ].slice(-11);
    setMessages(nextMessages);
    setInput("");
    setActions([]);
    setError("");
    setBusy(true);
    try {
      const response = await apiFetch<AgentReply>("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: nextMessages,
          locale,
          currentPath: pathname,
        }),
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.reply },
      ]);
      setActions(response.actions);
      setProvider(response.provider);
    } catch (requestError) {
      console.error("GPS Agent request failed", requestError);
      setError(t("agentError"));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function choosePrompt(prompt: string) {
    setInput("");
    void sendMessage(prompt);
  }

  function resetConversation() {
    setMessages([]);
    setActions([]);
    setProvider(null);
    setError("");
    setInput("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (pathname === "/onboarding") return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="agent-launcher"
          aria-label={t("agentOpen")}
          aria-expanded="false"
          aria-controls="gps-site-agent"
          onClick={() => setOpen(true)}
        >
          <Sparkles size={19} aria-hidden />
          <span>{t("agentLauncher")}</span>
        </button>
      ) : null}
      {open ? (
        <section
          id="gps-site-agent"
          className="agent-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="agent-title"
        >
          <header className="agent-header">
            <span className="agent-avatar" aria-hidden>
              <Bot size={19} />
            </span>
            <div>
              <h2 id="agent-title">{t("agentTitle")}</h2>
              <span>
                {provider === "deepseek"
                  ? t("agentAi")
                  : provider === "local"
                    ? t("agentLocal")
                    : t("agentCapability")}
              </span>
            </div>
            {messages.length ? (
              <button
                type="button"
                className="icon-button agent-reset"
                onClick={resetConversation}
                aria-label={t("agentReset")}
                title={t("agentReset")}
              >
                <RotateCcw size={16} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className="icon-button"
              onClick={() => setOpen(false)}
              aria-label={t("agentClose")}
            >
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="agent-messages" ref={scrollRef} aria-live="polite">
            {!messages.length ? (
              <div className="agent-empty">
                <span className="agent-empty-icon" aria-hidden>
                  <Compass size={22} />
                </span>
                <strong>{t("agentIntroTitle")}</strong>
                <p>{t("agentIntro")}</p>
                <div className="agent-quick-prompts">
                  {quickPrompts.map((item) => (
                    <button
                      type="button"
                      key={item.label}
                      onClick={() => choosePrompt(item.prompt)}
                    >
                      <Search size={13} aria-hidden />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div
                className={`agent-message ${message.role}`}
                key={`${index}-${message.role}`}
              >
                {message.content}
              </div>
            ))}
            {busy ? (
              <div className="agent-message assistant agent-thinking">
                <LoaderCircle size={15} className="spin" aria-hidden />
                {t("agentThinking")}
              </div>
            ) : null}
            {error ? (
              <div className="agent-error">{error || t("agentError")}</div>
            ) : null}
          </div>
          {actions.length ? (
            <div className="agent-actions" aria-label="Agent actions">
              {actions.map((action) => (
                <Link
                  href={action.href}
                  key={`${action.type}-${action.href}`}
                  onClick={() => setOpen(false)}
                >
                  {action.label}
                  <ExternalLink size={13} aria-hidden />
                </Link>
              ))}
            </div>
          ) : null}
          <form className="agent-compose" onSubmit={submit}>
            <div className="agent-input-wrap">
              <textarea
                ref={inputRef}
                value={input}
                maxLength={1_200}
                rows={2}
                placeholder={t("agentPlaceholder")}
                aria-label={t("agentPlaceholder")}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <span>{t("agentInputHint")}</span>
            </div>
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t("agentSend")}
            >
              <Send size={17} aria-hidden />
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
