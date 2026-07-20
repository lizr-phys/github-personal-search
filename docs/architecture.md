# GPS 架构

## 总体形态

GPS 采用生产导向的模块化单体：Next.js 16 App Router 同时承载 Web、Route Handlers 与服务端渲染；独立 Worker 进程承载抓取、索引、推荐预生成和邮件任务。生产目标以 PostgreSQL 为业务事实源，`pgvector` 保存可替换的向量；Redis/BullMQ 用于异步任务与幂等锁。当前零依赖演示运行使用与领域结构对齐的原子 JSON 适配器，开发环境通过 Docker Compose 提供 PostgreSQL、Redis 和 Mailpit。

```text
Browser
  -> Next.js UI / Route Handlers
       -> application services
            -> search / recommendation / github / mail / privacy modules
                 -> Drizzle repositories -> PostgreSQL + pgvector
                 -> BullMQ -> worker -> GitHub / mail provider
```

## 目录边界

```text
src/app                 页面、布局和 Route Handlers
src/components          无业务持久化逻辑的 UI
src/server              会话、数据库、校验、限流、日志和应用服务
src/domain              实体、枚举、证据和算法版本类型
src/search              查询解析、扩展、召回、特征、排序、聚类
src/recommendation      画像、暖队列、批次配额、重排、解释
src/github              OAuth、REST 客户端、缓存、导入和同步
src/ai                  Provider 接口与无密钥本地实现
src/mail                模板、预览、Provider 与反馈签名
src/config              版本化权重和运行配置
db                      Drizzle Schema、SQL 迁移与种子
workers                 BullMQ 作业入口
tests                   单元、集成和 E2E
```

## 运行模式

- `demo`：默认模式。使用明确标注日期和来源类型的演示仓库快照；业务状态写入 `.data/gps-demo.json`，本地词典、字符 n-gram/哈希向量和证据模板提供可复现的语义与简介降级。
- `live`：配置 GitHub OAuth 后可登录、导入公开 Stars、按需搜索和同步公开仓库；本地索引仍是排序与稳定响应层。
- `AI`：`DeepSeekProvider` 只在服务器读取 `DEEPSEEK_API_KEY`，项目简介和站内 Agent 输出均通过 Zod Schema；20 秒超时、格式错误或无密钥时分别回退到证据模板和规则 Agent。Agent 只允许经过白名单的内部导航/搜索动作，不能直接执行数据修改。
- 邮件：默认写入数据库并由 `/subscriptions/preview` 渲染；配置 SMTP 后交给 Mailpit 或真实 Provider。
- 队列：Redis 可用时异步；测试和受限开发环境使用同一 Job Handler 的内联执行器，保持语义一致。

## 数据与审计

Drizzle Schema 为 PRD 中每个核心实体建立独立表。`interactions` 与 `exposures` 保存模型版本、位置、召回源和特征；`feed_batches` 保存用户实际看到的批次；`search_results` 保存排序分解；`algorithm_versions` 保存权重快照。演示适配器保存同类审计字段，因此当前流程可回放；生产上线前需将应用服务接到 Drizzle Repository，迁移文件已就绪。

Token 以 AES-256-GCM 加密后存储；日志对 Token、Cookie、邮件和授权码做脱敏。写接口使用 SameSite Cookie、Origin 检查、CSRF Token、Zod Schema 和用户级限流。图片代理只允许 HTTPS、受控域名/解析结果、图片 Content-Type、大小和超时。

## 可替换接口

`QueryParser`、`QueryExpander`、`CandidateRetriever`、`FeatureExtractor`、`SearchRanker`、`FeedRanker`、`DiversityReranker`、`TrendCalculator`、`ExplanationBuilder`、`UserProfileUpdater`、`EmbeddingProvider`、`LLMProvider` 均以 TypeScript 接口隔离。未来 LightGBM/LambdaMART、双塔或 contextual bandit 只替换实现和算法版本，不改变曝光、反馈和结果审计结构。

## 性能策略

- 发现页读取当天暖队列并分页二次重排，目标 P95 < 2 秒。
- 查询解析和本地召回并行；查询指纹缓存完整意图和候选，缓存目标 P95 < 2.5 秒。
- 冷查询先返回本地结果，GitHub 按需补充通过队列写回索引，目标 P95 < 6 秒。
- Repository、README 和 Release 使用 ETag；抓取任务有并发上限、指数退避、重试上限和幂等键。
