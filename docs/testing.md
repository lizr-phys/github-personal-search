# 测试说明

## 测试层次

- 单元：查询解析、中英文扩展、搜索/推荐评分、行为权重、负反馈、已看过、曝光抑制、去重、MMR、配额、1/7/30 日热度、订阅去重、邮件签名和证据约束。
- 集成：搜索索引与画像开关、暖队列与两批推荐、会话反馈重排、曝光审计、知识库/合集/关系/画像/撤销、邮件生成、GitHub ETag 缓存与配额。
- E2E：演示登录、冷启动、首批 10 个、收藏、负反馈、再来 10 个、中文搜索、查询理解、详情、学习、知识库回查。

## 命令

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e:install
pnpm test:e2e
pnpm build
```

Playwright 自动启动 Next.js 测试服务器，使用隔离的 `.data/gps-e2e.json`，并把关键截图保存到 `docs/screenshots`。失败工件位于 `test-results` 与 `playwright-report`。

## 数据库与 Docker

```bash
docker compose up -d postgres redis mailpit
pnpm db:migrate
pnpm db:seed
curl http://localhost:3000/api/health
docker compose ps
```

数据库重置具有破坏性，只应对本地 GPS 数据库执行：`pnpm db:reset && pnpm db:migrate && pnpm db:seed`。

## 性能验收

本地 `/api/observability` 提供搜索次数、推荐生成、缓存命中、抓取成功/失败、GitHub 剩余额度、负反馈和分布指标。正式 P95 需要在接入 PostgreSQL/Redis 与真实 GitHub 后运行独立负载测试；单机演示响应时间不能替代生产容量结论。
