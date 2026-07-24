# 编码规范

> 状态：生效中
> 最近更新：2026-07-24
> 定位：所有开发者编码前必读。涵盖代码风格、技术选型边界、命名约定、测试约定

## 1. 代码质量三件套

```
日常开发
   ├─ Biome（格式 + 基础 lint + import 组织）── pre-commit 自动触发
   │     └─ simple-git-hooks + lint-staged（仅暂存文件）
   ├─ ESLint 9 + typescript-eslint（类型感知规则）── pnpm lint 手动触发
   └─ TypeScript 6 strict ── pnpm typecheck 手动触发
```

### 1.1 分工原则

- **Biome**：格式化、基础 lint、import 组织。**唯一负责格式化的工具**，ESLint 不启用 `prettier/prettier` 规则
- **ESLint**：TypeScript 类型感知规则（`no-floating-promises` / `no-unsafe-member-access` / `no-misused-promises` / `no-base-to-string` / `no-unsafe-argument` / `no-unsafe-call`）
- **TypeScript**：strict 模式类型检查

### 1.2 关键原则

> **Biome 通过 ≠ 质量过关**。提交前必须确保 `pnpm typecheck` 与 `pnpm lint` 通过。

### 1.3 Biome 配置要点

- 单引号、分号结尾、2 空格缩进、行宽 100、尾随逗号 `all`
- 箭头函数参数始终加括号
- `unsafeParameterDecoratorsEnabled: true`（支持 NestJS 装饰器参数）
- `css.parser.tailwindDirectives: true`

### 1.4 禁止项

- `@ts-ignore` / `@ts-nocheck`
- `as any`、隐式 `any`
- `ignoreDeprecations: "6.0"`（必须用 `paths` 替代 `baseUrl`）

## 2. TypeScript 配置

### 2.1 预设体系

`@nebula/typescript-config` 提供三套预设：

| 预设 | 适用 | 特性 |
|---|---|---|
| `base.json` | 所有包 | target ES2023 / module NodeNext / strict / strictNullChecks / noImplicitAny |
| `nestjs.json` | 后端 | 继承 base + experimentalDecorators + emitDecoratorMetadata + types `["node","jest"]` |
| `react.json` | 前端 | 继承 base + lib `["ES2023","DOM","DOM.Iterable"]` + jsx react-jsx + noEmit |

### 2.2 路径别名

| 包 | 别名 |
|---|---|
| 前端 | `@` → `./src` |
| 后端 | `@/` → `src/`、`@modules/`、`@common/`、`@config/` |

## 3. UI 组件选型边界

> 这是最容易踩坑的规范，务必区分清楚。

### 3.1 编辑器外壳 — 必须用 shadcn/ui

**范围**：toolbar、panels、forms、dialogs、dropdown menu、context menu、状态栏、工具选择器等编辑器壳层 UI。

**为什么**：主题一致性、可访问性（ARIA）、与 Radix 生态集成。

### 3.2 Canvas 渲染组件 — 禁止用 shadcn/ui

**范围**：用户可配置的大屏组件（text / bar-chart / rect / ellipse / image 等），即 `registry/components/` 下的 renderer。

**为什么**：大屏组件的样式由用户数据驱动，shadcn/ui 会注入 CSS 变量与类名，与用户自定义样式冲突。

### 3.3 判断方法

| 场景 | 用什么 |
|---|---|
| 组件在编辑器界面里（工具栏/面板/对话框） | shadcn/ui |
| 组件会被渲染到大屏画布上 | 原生 HTML/SVG + 内联样式 |
| 不确定 | 问自己"用户能否配置它的样式" → 能 → 不用 shadcn |

## 4. React Flow 约定

### 4.1 Handle ID

- **目标 Handle 必须有 `id="in"`**，与模板生成的 edges（`targetHandle: 'in'`）匹配
- 不写 id 会导致边无法连接

### 4.2 样式导入

`@xyflow/react/dist/style.css` 必须在使用 React Flow 的文件中导入（如 `blueprint-sheet.tsx`），否则节点/边/Handle 渲染异常（黑块）。

## 5. 数据层约定

### 5.1 判别联合模式

`DataSourceConfig` 使用 `z.discriminatedUnion('type', [...])`：

```ts
type DataSourceConfig =
  | { type: 'static'; staticData; ... }
  | { type: 'api'; apiConfig; ... }
```

**新增数据源类型**：添加新分支，不修改既有分支。

### 5.2 类型切换保留配置

切到新类型时，旧配置保留为 optional，便于回切。例：从 `api` 切到 `static`，`apiConfig` 字段保留在对象上（标记 optional），切回时恢复。

### 5.3 四层分层

组件配置分为四层，互不耦合：

| 层 | 字段 | 职责 |
|---|---|---|
| 数据层 | `dataSource` | 数据来源（static/api） |
| 逻辑层 | `logic` | 排序/限制 |
| 视觉层 | `props` + `style` | 外观 |
| 交互层 | `interaction` | 行为（tooltipOnHover 等） |

