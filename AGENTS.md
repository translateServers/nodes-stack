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

## Monorepo 规范

- 项目使用 pnpm workspace + Turborepo 管理
- 共享类型放在 `packages/shared`，通过 `@nebula/shared` 引用
- 共享 TS 配置放在 `packages/typescript-config`，通过 `@nebula/typescript-config` 引用
- 共享 ESLint 配置放在 `packages/eslint-config`，通过 `@nebula/eslint-config` 引用
- 新增依赖时注意区分 dependencies 和 devDependencies

## TypeScript 规则

- 项目已启用 `strict: true` + `strictNullChecks: true` + `noImplicitAny: true`，所有生成的代码必须通过类型检查，不允许产生 TS 编译错误
- 禁止使用 `@ts-ignore`、`@ts-nocheck`、`as any` 绕过类型检查
- 禁止使用隐式 `any`，函数参数和返回值必须显式声明类型
- 第三方库必须安装对应的 `@types/*` 类型声明包
- 异步操作必须正确处理 Promise，禁止浮动 Promise（对应 `@typescript-eslint/no-floating-promises`）
- 禁止不安全的类型断言和调用（对应 `@typescript-eslint/no-unsafe-argument`、`no-unsafe-call`）
- API 类型使用 `@nebula/shared` 中的 `ApiResponse<T>`、`PaginatedResponse<T>` 等
- 组件 Props 必须定义独立的 interface 或 type，禁止内联对象类型
- 禁止使用 `ignoreDeprecations: "6.0"`（TypeScript 6），必须用 `paths` 替代 `baseUrl`

## ESLint 规范

- 项目使用 `typescript-eslint` 的 `recommendedTypeChecked` 配置，所有生成的代码必须通过 ESLint 检查
- `@typescript-eslint/no-explicit-any` 为 warn 级别，应尽量避免使用 `any`
- 格式化由 Biome 负责，ESLint 不再启用 `prettier/prettier` 规则
- 前端项目继承 `@nebula/eslint-config/react.js`，包含浏览器全局变量
- 后端项目继承 `@nebula/eslint-config/nestjs.js`

## 代码格式（Biome）

- 单引号、分号结尾、2 空格缩进、行宽 100
- 尾随逗号 `all`、箭头函数参数始终加括号
- 生成代码前必须先读取根 `biome.json` 配置
- Biome 作为项目格式化工具，并补充基础 lint 与 organize imports；不能替代 `pnpm typecheck` 与 `pnpm lint` 质量门
- Biome 必须忽略 `node_modules`、`dist`、`build`、`coverage`、`.turbo`、生成路由树、锁文件和其他构建/生成产物，避免大面积格式化非源码文件

## Biome 工具链

- 根命令 `pnpm biome:check` 用于执行 Biome 检查，`pnpm biome:fix` 用于执行 Biome 安全自动修复
- pre-commit 使用 `simple-git-hooks` + `lint-staged`，仅对暂存且受支持的文件运行 Biome 检查
- Biome 检查通过仅代表格式、基础 lint 和 import 组织符合配置，不能替代 `pnpm typecheck` 与 `pnpm lint`
- 修改 Biome 配置后，应按任务要求运行 `pnpm biome:check`；涉及 TypeScript/ESLint 兼容性时继续运行 `pnpm typecheck` 和 `pnpm lint`

## 前端注意事项

- 框架：React 19 + Vite 8 + Tailwind CSS v4 + Radix UI + shadcn/ui + TanStack Router
- 路径别名：`@/` → `src/`，导入时使用别名路径
- 样式优先使用 Tailwind CSS 工具类，复杂交互组件使用 Radix UI + shadcn/ui
- TanStack Router 使用文件系统路由，新增页面在 `src/routes/` 下创建路由文件（如 `_app.<page>.tsx`），路由树自动生成（`routeTree.gen.ts`，已加入 Biome 忽略配置，禁止手动编辑）
- 需要鉴权的页面使用 `_app` 布局路由（`src/routes/_app.tsx`），其组件为 `AppLayout`（`src/components/layout/app-layout.tsx`）
- 侧边栏菜单在 `src/config/navigation.ts` 的 `menuGroups` 中配置，新增页面后需同步添加导航项
- 大屏设计器（`src/features/screen/`）编辑器外壳复用 `components/ui-primitives/` 的 `PanelSection`/`ToolbarButton`/`PanelResizeHandle`/`useResizablePanel` 保持视觉一致；左右面板宽度可调（localStorage 持久化）、可折叠

## 后端注意事项

