# 前端设计与可访问性审计

更新日期：2026-07-19

## 结果

发现、搜索、详情、知识库、趋势、订阅、画像和设置共享统一 Token，但不再使用相同卡片网格机械铺满页面。信息结构主要由内容宽度、留白、字级、对齐、图像比例和细分割线建立；颜色只强调主操作、反馈、趋势、来源与状态。

## 设计系统

- 颜色：纸面/墨色/弱文本/品牌绿/趋势琥珀/错误色均使用语义变量，暗色模式重新校准。
- 排版：标题、正文、说明、标签和数据各有固定字级与行高；内容最大宽度统一。
- 空间与形状：8 级间距、4 级圆角、2 级阴影；大部分内容区使用开放分隔而非封闭卡片。
- 动效：高频 120–220 ms、页面 200–400 ms，主要使用 opacity/transform；`prefers-reduced-motion` 下近乎归零。
- 响应式：桌面编辑流、平板双列/收缩导航、移动单列与底部导航；交互目标最小约 44 px。

## 关键页面

- 发现页：批次主题、进度点、稳定 16:9 视觉、推荐证据和动作形成单一阅读流；批次末尾是明确的“再来 10 个”节点。
- 搜索页：主搜索框、建议、自然语言查询摘要、可编辑主要条件和渐进展开高级条件；结果按解决路线分组。
- 详情页：首屏优先用途、推荐证据、能力与适用人群，元数据后移；README 提取和仓库事实明确分区。
- 知识库：状态、笔记、标签、合集、关系和重新访问围绕“个人技术记忆”组织，而非普通收藏网格。

## 可访问性与兼容性

- Chrome、Edge、Firefox、Safari WebKit、Android Chrome 和 iOS Safari 均执行核心闭环。
- 五个核心路由在六项目矩阵中检查 Axe critical/serious；Chrome 定向结果为零，完整结果见最终质量报告。
- 已修复弱文本/键帽对比度、趋势筛选器与关系下拉框名称、画像屏蔽输入标签、跳转链接和焦点状态。
- 键盘顺序、暗色、减少动态、离线错误、触控和移动横向溢出均进入自动化回归。

## 截图

- [`screenshots/discover-chrome.png`](screenshots/discover-chrome.png)
- [`screenshots/search-chrome.png`](screenshots/search-chrome.png)
- [`screenshots/repository-detail-chrome.png`](screenshots/repository-detail-chrome.png)
- [`screenshots/library-chrome.png`](screenshots/library-chrome.png)
- [`screenshots/dark-chrome.png`](screenshots/dark-chrome.png)
- 移动与其他浏览器同名截图位于 `docs/screenshots/`。

## 跨领域与内容复审

- 删除首页和搜索首屏中的量子、物理与 WebGPU 主导示例，改用数据工作流、移动应用、自托管与开发工具等并列方向。
- 冷启动兴趣默认为空，兴趣选择与种子项目采用跨领域排序，科学与工程只是 12 个同级选项之一。
- 搜索页从三张说明卡改为开放式示例列表；查询条件、订阅和运行信息使用更短的任务文案。
- 项目卡删除许可证等低优先级首屏字段，并把“推荐依据”标题改成直接呈现的事实短句。
- 负反馈原因收进“ 不合适 ”渐进展开区，保留全部反馈能力但不再长期占据项目卡主阅读流。
- 复审截图：[`domain-balanced-home.png`](../output/playwright/domain-balanced-home.png)、[`domain-balanced-search.png`](../output/playwright/domain-balanced-search.png)。

## 字体、动效与最终浏览器复审

- 统一中英文字体、标题 Display 字体、仓库/代码等宽字体和数字等宽特性；正文行高 1.62–1.72，标题使用平衡换行，减少中英文混排的跳变。
- 搜索解析使用底部扫描线，推荐封面和结果簇采用错峰渐显，收藏/反馈/标签/按钮使用短过渡；所有高频动画只改变 opacity/transform。
- 搜索结果默认显示 4 条主要路线，按钮按 4 条继续展开；查询条件保留渐进高级区，减少长列表首次呈现的杂乱感。
- Playwright 实测 390 px 视口：`scrollWidth = 390`，封面宽度与卡片宽度均为 358 px，数据来源标记没有越界。
- 减少动态模式实测：媒体查询为 true，卡片 `animation-duration` 与 `transition-duration` 均为 `0.00001 s`；控制台 0 error、0 warning。
- 本轮截图：[`visual-motion-landing.png`](../output/playwright/visual-motion-landing.png)、[`visual-motion-home-final.png`](../output/playwright/visual-motion-home-final.png)、[`visual-motion-search-final.png`](../output/playwright/visual-motion-search-final.png)、[`visual-motion-mobile-final.png`](../output/playwright/visual-motion-mobile-final.png)。

## 2026-07-20 滚动、双语与 Agent 复审

- 桌面推荐卡由纵向海报改为约 16:9 视觉区与内容区并排的编辑式结构；1280×720 实测卡高从 771 px 降到 452.86 px，整页从 1231 px 降到 856 px。
- 390×844 触控视口将封面缩到 200 px、标签限制为 3 个、操作改为单行横向轨道；卡高从 892.44 px 降到 625.92 px，`scrollWidth <= clientWidth`。
- 搜索结构化条件、详情 README／技术／推荐证据、知识库合集／关系／历史均改为渐进披露；详情相似项目默认折叠，保留能力但不强迫用户滚过低优先内容。
- 全局语言切换实测能够同步文档 `lang`、导航、推荐卡、项目简介、搜索主要结构、知识库标题与 Agent；原始 GitHub 文本保持来源语言。
- 右下角 Agent 在桌面使用非模态浮层，在移动端避开底部导航；支持 Escape、键盘提交、焦点进入、滚动隔离和减少动态效果。
- iOS WebKit 快速连续反馈暴露了触控滚动稳定性问题：触控设备关闭卡片位移动画，页面不再使用全局平滑滚动，移动反馈提示移至顶部，最终 iOS 核心路径单独复测通过。
- 新截图：[`discovery-quality-en-final.png`](../output/playwright/discovery-quality-en-final.png)、[`discovery-mobile-en-final.png`](../output/playwright/discovery-mobile-en-final.png)、[`agent-en.png`](../output/playwright/agent-en.png)、[`search-en-compact.png`](../output/playwright/search-en-compact.png)。

## 2026-07-20 二次视觉复审

- 未登录首屏从“单一大标题 + 装饰空卡”改为左右不对称编辑布局：左侧说明价值与权限，右侧显示跨领域内容样例，下方用轻量文字带说明覆盖范围；减少空白但不回到模块堆叠。
- 侧栏宽度收至 12.75rem，顶栏收至 3.8rem，页面内容宽度收至 76rem；标题、正文、标签、按钮和搜索框使用更紧凑的字号/行高，中文标题单独减少负字距。
- 推荐页右栏不再使用大环形进度；移动端只保留主流中的主题与圆点进度，隐藏重复的画像摘要和演示说明，卡片结束后不会再产生一整屏次要滚动。
- Agent 改为 23rem × 32.5rem 的任务面板：空状态提供三个可执行问题，快捷问题点击即发送；回复后展示安全站内操作，支持新对话、关闭、Enter 提交和 Shift+Enter 换行。移动入口缩为 44px 图标，减少内容遮挡。
- 首次实测发现冷启动操作被固定导航拦截、弱文本仅 4.41:1；两项均在页面逻辑和 Token 层修复，Chrome 与 iOS 回归后 Axe serious/critical 为零，核心触控路径通过。
