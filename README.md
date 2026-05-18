# 润涛题苑

> Runtao Academy 是一套面向题库沉淀、学习复习、标签治理与 AI 辅助内容生产的现代化题库系统。

<p align="center">
  <strong>题库管理</strong>
  <span> · </span>
  <strong>学习复习</strong>
  <span> · </span>
  <strong>AI 内容生产</strong>
  <span> · </span>
  <strong>标签治理</strong>
  <span> · </span>
  <strong>权限与备份</strong>
</p>

<p align="center">
  <a href="./docs/USER_GUIDE.md">用户手册</a>
  <span> · </span>
  <a href="./docs/AI_GUIDE.md">AI 指南</a>
  <span> · </span>
  <a href="./docs/DEPLOYMENT.md">部署说明</a>
  <span> · </span>
  <a href="./docs/DEVELOPMENT.md">开发指南</a>
</p>

---

## 项目定位

润涛题苑不是单纯的题目增删改查页面，而是一套覆盖“题目整理、学习使用、AI 生产、标签治理、权限控制、备份恢复”的完整题库工作流。

它适合这些场景：

- 个人知识库、面试问答、学习笔记沉淀
- 教培题库、团队内部学习库、多人协作题库
- 使用 AI 批量生题、补答案、润色题目、建议标签
- 需要分类授权、独立题库、集成题库和管理员运维能力的题库系统

---

## 快速导航

