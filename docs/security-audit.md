# 安全审查记录

审查日期：2026-08-05
范围：Web、API、离线存储、依赖、Docker、CI 与备份链路。

## 结论

应用代码、API 权限、离线存储、AI 凭据、容器和备份链路已完成复核并加入回归验证。Service Worker 不缓存 API 响应或 AI Key；浏览器本地草稿按用户 ID 隔离。当前保留一项不适用于现有使用方式的前端路由依赖公告，以及若干纵深防御建议。

## 已修复问题

| 编号 | 原级别 | 位置 | 风险 | 修复与验证 |
| --- | --- | --- | --- | --- |
| TGH-CSRF-001 | 高 | `api/src/middleware/auth.ts`、`web/src/api/index.ts` | Cookie 登录下，跨站页面可能诱导写操作 | 双重提交 CSRF Cookie/Header；Bearer 客户端保持兼容；API 回归覆盖拒绝与通过路径 |
| TGH-AUTH-002 | 中 | `web/src/store/index.ts` | Bearer token 曾可进入浏览器持久存储 | Web 仅使用 HttpOnly Cookie，非敏感用户快照只放 sessionStorage，并清理旧 token |
| TGH-AIKEY-003 | 高 | `api/src/database/index.ts`、`api/src/routes/ai.ts` | 用户 AI Key 会以明文进入数据库和完整备份，或被模型配置接口返回 | 独立 API 凭据表；AES-256-GCM 随机 IV 加密；配置接口不返回 Key；备份恢复保持密文；回归测试检查存储与导出 |
| TGH-OFFLINE-004 | 中 | `web/public/sw.js`、`web/src/lib/offlineStorage.ts` | 不当 Service Worker 策略可能缓存私有 API 数据 | `/api/` 全部绕过 Cache Storage；只缓存同源静态应用壳；记题草稿按用户写入 IndexedDB |
| TGH-DEPS-006 | 高 | npm 锁文件 | 旧版前后端依赖包含已公开高危漏洞 | 升级 Vite、Multer、Axios、路由和开发运行器；锁文件审计纳入 CI |
| TGH-CONTAINER-007 | 中 | `api/Dockerfile`、`web/Dockerfile` | 容器默认权限和不必要构建依赖扩大攻击面 | 多阶段构建、生产依赖裁剪、非 root 用户、只读静态 Web 运行时和健康探针 |

## 代码级复核

- Markdown：所有题目和 AI 内容先 HTML 转义，再生成受控标签；未发现允许原始 HTML 透传的路径。
- CAPTCHA SVG：只由服务端/页面本地受限字符集和固定 SVG 模板生成，不接收用户 SVG。
- 权限：题目、AI 配置和复习事件均校验用户归属；集成题库继续受分类范围约束。
- 上传：限制扩展名、MIME、10 MB 大小，随机文件名，并在成功或失败后清理临时文件。
- HTTP：Helmet、安全响应头、请求体限制、速率限制、生产弱密钥拒绝、就绪/存活探针和优雅停机。
- AI 出口：自定义地址仅管理员可配置，强制 HTTPS；配置时拒绝显式内网地址，请求前再次解析全部 DNS 结果并拒绝内网、环回、链路本地与保留地址。

## 剩余低风险与建议

1. 自定义 AI 地址会在请求前校验 DNS 结果，但连接层没有把套接字固定到刚验证的 IP。高对抗环境仍建议通过出口代理或网络策略限制目的地，进一步防止极短窗口的 DNS rebinding。
2. GitHub Actions 当前使用官方 action 的版本标签。更严格的供应链策略可固定到完整提交 SHA，并定期人工检查上游安全更新。
3. AI 配置加密密钥暂不支持在线轮换。轮换前应导出、验证可恢复备份，并通过专用迁移流程重新加密。
4. 离线记题草稿存于浏览器配置文件中。公共或共享设备应及时清理草稿和站点数据，后续可增加更直接的一键清除入口。
5. `npm audit --omit=dev` 当前报告 React Router 6 的两个中危公告，涉及不受信任目标路径跳转与 SSR hydration 错误反序列化。本项目只使用代码内固定路由，不接收用户提供的跳转目标，也不使用 SSR/RSC；升级到当前 7.x 会引入破坏性变更，且该版本线另有 RSC 公告，因此暂保留 6.30.4 并持续跟踪上游修复版本。

## 复核命令

```bash
cd api
npm run lint && npm run typecheck && npm test && npm audit

cd ../web
npm run lint && npm run build && npm run e2e && npm audit

cd ..
JWT_SECRET=replace-with-at-least-32-characters \
AI_CONFIG_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
MYSQL_PASSWORD=compose-validation-password \
MYSQL_ROOT_PASSWORD=compose-validation-root-password \
docker compose config --quiet
```
