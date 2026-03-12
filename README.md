# 润涛题苑

> Runtao Academy  
> 一个面向学习、题苑运营与 AI 辅助内容生产的现代化在线题苑系统。

润涛题苑是一个前后端分离的学习平台，适合个人知识沉淀、小团队共建学习库、教培内容整理，以及 AI 辅助出题、润色和知识讲解场景。

## 产品定位

- 面向个人和团队的题苑管理
- 面向学习流程的背题、答题、收藏与进度追踪
- 面向运营场景的标签治理、查重、备份恢复
- 面向生产效率的 AI 生题、AI 助手、AI 润色
- 面向协作与发布的细粒度权限和双模式用户体系

## 核心亮点

- 题目、分类、标签三层结构完整打通
- 支持独立题库用户与集成题库用户
- AI 批量生题支持 `速记版 / 练习版 / 教学版`
- 单题 AI 润色支持先预览、再编辑、再写回
- 标签体系支持规范化、别名归并、健康检查
- 支持 SQLite / MySQL 数据库配置、迁移、切换向导
- 支持完整备份导出与恢复
- 已补构建、lint、单测和浏览器级回归测试

## 功能概览

### 1. 题苑管理

- 新增、编辑、删除题目
- 按关键词、分类、难度、标签筛选
- 单题导入、批量导入、批量删除
- 批量加标签、删标签、替换标签
- Markdown / JSON / CSV / 文本导入
- 导出题目
- 完全重复题检查
- 相似题查重与“保留并合并”

### 2. 学习模式

- 背题模式
- 答题模式
- 收藏题目
- 最近学习记录
- 查看次数与学习统计
- 标签联动筛题
- 一键清空当前账号学习相关信息
  - 背题/答题进度
  - 已查看次数
  - 收藏标记
  - 最近学习记录

### 3. 标签体系

- 每题最多 5 个标签
- 标签展示、搜索、筛选
- 标签管理
- 标签重命名、删除、合并
- 标签规范化
- 标签别名 / 同义词归并
- 标签推荐
- 标签健康检查与直接处理

### 4. AI 能力

- AI 批量生题
- AI 粘贴导入
- AI 助手
  - 题目解析
  - 答案扩展
  - 知识推荐
  - 相似题生成
  - 精简版
  - 口语化
  - 结构化
  - 深度对话
- AI 单题润色
  - 生成润色草稿
  - 支持编辑题目内容 / 答案 / 解析
  - 确认后写回原题
- AI 输出清洗与 Markdown 兼容增强
  - 自动去掉常见废话开场
  - 支持标题、列表、分隔线、表格展示

### 5. 用户与权限

- 管理员创建用户
- 用户编辑、删除、角色切换
- 注册开关
- 细粒度权限配置
- 分类范围授权
- 用户模式：
  - 独立题库用户
  - 集成题库用户

### 6. 数据与运维

- SQLite / MySQL 双数据库支持
- 数据库测试连接
- 初始化目标库结构
- 数据迁移
- 数据校验
- 下次启动生效切换
- 完整备份导出
- 完整备份恢复

## 用户模式

### 独立题库用户

- 拥有自己的分类、题目、标签、AI 配置
- 默认只操作自己的题苑
- 适合个人用户、独立维护者

### 集成题库用户

- 接入指定题库来源
- 可按分类范围授权
- 权限与可见范围分离
- 适合团队协作、录题员、学习成员

## 权限模型

系统已从粗粒度权限拆分为细粒度权限。

### 题苑权限

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

## 技术栈

### 前端

- React 18
- TypeScript
- Vite
- React Router
- Zustand
- Tailwind CSS
- Lucide React
- Playwright

### 后端

- Node.js 20
- Express
- TypeScript
- better-sqlite3
- mysql2
- multer 2.x
- Zod
- JWT
- Helmet
- rate-limiter-flexible

## 项目结构

```text
runtao-academy/
├─ frontend/                  # React 前端
│  ├─ src/
│  ├─ e2e/                    # Playwright 回归测试
│  ├─ playwright.config.ts
│  └─ Dockerfile
├─ backend/                   # Express 后端
│  ├─ src/
│  ├─ test/                   # 后端安全回归测试
│  └─ Dockerfile
├─ docker-compose.yml
├─ README.md
└─ SECURITY_AUDIT.md
```

## 快速开始

### 方式一：Docker 部署

