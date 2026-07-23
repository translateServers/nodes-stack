# Nebula 项目开发规则

## TypeScript 类型安全

- 项目已启用 `strict: true` + `strictNullChecks: true` + `noImplicitAny: true`，所有生成的代码必须通过类型检查，不允许产生 TS 编译错误
- 禁止使用 `@ts-ignore`、`@ts-nocheck`、`as any` 绕过类型检查
- 禁止使用隐式 `any`，所有函数参数和返回值必须明确声明类型
- 第三方库必须安装对应的 `@types/*` 类型声明包
- 异步操作必须正确处理 Promise，禁止浮动 Promise（对应 `@typescript-eslint/no-floating-promises`）
- 禁止不安全的类型断言和调用（对应 `@typescript-eslint/no-unsafe-argument`、`no-unsafe-call`）
- API 请求和响应必须使用 `@nebula/shared` 中定义的 `ApiResponse<T>`、`PaginatedResponse<T>` 等类型
- 组件 Props 必须定义独立的 interface 或 type，禁止内联对象类型
- 保留 TypeScript 6.0 新特性校验，禁止使用 `ignoreDeprecations: "6.0"` 忽略所有 6.0 相关弃用警告，必须从根源上解决（如使用 `paths` 替代 `baseUrl`）

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

## 前端开发

- 框架：React 19 + Vite 8 + Tailwind CSS v4 + Radix UI + shadcn/ui + TanStack Router
- 样式优先使用 Tailwind CSS 工具类，复杂交互组件使用 Radix UI + shadcn/ui
- 路径别名 `@/` 映射 `src/`，导入时使用别名路径
- 路由使用 TanStack Router 文件系统路由，新增页面在 `src/routes/` 下创建路由文件（如 `_app.<page>.tsx`），路由树自动生成（`routeTree.gen.ts`，已加入 Biome 忽略配置，禁止手动编辑）
- 需要鉴权的页面使用 `_app` 布局路由（`src/routes/_app.tsx`），其组件为 `AppLayout`（`src/components/layout/app-layout.tsx`）
- 侧边栏菜单在 `src/config/navigation.ts` 的 `menuGroups` 中配置，新增页面后需同步添加导航项

## Monorepo 规范

- 项目使用 pnpm workspace + Turborepo 管理
- 共享类型放在 `packages/shared`，通过 `@nebula/shared` 引用
- 共享 TS 配置放在 `packages/typescript-config`，通过 `@nebula/typescript-config` 引用
- 共享 ESLint 配置放在 `packages/eslint-config`，通过 `@nebula/eslint-config` 引用
- 新增依赖时注意区分 dependencies 和 devDependencies

## 单元测试

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

## 生成代码验证

- 类型检查（`pnpm typecheck`）和 ESLint 检查（`pnpm lint`）由专门的任务负责，日常代码生成不强制要求运行
- 仅当用户明确要求做校验时，才运行 `pnpm typecheck` 和 `pnpm lint` 验证
- 如果验证失败，必须修复后再输出，不允许交付带类型错误或 lint 错误的代码

## 快速模式（Quick Mode）

- 当用户明确说"快速实现"、"快速模式"、"不用管类型"、"先跑通就行"等类似表述时，进入快速模式
- 快速模式下：
  - 跳过 TypeScript 严格类型检查规则（允许 `any`、隐式类型、`@ts-ignore` 等）
  - 跳过 ESLint `recommendedTypeChecked` 相关规则
  - 仍需保证代码语法正确、能正常运行
  - 仍需遵守 Biome 格式规范
  - 不需要运行 `pnpm typecheck` 和 `pnpm lint` 验证
- 快速模式仅限当前请求，下一次请求自动恢复为默认的严格模式
