# 部署说明

## 本地演示

```bash
cp .env.example .env
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

这一路径使用文件型演示适配器，不需要 Docker。数据重置可通过设置页“重置演示数据”，测试环境也可启用 `GPS_ENABLE_TEST_RESET=true` 后调用重置 API。

## 本地完整基础设施

```bash
docker compose up -d postgres redis mailpit
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm worker
```

PostgreSQL 暴露 `5432`，Redis 为 `6379`，Mailpit SMTP 为 `1025`、Web UI 为 `8025`。`db:reset` 会清空全部 GPS 表，仅可用于明确的开发环境。

## 容器化应用

```bash
docker compose up -d postgres redis mailpit
docker compose --profile app run --rm web pnpm db:migrate
docker compose --profile app run --rm web pnpm db:seed
docker compose --profile app up --build -d web worker
```

镜像固定 Node 24.14.0，构建阶段执行 `pnpm build`。应用健康检查位于 `/api/health`。生产建议在编排层增加只读根文件系统、非 root 用户、资源限制、滚动发布、健康探针和集中日志。

## 必需配置

- `APP_URL`：公开 HTTPS 地址。
- `SESSION_SECRET`、`TOKEN_ENCRYPTION_KEY`：独立随机密钥。
- `DATABASE_URL`：PostgreSQL 16 + pgvector。
- `REDIS_URL`：BullMQ 和分布式限流目标。

GitHub 真实模式追加 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GITHUB_WEBHOOK_SECRET`。SMTP 投递追加 `SMTP_HOST`、`SMTP_PORT`、`MAIL_FROM`。外部语义 Provider 是可选项，空值时保留本地语义降级。

## 上线顺序

1. 备份数据库并运行 `pnpm db:migrate`。
2. 发布 Web，再发布 Worker；保留上一算法版本和旧 Embedding。
3. 验证 `/api/health`、OAuth Callback、GitHub 配额、队列、邮件预览和核心 E2E。
4. 观察搜索/推荐耗时、负反馈率、缓存命中、抓取失败和语言/组织分布。

当前应用服务默认仍使用演示适配器；这套部署配置用于完整工程联调。多用户生产上线前必须完成 Drizzle Repository 接线，详见已知限制。
