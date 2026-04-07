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
docker-compose up -d --build
```

默认服务：

- 前端：`http://127.0.0.1:10089`
- 健康检查：`http://127.0.0.1:10089/api/health`

### 查看状态

```bash
docker-compose ps
docker logs runtao-academy-backend
docker logs runtao-academy-frontend
```

### 重建服务

```bash
docker-compose up -d --build backend frontend
```

只重建后端：

```bash
docker-compose up -d --build backend
```

只重建前端：

```bash
docker-compose up -d --build frontend
```

---

## 3. 本地开发

### 后端

```bash
cd backend
npm install
npm run dev
```

### 前端

```bash
cd frontend
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
JWT_EXPIRES_IN=7d

DATABASE_TYPE=sqlite
SQLITE_PATH=./data/runtao-academy.db

AI_ENABLED=true
DEFAULT_AI_PROVIDER=deepseek
```

数据库切到 MySQL 时需要补齐：

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=runtao_academy
```

AI 模型至少需要配置一组有效的 Key。

---

## 5. 数据库说明

### SQLite

- 默认方案
- 配置简单
- 适合个人或轻量团队

### MySQL

- 适合更正式的多用户部署
- 可通过系统设置里的数据库管理功能做连接测试、初始化、迁移和切换

---

## 6. 正式环境建议

- 替换 `JWT_SECRET`
- 开启 HTTPS
- 明确配置 `ALLOWED_ORIGINS`
- 定期导出备份
- 保留容器日志
- 定期更新依赖

---

## 7. 健康检查

后端提供：

```text
/api/health
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
