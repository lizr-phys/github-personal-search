# 安全最佳实践审计报告

更新日期：2026-07-19

## 执行摘要

本轮发现并修复 2 个高风险、4 个中风险问题；依赖审计由 2 个 moderate 告警降为 0。没有发现未修复的 Critical/High。剩余风险主要是单实例内存限流和 CSP 仍需 Next.js nonce 化，均不阻断本地公开演示，但在多实例公网部署前必须处理。

## 方法

审计范围包括认证 Cookie、OAuth 回调、CSRF、Host Header、Webhook、图片代理、错误与日志、Token 加密、API 限流、输入 Schema、依赖树和用户数据清除。验证方式为代码审计、Vitest 边界测试、Playwright 恶意/离线路径、`pnpm audit --audit-level moderate`。

## 发现与处置

### GPS-SEC-001 — 客户端可伪造会话（High，已修复）

- 证据：旧运行时接受明文用户 Cookie。
- 修复：改为 HMAC-SHA256 签名、带 session ID 和过期时间的 `gps_auth`；生产环境要求至少 32 字符 `SESSION_SECRET`；删除账户时清除 Cookie。
- 验证：篡改和过期 Token 单元测试通过。

### GPS-SEC-002 — OAuth/CSRF 依赖请求 Host（High，已修复）

- 证据：攻击者控制 Host/Forwarded Host 时可能影响回调或来源判断。
- 修复：全部使用规范 `APP_URL`；公网生产 URL 强制 HTTPS，本地 `localhost/127.0.0.1/[::1]` 只用于可复现预览。
- 验证：攻击者 Host 被拒、规范来源通过、非回环 HTTP 生产来源被拒。

### GPS-SEC-003 — 5xx 可能暴露内部错误（Medium，已修复）

- 修复：客户端只收到通用信息和 request ID；服务端结构化日志保留内部原因并避免 Token 字段。
- 验证：包含“database password”的异常不出现在响应。

### GPS-SEC-004 — 图片代理 SSRF 与主动内容风险（Medium，已修复）

- 修复：仅 HTTPS GitHub 图片域名、DNS 私网/回环检测、禁止重定向、5 MiB 上限、超时、仅安全 Raster MIME、拒绝 SVG，并设置 `nosniff`/sandbox CSP。
- 验证：HTTP/私网 URL 在发起 fetch 前被拒。

### GPS-SEC-005 — Webhook 大请求与坏 JSON 恢复不足（Medium，已修复）

- 修复：1 MiB 请求上限；基于原始字节校验 HMAC 后再解析；坏 JSON 返回 400；签名错误返回 401。
- 验证：超大请求和正确签名但非法 JSON 测试通过。

### GPS-SEC-006 — 依赖已知漏洞（Medium，已修复）

- 证据：基线为 2 个 moderate。
- 修复：锁定安全的 `esbuild` 与 `postcss` overrides。
- 验证：最终 `pnpm audit --audit-level moderate` 报告 0 个已知漏洞。

### GPS-SEC-007 — CSP 仍包含 `unsafe-inline`（Low，接受并跟踪）

- 现状：已有 `default-src 'self'`、`object-src 'none'`、`frame-ancestors 'none'`、`base-uri 'self'`、受限图片/连接源；生产不包含 `unsafe-eval`。
- 原因：当前 Next.js 样式和少量内联样式尚未 nonce 化。
- 后续：迁移剩余内联 style，使用请求级 nonce/strict-dynamic 后移除 `unsafe-inline`。

### GPS-SEC-008 — 限流为进程内状态（Medium，开放）

- 风险：多实例之间不共享配额，重启会清空窗口。
- 当前缓解：单实例演示已覆盖搜索/Feed/GitHub 发现，峰值负载会明确返回 429。
- 上线要求：使用 Redis 原子计数或边缘网关限流，并按账户、IP 和端点组合 Key。

## 隐私

最小 GitHub OAuth 权限、Token AES-256-GCM 接口、清除 Stars/历史/画像、撤销授权、删除账户、邮件退订和独立第三方声明均保留。生产部署必须替换示例密钥，并禁止把 `.env`、Cookie、OAuth Token 或 Webhook Secret 写入日志。
