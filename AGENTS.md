# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## 项目结构

pnpm workspace + Turborepo 全栈 monorepo：

- `apps/nestjs-server/` — NestJS 11 后端 API（Prisma 7 + SQLite/PostgreSQL + Redis）
- `apps/web/` — React 19 + Vite 8 前端 SPA（React Router 7 + TanStack Query + shadcn/ui + Tailwind CSS v4）
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
pnpm format           # Biome 格式化所有文件
pnpm biome:check      # Biome 检查
pnpm biome:fix        # Biome 安全自动修复
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
- React Router 7 使用文件系统路由，路由树自动生成（`routeTree.gen.ts`，已加入 Biome 忽略配置）
- UI 组件优先使用 shadcn/ui + Radix UI + Tailwind CSS 工具类

## 测试

- 后端：Jest 30（`*.spec.ts`），覆盖率阈值 80%（branches/functions/lines/statements）
- 前端：Vitest 4（`src/**/*.test.{ts,tsx}`），jsdom 环境
- shared 包：Vitest 4（`src/**/*.test.ts`）
- 运行单个后端测试：`pnpm --filter @nebula/nestjs-server test -- --testPathPattern=<name>`
- 运行单个前端测试：`pnpm --filter @nebula/web test -- --reporter=verbose <name>`

## 提交规范

使用 Conventional Commits 格式，描述使用中文：
`feat(web): 新增用户管理页面`、`fix(server): 修复 JWT 刷新逻辑`

## 日常开发

- 日常代码生成不强制运行 `pnpm typecheck` 和 `pnpm lint`，仅当用户明确要求时才运行
- 如果验证失败，必须修复后再输出
- 当用户说"快速实现"或"不用管类型"时，可临时放宽类型检查，但仍遵守 Biome 格式
