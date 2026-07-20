# 已知限制与后续迭代

更新日期：2026-07-19

## 当前限制

1. 本地零依赖模式使用原子 JSON/内存运行时保存用户事务；PostgreSQL 已覆盖仓库、文档、向量、快照和完整业务 Schema，但全部用户路径尚未统一切换到 Drizzle Repository。
2. 当前主机没有 Docker、PostgreSQL、`psql` 和 Redis CLI，因此 Compose、在线迁移/回滚、`EXPLAIN ANALYZE`、连接池、锁竞争和 Redis 故障恢复没有在本机执行。
3. Vercel CLI 预览部署和账号查询均超时，本轮没有公网 URL。Serverless 多实例还需要 PostgreSQL/Redis 才能保持跨实例演示状态一致。
4. 本机测试服务默认加载 60 个跨领域演示项目。公开 GitHub 按需搜索与 README/Topic/语言/Release 索引可无 OAuth 运行，但会受匿名 API 配额影响；真实 Stars 导入需要所有者配置 OAuth App。
5. 20,000 仓库测试使用合成元数据，不能代表全 GitHub 分布，也不能代替 pgvector 上的真实查询计划。
6. 当前本地哈希向量是确定性轻量语义降级，不等同于神经多语言 Embedding；无密钥时界面只声明“本地语义”。
7. 60 项人工目录和 27 条查询可以发现跨领域回归，但不足以训练或证明 Learning-to-Rank 的线上增益。
8. 移动 Lighthouse LCP 为 2.616 s，比 2.5 s 目标高约 0.116 s；桌面 LCP 为 0.715 s。
9. API 限流为进程内状态，多实例生产部署必须迁移到 Redis 或边缘网关。
10. CSP 仍保留 `unsafe-inline` 以兼容 Next.js 和遗留内联样式；生产不含 `unsafe-eval`，后续应用 nonce 后应进一步收紧。
11. BullMQ Worker/任务处理器和 Mailpit 基础设施已存在，但真实 Redis 死信/竞争恢复和域名 SMTP 送达/退信/投诉未实测。
12. P2 社区、团队、企业权限、全量源码索引、移动 App、插件和复杂知识图谱按 PRD 明确不开发；赞助仅实现隔离预留，不包含竞价或投放后台。
13. DeepSeek 真实网络调用需要由项目所有者配置一枚未公开的新密钥；本轮不会使用聊天中已经暴露的密钥。Schema、超时、路径白名单和无密钥降级均可本地验证，但供应商账户配额与线上延迟需在密钥轮换后复测。
14. 英文模式统一了全局导航、推荐内容、项目简介、Agent 与详情主要结构；部分低频管理页的领域数据值和仓库原始证据仍保留来源语言，后续可继续扩充静态 UI 词典，但不能篡改原始 GitHub 文本。

## 下一步优先级

1. 完成用户、曝光、交互、批次、搜索、知识库和订阅到 PostgreSQL 事务 Repository 的切换，并在真实容器环境保存 `EXPLAIN ANALYZE` 前后证据。
2. 使用测试 OAuth App 验收 Stars 分页、ETag 304、配额耗尽、撤销授权、Webhook 和账户删除全链路。
3. 扩大盲标查询/项目集与真实授权用户反馈，再评估 LambdaMART、双塔或 contextual bandit。
4. 接入 Redis 分布式限流、缓存防击穿、BullMQ 重试/死信，并做数据库/Redis/Worker 重启演练。
5. 优化未登录首屏的客户端会话检测和 JS 体积，使移动 LCP 稳定低于 2.5 s；接入浏览器 V8 覆盖率合并。
6. 配置可持久化预览基础设施后再提供公网测试环境，避免把不稳定 Serverless 内存状态描述为完整闭环。