```bash
git clone <your-repo-url>
cd runtao-academy
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

## 开源与协作

### License

本项目使用 [MIT License](./LICENSE)。

### GitHub 建议

- 仓库名建议：`runtao-academy`
- 默认分支建议：`main`
- 建议开启：
  - Issue 模板
  - Pull Request 模板
  - Dependabot 或定期依赖升级
  - Release Notes

### 提交前建议检查

```bash
cd backend && npm run lint && npm run build && npm run test
cd ../frontend && npm run lint && npm run build && npm run e2e
```

### Issue 与 PR

- Bug 请附复现步骤、环境信息和日志
- 功能需求请说明使用场景、权限影响和数据影响
- UI 变更建议附截图

### 贡献文档

- 贡献流程见 [CONTRIBUTING.md](./CONTRIBUTING.md)
- 安全审计记录见 [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)
- 版本变更记录见 [CHANGELOG.md](./CHANGELOG.md)

## 环境变量

### 后端基础配置

```bash
PORT=3001
NODE_ENV=production

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
```

### 数据库配置

SQLite：

```bash
DATABASE_TYPE=sqlite
SQLITE_PATH=./data/runtao-academy.db
```

MySQL：

```bash
DATABASE_TYPE=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=runtao_academy
```

### AI 基础配置

```bash
AI_ENABLED=true
DEFAULT_AI_PROVIDER=deepseek
```

可选 Provider 密钥：

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `QWEN_API_KEY`
- `DOUBAO_API_KEY`
- `ZHIPU_API_KEY`

### 跨域配置

```bash
ALLOWED_ORIGINS=http://localhost,http://localhost:3000
```

## AI 支持说明

系统支持以下类型的 AI 配置：

- OpenAI
- DeepSeek
- 通义千问
- 豆包
- 智谱
- 自定义 OpenAI 兼容接口

你可以在系统设置中：

- 新增多个 AI 配置
- 切换当前生效配置
- 管理模型名、Base URL、API Key

## 数据库切换向导

系统设置中的数据库向导支持：

1. 新建数据库配置
2. 测试连接
3. 初始化目标库
4. 迁移当前数据
5. 校验迁移结果
6. 设为“下次启动生效”
7. 恢复为环境变量数据库

说明：

- 当前版本采用安全切换方案
- 真正生效时间点是下次重启
- 不做运行时热切换

## 导入格式

### JSON

```json
[
  {
    "title": "HTTP 状态码 200 表示什么？",
    "content": "HTTP 状态码 200 表示什么？",
    "answer": "表示请求成功。",
    "explanation": "服务器成功接收并返回了请求结果。",
    "difficulty": "easy",
    "tags": ["http", "状态码"]
  }
]
```

### CSV 字段

```text
title,content,answer,explanation,difficulty,tags
```

### Markdown

```markdown
**HTTP 状态码 404 表示什么？**
答案：表示请求的资源不存在。
解析：客户端发起的 URL 在服务器端没有对应资源。
```

## 测试与质量检查

当前项目已内置以下质量检查：

### 后端

- `npm run lint`
- `npm run build`
- `npm run test`
- `npm audit --omit=dev`

### 前端

- `npm run lint`
- `npm run build`
- `npm run e2e`
- `npm audit --omit=dev`

### 当前检查结果

在本地最近一次完整检查中：

- 后端 lint 通过
- 后端构建通过
- 后端测试通过
- 后端生产依赖审计无漏洞
- 前端 lint 通过
- 前端构建通过
- 前端浏览器级回归通过
- 前端生产依赖审计无漏洞

## 安全基线

项目当前已包含这些基础安全措施：

- JWT 鉴权
- Helmet 安全头
- 基础限流
- 上传文件扩展名白名单
- Markdown/XSS 风险点统一安全渲染
- AI 输出展示前清洗
- 题苑与分类范围权限校验
- 备份恢复前预览确认

更多检查记录见 [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)。

## 发布建议

建议使用以下仓库名之一：

- `runtao-academy`
- `runtao-study-suite`
- `runtao-learning-platform`

建议发布前再确认：

- 修改生产环境 `JWT_SECRET`
- 配置正式 AI Key
- 配置正式域名与 HTTPS
- 根据实际情况关闭开放注册
- 做一次完整备份演练

## 许可证

如需对外发布，建议补充正式 LICENSE 文件后再公开仓库。
