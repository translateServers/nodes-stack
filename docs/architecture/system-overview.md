# 系统总览

> 状态：生效中
> 最近更新：2026-07-24
> 定位：新人入职第一篇必读。读完应能回答"项目是什么、用什么技术、怎么跑起来、怎么动手"

## 1. 项目是什么

Nebula 是一个**大屏可视化设计器**平台，包含：

- **大屏设计器**（核心 feature）：拖拽式画布 + 组件库 + 属性面板 + 事件蓝图，类 GoView / Light Chaser 的低代码可视化大屏编辑器
- **后台管理系统**：用户/角色/菜单/字典的 RBAC 权限体系
- **公开预览**：已发布大屏的对外访问页

技术形态：前后端分离的 SPA + REST API，monorepo 管理。

## 2. Monorepo 结构

工具链：**pnpm 9.15.0 + Turborepo 2.3.0**。

```
nebula/
├── apps/
│   ├── web/                  前端 SPA（@nebula/web）
│   └── nestjs-server/        后端 API（@nebula/nestjs-server）
├── packages/
│   ├── shared/               前后端共享类型/Zod schema/错误（@nebula/shared）
│   ├── eslint-config/        共享 ESLint 配置（@nebula/eslint-config）
│   └── typescript-config/    共享 TS 配置预设（@nebula/typescript-config）
├── docs/                     项目文档（本目录）
├── .trae/                    AI agent 规则、skill、归档
├── turbo.json                Turborepo 任务管道
├── pnpm-workspace.yaml       workspace 声明
└── package.json              根级 scripts
```

### 包依赖关系

```
@nebula/web ──────┐
                  ├──→ @nebula/shared
@nebula/nestjs-server ─┘

@nebula/web ──────┬──→ @nebula/eslint-config
@nebula/nestjs-server ─┘
                  └──→ @nebula/typescript-config
```

`@nebula/shared` 是契约层，同时被前后端依赖，包含 Zod schema、BizCode、ApiResponse 类型。后端用 nestjs-zod 做 DTO 校验，前端用同一套 Zod schema 做响应运行时校验，**类型与契约端到端对齐**。

## 3. 技术栈速查

### 前端（@nebula/web）

| 类别 | 技术 | 版本 |
|---|---|---|
| UI 框架 | React | 19.1.0 |
| 构建 | Vite | 8.0.0 |
| 路由 | TanStack Router | 1.170（文件系统路由） |
| 数据请求 | TanStack Query | 5.59 |
| 状态管理 | Zustand | 5.0.14 |
| UI 组件库 | shadcn/ui + Radix UI | shadcn 4.11 / radix 1.5 |
| 样式 | Tailwind CSS | 4.0（Vite 插件方式） |
| 表单 | React Hook Form | 7.79 |
| 校验 | Zod | 4.4.3 |
| 图表 | ECharts | 6.1.0 |
| 流程图（蓝图） | @xyflow/react | 12.11 |
| 大屏交互 | react-moveable / react-selecto / @scena/react-ruler | — |
| 拖拽 | @dnd-kit | 6.3 |
| 快捷键 | react-hotkeys-hook | 5.3.3 |
| HTTP | axios | 1.17 |
| 测试 | Vitest + Testing Library + Playwright（E2E） | — |

### 后端（@nebula/nestjs-server）

| 类别 | 技术 | 版本 |
|---|---|---|
| 框架 | NestJS | 11.0.1 |
| ORM | Prisma | 7.8.0（多文件 schema 模式） |
| 数据库 | SQLite（开发）/ PostgreSQL（生产可选） | — |
| 参数校验 | nestjs-zod + Zod（**禁用 class-validator**） | — |
| 鉴权 | Passport + JWT + bcryptjs | — |
| 验证码 | svg-captcha | — |
| 缓存 | @nestjs/cache-manager + keyv | — |
| Redis | redis + @keyv/redis | — |
| 日志 | nest-winston + winston-daily-rotate-file | — |
| API 文档 | @nestjs/swagger + swagger-ui-express | — |
| 限流 | @nestjs/throttler | — |
| 测试 | Jest 30 + supertest | — |

### 工程化

| 类别 | 技术 |
|---|---|
| 包管理 | pnpm 9.15.0（packageManager 锁定） |
| 编排 | Turborepo 2.3.0 |
| TypeScript | 6.0.3（target ES2023，module NodeNext，strict） |
| 格式化 | Biome 2.5.1（格式 + 基础 lint + import 组织） |
| 类型感知 lint | ESLint 9 + typescript-eslint 8 |
| Git 钩子 | simple-git-hooks + lint-staged（pre-commit 跑 Biome） |

> **Node 版本**：无 `.nvmrc` 与 `engines` 声明，但 `@types/node ^24`，建议使用 **Node 24+**。

## 4. 前后端通信约定

### 统一响应格式

后端 `TransformInterceptor` 包装所有响应为：

```ts
{ code: number; data: T; message: string }
```

前端 `http.ts` 响应拦截器自动剥壳：检查 `code !== BizCode.SUCCESS` 抛错，否则返回 `payload.data`。

### BizCode 段位

| 段位 | 模块 |
|---|---|
| 0 | SUCCESS |
| 1xxx | 通用 |
| 10xxx | 认证 |
| 20xxx | 用户 |
| 30xxx | 菜单 |
| 40xxx | 角色 |
| 50xxx | 字典 |
| 60xxx | 文件 |
| 70xxx | 大屏 |

