# 隐私与安全

## 数据范围与用户控制

GPS 的 GitHub OAuth 默认只申请 `read:user`；公开 Stars 仅在用户主动同步时读取。设置页显示 scope、连接状态、导入数量和演示/真实来源。用户可分别清除搜索历史、导入 Stars、兴趣画像、授权 Token，或删除全部账户数据。搜索页的“写入近期兴趣”开关默认可控，画像中心还可全局关闭搜索影响。

演示模式只在本地 `.data/gps-demo.json` 保存单用户状态。真实多用户部署前应切换到 PostgreSQL Repository、配置备份保留期和数据主体请求流程。

## 已实现控制

- OAuth state 使用签名/时效 Cookie，Callback 校验 state；Token 以 AES-256-GCM 加密。
- 写接口校验 SameSite Cookie、Origin/Host 和双提交 CSRF Token；所有输入通过 Zod Schema。
- Webhook 使用 HMAC-SHA256 和常量时间比较；缺少密钥时拒绝处理。
- GitHub 客户端限制并发、超时、重试和响应体，并记录配额；日志不输出 Token、Cookie 或授权码。
- 图片代理仅接受 HTTPS，限制可信主机、DNS 解析、私网/loopback/link-local、重定向、Content-Type、大小和超时，降低 SSRF 风险。
- React 默认转义文本；邮件模板显式 HTML 转义；数据库访问使用参数化 ORM。
- 邮件反馈使用 HMAC 签名、30 日有效期和投递记录二次校验；退订入口指向设置页。
- 安全响应头包括 `nosniff`、严格 Referrer Policy、Permissions Policy 和 `DENY` frame policy。

## 生产检查清单

1. 使用至少 32 字节随机 `SESSION_SECRET` 和独立 `TOKEN_ENCRYPTION_KEY`，通过密钥管理系统注入。
2. 强制 HTTPS、Secure Cookie、受控 `APP_URL`，在反向代理设置可信 Host。
3. 将演示文件适配器替换为 PostgreSQL Repository，并启用事务、连接池、备份、审计和行级访问校验。
4. 将进程内限流替换为 Redis 分布式限流；为 OAuth、搜索、图片代理和邮件反馈设置独立阈值。
5. 对依赖、容器镜像和生产配置执行 SCA、镜像扫描和渗透测试。
6. 配置隐私政策、数据保留期、联系渠道和 GitHub OAuth Application 的公开信息。

## 威胁边界

GPS 不索引私有仓库，不批量抓取公开 stargazer 身份，不镜像全量源码，不把赞助候选混入自然推荐。外部 LLM/Embedding Provider 默认关闭；启用前应获得用户同意并记录发送字段、Provider、区域和保留策略。
