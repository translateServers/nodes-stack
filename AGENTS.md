# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## 项目结构

pnpm workspace + Turborepo 全栈 monorepo：

- `apps/nestjs-server/` — NestJS 11 后端 API（Prisma 7 + SQLite/PostgreSQL + Redis）
- `apps/web/` — React 19 + Vite 8 前端 SPA（TanStack Router + TanStack Query + shadcn/ui + Tailwind CSS v4）
- `packages/shared/` — 共享类型、Zod schemas、工具函数（`@nebula/shared`）
- `packages/eslint-config/` — 共享 ESLint 配置（base / nestjs / react）
- `packages/typescript-config/` — 共享 tsconfig presets

## 常用命令

```bash
pnpm dev              # 启动所有应用
pnpm dev:web          # 仅启动前端（端口 5173，自动代理 /api → localhost:3000）
pnpm dev:server       # 仅启动后端（端口 3000）
pnpm build            # 构建所有包（turbo 按依赖顺序）
pnpm test             # 运行所有测试（turbo 会先执行 build）
pnpm typecheck        # 全量类型检查
pnpm lint             # 全量 ESLint 检查
pnpm biome:check      # Biome 检查
pnpm biome:fix        # Biome 安全自动修复（格式化用这个）
```

## TypeScript 规则

- `strict: true` + `strictNullChecks: true`，禁止 `@ts-ignore`、`@ts-nocheck`、`as any`
- 禁止隐式 `any`，函数参数和返回值必须显式声明类型
- 禁止使用 `ignoreDeprecations: "6.0"`（TypeScript 6），必须用 `paths` 替代 `baseUrl`
- API 类型使用 `@nebula/shared` 中的 `ApiResponse<T>`、`PaginatedResponse<T>` 等
- 异步操作必须正确处理 Promise，禁止浮动 Promise

## 代码格式（Biome）

单引号、分号结尾、2 空格缩进、行宽 100、尾随逗号 `all`、箭头函数参数始终加括号。
格式化由 Biome 负责；ESLint 保留 TypeScript 类型感知规则，不再启用额外格式化插件规则。

## 后端注意事项

- NestJS 使用 Zod（通过 nestjs-zod）做参数校验，**不使用** class-validator
- Prisma schema 为多文件模式：`apps/nestjs-server/prisma/schema/*.prisma`（Prisma 7），根 `schema.prisma` 仅包含 generator 和 datasource
- 路径别名：`@/` → `src/`、`@modules/` → `src/modules/`、`@common/` → `src/common/`、`@config/` → `src/config/`
- 环境变量参考 `apps/nestjs-server/.env.example`，开发环境使用 SQLite

## 前端注意事项

- 路径别名：`@/` → `src/`
- TanStack Router 使用文件系统路由，路由树自动生成（`routeTree.gen.ts`，已加入 Biome 忽略配置）
- UI 组件优先使用 shadcn/ui + Radix UI + Tailwind CSS 工具类
- 大屏设计器（`src/features/screen/`）编辑器外壳复用 `components/ui-primitives/` 的 `PanelSection`/`ToolbarButton`/`PanelResizeHandle`/`useResizablePanel` 保持视觉一致；左右面板宽度可调（localStorage 持久化）、可折叠

## 测试

- 后端：Jest 30（`*.spec.ts`），覆盖率阈值 80%（branches/functions/lines/statements）
- 前端：Vitest 4（`src/**/*.test.{ts,tsx}`），jsdom 环境
- shared 包：Vitest 4（`src/**/*.test.ts`）
- E2E：Playwright（`apps/web/e2e/`），运行：`pnpm --filter @nebula/web e2e`
- 运行单个后端测试：`pnpm --filter @nebula/nestjs-server test -- --testPathPattern=<name>`
- 运行单个前端测试：`pnpm --filter @nebula/web test -- --reporter=verbose <name>`

## 提交规范

使用 Conventional Commits 格式，描述使用中文：
`feat(web): 新增用户管理页面`、`fix(server): 修复 JWT 刷新逻辑`

## 日常开发

