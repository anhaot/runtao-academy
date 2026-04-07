# 开发指南

## 1. 目标

这份文档面向继续开发这个项目的人，重点说明：

- 代码结构
- 本地开发方式
- 常用脚本
- 测试策略
- 当前几个关键业务流的实现边界

---

## 2. 项目结构

### 后端

目录：[backend](/root/tiku-new/runtao-academy/backend)

主要分层：

- `src/routes`
  - API 路由入口
- `src/middleware`
  - 鉴权、权限、限流、错误处理
- `src/database`
  - 数据访问与数据库抽象
- `src/services`
  - AI 等服务层逻辑
- `src/utils`
  - 标签、Markdown、AI 安全等工具
- `test`
  - 后端安全与回归测试

### 前端

目录：[frontend](/root/tiku-new/runtao-academy/frontend)

主要分层：

- `src/pages`
  - 页面级逻辑
- `src/components`
  - 可复用组件
- `src/api`
  - Axios 请求封装
- `src/store`
  - Zustand 状态管理
- `src/lib`
  - 渲染、格式化、权限辅助逻辑
- `e2e`
  - Playwright 浏览器级测试

---

## 3. 本地开发

### 安装依赖

后端：

```bash
cd backend
npm install
```

前端：

```bash
cd frontend
npm install
```

### 启动开发环境

后端：

```bash
cd backend
npm run dev
```

前端：

```bash
cd frontend
npm run dev
```

默认情况下：

- 前端跑在 Vite 开发服务器
- 后端跑在 `tsx watch`

---

## 4. 常用脚本

### 后端

```bash
cd backend
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
```

说明：

- `build`：TypeScript 编译
- `lint`：ESLint 检查
- `typecheck`：只做类型检查
- `test`：运行后端安全回归测试

### 前端

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run preview
npm run e2e
npm run e2e:headed
```

说明：

- `build`：TypeScript + Vite 构建
- `e2e`：Playwright 无头测试
- `e2e:headed`：Playwright 有头模式，便于本地观察

---

## 5. 测试策略

当前项目主要有三层测试：

### 后端安全回归

文件：

- [security-regression.test.ts](/root/tiku-new/runtao-academy/backend/test/security-regression.test.ts)

目前覆盖重点：

- 注册开关
- 批量删除越权
- AI 配置越权
- AI 题目接口越权

### 前端 E2E

文件：

- [login.spec.ts](/root/tiku-new/runtao-academy/frontend/e2e/login.spec.ts)
- [questions.spec.ts](/root/tiku-new/runtao-academy/frontend/e2e/questions.spec.ts)
- [backup.spec.ts](/root/tiku-new/runtao-academy/frontend/e2e/backup.spec.ts)

目前覆盖重点：

- 登录
- 新建题目
- AI 润色预览并保存
- 备份导出与恢复

### 构建校验

推荐至少执行：

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

---

## 6. 关键业务流

### 题库

主要入口：

- [questions.ts](/root/tiku-new/runtao-academy/backend/src/routes/questions.ts)
- [Questions.tsx](/root/tiku-new/runtao-academy/frontend/src/pages/Questions.tsx)

注意点：

- 题库权限和分类范围限制要一起考虑
- 批量操作更容易出现越权问题，改动时优先补回归验证

### AI答案

定位：

- 只生成答案、解析和标签建议
- 不动题干、标题、难度

主要文件：

- [ai.ts](/root/tiku-new/runtao-academy/backend/src/routes/ai.ts)
- [AIAnswerDraftModal.tsx](/root/tiku-new/runtao-academy/frontend/src/components/AIAnswerDraftModal.tsx)

改动时注意：

- 不要重新引入“参考原答案”逻辑
- 输出格式要兼顾展示，不要为了格式化牺牲内容准确性

### AI润色

定位：

- 处理整题优化
- 当前分为 `轻润色` 和 `深润色`

改动时注意：

- `轻润色` 默认优先，避免不必要的慢请求
- 前端要保留预览后保存，不要直接无确认覆盖

### AI批量生题

定位：

- 扩题工具
- 生成后再导入题库

改动时注意：

- 模型返回格式波动很大
- 解析逻辑必须容错，兼容 JSON 数组、代码块、带包装对象的结果

---

## 7. 鉴权与权限

鉴权逻辑主要在：

- [auth.ts](/root/tiku-new/runtao-academy/backend/src/middleware/auth.ts)
- [auth.ts](/root/tiku-new/runtao-academy/backend/src/routes/auth.ts)

当前要点：

- 登录态优先走 `HttpOnly Cookie`
- 仍兼容 `Authorization: Bearer`
- 权限有兼容映射关系
- 集成用户要额外受分类范围限制

改动这部分时，重点防止：

- 越权访问别人的题目
- AI 路由绕过分类范围
- 普通用户越权管理 AI 配置

---

## 8. AI 配置与安全边界

当前安全策略：

- 普通用户可以使用已有的安全 AI 配置
- 普通用户不能新增或修改自定义 `baseUrl`
- 管理员可以管理自定义地址

相关文件：

- [ai.ts](/root/tiku-new/runtao-academy/backend/src/routes/ai.ts)
- [ai.ts](/root/tiku-new/runtao-academy/backend/src/services/ai.ts)
- [aiConfigSecurity.ts](/root/tiku-new/runtao-academy/backend/src/utils/aiConfigSecurity.ts)

改这块时，不要为了“能用”把 SSRF 防护重新放开。

---

## 9. 前端展示约束

当前 AI 生成内容经常包含：

- Markdown
- 编号列表
- `- ` 项目符号
- `* ` 项目符号

相关文件：

- [renderMarkdown.ts](/root/tiku-new/runtao-academy/frontend/src/lib/renderMarkdown.ts)
- [aiDraftFormatting.ts](/root/tiku-new/runtao-academy/frontend/src/lib/aiDraftFormatting.ts)

改动原则：

- 以答案准确、完整为优先
- 展示修正只能做轻量整理，不能篡改原意
- 不要为了强制格式化，破坏原始内容结构

---

## 10. 推荐开发流程

每次改动建议按这个顺序：

1. 先确认影响的是页面、API、权限还是存储
2. 改最小闭环代码
3. 跑对应构建
4. 涉及权限或安全边界时，补测试
5. 本地或 Docker 冒烟验证
6. 更新 README 或专项文档

---

## 11. 提交前检查

至少执行：

```bash
cd backend && npm run build && npm run test
cd ../frontend && npm run build
```

如果改了页面关键交互，最好再补：

```bash
cd frontend && npm run e2e
```

---

## 12. 文档入口

更多信息见：

- [README.md](/root/tiku-new/runtao-academy/README.md)
- [DEPLOYMENT.md](/root/tiku-new/runtao-academy/docs/DEPLOYMENT.md)
- [OPERATIONS.md](/root/tiku-new/runtao-academy/docs/OPERATIONS.md)
- [AI_GUIDE.md](/root/tiku-new/runtao-academy/docs/AI_GUIDE.md)
- [PERMISSIONS.md](/root/tiku-new/runtao-academy/docs/PERMISSIONS.md)
