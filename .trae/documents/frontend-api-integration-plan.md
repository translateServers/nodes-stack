# 前端接口方案（Nebula Web ↔ NestJS Server）

> 目标：在充分掌握后端服务（NestJS 11 + Prisma 7 + JWT + Zod 校验）的基础上，建立一套与后端 **1:1 对齐、可实施、可演进** 的前端接口方案。
> 覆盖范围：Auth / User / Health（已实现）+ Menu / Role / Dict（Prisma 已建模、Controller 待补齐，预留设计）。
> 技术选型：**共享包 + Zod 双向校验**、**集成 React Query**、**axios 拦截器层 + TanStack Query 缓存层** 分层协作。

---

## 1. 后端核心能力清单（探索确认）

| 维度 | 内容 |
| --- | --- |
| 框架 | NestJS 11（模块化：Auth / User / Health / Cache / Logger / Prisma） |
| 数据库 | Prisma 7 + SQLite（better-sqlite3 适配器） |
| 模型 | `User`、`Role`、`Menu`、`RefreshToken`、`DictType`、`DictValue` |
| 鉴权 | JWT 双令牌（access 15m / refresh 7d，SHA-256 哈希入库，轮换机制） |
| 校验 | 全局 `ZodValidationPipe`（`nestjs-zod`），DTO 由 `createZodDto` 生成 |
| 统一响应 | 成功：`{ code, data?, message }`（`data` 为 `undefined/null` 时省略字段）<br>错误：`{ code, message, details? }`，HTTP 状态由 `getHttpStatus(bizCode)` 映射 |
| 业务码 | `BizCode`：0 成功 / 1xxx 通用 / 10xxx 认证 / 20xxx 用户 / 30xxx 菜单 / 40xxx 角色 / 50xxx 字典 |
| API 前缀 | `/api/v1`（可通过 `API_PREFIX` 调整） |
| 限流 | 全局：3/1s、20/10s、100/60s；登录 5/分钟；验证码 10/分钟；Health 跳过 |
| 已有接口 | `GET /auth/captcha`、`POST /auth/register`、`POST /auth/login`、`POST /auth/refresh`、`POST /auth/logout`、`GET /auth/profile`；`POST /users`、`GET /users`、`GET /users/:id`、`PATCH /users/:id`、`DELETE /users/:id`；`GET /health`、`GET /health/ping` |
| 文档 | Swagger 位于 `/${apiPrefix}/docs`，`enableSwagger` 可关闭 |

---

## 2. 前端现状与差距

| 现状 | 差距 |
| --- | --- |
| `apps/web/src/api/types.ts` 自维护 `BizCode`，与后端枚举值不一致 | 需以 `@nebula/shared` 为唯一来源 |
| `ApiResponse<T>` 包含 `timestamp` 字段 | 后端实际不返回，需移除并定义对齐 |
| `ApiResponse.data` 标注为必填 | 实际后端会省略 `data`（如退出登录），需改为可选 |
| `apps/web/src/api/http.ts` 在刷新令牌分支直接 `axios.post('/api/auth/refresh', ...)`，绕过 `http` 实例的 baseURL/拦截器 | 必须统一走 `http` 实例或剥离拦截器的请求体 |
| 无请求取消、Zod 运行时校验、类型化错误 | 需新增 |
| `pendingQueue` 中 token 为空串仍会重试 | 需在 refresh 失败时直接拒绝队列并清空 |
| 仅有 Auth / User 域 API；无 Menu/Role/Dict/Health 客户端 | 需按域补齐 + 预留未实现模块类型 |
| 直接 `await http.get(...)` 风格，无缓存、无 loading 统一管理 | 需 React Query 集成 |
| 已有 `MainLayout` 与 `Login` 占位页 | 需补齐路由守卫与错误兜底 |

---

## 3. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│  Pages (React 19 + MUI 9 + Tailwind 4)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ hooks
┌──────────────────────────▼──────────────────────────────────┐
│  React Query 缓存层  (@tanstack/react-query v5)              │
│  - useQuery / useMutation / QueryClient 全局错误处理         │
└──────────────────────────┬──────────────────────────────────┘
                           │ 调用
