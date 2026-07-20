"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppLocale = "zh" | "en";

const messages = {
  zh: {
    skip: "跳到主要内容",
    mainNav: "主导航",
    home: "为你推荐",
    search: "智能搜索",
    library: "个人知识库",
    trends: "趋势中心",
    subscriptions: "语义订阅",
    interests: "兴趣画像",
    settings: "设置与隐私",
    brandSub: "个人项目雷达",
    independent: "独立第三方项目",
    disclaimer: "GPS 不隶属于 GitHub，也不代表 GitHub 官方立场。",
    globalSearch: "全局项目搜索",
    searchPlaceholder: "用中文、英文或自然语言搜索项目…",
    demoData: "演示数据",
    language: "语言",
    mobileNav: "移动端导航",
    interested: "感兴趣",
    favorite: "收藏",
    learn: "加入学习",
    details: "详情",
    unsuitable: "不合适",
    notInterested: "不感兴趣",
    seen: "已经看过",
    tooComplex: "项目太复杂",
    languageMismatch: "语言不符合偏好",
    unmaintained: "项目已失效或停止维护",
    blockSimilar: "不再推荐相似项目",
    confirm: "确认",
    lastPush: "最近 Push",
    qualityEstablished: "高关注项目",
    qualityEmerging: "新锐项目",
    aiBrief: "项目简介",
    aiEvidence: "基于仓库证据",
    aiGenerated: "AI 归纳",
    expandBrief: "查看详细简介",
    suitableFor: "适合",
    caveat: "采用前提示",
    agentTitle: "GPS 项目向导",
    agentLauncher: "问 GPS",
    agentIntroTitle: "今天想解决什么问题？",
    agentIntro:
      "可以直接描述产品目标、技术限制或想完成的操作。我会整理需求并给出可执行入口。",
    agentOpen: "打开 GPS 项目向导",
    agentClose: "关闭对话",
    agentReset: "开始新对话",
    agentCapability: "搜索 · 趋势 · 知识库",
    agentPlaceholder: "描述需求、技术栈或限制条件…",
    agentInputHint: "Enter 发送 · Shift + Enter 换行",
    agentSend: "发送",
    agentThinking: "正在整理最短路径…",
    agentLocal: "本地向导",
    agentAi: "DeepSeek Agent",
    agentError: "暂时无法回复，请稍后重试。",
  },
  en: {
    skip: "Skip to main content",
    mainNav: "Main navigation",
    home: "For you",
    search: "Smart search",
    library: "Knowledge library",
    trends: "Trends",
    subscriptions: "Subscriptions",
    interests: "Interest profile",
    settings: "Settings & privacy",
    brandSub: "Personal project radar",
    independent: "Independent third-party project",
    disclaimer: "GPS is not affiliated with or endorsed by GitHub.",
    globalSearch: "Search projects",
    searchPlaceholder: "Search in Chinese, English, or natural language…",
    demoData: "Demo data",
    language: "Language",
    mobileNav: "Mobile navigation",
    interested: "Interested",
    favorite: "Save",
    learn: "Learn",
    details: "Details",
    unsuitable: "Not for me",
    notInterested: "Not interested",
    seen: "Already seen",
    tooComplex: "Too complex",
    languageMismatch: "Language mismatch",
    unmaintained: "Inactive or unmaintained",
    blockSimilar: "Stop similar recommendations",
    confirm: "Confirm",
    lastPush: "Last push",
    qualityEstablished: "High-attention project",
    qualityEmerging: "Promising newcomer",
    aiBrief: "Project brief",
    aiEvidence: "Repository evidence",
    aiGenerated: "AI synthesis",
    expandBrief: "Read full brief",
    suitableFor: "Best for",
    caveat: "Before adopting",
    agentTitle: "GPS project guide",
    agentLauncher: "Ask GPS",
    agentIntroTitle: "What are you trying to solve?",
    agentIntro:
      "Describe a product goal, technical constraint, or site task. I’ll turn it into a clear next step.",
    agentOpen: "Open GPS project guide",
    agentClose: "Close conversation",
    agentReset: "Start a new conversation",
    agentCapability: "Search · trends · library",
    agentPlaceholder: "Describe the goal, stack, or constraints…",
    agentInputHint: "Enter to send · Shift + Enter for a new line",
    agentSend: "Send",
    agentThinking: "Finding the shortest path…",
    agentLocal: "Local guide",
    agentAi: "DeepSeek Agent",
    agentError: "I cannot reply right now. Please try again.",
  },
} as const;

type MessageKey = keyof (typeof messages)["zh"];
type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("zh");

  useEffect(() => {
    const saved = window.localStorage.getItem("gps_locale");
    if (saved === "zh" || saved === "en") setLocaleState(saved);
  }, []);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem("gps_locale", nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === "zh" ? "en" : "zh"),
      t: (key) => messages[locale][key],
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