- NestJS 使用 Zod（通过 nestjs-zod）做参数校验，**不使用** class-validator
- Prisma schema 为多文件模式：`apps/nestjs-server/prisma/schema/*.prisma`（Prisma 7），根 `schema.prisma` 仅包含 generator 和 datasource
- 路径别名：`@/` → `src/`、`@modules/` → `src/modules/`、`@common/` → `src/common/`、`@config/` → `src/config/`
- 环境变量参考 `apps/nestjs-server/.env.example`，开发环境使用 SQLite

## 测试

- 后端：Jest 30（`*.spec.ts`），覆盖率阈值 80%（branches/functions/lines/statements）
- 前端：Vitest 4（`src/**/*.test.{ts,tsx}`），jsdom 环境
- shared 包：Vitest 4（`src/**/*.test.ts`）
- E2E：Playwright（`apps/web/e2e/`），运行：`pnpm --filter @nebula/web e2e`
- 运行单个后端测试：`pnpm --filter @nebula/nestjs-server test -- --testPathPattern=<name>`
- 运行单个前端测试：`pnpm --filter @nebula/web test -- --reporter=verbose <name>`

### 何时应该写测试

测试的目标是保护**业务约束和安全边界**，而非验证框架自身能力。以下场景必须编写测试：

- `superRefine` / `refine` 自定义校验逻辑（如 bar-chart props 类型守卫、navigate URL 协议白名单）
- `transform` 数据转换逻辑
- `discriminatedUnion` 的判别与条件必填行为（如 static/api 数据源的互斥必填校验）
- `partial().omit()` 等组合操作中涉及安全或数据完整性的场景（如 `UpdateUserSchema` 剥离 password、`UpdateDictValueSchema` 剥离 dictTypeId）
- 自定义正则或自定义工具函数（如 `isSensitiveHeaderKey`、`isAllowedNavigateUrl`）
- 后端 Service / Controller 的业务逻辑分支、边界条件、错误处理路径
- 前端 hook 的状态流转、副作用触发条件、边界条件

### 何时不需要写测试

以下场景的测试本质上是在验证框架自身能力，不提供有效的回归保护，不应编写：

- 纯字段映射的 Zod schema（`z.object({ field: z.string() })` 无自定义校验）
- 仅使用 Zod 内置验证器的场景（`z.email()`、`.min()`、`.max()`、`.default()`、`.optional()`、`.nullable()`、`z.enum()`）
- 仅验证必填字段缺失时被 Zod 拒绝
- 仅验证 Zod 默认 strip 未知字段的行为

一句话原则：**测你的业务约束，不要测框架能力。**

## 提交规范

使用 Conventional Commits 格式，描述使用中文：
`feat(web): 新增用户管理页面`、`fix(server): 修复 JWT 刷新逻辑`

## 日常开发

- 日常代码生成不强制运行 `pnpm typecheck` 和 `pnpm lint`，仅当用户明确要求时才运行
- 如果验证失败，必须修复后再输出，不允许交付带类型错误或 lint 错误的代码
- 当用户说"快速实现"或"不用管类型"时，可临时放宽类型检查，但仍遵守 Biome 格式

## 快速模式（Quick Mode）

- 当用户明确说"快速实现"、"快速模式"、"不用管类型"、"先跑通就行"等类似表述时，进入快速模式
- 快速模式下：
  - 跳过 TypeScript 严格类型检查规则（允许 `any`、隐式类型、`@ts-ignore` 等）
  - 跳过 ESLint `recommendedTypeChecked` 相关规则
  - 仍需保证代码语法正确、能正常运行
  - 仍需遵守 Biome 格式规范
  - 不需要运行 `pnpm typecheck` 和 `pnpm lint` 验证
- 快速模式仅限当前请求，下一次请求自动恢复为默认的严格模式

## Spec / Plan 工作流输出路径

- 使用 Spec 工作流时，所有产出文档（`spec.md`、`tasks.md`、`checklist.md`）必须放在 `docs/specs/<feature-name>/` 目录下，**禁止**写入 `.trae/specs/`
- 使用 Plan 工作流时，规划文档放在 `docs/plans/<feature-name>/` 目录下，**禁止**写入 `.trae/documents/`
- 子目录命名使用 kebab-case，与已有 `docs/specs/dataset-management/` 保持一致
- 产出文档纳入版本控制，作为项目知识资产长期保留
- 若内置流程仍将文件写到了 `.trae/` 下，需立即移动到上述 `docs/` 对应目录，并在原位置不留副本

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
