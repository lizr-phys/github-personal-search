"use client";

import {
  BookMarked,
  Compass,
  Gauge,
  Languages,
  Library,
  Mail,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { SiteAgent } from "@/components/site-agent";
import { useI18n } from "@/i18n/i18n-provider";

const navigation = [
  { href: "/", label: "home", icon: Compass },
  { href: "/search", label: "search", icon: Search },
  { href: "/library", label: "library", icon: Library },
  { href: "/trends", label: "trends", icon: Gauge },
  { href: "/subscriptions", label: "subscriptions", icon: Mail },
  { href: "/profile/interests", label: "interests", icon: UserRound },
  { href: "/settings", label: "settings", icon: Settings },
] as const;

const mobileNavigation = navigation.slice(0, 5);

export function AppShell({ children }: { children: React.ReactNode }) {
  const { locale, toggleLocale, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<{
    mode: string;
    githubRepositories: number;
  }>({ mode: "demo", githubRepositories: 0 });

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#global-search")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((value: { mode?: string; githubRepositories?: number }) =>
        setSource({
          mode: value.mode ?? "demo",
          githubRepositories: value.githubRepositories ?? 0,
        }),
      )
      .catch(() => undefined);
  }, [pathname]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim())
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("skip")}
      </a>
      <aside className="sidebar" aria-label={t("mainNav")}>
        <Link href="/" className="brand" aria-label="GPS 首页">
          <span className="brand-mark">G</span>
          <span>
            <span className="brand-name">GPS</span>
            <span className="brand-sub">{t("brandSub")}</span>
          </span>
        </Link>
        <nav className="nav-list">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${active(href) ? "active" : ""}`}
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon size={18} aria-hidden />
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <BookMarked size={15} aria-hidden style={{ marginBottom: 8 }} />
          <strong>{t("independent")}</strong>
          <br />
          {t("disclaimer")}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <form className="top-search" role="search" onSubmit={submit}>
            <Search size={18} aria-hidden />
            <input
              id="global-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("globalSearch")}
            />
            <span className="kbd">Ctrl K</span>
          </form>
          <div className="topbar-actions">
            <button
              type="button"
              className="language-toggle"
              onClick={toggleLocale}
              aria-label={`${t("language")}: ${locale === "zh" ? "中文" : "English"}`}
            >
              <Languages size={15} aria-hidden />
              <span>{locale === "zh" ? "中 / EN" : "EN / 中"}</span>
            </button>
            <span className="mode-pill">
              <Sparkles size={14} aria-hidden />
              {source.mode === "demo"
                ? t("demoData")
                : `GitHub ${source.githubRepositories}`}
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      {pathname !== "/onboarding" ? (
        <nav className="mobile-nav" aria-label={t("mobileNav")}>
          {mobileNavigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={active(href) ? "active" : ""}
            >
              <Icon size={19} aria-hidden />
              <span>{t(label)}</span>
            </Link>
          ))}
        </nav>
      ) : null}
      <SiteAgent />
    </div>
  );
}
