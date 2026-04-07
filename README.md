# 润涛题苑

> Runtao Academy  
> 一个面向题库整理、学习复习、标签治理与 AI 辅助内容生产的现代化题库系统。

<p align="center">
  <strong>题库管理</strong> ·
  <strong>学习复习</strong> ·
  <strong>AI 生题 / 润色 / 答案</strong> ·
  <strong>标签治理</strong> ·
  <strong>权限与备份</strong>
</p>

---

## 概览

润涛题苑不是一个简单的“题目增删改查”页面，而是一套完整的题库工作流：

- 管理端负责题目、分类、标签、权限、数据库与备份
- 学习端负责背题、答题、收藏与进度追踪
- AI 端负责批量生题、单题润色、答案草稿与标签建议
- 治理端负责标签规范化、查重、批量标签与数据恢复

适合的场景也很明确：

- 个人知识沉淀
- 面试问答整理
- 教培题库维护
- 团队协作题库
- AI 辅助内容生产

---

## 快速导航

| 你现在想看什么 | 入口 |
| --- | --- |
| 快速了解项目能力 | [核心能力](#核心能力) |
| 直接启动项目 | [快速开始](#快速开始) |
| 看 AI 功能说明 | [docs/AI_GUIDE.md](/root/tiku-new/runtao-academy/docs/AI_GUIDE.md) |
| 看部署方法 | [docs/DEPLOYMENT.md](/root/tiku-new/runtao-academy/docs/DEPLOYMENT.md) |
| 看运维手册 | [docs/OPERATIONS.md](/root/tiku-new/runtao-academy/docs/OPERATIONS.md) |
| 看开发指南 | [docs/DEVELOPMENT.md](/root/tiku-new/runtao-academy/docs/DEVELOPMENT.md) |
| 看用户操作说明 | [docs/USER_GUIDE.md](/root/tiku-new/runtao-academy/docs/USER_GUIDE.md) |
| 看权限模型 | [docs/PERMISSIONS.md](/root/tiku-new/runtao-academy/docs/PERMISSIONS.md) |

---

## 核心能力

| 模块 | 能做什么 |
| --- | --- |
| 题库管理 | 创建、编辑、删除题目，按关键词、分类、难度、标签筛选，支持导入导出和批量操作 |
| 学习模式 | 背题、答题、收藏、最近学习记录、学习进度保存与恢复 |
| 标签治理 | 标签统计、搜索、重命名、批量替换、规范化、别名归并、健康检查 |
| AI 能力 | AI 批量生题、AI 答案草稿、AI 题目润色、AI 助手、AI 批量标签 |
| 用户与权限 | 管理员、独立题库用户、集成题库用户、分类范围授权、细粒度权限模型 |
| 数据与运维 | SQLite / MySQL 双数据库、连接测试、迁移、切换、完整备份导出与恢复 |

---

## AI 工作流

### `AI答案`

定位是“只补答案，不改题”：

- 只生成 `answer`、`explanation`、`tags`
- 不修改题干、标题、难度
- 适合缺答案、答案偏弱、想补不同表达版本的题

支持版本：

- `速记版`
- `练习版`
- `教学版`

### `AI润色`

定位是“优化整题表达与质量”：

- `轻润色`
  - 更快
  - 更偏表达、结构、可读性优化
- `深润色`
  - 更完整
  - 更适合原题质量较弱时使用

### `AI批量生题`

适合围绕一个主题快速扩充题库：

- `速记版`
- `练习版`
- `教学版`

返回后可直接导入题库。

---

## 最近这版

这一版的重点不是小修小补，而是把产品链路补完整了：

- `AI答案` 从 `AI润色` 中拆分出来，专门负责答案、解析和标签建议
- `AI润色` 支持 `轻润色 / 深润色` 两档，默认走 `轻润色`
- `AI批量生题` 的结果解析更稳，兼容更多 AI JSON 返回格式
- Markdown、列表、分条内容展示更稳定
- AI 路由补上了题目访问权限边界校验
- 登录鉴权切换到 `HttpOnly Cookie` 优先模式
- AI 自定义地址做了 SSRF 风险收口
- 备份导出 / 恢复限制为管理员专用
- 文档体系拆成了部署、运维、开发、用户、AI、权限六个专题文档

---

## 典型用法

### 题库运营

1. 导入历史题目
2. 批量检查重复题
3. 统一规范标签
4. 用 `AI批量生题` 补充题量
5. 用 `AI润色` 提升重点题质量

### 学习复习

1. 在题库页筛选一个分类或标签
2. 进入背题或答题模式
3. 收藏重点题目
4. 用 `AI答案` 生成更适合背诵或讲解的答案版本

### 内容生产

1. 先用 `AI批量生题` 铺题量
2. 再用 `AI答案` 补答案和标签
3. 最后用 `AI润色` 处理高价值题目

---

## 技术栈

### 前端

- React 18
- TypeScript
- Vite
- React Router
- Zustand
- Tailwind CSS
- Axios
- Playwright

### 后端

- Node.js 20
- Express
- TypeScript
- Zod
- JWT
- Helmet
- rate-limiter-flexible
- better-sqlite3
- mysql2
- multer

---

## 项目结构

```text
runtao-academy/
├─ backend/
│  ├─ src/
│  │  ├─ config/               # 配置、数据库运行时配置
│  │  ├─ database/             # 数据库访问层
│  │  ├─ middleware/           # 鉴权、限流、错误处理
│  │  ├─ routes/               # API 路由
│  │  ├─ services/             # AI 等服务层
│  │  ├─ types/                # 类型定义
│  │  └─ utils/                # 标签、AI 安全等工具
│  ├─ test/                    # 后端安全回归测试
│  └─ Dockerfile
├─ frontend/
│  ├─ src/
│  │  ├─ api/                  # Axios API 封装
│  │  ├─ components/           # 公共组件
│  │  ├─ lib/                  # 渲染、格式化、权限辅助函数
│  │  ├─ pages/                # 页面层
│  │  ├─ store/                # Zustand 状态管理
│  │  └─ types/                # 前端类型定义
│  ├─ e2e/                     # Playwright 冒烟与回归测试
│  └─ Dockerfile
├─ docs/
├─ docker-compose.yml
├─ .env.example
├─ CHANGELOG.md
├─ CONTRIBUTING.md
└─ README.md
```

---

## 快速开始

### Docker 运行

```bash
git clone <your-repo-url>
cd runtao-academy
cp .env.example .env
docker-compose up -d --build
```

默认访问地址：

- 前端：`http://127.0.0.1:10089`
- 健康检查：`http://127.0.0.1:10089/api/health`

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

最常用的是这些：

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

更多变量见：

- [.env.example](/root/tiku-new/runtao-academy/.env.example)

补充说明：

- 不配置 `MYSQL_*` 时，默认可直接使用 SQLite
- 不配置 AI Key 时，AI 功能不会正常工作
- `JWT_SECRET` 应尽快替换成你自己的随机密钥

---

## 安全说明

当前已经做了这些基础安全收口：

- `HttpOnly Cookie` 优先的登录态方案
- 登录接口限流
- AI 接口专用限流
- `Helmet` 安全头
- 自定义 AI 地址安全校验
- 题目访问权限边界校验
- 管理员专属备份导出 / 恢复

正式环境仍建议继续做：

- 配置独立的 `JWT_SECRET`
- 使用 HTTPS
- 为 `ALLOWED_ORIGINS` 设置明确白名单
- 定期备份数据库
- 定期更新依赖

## 测试与验证

当前至少有三层验证：

- TypeScript 构建检查
- ESLint 静态检查
- Playwright 浏览器级回归

推荐提交前执行：

```bash
cd backend && npm run lint && npm run build && npm run test
cd ../frontend && npm run lint && npm run build && npm run e2e
```

---

## 文档中心

- 更新记录：[CHANGELOG.md](/root/tiku-new/runtao-academy/CHANGELOG.md)
- 贡献方式：[CONTRIBUTING.md](/root/tiku-new/runtao-academy/CONTRIBUTING.md)
- 部署说明：[docs/DEPLOYMENT.md](/root/tiku-new/runtao-academy/docs/DEPLOYMENT.md)
- 运维手册：[docs/OPERATIONS.md](/root/tiku-new/runtao-academy/docs/OPERATIONS.md)
- 开发指南：[docs/DEVELOPMENT.md](/root/tiku-new/runtao-academy/docs/DEVELOPMENT.md)
- 用户手册：[docs/USER_GUIDE.md](/root/tiku-new/runtao-academy/docs/USER_GUIDE.md)
- AI 功能说明：[docs/AI_GUIDE.md](/root/tiku-new/runtao-academy/docs/AI_GUIDE.md)
- 权限模型说明：[docs/PERMISSIONS.md](/root/tiku-new/runtao-academy/docs/PERMISSIONS.md)
- 许可证：[LICENSE](/root/tiku-new/runtao-academy/LICENSE)

---

## 适合谁用

润涛题苑适合这些场景：

- 个人知识题库
- 面试题与问答整理
- 教培题库维护
- 团队内部学习库
- AI 辅助内容生产与润色
- 需要分类、权限、标签治理和备份恢复的题库系统

如果后面继续扩展，比较值得做的方向通常有：

- 更完整的统计面板
- 多人协作审核流
- 更细的 AI 模型策略
- 批量导入质量检查
- 更强的学习反馈和记忆曲线支持
