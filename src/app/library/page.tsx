"use client";

import {
  BookMarked,
  Clock3,
  Link2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import type { Repository } from "@/domain/types";
import { useI18n } from "@/i18n/i18n-provider";
import { apiFetch } from "@/lib/client-api";

type Entry = {
  repositoryId: string;
  collectionId: string;
  status: string;
  tags: string[];
  note: string;
  addedAt: string;
  updatedAt: string;
  repository: Repository;
};
type Collection = {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
};
type LearningLog = {
  id: string;
  repositoryId: string;
  status: string;
  at: string;
  repository?: Repository;
};
type History = {
  id: string;
  repositoryId: string;
  surface: string;
  at: string;
  repository?: Repository;
};
type Relation = {
  fromRepositoryId: string;
  toRepositoryId: string;
  type: string;
  note?: string;
  fromRepository?: Repository;
  toRepository?: Repository;
};
type Response = {
  items: Entry[];
  collections: Collection[];
  learningLogs: LearningLog[];
  history: History[];
  relations: Relation[];
};

const labels: Record<string, string> = {
  read_later: "稍后阅读",
  learning: "正在学习",
  ran: "已运行",
  reproduced: "已复现",
  used: "已用于项目",
  paused: "暂时放弃",
  outdated: "已过时",
};
const relationLabels: Record<string, string> = {
  similar: "相似项目",
  alternative: "替代方案",
  depends_on: "依赖于",
  extends: "扩展自",
  inspired_by: "启发自",
};

export default function LibraryPage() {
  const { locale } = useI18n();
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Response>();
  const [editing, setEditing] = useState<Entry>();
  const [collectionName, setCollectionName] = useState("");
  const [relation, setRelation] = useState({
    fromRepositoryId: "",
    toRepositoryId: "",
    type: "similar",
    note: "",
  });
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  async function load(search = query) {
    try {
      setData(
        await apiFetch<Response>(
          `/api/library?q=${encodeURIComponent(search)}`,
        ),
      );
      setError(undefined);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  useEffect(() => {
    void load("");
  }, []);

  async function save() {
    if (!editing) return;
    try {
      await apiFetch(`/api/library/${editing.repositoryId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: editing.status,
          tags: editing.tags,
          note: editing.note,
          collectionId: editing.collectionId,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function remove(repositoryId: string) {
    await apiFetch(`/api/library/${repositoryId}`, { method: "DELETE" });
    setEditing(undefined);
    await load();
  }

  async function createCollection() {
    if (!collectionName.trim()) return;
    try {
      await apiFetch("/api/collections", {
        method: "POST",
        body: JSON.stringify({ name: collectionName }),
      });
      setCollectionName("");
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function deleteCollection(id: string) {
    await apiFetch(`/api/collections/${id}`, { method: "DELETE" });
    await load();
  }

  async function saveRelation() {
    if (!relation.fromRepositoryId || !relation.toRepositoryId) return;
    try {
      await apiFetch("/api/relations", {
        method: "POST",
        body: JSON.stringify(relation),
      });
      setRelation((current) => ({ ...current, toRepositoryId: "", note: "" }));
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function deleteRelation(item: Relation) {
    await apiFetch("/api/relations", {
      method: "DELETE",
      body: JSON.stringify({
        fromRepositoryId: item.fromRepositoryId,
        toRepositoryId: item.toRepositoryId,
        type: item.type,
      }),
    });
    await load();
  }

  if (!data && !error) return <PageSkeleton cards={3} />;
  return (
    <div className="page library-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Personal repository memory</p>
          <h1 className="page-title">{l("个人知识库", "Knowledge library")}</h1>
          <p className="page-description">
            {l(
              "收藏、学习、运行与使用状态不是终点，而是下一次推荐的长期信号。",
              "Saved, learning, run, and used states become signals for future recommendations.",
            )}
          </p>
        </div>
        <span className="chip chip-accent">
          <BookMarked size={14} />
          {data?.items.length ?? 0} {l("个项目", "projects")}
        </span>
      </div>
      <form
        className="search-form"
        style={{ maxWidth: 680, marginBottom: 20 }}
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={l(
            "搜索项目、标签或笔记",
            "Search projects, tags, or notes",
          )}
          data-testid="library-search"
        />
        <button className="button">
          <Search size={16} />
          {l("搜索", "Search")}
        </button>
      </form>
      {error && (
        <div style={{ marginBottom: 18 }}>
          <ErrorState message={error} />
        </div>
      )}
      {data && (
        <details
          className="panel library-disclosure"
          style={{ marginBottom: 20 }}
        >
          <summary>
            <Plus size={15} aria-hidden />
            {l("管理自定义合集", "Manage collections")}
          </summary>
          <h2 className="side-title">自定义合集</h2>
          <div className="search-form" style={{ maxWidth: 520 }}>
            <input
              className="input"
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              placeholder="例如：数据库与后端工具"
            />
            <button className="button" type="button" onClick={createCollection}>
              <Plus size={15} />
              新建合集
            </button>
          </div>
          <div className="chip-row" style={{ marginTop: 12 }}>
            {data.collections.map((collection) => (
              <span className="chip" key={collection.id}>
                {collection.name}
                {!collection.isDefault && (
                  <button
                    type="button"
                    aria-label={`删除合集 ${collection.name}`}
                    onClick={() => void deleteCollection(collection.id)}
                    style={{
                      border: 0,
                      background: "transparent",
                      padding: 0,
                      display: "inline-flex",
                      color: "inherit",
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </details>
      )}
      {data?.items.length ? (
        <div className="two-column">
          <div
            className="grid-cards"
            style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}
            data-testid="library-items"
          >
            {data.items.map((entry) => (
              <article className="card mini-repo" key={entry.repositoryId}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span className="chip chip-accent">
                    {labels[entry.status] ?? entry.status}
                  </span>
                  <span className="repo-path">{entry.repository.language}</span>
                </div>
                <h3>
                  {locale === "zh"
                    ? entry.repository.chineseTitle
                    : entry.repository.name}
                </h3>
                <div className="repo-path">{entry.repository.fullName}</div>
                <p>{entry.repository.description}</p>
                <div className="chip-row">
                  {entry.tags.map((tag) => (
                    <span className="chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                {entry.note && (
                  <p
                    style={{
                      background: "var(--wash)",
                      padding: 10,
                      borderRadius: 10,
                    }}
                  >
                    {entry.note}
                  </p>
                )}
                <div className="repo-actions">
                  <button
                    className="button"
                    onClick={() => setEditing(structuredClone(entry))}
                  >
                    {l("管理", "Manage")}
                  </button>
                  <Link
                    className="button button-quiet"
                    href={`/repository/${entry.repository.owner}/${entry.repository.name}`}
                  >
                    {l("详情", "Details")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <aside className="panel" style={{ position: "sticky", top: 96 }}>
            {editing ? (
              <>
                <h2 className="side-title">
                  管理 {editing.repository.fullName}
                </h2>
                <label className="label" htmlFor="collection">
                  所属合集
                </label>
                <select
                  id="collection"
                  className="select"
                  value={editing.collectionId}
                  onChange={(event) =>
                    setEditing({ ...editing, collectionId: event.target.value })
                  }
                >
                  {data.collections.map((collection) => (
                    <option value={collection.id} key={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
                <label
                  className="label"
                  htmlFor="status"
                  style={{ marginTop: 14 }}
                >
                  项目状态
                </label>
                <select
                  id="status"
                  className="select"
                  value={editing.status}
                  onChange={(event) =>
                    setEditing({ ...editing, status: event.target.value })
                  }
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <label
                  className="label"
                  htmlFor="tags"
                  style={{ marginTop: 14 }}
                >
                  自定义标签（逗号分隔）
                </label>
                <input
                  id="tags"
                  className="input"
                  value={editing.tags.join(", ")}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      tags: event.target.value
                        .split(/[,，]/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <label
                  className="label"
                  htmlFor="note"
                  style={{ marginTop: 14 }}
                >
                  项目笔记
                </label>
                <textarea
                  id="note"
                  className="textarea"
                  value={editing.note}
                  onChange={(event) =>
                    setEditing({ ...editing, note: event.target.value })
                  }
                  placeholder="记录安装、运行、复现或使用经验…"
                />
                <div className="repo-actions">
                  <button className="button button-primary" onClick={save}>
                    <Save size={15} />
                    {saved ? "已保存" : "保存"}
                  </button>
                  <button
                    className="button button-danger"
                    onClick={() => remove(editing.repositoryId)}
                  >
                    <Trash2 size={15} />
                    移除
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="side-title">选择一个项目</h2>
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  可管理合集、状态、自定义标签和笔记。状态变化会写入学习记录并调整画像。
                </p>
              </>
            )}
          </aside>
        </div>
      ) : (
        data && (
          <EmptyState
            title="知识库还是空的"
            message="在推荐流或项目详情中收藏、加入学习，项目就会沉淀到这里。"
            action={
              <Link className="button button-primary" href="/">
                去发现项目
              </Link>
            }
          />
        )
      )}
      {data && data.items.length >= 2 && (
        <details className="panel library-disclosure" style={{ marginTop: 22 }}>
          <summary>
            <Link2 size={15} aria-hidden />
            基础项目关系 · {data.relations.length}
          </summary>
          <div className="filter-row">
            <select
              className="select"
              aria-label="关系来源项目"
              value={relation.fromRepositoryId}
              onChange={(event) =>
                setRelation({
                  ...relation,
                  fromRepositoryId: event.target.value,
                })
              }
            >
              <option value="">来源项目</option>
              {data.items.map((item) => (
                <option key={item.repositoryId} value={item.repositoryId}>
                  {item.repository.fullName}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="项目关系类型"
              value={relation.type}
              onChange={(event) =>
                setRelation({ ...relation, type: event.target.value })
              }
            >
              {Object.entries(relationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="关系目标项目"
              value={relation.toRepositoryId}
              onChange={(event) =>
                setRelation({ ...relation, toRepositoryId: event.target.value })
              }
            >
              <option value="">目标项目</option>
              {data.items
                .filter(
                  (item) => item.repositoryId !== relation.fromRepositoryId,
                )
                .map((item) => (
                  <option key={item.repositoryId} value={item.repositoryId}>
                    {item.repository.fullName}
                  </option>
                ))}
            </select>
            <input
              className="input"
              value={relation.note}
              onChange={(event) =>
                setRelation({ ...relation, note: event.target.value })
              }
              placeholder="关系说明（可选）"
            />
            <button className="button" type="button" onClick={saveRelation}>
              保存关系
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            {data.relations.map((item) => (
              <div
                className="interest-line"
                key={`${item.fromRepositoryId}:${item.toRepositoryId}:${item.type}`}
              >
                <span>
                  {item.fromRepository?.fullName} ·{" "}
                  {relationLabels[item.type] ?? item.type} ·{" "}
                  {item.toRepository?.fullName}
                </span>
                <button
                  className="button button-quiet"
                  onClick={() => void deleteRelation(item)}
                >
                  <Trash2 size={13} />
                  删除
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
      {data && (
        <div className="two-column" style={{ marginTop: 22 }}>
          <details className="panel library-disclosure">
            <summary>
              <Clock3 size={15} aria-hidden />
              最近浏览 · {data.history.length}
            </summary>
            {data.history.slice(0, 8).map((item) => (
              <div className="interest-line" key={item.id}>
                <span>{item.repository?.fullName ?? item.repositoryId}</span>
                <small>
                  {item.surface} · {item.at.slice(0, 10)}
                </small>
              </div>
            ))}
            {!data.history.length && (
              <p className="page-description">
                浏览项目后会在这里留下可审计记录。
              </p>
            )}
          </details>
          <details className="panel library-disclosure">
            <summary>学习记录 · {data.learningLogs.length}</summary>
            {data.learningLogs.slice(0, 8).map((item) => (
              <div className="interest-line" key={item.id}>
                <span>{item.repository?.fullName ?? item.repositoryId}</span>
                <small>
                  {labels[item.status] ?? item.status} · {item.at.slice(0, 10)}
                </small>
              </div>
            ))}
            {!data.learningLogs.length && (
              <p className="page-description">
                加入学习、运行或复现后自动记录。
              </p>
            )}
          </details>
        </div>
      )}
    </div>
  );
}
