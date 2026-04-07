# 润涛题苑

> Runtao Academy  
> 一个面向题库整理、学习复习、标签治理与 AI 辅助内容生产的现代化题库系统。

## 项目简介

润涛题苑是一个前后端分离的在线题库平台，适合个人知识沉淀、小团队共建题库、面试问答整理、教培内容维护，以及 AI 辅助出题、润色、答案生成等场景。

它不是单纯的“题目增删改查”，而是一套完整的题库工作流：

- 管理端维护题目、分类、标签、权限、数据库与备份
- 学习端支持背题、答题、收藏、进度追踪
- AI 端支持批量生题、单题润色、单题答案草稿、标签建议
- 治理端支持标签规范化、查重、批量标签与数据恢复

---

## 功能总览

### 题库管理

- 创建、编辑、删除题目
- 按关键词、难度、分类、标签筛选
- 批量删除、批量标签操作
- JSON / CSV / Markdown / 文本导入
- 题目导出
- 重复题检测与相似题合并

### 学习模式

- 背题模式
- 答题模式
- 收藏题目
- 最近学习记录
- 学习进度保存与恢复
- 标签联动筛题

### 标签治理

- 每题最多 5 个标签
- 标签统计与搜索
- 标签重命名、删除、批量替换
- 标签规范化
- 标签别名归并
- 标签健康检查
- AI 批量补标签

### AI 能力

- AI 批量生题
  - `速记版`
  - `练习版`
  - `教学版`
- AI 答案草稿
  - 只生成答案、解析和标签建议
  - 不改题干、标题、难度
- AI 题目润色
  - `轻润色`
  - `深润色`
  - 先预览、再编辑、再保存
- AI 助手
  - 题目分析
  - 答案扩展
  - 知识推荐
  - 相似题生成
  - 深度对话

### 用户与权限

- 管理员创建用户
- 独立题库用户
- 集成题库用户
- 分类范围授权
- 细粒度权限模型

### 数据与运维

- SQLite / MySQL 双数据库
- 数据库连接测试
- 数据初始化与迁移
- 数据校验
- 数据库切换
- 完整备份导出与恢复

---

## 最近这版的重点改动

这一版相对早期版本，已经补上了几条核心能力：

- `AI答案` 从 `AI润色` 中拆分出来，专门负责“只生成答案和解析”
- `AI答案` 支持版本化输出和标签建议
- `AI润色` 支持 `轻润色 / 深润色` 两档，默认走 `轻润色`
- `AI批量生题` 结果解析更稳，兼容更多 AI JSON 返回格式
- Markdown / 列表 / 分条内容展示更稳定
- AI 路由补上了题目访问权限边界校验
- 登录鉴权切换到 `HttpOnly Cookie` 优先模式
- AI 自定义地址做了 SSRF 风险收口
- 备份导出 / 恢复限制为管理员专用

---

## 典型工作流

### 1. 题库运营

1. 导入历史题目
2. 批量检查重复题
3. 统一规范标签
4. 用 `AI批量生题` 补充题量
5. 用 `AI润色` 提升题目质量

### 2. 学习复习

1. 在题库页筛选一个分类或标签
2. 进入背题或答题模式
3. 收藏重点题目
4. 结合 `AI答案` 生成更适合背诵的答案版本

### 3. AI 内容生产

1. `AI批量生题` 先围绕一个主题批量生成
2. 对关键题目使用 `AI润色`
3. 对缺答案或答案偏弱的题使用 `AI答案`
4. 用 AI 标签建议补齐标签体系

---

## 权限模型

系统权限是细粒度拆分的，主要包括下面几组。

### 题库权限

- `question_view`
- `question_create`
- `question_edit_content`
- `question_edit_meta`
- `question_delete`
- `question_batch_edit`
- `question_export`
- `import_manage`

### 分类与治理

- `category_view`
- `category_manage`
- `tag_manage`
- `duplicate_manage`

### AI 权限

- `ai_use`
- `ai_generate`
- `ai_polish`
- `ai_chat`
- `ai_config_manage`

### 系统权限

- `backup_export`
- `backup_restore`
- `system_manage`
- `user_manage`

补充说明：

- 管理员默认拥有全部权限
- 集成题库用户可以再叠加分类范围限制
- 普通用户可以使用已有的安全 AI 配置
- 普通用户不能自行配置危险的自定义 AI 地址

---

## AI 设计说明

### AI答案

`AI答案` 的定位是“只补答案，不改题”。

- 只生成 `answer`、`explanation`、`tags`
- 不修改题干、标题、难度
- 适合缺答案、答案偏弱、想补不同表述版本的题

### AI润色

`AI润色` 的定位是“优化整题表达与质量”。

- `轻润色`
  - 更快
  - 主要优化表达、结构与可读性
  - 尽量少改题目原意
- `深润色`
  - 更完整
  - 可补强答案和解析
  - 更适合题目质量较差时使用

### AI批量生题