┌──────────────────────────▼──────────────────────────────────┐
│  API 模块 (apps/web/src/api/*)                               │
│  auth / user / menu / role / dict / health  领域函数        │
│  入参出参全部基于 @nebula/shared Zod Schema                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch
┌──────────────────────────▼──────────────────────────────────┐
│  axios http 实例 (apps/web/src/api/http.ts)                 │
│  - 请求拦截：注入 Bearer                                     │
│  - 响应拦截：401 自动刷新（基于共享 refresh 函数）            │
│  - 业务码非 0 → throw BusinessError                          │
│  - Zod 二次校验 data（运行时保障）                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ /api/v1/*  (Vite proxy → :3001)
┌──────────────────────────▼──────────────────────────────────┐
│  NestJS Server (apps/nestjs-server)                          │
└─────────────────────────────────────────────────────────────┘

共享类型源 (packages/shared)：
  - BizCode 枚举 / 业务错误 / 通用响应 / 通用分页
  - 业务领域 Zod Schema（Auth/User/Menu/Role/Dict）
  - 时间格式化工具（YYYY-MM-DD HH:mm:ss 解析与序列化）
```

---

## 4. 实施步骤

### 阶段 1：共享包重构（`packages/shared/src`）

**目标**：让 `@nebula/shared` 成为前后端单一类型源；修复现有 `api.types.ts` 的不一致。

#### 1.1 调整 `packages/shared/package.json`
- 增加 `zod` 依赖（与后端统一版本 `^4.4.3`）
- `exports` 拆分：`./types`、`./schemas`、`./errors`、`./utils`
- 维持 `tsdown` 构建产物 CJS/ESM/DTS 三套

#### 1.2 重写 `src/types/api.types.ts`
- 移除 `timestamp` 字段
- `ApiResponse<T>` 改为：
  ```ts
  export interface ApiResponse<T = unknown> {
    code: number;
    data?: T;
    message: string;
  }
  export interface ApiErrorResponse {
    code: number;
    message: string;
    details?: string[];
  }
  ```
- `PaginationQuery` / `PaginatedResponse<T>` 保留（与后端约定一致即可）
- `BizCode` 枚举以 `Record<string, number>` 形式重新导出（**严格对齐后端**），并暴露 `type BizCodeValue`

#### 1.3 新增 `src/schemas/`（Zod）
- `auth.schema.ts`：`LoginSchema`、`RegisterSchema`、`RefreshTokenSchema`、`TokenResponseSchema`、`CaptchaResponseSchema`、`ProfileResponseSchema`（**与后端 `apps/nestjs-server/src/modules/auth/dto/auth.dto.ts` 字段、`.describe()` 1:1**）
- `user.schema.ts`：`CreateUserSchema`、`UpdateUserSchema`、`UserResponseSchema`
- `menu.schema.ts`（预留）：`MenuTypeSchema`、`CreateMenuSchema`、`UpdateMenuSchema`、`MenuResponseSchema`、`MenuTreeNodeSchema`
- `role.schema.ts`（预留）：`CreateRoleSchema`、`UpdateRoleSchema`、`RoleResponseSchema`、`AssignMenusSchema`
- `dict.schema.ts`（预留）：`DictTypeSchema`、`DictValueSchema`、`DictTypeWithValuesSchema`
- `datetime.schema.ts`：与后端 `DateTimeStringSchema` 同步，导出 `parseDateTime` / `formatDateTime`
- `paginated.schema.ts`：分页参数与响应 schema

> **关键约束**：每个 Schema 必须导出 `export type Xxx = z.infer<typeof XxxSchema>`，与 `createZodDto` 生成的 DTO 等价。

#### 1.4 新增 `src/errors/`
- `BusinessError` 类（迁移前端 `http.ts` 中的定义到共享包）
- `isBusinessError(err): err is BusinessError` 守卫
- `getBizMessage(code, fallback?)` 工具（前端可在此处维护一份与后端 `BizMessage` 等价的本地化表，便于无后端上下文时显示）

#### 1.5 新增 `src/utils/`
- `datetime.ts`：`formatDateTime(value: string | Date)`、`parseDateTime(value: string): Date`，约定格式 `YYYY-MM-DD HH:mm:ss`
- `http.ts`（仅类型，不重复实例）：导出 `HttpMethod`、`RequestConfig<TBody>` 扩展

#### 1.6 调整 `src/index.ts` 统一出口
- 分组：`export * as Biz from './types/api.types'`、`export * as AuthSchemas from './schemas/auth.schema'` …

**验收**：`pnpm --filter @nebula/shared build` 通过，产物包含 `dist/types`、`dist/schemas`、`dist/errors`、`dist/utils`。

---

### 阶段 2：HTTP 客户端升级（`apps/web/src/api`）

**目标**：修复现有 `http.ts` 的刷新令牌、拦截器绕行等隐患；统一基于共享包。

#### 2.1 改造 `http.ts`
- 删除本地 `BusinessError` 定义，改为从 `@nebula/shared` 导入
- 删除本地 `BizCode` 定义，改为从 `@nebula/shared` 导入
- 删除本地 token 读写工具，改为从共享包导入（如 `apps/web/src/api/token.ts` 集中管理）
- 401 刷新令牌分支：改用本文件导出的 `refreshToken` 封装（构造一个 **关闭拦截器** 的 axios 实例，路径 `/auth/refresh`，避免 401 递归触发刷新）
- 失败时统一 `processPendingQueue(error, null)` 拒绝队列
- 响应拦截：成功响应增加 `safeParse(data, responseSchema)` 进行 Zod 二次校验（按 `config.url` 映射 schema；未配置时不校验）
- 网络错误（`!response`）抛 `BusinessError(-1, error.message || '网络异常')`

#### 2.2 新增 `token.ts`
- `ACCESS_TOKEN_KEY = 'nebula_access_token'`、`REFRESH_TOKEN_KEY = 'nebula_refresh_token'`
- `getAccessToken` / `setAccessToken` / `getRefreshToken` / `setRefreshToken` / `clearTokens`
- 监听 `storage` 事件实现多标签页同步登出（可选，先实现单标签）

#### 2.3 新增 `endpoints.ts`（集中路径常量）
- `API_PREFIX = '/api'`（与 Vite proxy 配合）
- `AUTH = { captcha: '/auth/captcha', login: '/auth/login', … }`
- `USERS = '/users'`、`HEALTH = '/health'`
- 预留 `MENU / ROLE / DICT` 常量

#### 2.4 新增 `health.ts`（健康检查客户端）
- `checkHealth()`：返回 `{ status, timestamp, uptime, database }`
- `ping()`：返回 `{ message }`

#### 2.5 重写 `auth.ts`、`user.ts`
- 所有入参出参从 `@nebula/shared` 的 Schema 推导：
  ```ts
  import { z } from 'zod';
  import { AuthSchemas } from '@nebula/shared';
  type LoginParams = z.infer<typeof AuthSchemas.LoginSchema>;
  ```
- 函数签名显式标注返回类型 `<T extends ZodTypeAny>(res: unknown, schema: T): z.infer<T>` 模式由 `http.ts` 自动校验，API 模块无需再断言

#### 2.6 新增预留模块（**类型与路径已就绪**，调用后端未实现的接口时由 React Query 自然失败）
- `menu.ts`：树形查询、按角色查询、CRUD（含 `parentId`）
- `role.ts`：CRUD、分配菜单、分配用户
- `dict.ts`：类型 CRUD、值 CRUD、按 `code` 查询整组

> **说明**：这些文件可以**先创建并按 Prisma schema 与既有的 Zod 约定编写**，不依赖后端 Controller 存在；后端补齐时仅需保证响应字段一致即可。

---

### 阶段 3：集成 React Query

**目标**：统一 loading / error / cache / retry / invalidate。

#### 3.1 安装依赖
- `apps/web/package.json` 新增 `"@tanstack/react-query": "^5.59.0"`、`"@tanstack/react-query-devtools": "^5.59.0"`（dev）

#### 3.2 `apps/web/src/main.tsx` 注入 `QueryClientProvider`
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isBusinessError(error) && error.code === Biz.UNAUTHORIZED) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
```
全局 `QueryCache` / `MutationCache` 捕获 `BusinessError` 并 dispatch 一个 toast 事件（自定义事件总线或 Context）。

#### 3.3 编写 `apps/web/src/api/hooks/` 目录
- `useLogin` / `useRegister` / `useLogout`（mutation，成功后设置 token、失效 `['profile']`）
- `useProfile`（query，启用条件：`!!getAccessToken()`）
- `useUsers` / `useUser` / `useCreateUser` / `useUpdateUser` / `useDeleteUser`
- `useHealth`（query，每 30s 轮询）
- 预留：`useMenus` / `useRoles` / `useDictTypes` / `useDictValues`

#### 3.4 错误兜底
- `useApiError` Hook：返回 `{ showError, showWarning }` 函数，订阅全局 QueryCache
- 与 MUI `Snackbar` 集成（在 `MainLayout` 顶部挂载一次）

---

### 阶段 4：路由与权限

**目标**：与后端 `JwtAuthGuard` 配合，登录态持久化、未授权自动跳转。

#### 4.1 `apps/web/src/router/index.tsx` 重构
- `loader` 或组件级判断：未登录访问受保护路由 → `redirect('/login')`
- 增加 `/users`、`/menus`（预留）、`/roles`（预留）、`/dict`（预留）路由
- 路由 `meta` 字段保存 `requiresAuth: boolean` 与可选 `roles: string[]`

#### 4.2 新增 `RequireAuth` 组件
- 包装 `Outlet`，检查 `getAccessToken()`；为空则 `navigate('/login', { replace: true })`

#### 4.3 `MainLayout` 顶部用户菜单
- 展示 `useProfile().data?.username`
- 退出按钮 → `useLogout()` + `clearTokens()` + `navigate('/login')`

#### 4.4 `Login` 页面重写
- 表单：账号、密码、验证码（图片 `captchaImage` 渲染为内联 SVG）
- 提交：调用 `useLogin()` mutation，成功 → 存 token + `queryClient.setQueryData(['profile'], user)` + `navigate('/')`
- 失败 → 由全局 `Snackbar` 提示 `message`

---

### 阶段 5：API 文档与开发体验

- 启用 Vite proxy `/api → http://localhost:3001`（已存在，确认 `VITE_API_BASE_URL` 可覆盖）
- 引入 `import.meta.env.VITE_API_BASE_URL` 读取，dev 默认 `''`（走代理），prod 走环境变量
- 在 `Login` 页或 `MainLayout` 抽屉底部添加 "API 文档" 链接（`/api/v1/docs`）

---

## 5. 关键文件改动清单

| 路径 | 动作 | 关键内容 |
| --- | --- | --- |
| `packages/shared/package.json` | 改 | 增 `zod`、拆分 `exports` |
| `packages/shared/src/types/api.types.ts` | 改 | 移除 `timestamp`、`data?` 可选、BizCode 重写 |
| `packages/shared/src/schemas/*.ts` | 新增 | auth/user/menu/role/dict/paginated/datetime 全部 Zod Schema |
| `packages/shared/src/errors/index.ts` | 新增 | `BusinessError`、`isBusinessError`、`getBizMessage` |
| `packages/shared/src/utils/datetime.ts` | 新增 | `formatDateTime` / `parseDateTime` |
| `packages/shared/src/index.ts` | 改 | 重新聚合导出 |
| `apps/web/src/api/http.ts` | 改 | 修复 401 刷新走裸 axios、Zod 二次校验 |
| `apps/web/src/api/token.ts` | 新增 | token 集中管理 |
| `apps/web/src/api/endpoints.ts` | 新增 | 路径常量 |
| `apps/web/src/api/types.ts` | 删除 | 改为从共享包导入 |
| `apps/web/src/api/auth.ts` | 改 | 类型从共享包推导 |
| `apps/web/src/api/user.ts` | 改 | 同上 |
| `apps/web/src/api/menu.ts` | 新增 | 预留实现 |
| `apps/web/src/api/role.ts` | 新增 | 预留实现 |
| `apps/web/src/api/dict.ts` | 新增 | 预留实现 |
| `apps/web/src/api/health.ts` | 新增 | 健康检查 |
| `apps/web/src/api/hooks/*.ts` | 新增 | React Query hooks |
| `apps/web/src/api/index.ts` | 改 | 重新聚合导出 |
| `apps/web/src/main.tsx` | 改 | 注入 `QueryClientProvider` |
| `apps/web/src/router/index.tsx` | 改 | 增加路由守卫、扩展路由 |
| `apps/web/src/components/RequireAuth.tsx` | 新增 | 鉴权守卫 |
| `apps/web/src/components/ApiErrorSnackbar.tsx` | 新增 | 全局错误提示 |
| `apps/web/src/pages/Login.tsx` | 改 | 接入 `useLogin`、验证码图片渲染 |
| `apps/web/src/pages/Users.tsx` | 新增 | 用户管理示例页（验证端到端） |
| `apps/web/src/pages/Dashboard.tsx` | 改 | 接入 `useHealth`、展示 `useProfile` |
| `apps/web/src/layouts/MainLayout.tsx` | 改 | 顶部用户菜单 + 错误提示挂载 |
| `apps/web/package.json` | 改 | 新增 `@tanstack/react-query` |

---

## 6. 与后端兼容性与版本控制策略

1. **路径版本**：保持 `/api/v1` 不变；后端若引入 v2 改为 `/api/v2`，前端通过 `VITE_API_BASE_URL` 切换，避免破坏性升级。
2. **业务码稳定**：新增模块必须沿用 `BizCode` 分段（30xxx/40xxx/50xxx）；前端 `@nebula/shared` 同步更新。
3. **响应体兼容**：响应新增字段不影响前端（Zod 默认剥离未知 key 行为可通过 `.strict()` 显式开启，但默认 `passthrough` 利于演进）。
4. **错误格式**：保持 `{ code, message, details? }`，HTTP 状态码由 `getHttpStatus(bizCode)` 决定；前端 **以 `code` 为主、HTTP 状态为辅** 处理业务。
5. **时间格式**：所有时间字段统一为 `YYYY-MM-DD HH:mm:ss` 字符串；前端通过 `formatDateTime` 工具转换。
6. **限流退避**：登录/验证码触发 1002 之外的限流 HTTP 429 时，前端按 `details[0]` 或 `message` 提示用户等待。
7. **预留模块失败**：当前端调用 Menu/Role/Dict 接口但后端未实现时，HTTP 404 → `BizCode.NOT_FOUND`；前端在 `QueryClient` 监听器中静默或提示「该功能未上线」。

---

## 7. 假设与决策

- **不引入 Orval / OpenAPI 代码生成**：因 Swagger 与 Zod Schema 已对齐、且后端无独立 OpenAPI 导出；Zod 双向校验已能满足类型同步。
- **不引入 Zustand / Redux**：当前状态以 React Query 缓存 + 少量本地 `useState` 足够；如未来出现大量跨页状态再考虑。
- **不使用 Formik / React Hook Form**：现阶段 Login 用受控组件 + Zod 手动校验；如表单增多再评估。
- **不启用 MSW Mock**：开发期直接通过 Vite proxy 连接后端 dev 服务，行为更真实。
- **预留模块的 Zod Schema 与后端 Controller 解耦**：当后端补齐 Controller 时，仅需对齐字段；如出现差异以「前端先适配、后端再修正」流程处理。
- **Token 存储**：使用 `localStorage`（当前实现），后续可平滑切换到 `httpOnly Cookie`，仅需修改 `token.ts`。

---

## 8. 验证步骤

1. **静态校验**
   - `pnpm --filter @nebula/shared build`
   - `pnpm typecheck`（根）
   - `pnpm lint`（根）
   - 必须 0 error、warning 数与基线持平
2. **开发态联调**
   - 启动 `pnpm dev`，三服务（TUI）应同时运行
   - 浏览器访问 `http://localhost:3000`，完成登录 → 仪表盘 → 退出
3. **业务码断言**
   - 故意触发 10001（错误密码）→ UI 应展示 `凭证无效（邮箱或密码错误）`
   - 故意触发 1002（未登录访问 /users）→ 自动跳登录
4. **健康检查**
   - Dashboard 周期 30s 展示 `useHealth` 数据，停止后端 → `database` 变为 `disconnected`
5. **限流验证**
   - 1 分钟内连续 6 次错误登录 → 第 6 次应触发限流提示
6. **预留模块**
   - 访问 `/menus`、`/roles`、`/dict` 路由 → 应展示「该功能未上线」占位（不崩溃）

---

## 9. 风险与回滚

| 风险 | 缓解 |
| --- | --- |
| 共享包导出结构调整导致 apps/web 编译失败 | 一次性提交 + 在 `index.ts` 保留旧路径别名导出 |
| Zod 二次校验在数据量大时影响性能 | 仅对响应 ≤ 1MB 的接口启用，列表/导出类接口关闭 |
| React Query 与现有 `http.ts` 拦截器冲突 | `http.ts` 抛 `BusinessError` 后，React Query 通过 `error` prop 暴露，不做 toast 自动弹，由独立 `ApiErrorSnackbar` 订阅全局事件 |
| Menu/Role/Dict 预留接口与未来 Controller 字段不一致 | 预留 Schema 在 `packages/shared/src/schemas/*` 中以 **增量 PR** 方式更新，并配套 repowiki 文档 |

---

## 10. 后续可选增强（不在本次范围内）

- 引入 [Orval](https://orval.dev/) 或 [openapi-typescript](https://openapi-ts.dev/) 自动从后端 Swagger 生成前端类型
- 增加请求级 `AbortController` 与 `useEffect` 清理
- 接入 Sentry / 阿里云 ARMS 做前端错误监控
- 字典 / 菜单数据通过 `QueryClient.prefetchQuery` 在登录后预热
- i18n 化错误消息（结合 `getBizMessage` 扩展）