- 日常代码生成不强制运行 `pnpm typecheck` 和 `pnpm lint`，仅当用户明确要求时才运行
- 如果验证失败，必须修复后再输出
- 当用户说"快速实现"或"不用管类型"时，可临时放宽类型检查，但仍遵守 Biome 格式

## 按需查询文档

任务开始前先读 [docs/README.md](./docs/README.md) 获取全局索引，再按任务类型定位到对应层。

### 任务类型 → 文档层路由

| 任务类型 | 优先层 | 关键文档 |
| --- | --- | --- |
| 新人入职 / 理解全局 | `architecture/` | [system-overview.md](./docs/architecture/system-overview.md) |
| 新增大屏组件 / 模块 / API | `architecture/` + `specs/<feature>/` | [development-guide.md](./docs/architecture/development-guide.md) + 对应 feature 子目录 |
| 编码前查规范 | `conventions/` | [coding-standards.md](./docs/conventions/coding-standards.md) |
| 前后端对接 / 契约问题 | `conventions/` | [frontend-backend-contract.md](./docs/conventions/frontend-backend-contract.md) |
| 实现某功能 | `specs/<feature>/` | 看对应 feature 的 README.md |
| 理解"为什么这样设计" | `decisions/` | ADR（`ADR-NNNN-*.md`） |
| 查现状缺口 / 调研 | `analysis/` | 缺口分析、技术调研 |
| 跟踪落地进度 | `plans/` | 执行计划 |
| 产品方向 / 功能定义 | `product/` | 产品文档（_待创建_） |

### 关键文档速查

| 文档 | 何时读 |
| --- | --- |
| [docs/_structure.md](./docs/_structure.md) | 不确定文档归属哪一层时 |
| [docs/conventions/coding-standards.md](./docs/conventions/coding-standards.md) | 编码前必读 |
| [docs/conventions/frontend-backend-contract.md](./docs/conventions/frontend-backend-contract.md) | 前后端对接前必读 |
| [docs/architecture/system-overview.md](./docs/architecture/system-overview.md) | 新人第一篇 |
| [docs/architecture/development-guide.md](./docs/architecture/development-guide.md) | 新增功能时按 step 操作 |
| [packages/shared/src/contracts/](./packages/shared/src/contracts/) | 前后端 API 契约单一数据源 |

### 检索技巧

| 工具 | 用途 | 示例 |
| --- | --- | --- |
| `Read` | 读已知路径的文档全文 | `Read docs/conventions/frontend-backend-contract.md` |
| `Glob` | 按文件名模式查找 | pattern=`docs/**/*.md` |
| `Grep` | 跨文档关键词检索 | pattern=`projectId`, path=`c:\worker\nebula\docs` |
| `Grep` | 查代码中的契约引用 | pattern=`DATASET_CONTRACT`, path=`c:\worker\nebula` |

### 按需深入的标准流程

1. 读 `docs/README.md` 看七层架构与重点文档清单
2. 按任务类型定位到对应层（参考上表）
3. 读该层 `README.md` 看具体文档清单与状态
4. 用 Grep 在 `docs/` 下检索关键词，定位到具体段落
5. 找到目标文档后用 Read 读全文
6. 注意文档顶部元信息：`状态`（生效中 / 设计中 / 已归档）+ `最近更新` 判断时效性

### 文档状态约定

| 状态 | 含义 | 处理 |
| --- | --- | --- |
| 草稿 | 内容不完整 | 不应作为实现依据 |
| 设计中 | 逐步完善 | 可参考，但要确认细节 |
| 评审中 | 等待反馈 | 暂不修改 |
| 生效中 | 正式依据 | **可直接据此实现** |
| 已归档 | 过期 / 被替代 | 仅作历史参考，找新文档替代 |

### 修改文档的流程

1. 判断文档归属哪一层（参考 `docs/_structure.md` 第 3 节）
2. 在对应层目录下修改文件
3. 更新文档顶部「最近更新」日期
4. 同步更新该层 `README.md` 索引
5. 重要文档变更同步更新 `docs/README.md`

