# 测试执行结果

最终执行日期：2026-07-20。完整分析见 [最终质量报告](final-quality-report.md)。

| 检查                                | 结果                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm typecheck`                    | 通过                                                                                     |
| `pnpm lint`                         | 通过，0 warning                                                                          |
| `pnpm test`                         | 11 文件，42/42 通过                                                                      |
| `pnpm test:integration`             | 6 文件，13/13 通过                                                                       |
| `pnpm test:coverage`                | 17 文件，55/55；Statements 42.06%、Branches 38.67%、Functions 39.17%、Lines 43.39%       |
| `pnpm test:e2e`                     | 既有六浏览器 12/12；本轮 Chrome+iOS 核心/无障碍 4/4，Agent/冷启动遮挡专项 4/4            |
| `pnpm test:algorithm`               | 27 查询；Recall@10 0.8333、NDCG@10 0.8125、硬约束违反率 0.51%                            |
| `pnpm test:scale`                   | 20,000 仓库；冷搜索 3.627 s、缓存搜索 0.24 ms、推荐排序/成批 704.08 ms                   |
| `pnpm test:performance`             | 暖 Feed P95 42.26 ms、换批 31.04 ms、暖搜索 67.47 ms，10 并发 0 错误                     |
| `pnpm test:load`                    | 650 请求；所有负载均 0 个非 429 失败                                                     |
| Lighthouse 移动                     | 91/100/100/100，LCP 2.616 s、CLS 0                                                       |
| Lighthouse 桌面                     | 100/100/100/100，LCP 0.715 s、CLS 0                                                      |
| `pnpm build`                        | Next.js 37 路由通过                                                                      |
| `pnpm exec drizzle-kit check`       | 27 表、3 迁移，一致                                                                      |
| `pnpm audit --audit-level moderate` | 0 个已知漏洞                                                                             |
| Docker/在线迁移                     | 当前主机无 Docker/PostgreSQL，未执行                                                     |

原始机器可读结果位于 [`docs/metrics/`](metrics/)，浏览器截图位于 [`docs/screenshots/`](screenshots/)。

## 2026-07-20 本轮缺陷发现与复测

- 首次 Chrome+iOS 回归发现 3 项失败：知识库弱文本对比度 4.41:1，以及 iOS 冷启动“下一步”分别被 Agent 与移动底栏拦截。未修改测试绕过；产品层提高弱文本对比度，并在冷启动路由移除两个浮层。
- 修复后 Chrome 与 iOS 的核心闭环、五页面 Axe serious/critical 检查、暗色/减少动态、离线反馈和移动无横向溢出共 4/4 通过。
- 新增 Agent 端到端测试：快捷需求自动发送，规则降级输出三条 Agent 技术路线，搜索链接包含扩展查询，趋势入口可执行；Chrome 与 iOS 4/4 通过。
- 新增 2 项 Agent 单元测试，覆盖短需求扩展和趋势路由；单元总数从 40 增至 42。
