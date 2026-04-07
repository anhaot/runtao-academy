# Security Review Report

Executive summary: The system has several good baseline protections in place, including `helmet`, broad route input validation with `zod`, bcrypt password hashing, and parameterized database access patterns. However, I found five material security issues. Two are high impact and should be prioritized immediately: a default JWT signing secret fallback and an SSRF-capable AI configuration flow available to normal users. There are also meaningful operational risks around backup exposure, brute-force protection, and client-side token storage.

## Critical

### SEC-001
- Rule ID: EXPRESS-AUTH-SECRET-001
- Severity: Critical
- Location: [backend/src/config/index.ts](/root/tiku-new/runtao-academy/backend/src/config/index.ts#L61)
- Evidence:
```ts
jwt: {
  secret: process.env.JWT_SECRET || 'default-secret-change-me',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
},
```
- Impact: If `JWT_SECRET` is not set in a deployed environment, an attacker can forge valid JWTs using the known fallback secret and fully impersonate arbitrary users, including admins.
- Fix: Fail fast on startup when `JWT_SECRET` is missing or weak in non-test environments. Do not allow a hard-coded fallback in deployable builds.
- Mitigation: Rotate the JWT secret immediately in every environment that may have used the fallback. Invalidate existing tokens after rotation.
- False positive notes: This is only safe if every runtime environment always injects a strong secret. That guarantee is not enforced in code today.

## High

### SEC-002
- Rule ID: EXPRESS-SSRF-001
- Severity: High
- Location: [backend/src/routes/ai.ts](/root/tiku-new/runtao-academy/backend/src/routes/ai.ts#L14), [backend/src/services/ai.ts](/root/tiku-new/runtao-academy/backend/src/services/ai.ts#L48), [backend/src/routes/auth.ts](/root/tiku-new/runtao-academy/backend/src/routes/auth.ts#L15)
- Evidence:
```ts
const aiConfigSchema = z.object({
  provider: z.string().min(1).max(50),
  displayName: z.string().max(100).optional(),
  baseUrl: z.string().url().max(500).optional().or(z.literal('')),
  apiKey: z.string().min(1).max(200),
  model: z.string().min(1).max(100),
});
```
```ts
const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  ...
  ai_config_manage: true,
  ...
};
```
```ts
const response = await fetch(`${this.baseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.apiKey}`,
  },
  ...
});
```
- Impact: Any normal user with default permissions can configure an arbitrary AI `baseUrl`, causing the backend to make authenticated outbound requests to attacker-chosen destinations. This is an SSRF primitive that can be used to probe internal services, hit metadata endpoints, or exfiltrate configured API keys to attacker infrastructure.
- Fix: Restrict `baseUrl` to an allowlist of trusted AI hosts, or move custom-provider creation behind an admin-only permission. Also validate scheme/host/IP to block private network ranges and loopback.
- Mitigation: Disable `ai_config_manage` for non-admin users immediately if custom endpoints are not required. Log and alert on AI configs pointing outside an approved host list.
- False positive notes: If this deployment is completely isolated from internal networks and custom AI endpoints are intentionally trusted, impact is lower, but API-key exfiltration risk remains.

### SEC-003
- Rule ID: EXPRESS-DATA-EXPORT-001
- Severity: High
- Location: [backend/src/routes/admin.ts](/root/tiku-new/runtao-academy/backend/src/routes/admin.ts#L316), [backend/src/database/index.ts](/root/tiku-new/runtao-academy/backend/src/database/index.ts#L1213), [backend/src/database/index.ts](/root/tiku-new/runtao-academy/backend/src/database/index.ts#L1232)
- Evidence:
```ts
const dataset = await db.exportAllData();
...
res.json({
  meta: {...},
  dataset,
});
```
```ts
async exportAllData(): Promise<Record<string, Record<string, unknown>[]>> {
  return {
    users: await this.all<Record<string, unknown>>('SELECT * FROM users ORDER BY created_at ASC'),
    ...
    ai_configs: await this.all<Record<string, unknown>>('SELECT * FROM ai_configs ORDER BY created_at ASC'),
    ...
  };
}
```
```ts
await this.bulkInsert('users', ['id', 'username', 'email', 'password_hash', 'role', 'permissions', 'created_at', 'updated_at'], dataset.users || []);
await this.bulkInsert('ai_configs', ['id', 'user_id', 'provider', 'display_name', 'base_url', 'api_key', 'model', 'is_active', 'is_custom', 'created_at', 'updated_at'], dataset.ai_configs || []);
```
- Impact: Anyone granted backup export/restore can extract password hashes and all AI API keys, or restore a crafted dataset containing privileged users and malicious AI configs. This is effectively full-system compromise for that permission scope.
- Fix: Treat backup export/restore as a break-glass admin-only capability, encrypt exported backups, and consider filtering secrets out of routine exports. For restore, require an explicit admin-only workflow and integrity checks.
- Mitigation: Review who currently has `backup_export` or `backup_restore`. Rotate exposed AI keys if backups have been shared insecurely.
- False positive notes: This may be an intentional admin capability, but it is still a high-risk interface and should be tightly restricted and audited.

## Medium

### SEC-004
- Rule ID: EXPRESS-BRUTEFORCE-001
- Severity: Medium
- Location: [backend/src/routes/auth.ts](/root/tiku-new/runtao-academy/backend/src/routes/auth.ts#L61), [backend/src/routes/auth.ts](/root/tiku-new/runtao-academy/backend/src/routes/auth.ts#L173), [backend/src/app.ts](/root/tiku-new/runtao-academy/backend/src/app.ts#L15)
- Evidence:
```ts
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}
```
```ts
const ip = getClientIp(req);
const lockStatus = checkLoginLock(ip);
```
There is no explicit `app.set('trust proxy', ...)` in the bootstrap.
- Impact: Login lockout keys off an attacker-controlled `X-Forwarded-For` header. A client can spoof different IPs and evade per-IP lockouts, weakening brute-force protection.
- Fix: Use `req.ip` only after explicitly configuring `trust proxy` to the real reverse-proxy topology, or ignore `X-Forwarded-For` entirely when no trusted proxy is configured.
- Mitigation: Add username-based throttling in addition to IP-based throttling.
- False positive notes: If an upstream proxy strips and rewrites `X-Forwarded-For` consistently, risk is reduced, but that trust boundary is not enforced in app code.

### SEC-005
- Rule ID: EXPRESS-ABUSE-001 / REACT-AUTH-001
- Severity: Medium
- Location: [backend/src/middleware/common.ts](/root/tiku-new/runtao-academy/backend/src/middleware/common.ts#L15), [backend/src/app.ts](/root/tiku-new/runtao-academy/backend/src/app.ts#L61), [backend/src/app.ts](/root/tiku-new/runtao-academy/backend/src/app.ts#L71), [frontend/src/store/index.ts](/root/tiku-new/runtao-academy/frontend/src/store/index.ts#L20)
- Evidence:
```ts
const aiRateLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
});
```
```ts
app.use('/api', rateLimitMiddleware);
...
app.use('/api/ai', aiRoutes);
```
`aiRateLimitMiddleware` is defined but not applied to `/api/ai`.
```ts
localStorage.setItem('token', token);
...
partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
```
- Impact: Expensive AI endpoints are protected only by the general `/api` limiter, increasing cost and denial-of-service exposure. Separately, auth tokens are persisted in `localStorage`, so any future XSS would immediately enable account takeover via token theft.
- Fix: Apply `aiRateLimitMiddleware` specifically to `/api/ai`. For auth, prefer short-lived access tokens with a more constrained storage model, ideally server-set HttpOnly cookies if the architecture can support CSRF defenses.
- Mitigation: Lower per-user AI quotas and monitor request spikes. Reduce token lifetime if localStorage must remain for now.
- False positive notes: No direct XSS exploit was confirmed in this review, so the localStorage issue is a hardening concern rather than proof of current compromise.

## Positive observations

- `helmet()` is enabled with a reasonably strong baseline in [backend/src/app.ts](/root/tiku-new/runtao-academy/backend/src/app.ts#L18).
- Most route inputs are validated with `zod` before use.
- Passwords are hashed with bcrypt at cost 12 in auth and admin flows.
- Recent AI permission-scope fixes now align AI question access more closely with category boundaries.

## Recommended priority

1. Remove the JWT fallback secret and rotate tokens.
2. Lock down custom AI `baseUrl` to prevent SSRF and key exfiltration.
3. Restrict backup export/restore and review who has those permissions.
4. Fix login lock IP handling and add stronger throttling.
5. Apply AI-specific rate limiting and plan a token-storage hardening pass.
