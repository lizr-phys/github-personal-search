# 最终测试计划

更新日期：2026-07-19

## 范围与门禁

本轮门禁按“基线 → 修改 → 定向回归 → 全量回归”执行。发布阻断条件为：P0 闭环失败、5xx/数据丢失、硬约束回归、严重或关键 Axe 问题、类型/Lint/构建失败、依赖存在 moderate 以上已知漏洞。

## 测试矩阵

| 层级      | 覆盖                                                                                                                                          | 命令/证据                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 单元      | 查询解析、错别字/中英扩展、搜索/推荐评分、负反馈、曝光、MMR、趋势、订阅、证据解释、赞助隔离、安全边界                                         | `pnpm test`                      |
| 集成      | GitHub 抓取缓存/索引、搜索、暖队列、反馈重排、知识库、画像、邮件                                                                              | `pnpm test:integration`          |
| E2E       | 演示初始化 → 10 个推荐 → 正负反馈 → 换批 → 中文搜索 → 详情 → 学习 → 知识库                                                                    | `pnpm test:e2e`                  |
| 可访问性  | 五个核心页面 Axe WCAG 2.0/2.1/2.2 A/AA，键盘跳转、暗色、减少动画、移动横向溢出                                                                | `visual-accessibility.spec.ts`   |
| 浏览器    | Chrome、Edge、Firefox、WebKit Safari、Pixel 5 Android Chrome、iPhone 13 iOS Safari                                                            | Playwright 六项目矩阵            |
| 算法离线  | 27 个查询、60 个目录项目，覆盖科学、Web、AI、数据、云、移动、游戏、安全、创意与自托管；检查 Recall/Precision/NDCG/MRR/硬约束/去重/簇覆盖/时延 | `pnpm test:algorithm`            |
| 规模      | 20,000 个合成仓库、推荐和冷/暖搜索                                                                                                            | `pnpm test:scale`                |
| HTTP 基准 | 冷暖推荐、换批、反馈、冷暖搜索、10 并发搜索、详情/知识库/趋势                                                                                 | `pnpm test:performance`          |
| 混合负载  | 5/20/50 并发，650 个混合请求；区分 429 限流和 5xx                                                                                             | `pnpm test:load`                 |
| 前端性能  | Lighthouse 移动与桌面，LCP/CLS/TBT/FCP                                                                                                        | `docs/metrics/lighthouse-*.json` |
| 安全      | 会话篡改、Host Header、CSRF、SSRF、Webhook 大包/坏 JSON、错误脱敏、依赖审计                                                                   | `security.test.ts`、`pnpm audit` |
| 数据库    | Drizzle Schema 与迁移一致性                                                                                                                   | `pnpm exec drizzle-kit check`    |

## 异常与恢复

- 外部 AI 无配置：规则解析、词典扩展、本地哈希语义和词法检索继续工作。
- GitHub 超时、限流和缓存：客户端超时/退避/ETag/配额单测与集成测试；界面显示部分数据或错误状态。
- 图片异常：仅允许 HTTPS GitHub 白名单，DNS 私网检测、无重定向、5 MiB、Raster MIME 限制，失败回退稳定占位图。
- 无有效候选：返回诚实空状态，不用低证据项目填满结果。
- 峰值访问：达到每用户窗口阈值后返回 429；负载报告将其记为受控限流，不记作服务器失败。
- Redis/SMTP/PostgreSQL 断开：本机缺少这些服务，完成代码路径与配置审计；真实容器恢复演练列为环境限制，不能标记已执行。

## 兼容性说明

Safari 默认是否用 Tab 聚焦链接受操作系统“全键盘控制”设置影响。测试在 Chromium/Firefox 使用真实 Tab，在 WebKit 使用程序化聚焦并验证跳转链接可操作；这避免把 OS 默认设置误判成应用缺陷。
