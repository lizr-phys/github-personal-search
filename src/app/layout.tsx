import type { Metadata } from "next";

import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { I18nProvider } from "@/i18n/i18n-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "GPS · GitHub Personal Search", template: "%s · GPS" },
  description:
    "以 GitHub 项目为内容、以用户兴趣图谱为核心的个性化搜索与推荐平台。",
  applicationName: "GitHub Personal Search",
  openGraph: {
    title: "GPS · GitHub Personal Search",
    description:
      "精准搜索、个性化项目推荐、趋势追踪、语义订阅和个人项目知识库。",
    type: "website",
    locale: "zh_CN",
    images: [
      {
        url: "/gps-og.png",
        width: 1672,
        height: 941,
        alt: "GPS 个性化开源项目发现网络",
      },
    ],
  },
  twitter: { card: "summary_large_image", images: ["/gps-og.png"] },
  robots: {
    index: process.env.NODE_ENV === "production",
    follow: process.env.NODE_ENV === "production",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
