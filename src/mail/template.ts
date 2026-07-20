import type { Repository } from "@/domain/types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type RepositoryLinks = Record<
  string,
  { view: string; favorite: string; notRelevant: string }
>;

export function renderDigest(input: {
  title: string;
  sections: Array<{ name: string; repositories: Repository[] }>;
  unsubscribeUrl: string;
  repositoryLinks?: RepositoryLinks;
}): string {
  const sections = input.sections
    .filter((section) => section.repositories.length)
    .map(
      (section) =>
        `<section style="margin:28px 0"><h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(section.name)}</h2>${section.repositories
          .map((repository) => {
            const links = input.repositoryLinks?.[repository.id];
            const view = links?.view ?? repository.githubUrl;
            return `<article style="border:1px solid #dce4e0;border-radius:14px;padding:16px;margin:10px 0;background:#fff"><div style="font-size:12px;color:#5c6964">${escapeHtml(repository.fullName)} · ${escapeHtml(repository.language)} · +${repository.trend7d.stars} / 7d</div><h3 style="font-size:16px;margin:6px 0">${escapeHtml(repository.chineseTitle)}</h3><p style="color:#3f4b47;line-height:1.6;margin:0 0 10px">${escapeHtml(repository.description)}</p><a href="${escapeHtml(view)}" style="color:#11664a">查看项目</a>${links ? ` <span style="color:#a6b0ac">·</span> <a href="${escapeHtml(links.favorite)}" style="color:#11664a">收藏</a> <span style="color:#a6b0ac">·</span> <a href="${escapeHtml(links.notRelevant)}" style="color:#68746f">不相关</a>` : ""}</article>`;
          })
          .join("")}</section>`,
    )
    .join("");
  return `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f3f6f4;font-family:Arial,sans-serif;color:#16211d"><main style="max-width:680px;margin:0 auto;padding:32px 18px"><div style="background:#143f33;color:#fff;border-radius:18px;padding:24px"><div style="font-size:12px;letter-spacing:.1em">GPS · GITHUB PERSONAL SEARCH</div><h1 style="font-size:26px;margin:10px 0 6px">${escapeHtml(input.title)}</h1><p style="margin:0;color:#c8ded5">只发送达到相关性与质量门槛的项目。</p></div>${sections}<p style="font-size:12px;color:#68746f">GPS 是独立第三方项目，不隶属于 GitHub，也不代表 GitHub 官方立场。 <a href="${escapeHtml(input.unsubscribeUrl)}">退订</a></p></main></body></html>`;
}
