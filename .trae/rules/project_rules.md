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
- `prettier/prettier` 为 error 级别，代码格式必须符合 Prettier 配置
- 前端项目继承 `@nebula/eslint-config/react.js`，包含浏览器全局变量
- 后端项目继承 `@nebula/eslint-config/nestjs.js`

## 代码格式（Prettier）

- 单引号、分号结尾、2 空格缩进、行宽 100
- 尾随逗号 `all`、箭头函数参数始终加括号
- 生成代码前必须先读取项目现有 `.prettierrc` 配置

## 前端开发

- 框架：React 19 + Vite 8 + Tailwind CSS v4 + Radix UI + shadcn/ui + React Router 7
- 样式优先使用 Tailwind CSS 工具类，复杂交互组件使用 Radix UI + shadcn/ui
- 路径别名 `@/` 映射 `src/`，导入时使用别名路径
- 新增页面必须在 `src/router/index.tsx` 中注册路由
- 新增页面使用 `MainLayout` 布局，侧边栏菜单在 `MainLayout.tsx` 的 `menuItems` 中配置

## Monorepo 规范

- 项目使用 pnpm workspace + Turborepo 管理
- 共享类型放在 `packages/shared`，通过 `@nebula/shared` 引用
- 共享 TS 配置放在 `packages/typescript-config`，通过 `@nebula/typescript-config` 引用
- 共享 ESLint 配置放在 `packages/eslint-config`，通过 `@nebula/eslint-config` 引用
- 新增依赖时注意区分 dependencies 和 devDependencies

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
  - 仍需遵守 Prettier 格式规范
  - 不需要运行 `pnpm typecheck` 和 `pnpm lint` 验证
- 快速模式仅限当前请求，下一次请求自动恢复为默认的严格模式
