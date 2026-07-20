# PRD 对照与验收映射

| PRD 能力                                       | 实现位置                                        | 自动验证                          | 状态                             |
| ---------------------------------------------- | ----------------------------------------------- | --------------------------------- | -------------------------------- |
| 演示登录、冷启动、12 次反馈                    | `/onboarding`、onboarding service               | E2E、feed integration             | 完成                             |
| GitHub OAuth、公开 Stars、最小 scope           | `/api/github/*`、GitHub client                  | GitHub client integration         | 完成；真实 OAuth 凭据未在线验收  |
| 无密钥公开仓库发现、README/语言/Release 索引   | `/api/github/discover`、repository sync/catalog | live index integration + 网络冒烟 | 完成                             |
| 每日暖队列、10 个批次、再来 10 个              | feed service、feed API、发现页                  | feed integration、E2E             | 完成                             |
| 当前会话反馈重排、30 日去重、撤销              | interaction/feed/profile updater                | unit、integration                 | 完成                             |
| 中文/英文/自然语言查询理解与扩展               | `src/search/query-parser.ts`                    | query parser unit、E2E            | 完成                             |
| 词法+本地语义+画像+趋势混排                    | search ranking/service                          | search unit/integration           | 完成                             |
| 综合/精确/灵感/最新、路线聚类                  | 搜索页、ranking variants                        | E2E、unit                         | 完成                             |
| 结构化详情、趋势、证据、相似项目               | repository detail page/API                      | E2E、live index integration       | 完成（真实与演示证据分离）       |
| 完整反馈类型、曝光/版本/来源审计               | interactions/exposures/runtime schema           | feed/library integration          | 完成                             |
| 知识库合集、状态、标签、笔记、历史、学习、关系 | library/collections/relations APIs 与页面       | library integration、E2E          | 完成                             |
| 1/7/30 日趋势与筛选                            | trend calculator、`/trends`                     | trend unit                        | 完成                             |
| 语义订阅、频率、阈值、30 日去重                | subscription service/page                       | subscription unit/integration     | 完成                             |
| 邮件四分区、5—10 个、预览、反馈回写            | mail template、签名反馈 API                     | email unit/integration            | 完成                             |
| 长/短期兴趣、排除、暂停/删除/重置              | profile page/service                            | integration、E2E                  | 完成                             |
| 隐私删除、撤销、清历史/Stars/账户              | settings/privacy API                            | API 实现、静态检查                | 完成                             |
| API 配额、抓取、缓存、分布、负反馈观测         | observability API/settings                      | GitHub integration                | 完成基础可观测性                 |
| 25 个核心数据库实体、迁移、向量索引、种子      | `db/schema.ts`、`db/migrations`、`db/seed.ts`   | drizzle generation                | 完成；本机无 PostgreSQL 运行验证 |
| Docker Compose、Redis、Mailpit、Web/Worker     | `docker-compose.yml`、`Dockerfile`              | 配置审阅                          | 交付；本机无 Docker 运行验证     |

P2 能力未实现且未伪装为已完成。`sponsored` 仅保留隔离的候选枚举，自然排序不返回赞助项目。