### 鉴权链路

```
登录 → JWT access token + refresh token（DB 存储可撤销）
  ↓
请求拦截器自动注入 Authorization: Bearer xxx
  ↓
401 → 单飞刷新队列（isRefreshing + pendingQueue）→ 重放原请求
  ↓
刷新失败 → clearAuth() + emitApiError 广播
```

`@Public()` 装饰器放行公开端点（如登录、预览页）。

## 5. 数据库模型

Prisma 多文件 schema（Prisma 7 特性）：根 `schema.prisma` 仅含 generator/datasource，业务模型拆到 `prisma/schema/*.prisma`。

7 个模型：

| 模型 | 表名 | 说明 |
|---|---|---|
| `User` | users | 用户，关联 Role + RefreshToken |
| `Role` | roles | 角色，关联 User + Menu |
| `Menu` | menus | 菜单树（自关联，MenuType: DIRECTORY/MENU/BUTTON） |
| `DictType` / `DictValue` | dict_types / dict_values | 字典类型与值（级联） |
| `File` | files | 通用附件（靠 rowId 软关联业务行，无外键） |
| `RefreshToken` | refresh_tokens | JWT refresh token（可撤销） |
| `ScreenProject` | screen_projects | 大屏项目（canvas/components/blueprint 均为 JSON 字符串） |

## 6. 前端路由结构

TanStack Router 文件系统路由，自动生成 `routeTree.gen.ts`（禁止手改）：

| 路径 | 说明 | 鉴权 |
|---|---|---|
| `/login` | 登录页 | 否 |
| `/_app/*` | 鉴权布局路由组，beforeLoad 校验 accessToken | 是 |
| `/` | 仪表盘 | 是 |
| `/users` / `/roles` / `/menus` / `/dict` | 系统管理 | 是 |
| `/screen` | 大屏项目列表 | 是 |
| `/screen/$id` | 大屏编辑器 | 是 |
| `/data-table-playground` | 表格演练场 | 是 |
| `/screen-preview/$id` | 大屏公开预览 | 否 |
| `/screen-editor-preview/$id` | 编辑器内预览 | 否 |

## 7. 常用命令

### 开发

```bash
pnpm install              # 安装依赖
pnpm dev                  # 同时启动前后端（Turbo 编排）
pnpm dev:web              # 仅前端（端口 5173）
pnpm dev:server           # 仅后端（端口 3000）
```

### 质量门禁

```bash
pnpm typecheck            # TypeScript 类型检查（全仓库）
pnpm lint                 # ESLint 类型感知规则
pnpm biome:check          # Biome 格式 + 基础 lint 检查
pnpm biome:fix            # Biome 自动修复
pnpm test                 # 全仓库单元测试
```

### 单包操作

```bash
pnpm --filter @nebula/web test -- --reporter=verbose <pattern>
pnpm --filter @nebula/nestjs-server test -- --testPathPattern=<name>
pnpm --filter @nebula/web e2e              # Playwright E2E
```

### 数据库

```bash
cd apps/nestjs-server
pnpm prisma migrate dev                   # 创建迁移
pnpm prisma generate                      # 生成 client
pnpm prisma studio                        # 可视化管理
```

> **Vite 代理**：前端 `/api` 请求代理到 `http://localhost:3000`，开发时无需处理跨域。

## 8. 代码质量三件套分工

```
日常开发
   ├─ Biome（格式 + 基础 lint + import 组织）── pre-commit 自动触发
   │     └─ simple-git-hooks + lint-staged（仅暂存文件）
   ├─ ESLint 9 + typescript-eslint（类型感知规则）── pnpm lint 手动触发
   └─ TypeScript 6 strict ── pnpm typecheck 手动触发
```

**关键原则**：Biome 通过 ≠ 质量过关。提交前必须确保 `pnpm typecheck` 与 `pnpm lint` 通过。

详见 [conventions/coding-standards.md](../conventions/coding-standards.md)。

## 9. 新人上手路径

1. **读本文件**：理解项目全貌
2. **读 [coding-standards.md](../conventions/coding-standards.md)**：了解编码约定（编码前必读）
3. **读 [screen-editor-architecture.md](./screen-editor-architecture.md)**：理解核心 feature 架构
4. **读 [blueprint-runtime-architecture.md](./blueprint-runtime-architecture.md)**：理解事件蓝图系统
5. **跑起来**：`pnpm install && pnpm dev`
6. **动手第一个任务**：参考 [development-guide.md](./development-guide.md) 的"新增大屏组件"指南

## 10. 关联文档

| 文档 | 说明 |
|---|---|
| [coding-standards.md](../conventions/coding-standards.md) | 编码规范（编码前必读） |
| [screen-editor-architecture.md](./screen-editor-architecture.md) | 大屏设计器架构 |
| [blueprint-runtime-architecture.md](./blueprint-runtime-architecture.md) | 蓝图运行时架构 |
| [development-guide.md](./development-guide.md) | 开发指南（新增组件/模块/API） |
| `AGENTS.md` | AI agent 指导，含项目结构与常用命令 |
| `.trae/rules/project_rules.md` | AI 专用开发规则 |
