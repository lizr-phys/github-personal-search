# GitHub 数据采集与索引

## 范围

GPS 不镜像全站。索引由高质量演示/种子仓库、授权用户 Stars、搜索按需候选、知识库项目和订阅主题扩张。私有仓库不在 MVP 范围内。

## GitHub 客户端

`GitHubClient` 封装 REST 调用并统一处理：

- `Authorization`、固定 API 版本和明确 User-Agent；
- REST/Search 各自的剩余额度、重置时间和结构化日志；
- ETag/`If-None-Match` 条件请求与 304 缓存命中；
- 每主机并发限制、指数退避、`Retry-After`、最多重试次数；
- Repository、Topics、Languages、README、Release 和公开 Stars 分页；
- 请求超时、响应大小上限、Schema 校验和敏感信息脱敏。

OAuth 默认只请求 `read:user`；公开 Stars 通过用户授权 Token 读取。界面显示实际 scope、同步时间、项目数和数据类型。用户可撤销本地授权、清除导入数据或删除全部账户数据。

公开仓库发现不依赖 OAuth。`POST /api/github/discover` 接受自然语言查询或明确的 `owner/repo`，将中文意图扩展为 GitHub 可检索的英文技术词，先召回公开候选，再补充 README、Topics、语言和最新 Release。映射结果保存为带 `dataSource=github`、证据 URL 和置信度的领域仓库；搜索、推荐、趋势和详情页都从同一混合目录读取。OAuth Stars 也复用同一映射和存储路径。

运行时默认写入原子 JSON 索引；启用 `GPS_PERSIST_GITHUB_TO_POSTGRES=true` 后，同时 upsert `repositories`、`repository_documents`、`repository_embeddings` 和 `repository_snapshots`。这使零依赖演示和生产数据层保持相同的领域边界。

## 分层刷新

- 热池：1—4 小时，覆盖近 30 日新建、订阅和高增长项目。
- 活跃池：每日，覆盖搜索/推荐/知识库/Stars 候选。
- 长尾池：每周。
- 按需层：搜索本地不足时异步补充。
- 授权事件：登录或用户主动同步；Webhook 仅处理安装/授权范围内事件并验证签名。

作业使用 `job_runs` 的唯一幂等键和状态机；抓取、文档解析、Embedding、快照、暖队列和邮件分别排队。失败保存分类原因并进入有上限的重试/死信状态。

## 项目语义文档

索引内容由名称、描述、Topics、README 提取摘要、主要语言、依赖/配置文件、目录摘要、功能列表、安装与部署线索、许可证、Release 摘要和维护特征拼接。MVP 不读取全量源码。每个字段保存来源 URL、抓取时间、ETag、解析器版本和置信度。

无模型密钥时使用提取式摘要、规则标签和本地哈希向量；配置外部 Provider 后新向量以独立模型版本写入，旧版本保留以便回滚和重建索引。

## 图片安全

封面按 Social Preview、README 首图、官网 Open Graph、稳定占位图排序。候选 URL 过滤 badge/统计/追踪、小尺寸和不安全协议。代理仅允许 HTTPS，解析后拒绝 loopback、link-local、私网和保留地址；限制重定向、允许域、5 MB 大小、3 秒连接/8 秒总超时和 `image/*` Content-Type。

## 演示数据

种子记录是明确标注的演示快照，不代表 2026 年实时 GitHub 状态。它们包含足够的领域、语言、项目类型、README 证据、趋势快照和关系，以离线演示搜索、推荐、热度、详情、订阅和邮件。真实索引不足 30 个时默认以种子补足多样性；两类数据通过 `dataSource` 分离，UI 不混淆来源。设置 `GPS_DEMO_FALLBACK=false` 可关闭兜底。