- 支持 `速记版 / 练习版 / 教学版`
- 适合围绕一个主题快速扩充题库
- 返回后可直接导入题库

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
├─ backend/                     # Express + TypeScript 后端
│  ├─ src/
│  │  ├─ config/               # 配置、数据库运行时配置
│  │  ├─ database/             # 数据库访问层
│  │  ├─ middleware/           # 鉴权、限流、错误处理
│  │  ├─ routes/               # API 路由
│  │  ├─ services/             # AI 等服务层
│  │  ├─ types/                # 类型定义
│  │  └─ utils/                # 标签、AI 安全等工具
│  ├─ test/                    # 后端安全回归测试
│  ├─ package.json
│  └─ Dockerfile
├─ frontend/                    # React 前端
│  ├─ src/
│  │  ├─ api/                  # Axios API 封装
│  │  ├─ components/           # 公共组件
│  │  ├─ lib/                  # 渲染、格式化、权限辅助函数
│  │  ├─ pages/                # 页面层
│  │  ├─ store/                # Zustand 状态管理
│  │  └─ types/                # 前端类型定义
│  ├─ e2e/                     # Playwright 冒烟与回归测试
│  ├─ package.json
│  └─ Dockerfile
├─ docker-compose.yml
├─ .env.example
├─ CHANGELOG.md
├─ CONTRIBUTING.md
├─ SECURITY_AUDIT.md
└─ README.md
```

---

## 快速开始

### 方式一：Docker 运行

```bash
git clone <your-repo-url>
cd runtao-academy
cp .env.example .env
docker-compose up -d --build
```

默认访问地址：

- 前端：`http://127.0.0.1:10089`
- 健康检查：`http://127.0.0.1:10089/api/health`

### 方式二：本地开发

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

## 环境变量

最常用的是下面这些：

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

更多变量请参考：

- [.env.example](/root/tiku-new/runtao-academy/.env.example)

补充说明：

- 如果不配置 `MYSQL_*`，默认可直接用 SQLite
- 如果没有配置 AI Key，AI 功能不会正常工作
- `JWT_SECRET` 建议尽快替换成你自己的随机密钥

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

## 安全说明

项目当前已经做了这些安全收口：

- `HttpOnly Cookie` 优先的登录态方案
- 登录接口限流
- AI 接口专用限流
- `Helmet` 安全头
- 自定义 AI 地址安全校验
- 题目访问权限边界校验
- 管理员专属备份导出 / 恢复

仍然建议你在正式环境里继续做：

- 配置独立的 `JWT_SECRET`
- 使用 HTTPS
- 为 `ALLOWED_ORIGINS` 设置明确白名单
- 定期备份数据库
- 定期更新依赖

详细审计可参考：

- [SECURITY_AUDIT.md](/root/tiku-new/runtao-academy/SECURITY_AUDIT.md)
- [security_best_practices_report.md](/root/tiku-new/runtao-academy/security_best_practices_report.md)

---

## 测试与验证

当前项目至少包含三层验证方式：

- TypeScript 构建检查
- ESLint 静态检查
- Playwright 浏览器级回归

推荐提交前执行：

```bash
cd backend && npm run lint && npm run build && npm run test
cd ../frontend && npm run lint && npm run build && npm run e2e
```

---

## 文档与协作

- 更新记录见 [CHANGELOG.md](/root/tiku-new/runtao-academy/CHANGELOG.md)
- 贡献方式见 [CONTRIBUTING.md](/root/tiku-new/runtao-academy/CONTRIBUTING.md)
- 许可证见 [LICENSE](/root/tiku-new/runtao-academy/LICENSE)
- 部署说明见 [docs/DEPLOYMENT.md](/root/tiku-new/runtao-academy/docs/DEPLOYMENT.md)
- 运维手册见 [docs/OPERATIONS.md](/root/tiku-new/runtao-academy/docs/OPERATIONS.md)
- 开发指南见 [docs/DEVELOPMENT.md](/root/tiku-new/runtao-academy/docs/DEVELOPMENT.md)
- 用户手册见 [docs/USER_GUIDE.md](/root/tiku-new/runtao-academy/docs/USER_GUIDE.md)
- AI 功能说明见 [docs/AI_GUIDE.md](/root/tiku-new/runtao-academy/docs/AI_GUIDE.md)
- 权限模型说明见 [docs/PERMISSIONS.md](/root/tiku-new/runtao-academy/docs/PERMISSIONS.md)

---

## 适合谁用

润涛题苑适合下面这些场景：

- 个人知识题库
- 面试题与问答整理
- 教培题库维护
- 团队内部学习库
- AI 辅助内容生产与润色
- 需要分类、权限、标签治理和备份恢复的题库系统

如果你想继续往下做，比较值得扩展的方向通常有：

- 更完整的统计面板
- 多人协作审核流
- 更细的 AI 模型策略
- 批量导入质量检查
- 更强的学习反馈和记忆曲线支持
