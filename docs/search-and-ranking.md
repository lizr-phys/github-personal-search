# 搜索与推荐算法

## 查询理解

`RuleQueryParser` 先解析语言、项目类型、技术、平台、部署、许可证、难度、时间和排除词；`DictionaryQueryExpander` 再使用中英文领域词典补充同义词、上位概念和英文术语。输出必须通过 `SearchIntentSchema`。可选 LLM 只能补充结构化字段，失败、超时或校验失败时直接保留规则结果。

本地语义能力不是远程大模型：文本被标准化为中英文 token、字符 n-gram 和领域概念，使用带 IDF 的哈希向量计算余弦相似度。演示 UI 明确称为“本地语义降级”，不虚假宣称在线 AI。

## 搜索召回

- 词法：名称、描述、Topics、README 摘要的 token/BM25 风格分数。
- 语义：统一项目语义文档与查询的多语言哈希向量余弦相似度。
- 个性化：长期/短期主题、语言、知识库状态和负面偏好。
- 趋势：1/7/30 日增量热度和 Release 信号。
- 图关系：Topic 共现、相似、依赖、README 引用和显式用户关系。
- 探索：低曝光但质量合格、相邻主题和新项目。

每个候选保存一个或多个 `retrievalSources`，并保留通道原始分数。

## 搜索排序

权重只定义在 `src/config/algorithms.ts`，以 `search-v1` 版本保存：

```text
S_search =
0.34 semantic + 0.18 lexical + 0.12 constraints + 0.10 quality
+ 0.09 freshness + 0.09 personal + 0.08 novelty - penalties
```

惩罚包含 archived、mirror、duplicate fork、stale、missing README、keyword stuffing、broken、negative preference、recent exposure 和 explicit block。四种浏览模式在同一特征上施加版本化权重变体：综合保持默认；精确提高 lexical/constraints；灵感提高 novelty/exploration/MMR；最新提高 freshness。

结果按项目类型和领域派生“解决路线”。前十通过 MMR 与配额重排：候选充足时至少 3 个簇，同组织最多 2 个，避免同语言/同框架/同功能连续；用户明确指定技术时放宽相关多样性约束。

## 推荐画像与排序

画像拆分为长期兴趣、短期意图、能力与成本、负面偏好、新颖性/曝光记忆。当前版本 `feed-quality-gated-v3`：

```text
S_feed =
0.29 longTerm + 0.22 shortTerm + 0.11 collaborative + 0.10 quality
+ 0.10 freshness + 0.08 novelty + 0.10 exploration
- exposureAndNegativePenalties
```

行为权重集中配置：用于项目 `+8`；运行/复现 `+6`；学习 `+5`；收藏 `+4`；GitHub/Demo `+2`；停留/展开 `+0.5..1.5`；不感兴趣 `-6`；语言不符/太复杂 `-4`；已看过 `-3` 且只影响曝光记忆。撤销通过反向事件和画像重算实现。

暖队列每天生成 40 个候选。首批目标配额为 `4 强匹配 + 2 短期延伸 + 2 新/热 + 1 小众质量 + 1 探索`；配额不足按质量和多样性回填。下一批读取同一暖队列、排除 30 日曝光，再应用当前会话反馈重新提取特征和排序。

推荐排序前执行独立质量资格门控，不允许相关性或探索分绕过：成熟项目至少 1,000 Stars；两年内的新项目至少 100 Stars、质量 0.82、活跃维护，并由作者 5,000 Followers、200 Watchers 或 30 日新增 300 Stars 之一提供关注度证据。归档、Fork、镜像、缺 README、质量低于 0.78 或一年未 Push 的项目直接剔除。门控同样用于冷启动种子、趋势推荐和相似项目，但主动搜索保留更宽候选并显式显示质量证据。

## 热度

每个窗口使用仓库快照差值，并在同领域、年龄桶、规模桶内做确定性 Z 标准化：

```text
H_T = 0.38 z(starVelocity) + 0.15 z(forkVelocity)
    + 0.15 z(commitActivity) + 0.12 z(issuePrActivity)
    + 0.10 releaseSignal + 0.10 ageNovelty
```

总 Star 仅展示和用于规模分桶，不直接替代热度。测试固定时钟和样本总体，覆盖 1/7/30 日、零方差、缺快照和新项目年龄归一化。

## 解释与证据

解释由排序特征模板生成。每个片段带 `evidenceType`、`evidenceId`、`sourceText` 和 `confidence`。可用证据仅限 GitHub 元数据、README/Topic/配置/Release、用户行为和画像条目。证据不足时返回“信息不足”，不会输出强维护或能力结论。