### 5.4 数据解析管线

`chart-data-parser.ts` 是纯函数管线，4 步：

1. `extractDataByPath` — 点分路径提取
2. `mapFieldsToChartData` — 字段映射 + 类型校验
3. `applyLogicConfig` — 排序 + 限制
4. `parseChartData` — 统一入口，返回判别联合 `ParseResult`

`ParseResult` 错误信息**面向用户可读**，不泄露原始数据全文。

## 6. 状态管理约定

### 6.1 Zustand 使用

- 编辑器状态用 Zustand（`editor-store.ts`），devtools middleware
- 开发模式下通过 `window.__screenEditorStore` 暴露给 Playwright E2E
- 高频更新（如拖拽过程中的尺寸提示）剥离到独立 store（`useDimensionStore`），避免触发整个画布重渲染

### 6.2 历史栈

- 历史栈快照包含 `components + canvas + blueprint` 三者，共享同一时间线
- 容量上限 50
- 高频操作（如蓝图节点拖拽）用手势模式合并为一次历史提交：
  - `beginGesture` 记录 baseline，期间更新不入栈
  - `endGesture` 有净变化时补一条历史（快照取 baseline）

### 6.3 不可变更新

属性面板字段写入用 `buildNestedUpdate` 构造不可变嵌套 partial，交给 store shallow merge：

```ts
buildNestedUpdate(source, 'position.x', 100)
// → { position: { ...source.position, x: 100 } }
```

## 7. 工具系统约定

### 7.1 所有权边界

| 注册表 | 拥有 | 不拥有 |
|---|---|---|
| `TOOL_REGISTRY` | 工具 ID/名称/图标/shortcutId/cursor/capabilities/implemented | 实际键位 |
| `SHORTCUTS_REGISTRY` | 实际键位/scope/preventDefault/browserConflict | 工具能力 |

两者通过 `shortcutId` 建立唯一引用，避免键位重复。

### 7.2 能力驱动

Moveable/Selecto 的启用状态完全由 `TOOL_REGISTRY` 的 capabilities 派生，**不要直接硬编码** `moveableDraggable = true`。

### 7.3 工具切换必须清理交互状态

切换工具时必须派发 `cancel` 让交互状态机恢复 idle，否则 Selecto 会因非 idle 状态阻塞 `onDragStart`。

用 `setToolWithCleanup`，不要直接调 `setTool`。

### 7.4 快捷键防冲突

- `browserConflict='overridable'` 必须搭配 `preventDefault='always'` 或 `'callback-only'`
- `browserConflict='reserved'` 不应注册（如 Ctrl+N/W/T）
- DEV 环境 `validateRegistry` 自动校验，必须修复警告

### 7.5 临时工具栈

- 按住临时切工具（如 Space → hand）用 `pushTemporaryTool` / `popTemporaryTool`
- `pushTemporaryTool` 幂等：栈顶相同或栈中已存在则不压入
- window blur 时 `clearTemporaryTools`（防止用户按住 Space 切应用后 activeTool 卡在 hand）

## 8. 画布交互约定

### 8.1 Canvas Drag Optimization

- 组件定位用 `transform: translate()`，**不用** `left/top`（GPU 合成层避免布局重排）
- store 层 `position.x/y` 语义不变，由 `resolveComponentContainerStyle` 转 transform
- 拖拽用 `e.beforeTranslate` 替代 DOM 回读（无精度损失）
- 用 `composeComponentTransform` 合并 transform 链，**不要**字符串拼接

### 8.2 rAF 节流

高频回调（onDrag/onResize）用 `createRafThrottler` 节流：

- DOM style 写入同步执行（避免与 Moveable 内部 flushSync 错开一帧抖动）
- store 更新与 Smart Guides 计算走 rAF
- 手势结束 `cancel()` 丢弃挂起任务

### 8.3 模块级常量

`SNAP_DIRECTIONS / ELEMENT_SNAP_DIRECTIONS / RENDER_DIRECTIONS` 等配置必须定义为模块级常量，**不要**在组件内创建新引用，否则会触发 Moveable 内部重算。

### 8.4 状态机恢复

所有 onDragEnd/onResizeEnd/onRotateEnd **无条件** `dispatchInteraction('pointer-up')`，修复纯点击零位移时漏发导致状态卡死。

### 8.5 Moveable dragStart 守卫

`setTimeout(() => moveableRef.current?.dragStart(...), 0)` 必须用 `activeToolRef` + `interactionStateRef` 守卫，防止工具切换后触发导致 Moveable 进入异常 dragging 状态。

## 9. 后端编码约定

### 9.1 校验方案

- **统一用 Zod + nestjs-zod**，**禁用 class-validator**
- DTO 用 Zod schema 定义，通过 `@nestjs-zod/zod` 装饰器注入
- Swagger 文档经 `cleanupOpenApiDoc` 清理

### 9.2 响应格式

后端 `TransformInterceptor` 自动包装为：

```ts
{ code: number; data: T; message: string }
```

