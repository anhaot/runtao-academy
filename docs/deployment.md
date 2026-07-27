# 部署说明

## 1. 运行方式

项目支持两种主要运行方式：

- Docker / Docker Compose
- 本地前后端分别启动

推荐正式环境优先使用 Docker Compose。

---

## 2. Docker 部署

### 启动

```bash
cp .env.example .env
openssl rand -hex 32  # 为 JWT、AI 加密、数据库用户和 root 分别生成不同的值
docker compose up -d --build
```

默认服务：

- 前端：`http://127.0.0.1:10089`
- 健康检查：`http://127.0.0.1:10089/api/health`
- 默认管理员：`admin` / `admin`（首次登录必须修改密码）

### 查看状态

```bash
docker compose ps
docker compose logs api
docker compose logs web
```

### 重建服务

```bash
docker compose up -d --build api web
```

只重建后端：

```bash
docker compose up -d --build api
```

只重建前端：

```bash
docker compose up -d --build web
```

---

## 3. 本地开发

### 后端

```bash
cd api
npm install
npm run dev
```

### 前端

```bash
cd web
npm install
npm run dev
```

---

## 4. 环境变量

常用变量：

```env
PORT=3001
NODE_ENV=production

JWT_SECRET=your-super-secret-jwt-key-change-in-production
AI_CONFIG_ENCRYPTION_KEY=replace-with-output-of-openssl-rand-hex-32
JWT_EXPIRES_IN=7d

DATABASE_TYPE=mysql
MYSQL_HOST=db
MYSQL_PORT=3306
MYSQL_USER=tech_growth_hub
MYSQL_PASSWORD=replace-with-a-random-database-password
MYSQL_ROOT_PASSWORD=replace-with-a-different-random-root-password
MYSQL_DATABASE=tech_growth_hub

AI_ENABLED=true
DEFAULT_AI_PROVIDER=deepseek
```

Docker Compose 默认使用 MariaDB 11.4（兼容 MySQL 协议），需要配置：

```env
MYSQL_HOST=db
MYSQL_PORT=3306
MYSQL_USER=tech_growth_hub
MYSQL_PASSWORD=replace-with-a-random-database-password
MYSQL_ROOT_PASSWORD=replace-with-a-different-random-root-password
MYSQL_DATABASE=tech_growth_hub
```

AI 模型至少需要配置一组有效的 Key。

---

## 5. 数据库说明

### MariaDB / MySQL

- Docker Compose 默认方案
- 数据保存在独立的 `db-data` 卷中
- 适合个人和多用户部署

### SQLite

- 作为本地开发和轻量单机部署的可选方案
- 设置 `DATABASE_TYPE=sqlite` 后使用 `SQLITE_PATH` 指定文件位置

---

## 6. 正式环境建议

- 分别生成并妥善保管 `JWT_SECRET` 与 `AI_CONFIG_ENCRYPTION_KEY`
- 不要在仍有加密 AI 配置时丢失或随意替换 `AI_CONFIG_ENCRYPTION_KEY`
- 开启 HTTPS
- 明确配置 `ALLOWED_ORIGINS`
- 定期导出备份
- 保留容器日志
- 定期更新依赖

---

## 7. 健康检查

后端提供：

```text
/api/health        # 综合状态
/api/health/live   # 进程存活
/api/health/ready  # 数据库就绪
```

可用于：

- 反向代理健康检查
- 容器编排健康检查
- 发布后自检

---

## 8. 常见问题

### 前端更新后看起来没变化

先强制刷新浏览器：

- Windows/Linux：`Ctrl + F5`
- Mac：`Cmd + Shift + R`

### AI 功能不能用

优先检查：

- AI Key 是否配置
- 当前用户是否有 AI 相关权限
- 当前激活模型是否有效
- 后端日志是否有模型调用错误

### Docker 服务是 healthy，但页面有旧资源

通常是浏览器缓存导致，先强制刷新。