| 入口 | 说明 |
| --- | --- |
| [快速开始](#快速开始) | 使用 Docker 或本地开发模式启动项目 |
| [核心能力](#核心能力) | 了解题库、学习、AI、权限与运维模块 |
| [AI 工作流](#ai-工作流) | 查看 AI 答案、AI 润色、AI 批量生题的使用边界 |
| [常用命令](#常用命令) | 构建、检查、测试与容器运维命令 |
| [文档中心](#文档中心) | 部署、运维、开发、用户、AI、权限等专题文档 |

---

## 核心能力

| 模块 | 能力 |
| --- | --- |
| 题库管理 | 创建、编辑、删除题目，按关键词、分类、难度、标签筛选，支持导入导出和批量操作 |
| 学习模式 | 背题、答题、收藏、最近学习记录、学习进度保存与恢复 |
| 标签治理 | 标签统计、搜索、重命名、批量替换、规范化、别名归并、健康检查 |
| AI 能力 | AI 批量生题、AI 答案草稿、AI 题目润色、AI 助手、AI 批量标签 |
| 用户与权限 | 管理员、独立题库用户、集成题库用户、分类范围授权、细粒度权限模型 |
| 数据与运维 | SQLite / MySQL 双数据库、连接测试、迁移、切换、完整备份导出与恢复 |

---

## 快速开始

### Docker 运行

```bash
git clone https://github.com/anhaot/runtao-academy.git
cd runtao-academy
cp .env.example .env
docker-compose up -d --build
```

默认访问地址：

| 服务 | 地址 |
| --- | --- |
| 前端 | `http://127.0.0.1:10089` |
| 健康检查 | `http://127.0.0.1:10089/api/health` |

### 本地开发

后端：

```bash
cd backend
npm install
npm run dev
```

前端：

```bash
cd frontend
npm install
npm run dev
```

默认情况下后端监听 `3001` 端口，前端由 Vite 提供开发服务。更多部署方式见 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)。

---

## AI 工作流

| 功能 | 定位 | 适合场景 |
| --- | --- | --- |
| AI 答案 | 只补 `answer`、`explanation`、`tags`，不改题干、标题和难度 | 缺答案、答案偏弱、需要速记版或教学版表达 |
| AI 润色 | 优化整题表达、结构和可读性 | 原题质量较弱、题干表达不清、需要更适合教学 |
| AI 批量生题 | 围绕主题批量生成题目 | 快速扩充题量、生成练习题、生成教学题 |
| AI 助手 | 辅助理解、生成草稿、处理内容 | 题目运营和内容生产过程中的即时辅助 |

AI 润色支持 `轻润色` 与 `深润色` 两档；AI 答案与 AI 批量生题支持 `速记版`、`练习版`、`教学版`。完整配置说明见 [docs/AI_GUIDE.md](./docs/AI_GUIDE.md)。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、React Router、Zustand、Tailwind CSS、Axios、Playwright |
| 后端 | Node.js 20、Express、TypeScript、Zod、JWT、Helmet、rate-limiter-flexible、better-sqlite3、mysql2、multer |
| 数据 | SQLite 默认可用，MySQL 可选 |
| 部署 | Docker、docker-compose、Nginx 静态资源服务 |

---

## 项目结构

```text
runtao-academy/
├─ backend/
│  ├─ src/
│  │  ├─ config/       # 配置、数据库运行时配置
│  │  ├─ database/     # 数据库访问层
│  │  ├─ middleware/   # 鉴权、限流、错误处理
│  │  ├─ routes/       # API 路由
│  │  ├─ services/     # AI 等服务层
│  │  ├─ types/        # 类型定义
│  │  └─ utils/        # 标签、AI 安全等工具
│  ├─ test/            # 后端安全回归测试
│  └─ Dockerfile
├─ frontend/
│  ├─ src/
│  │  ├─ api/          # Axios API 封装
│  │  ├─ components/   # 公共组件
│  │  ├─ lib/          # 渲染、格式化、权限辅助函数
│  │  ├─ pages/        # 页面层
│  │  ├─ store/        # Zustand 状态管理
│  │  └─ types/        # 前端类型定义
│  ├─ e2e/             # Playwright 冒烟与回归测试
│  └─ Dockerfile
├─ docs/               # 专题文档
├─ docker-compose.yml
├─ .env.example
├─ CHANGELOG.md
├─ CONTRIBUTING.md
└─ README.md
```

---

## 常用命令

### 后端

```bash
cd backend
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
```

### 前端

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run e2e
```

### Docker

```bash
docker-compose up -d --build
docker-compose ps
docker logs runtao-academy-backend
docker logs runtao-academy-frontend
```

---

## 环境变量

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

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

ALLOWED_ORIGINS=http://localhost,http://localhost:3000
```

更多变量见 [.env.example](./.env.example) 和 [backend/.env.example](./backend/.env.example)。

补充说明：

- 不配置 `MYSQL_*` 时，默认可直接使用 SQLite
- 不配置 AI Key 时，AI 功能不会正常工作
- 生产环境必须替换 `JWT_SECRET`，并为 `ALLOWED_ORIGINS` 设置明确白名单

---

## 安全与权限

当前已覆盖的基础安全能力：

- `HttpOnly Cookie` 优先的登录态方案
- 登录接口和 AI 接口限流
- `Helmet` 安全头
- 自定义 AI 地址安全校验
- 题目访问权限边界校验
- 管理员专属备份导出与恢复

正式环境建议继续配置 HTTPS、独立密钥、定期备份和依赖更新。权限模型见 [docs/PERMISSIONS.md](./docs/PERMISSIONS.md)。

---

## 测试与验证

推荐提交前执行：

```bash
cd backend
npm run lint
npm run build
npm run test

cd ../frontend
npm run lint
npm run build
npm run e2e
```

当前验证覆盖 TypeScript 构建检查、ESLint 静态检查、后端安全回归测试和 Playwright 浏览器级回归。

---

## 文档中心

| 文档 | 内容 |
| --- | --- |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新记录 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献方式和开发协作说明 |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | 部署、容器和生产环境说明 |
| [docs/OPERATIONS.md](./docs/OPERATIONS.md) | 运维、备份、恢复和排障 |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | 开发环境、目录约定和工程说明 |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | 用户操作说明 |
| [docs/AI_GUIDE.md](./docs/AI_GUIDE.md) | AI 能力、配置和使用边界 |
| [docs/PERMISSIONS.md](./docs/PERMISSIONS.md) | 用户角色、分类范围和权限模型 |
| [LICENSE](./LICENSE) | 开源许可证 |

---

## 版本重点

最近版本主要补齐了产品链路和安全边界：

- `AI 答案` 从 `AI 润色` 中拆分出来，专门负责答案、解析和标签建议
- `AI 润色` 支持 `轻润色 / 深润色` 两档，默认走 `轻润色`
- `AI 批量生题` 的结果解析更稳，兼容更多 AI JSON 返回格式
- Markdown、列表、分条内容展示更稳定
- AI 路由补上题目访问权限边界校验
- 登录鉴权切换到 `HttpOnly Cookie` 优先模式
- AI 自定义地址做了 SSRF 风险收口
- 备份导出和恢复限制为管理员专用

---

## 许可证

本项目基于 [LICENSE](./LICENSE) 中的条款发布。