**不要**手动包装响应，直接返回 `data`。

### 9.3 鉴权

- 全局 `JwtAuthGuard` + `@Public()` 装饰器放行公开端点
- 密码用 `bcryptjs` 哈希
- RefreshToken 存 DB 可撤销

### 9.4 模块结构

```
modules/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── dto/                    Zod schema 定义
└── __tests__/
```

### 9.5 BizCode 段位

新增业务错误码时，在 `@nebula/shared` 的 `BizCode` 与 `BizMessage` 中同步添加，段位按模块分配：

| 段位 | 模块 |
|---|---|
| 1xxx | 通用 |
| 10xxx | 认证 |
| 20xxx | 用户 |
| 30xxx | 菜单 |
| 40xxx | 角色 |
| 50xxx | 字典 |
| 60xxx | 文件 |
| 70xxx | 大屏 |

## 10. 前端 API 客户端约定

### 10.1 端点配置

`api/core/endpoints.ts` 用 `as const` 对象按模块组织端点常量，**不要**散落字符串。

### 10.2 响应校验

`http.ts` 支持通过 `meta.responseSchema` 在响应拦截器做 Zod 运行时校验：

```ts
get('/users', { meta: { responseSchema: UserSchema } })
// 返回校验后数据，类型自动推导
```

带 schema 返回校验后数据，不带 schema 返回 `undefined`（类型层面）。

### 10.3 401 自动刷新

`http.ts` 内置 401 单飞刷新机制：

- 检测 401 + 未标记 `_retry` + 未 `skipAuthRefresh`
- `isRefreshing` + `pendingQueue` 单飞
- 刷新成功重放队列，刷新失败 `clearAuth()` + `emitApiError`

**不要**在业务代码里手动处理 401，统一交给拦截器。

### 10.4 TanStack Query

- QueryCache / MutationCache 的 `onError` 统一调 `emitApiError`
- 默认 query：`retry` 对 `UNAUTHORIZED` 不重试，其他最多 2 次；`staleTime: 30s`；`refetchOnWindowFocus: false`
- 默认 mutation：`retry: 0`

## 11. 测试约定

### 11.1 测试框架

| 层 | 框架 |
|---|---|
| 前端单测 | Vitest + Testing Library + jsdom |
| 后端单测 | Jest 30 + ts-jest |
| 后端 E2E | Jest + supertest |
| 前端 E2E | Playwright |
| shared 单测 | Vitest |

### 11.2 测试目标

> **测试业务约束与安全边界，不测框架能力。**

- 纯 Zod schema、内置验证器**无需测试**
- 纯函数管线（如 `chart-data-parser`）必须有完整单测，覆盖各分支与错误原因
- 状态机转换表必须有单测（`transition` 是纯函数）
- 编译器（`compileBlueprint`）必须有单测，覆盖环、深度截断、诊断分级

### 11.3 测试文件位置

**测试与源码同目录**：`*.test.ts(x)` 紧邻源码。

### 11.4 后端覆盖率阈值

Jest 覆盖率阈值 80%（branches/functions/lines/statements）。

### 11.5 质量门禁

提交前必须通过：

```bash
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # ESLint 类型感知规则
pnpm biome:check  # Biome 格式 + 基础 lint
pnpm test         # 单元测试
```

## 12. 提交规范

### 12.1 提交消息

遵循 Conventional Commits：

```
<type>(<scope>): <subject>

<body>

<footer>
```

type：`feat` / `fix` / `refactor` / `test` / `docs` / `chore` / `perf` / `style` / `ci`

### 12.2 pre-commit 钩子

`simple-git-hooks` + `lint-staged`，仅对暂存文件运行 Biome。

### 12.3 禁止项

- 不要用 `git add -A` 或 `git add .`，按文件名添加
- 不要提交 `.env` / `credentials.json` 等敏感文件
- 不要提交 `routeTree.gen.ts` 的手动修改（自动生成）

## 13. 路由与导航约定

### 13.1 TanStack Router 文件系统路由

- 路由文件在 `apps/web/src/routes/`
- `routeTree.gen.ts` 自动生成，**禁止手改**
- `_app.` 前缀的路由共享鉴权布局

### 13.2 新增页面后

在 `apps/web/src/config/navigation.ts` 的 `menuGroups` 同步添加导航项（项目规则要求）。

## 14. 文档约定

### 14.1 文档元信息

每个文档顶部必须包含：

```markdown
# 文档标题

> 状态：<草稿 | 设计中 | 评审中 | 生效中 | 已归档>
> 最近更新：YYYY-MM-DD
> 定位：一句话说明本文档的职责
```

### 14.2 文档分层

详见 [_structure.md](../_structure.md)。

## 15. 关联文档

- [系统总览](../architecture/system-overview.md)
- [大屏设计器架构](../architecture/screen-editor-architecture.md)
- [蓝图运行时架构](../architecture/blueprint-runtime-architecture.md)
- [开发指南](../architecture/development-guide.md)
- [_structure.md](../_structure.md) 文档结构说明
