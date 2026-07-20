# 假设与关键决策

## 已确认事实

- 产品事实源为 `GitHub_Personal_Search_GPS_PRD_v1.0.docx`，已提取 172 个正文段落、32 张表和 202 行表格到 `docs/prd-extracted.md` 供实现核对。
- PRD 与任务都要求模块化单体、PostgreSQL/pgvector、批次推荐、可解释混合检索和无密钥演示闭环。
- 当前机器有 Node.js 24 与 pnpm 11，但没有可调用的 Docker CLI；Compose 文件和容器化配置仍会交付，最终本机 Docker 运行只能在安装 Docker 的环境补做。
- 当前机器缺少 LibreOffice，因此 PRD 的页面渲染 QA 不可用；正文和表格通过 OOXML/python-docx 完整抽取，布局图不作为实现事实源。

## 技术决策

1. 使用 Next.js 16.2.10、React 19.2.7、TypeScript 5.9.x、Tailwind CSS 4、Drizzle ORM 0.45.2、PostgreSQL 16 + pgvector、Redis 7 + BullMQ、Vitest 4 和 Playwright 1.61.1。依赖精确锁定；选择 Drizzle 是因为其类型安全迁移和原生 pgvector 列/索引支持。
2. 不采用微服务。Worker 与 Web 共享领域包和数据库；未来只有达到吞吐瓶颈才拆分。
3. 零密钥演示默认使用 `.data/gps-demo.json` 原子文件适配器，以保证在当前无 Docker 的机器仍能完整验收；生产数据模型、迁移和种子采用 PostgreSQL/pgvector。Redis、SMTP、GitHub 和外部 AI 均可降级，任务处理器可内联执行，邮件默认应用内预览。
4. OAuth 自行使用标准 GitHub 授权码流程，避免为了单一 Provider 引入更重的认证框架。状态 Cookie、Origin/CSRF 检查、加密 Token 和最小 scope 都由测试覆盖。
5. 演示仓库的指标是固定演示快照，不宣称实时；真实模式写入独立来源和抓取时间。
6. 协同信号在 MVP 仅来自 GPS 内授权用户的聚合一方行为；演示用户只有受控群体先验，不抓取公开 stargazer 身份。
7. P2 仅在数据枚举中保留 `sponsored` 候选类型，所有自然排序入口硬性排除该类型，UI 本轮不展示赞助位。

## 产品取舍

- 冷启动使用 8 个兴趣标签、可选种子项目和 12 次快速反馈；演示入口提供合理默认选项以保证 3 分钟内完成。
- 首页一次展示/推进 10 个卡片，不自动加载；卡片操作立即持久化并乐观更新，批次完成后才出现主“再来 10 个”。
- 外部模型不是核心路径。未配置 Provider 时 UI 使用“本地语义”文案；只有外部 Provider 成功且保存模型版本时才显示 AI 增强标识。
- 运营可观测性以 `/settings` 的系统状态卡和结构化日志提供基础版本，不建设独立商业监控后台。
- 对象存储抽象保留，本地 MVP 只缓存小型文本元数据和安全远程图片 URL，不持久化大文件。

## 已知限制边界

- 演示索引规模用于验证闭环与算法确定性，不代表全 GitHub 召回率。
- 本地哈希向量支持概念扩展和相似性，但不等价于大型神经 Embedding；外部 Provider 接口可无迁移替换。
- GitHub Search 的增量候选受官方速率限制；GPS 始终优先返回本地缓存并显示更新时间。
- 电子邮件的本地验收使用预览/捕获，不声称真实投递到达率。
- Web 业务服务尚未切换为 Drizzle Repository 实现；文件适配器与 PostgreSQL Schema 的领域结构对齐，但 live 多用户部署前仍需完成持久层替换和并发事务压测。
