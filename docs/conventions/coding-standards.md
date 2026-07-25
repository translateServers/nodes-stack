# 编码规范

> 状态：生效中
> 最近更新：2026-07-25
> 定位：所有开发者（含 AI）编码前必读。仅记录"必须做/不能做"的约束、隐式约定与陷阱警示，工具自动处理的细节不重复。

## 1. 代码质量三件套

```
日常开发
   ├─ Biome（格式 + 基础 lint + import 组织）── pre-commit 自动触发
   ├─ ESLint 9 + typescript-eslint（类型感知规则）── pnpm lint 手动触发
   └─ TypeScript 6 strict ── pnpm typecheck 手动触发
```

### 1.1 分工原则

- **Biome**：唯一负责格式化的工具，ESLint 不启用 `prettier/prettier`
- **ESLint**：TypeScript 类型感知规则
  - 显式配置：`no-explicit-any` / `no-floating-promises` / `no-unsafe-argument` / `no-unsafe-call`
  - `recommendedTypeChecked` 默认启用：`no-unsafe-member-access` / `no-misused-promises` / `no-base-to-string`
- **TypeScript**：strict 模式类型检查

### 1.2 关键原则

> **Biome 通过 ≠ 质量过关**。提交前必须确保 `pnpm typecheck` 与 `pnpm lint` 通过。

### 1.3 禁止项

- `@ts-ignore` / `@ts-nocheck` / `as any` / 隐式 `any`
- `ignoreDeprecations: "6.0"`（必须用 `paths` 替代 `baseUrl`）

### 1.4 禁止引入的依赖

> ⚠️ AI 陷阱：AI 倾向于安装"流行库"，但本项目已选定技术栈，禁止引入以下依赖。

| 禁止引入 | 替代方案 | 原因 |
|---|---|---|
| `prettier` | Biome | 项目唯一格式化工具为 Biome |
| `class-validator` | Zod + nestjs-zod | 后端校验统一用 Zod |
| `lodash`（全量包） | `lodash-es` 或具体函数 | 全量包体积过大，按需引入 |
| `moment` | `date-fns` | moment 已进入维护模式 |

## 2. 路径别名

| 包 | 别名 |
|---|---|
| 前端 | `@` → `./src` |
| 后端 | `@/` → `src/`、`@modules/`、`@common/`、`@config/` |

## 3. UI 组件选型边界

> ⚠️ AI 陷阱：AI 常在大屏组件中误用 shadcn/ui，导致样式冲突。判断方法：组件会被渲染到画布上 → 用原生 HTML/SVG。

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

> ⚠️ AI 陷阱：AI 写新节点常漏 Handle id="in"，导致边无法连接但不报错。

### 4.1 Handle ID

- **目标 Handle 必须有 `id="in"`**，与模板生成的 edges（`targetHandle: 'in'`）匹配
- 不写 id 会导致边无法连接

### 4.2 样式导入

`@xyflow/react/dist/style.css` 必须在使用 React Flow 的文件中导入（如 `blueprint-sheet.tsx`），否则节点/边/Handle 渲染异常（黑块）。

## 5. 数据层约定

> ⚠️ AI 陷阱：AI 新增数据源类型常修改既有分支，应添加新分支。

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

`ParseResult` 错误原因共 6 种：`not-an-array` / `path-not-found` / `path-not-array` / `missing-dimension-field` / `missing-value-field` / `invalid-value-type`。

> 注：`path-not-array` 当前未实际发出，仅为类型层预留（`parseChartData` 在路径不存在时统一返回 `path-not-found`，在结果非数组时返回 `not-an-array`）。

错误信息**面向用户可读**，不泄露原始数据全文。

## 6. 状态管理约定

> ⚠️ AI 陷阱：AI 常直接 mutate state，必须用 `buildNestedUpdate` 构造不可变更新。

### 6.1 Zustand 使用

- 编辑器状态用 Zustand（`editor-store.ts`），devtools middleware
- 开发模式下通过 `window.__screenEditorStore` 暴露给 Playwright E2E
- 高频更新（如拖拽过程中的尺寸提示）剥离到独立 store（`useDimensionStore`），避免触发整个画布重渲染

### 6.2 历史栈

- 历史栈快照包含 `components + canvas + blueprint` 三者，共享同一时间线
- 容量上限 50
- 高频操作（如蓝图节点拖拽）用手势模式合并为一次历史提交：
  - `beginBlueprintGesture` 记录 baseline，期间更新不入栈
  - `endBlueprintGesture` 有净变化时补一条历史（快照取 baseline）

### 6.3 不可变更新

属性面板字段写入用 `buildNestedUpdate` 构造不可变嵌套 partial，交给 store shallow merge：

```ts
buildNestedUpdate(source, 'position.x', 100)
// → { position: { ...source.position, x: 100 } }
```

## 7. 工具系统约定

> ⚠️ AI 陷阱：AI 常硬编码 `moveableDraggable = true`，应通过 `TOOL_REGISTRY` capabilities 派生。

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

> ⚠️ AI 陷阱：AI 常用 `left/top` 定位组件，必须用 `transform: translate()`。

### 8.1 Canvas Drag Optimization

- 组件定位用 `transform: translate()`，**不用** `left/top`（GPU 合成层避免布局重排）
- store 层 `position.x/y` 语义不变，由 `resolveComponentContainerStyle` 转 transform
- 拖拽用 `e.beforeTranslate` 替代 DOM 回读（无精度损失）
- 用 `composeComponentTransform` 合并 transform 链，**不要**字符串拼接

```ts
// ❌ 错误：触发布局重排
style.left = `${x}px`;
style.top = `${y}px`;

// ✅ 正确：GPU 合成层
style.transform = `translate(${x}px, ${y}px)`;
```

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

> ⚠️ AI 陷阱：AI 常引入 `class-validator`，应统一用 Zod + nestjs-zod。

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

`data` 字段仅在 `data !== undefined && data !== null` 时才携带，否则省略（如 DELETE 等无返回数据的操作）。falsy 但非 null/undefined 的值（`0` / `''` / `false` / `[]` / `{}`）仍保留 `data` 字段。

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

> ⚠️ AI 陷阱：AI 常在业务代码手动处理 401，应统一交给拦截器。

### 10.1 端点配置

`api/core/endpoints.ts` 用 `as const` 对象按模块组织端点常量，**不要**散落字符串。

### 10.2 响应校验

`http.ts` 的 `get` / `post` 接受 Zod schema 作为参数，内部自动构造 `meta.responseSchema` 在响应拦截器做运行时校验：

```ts
get('/users', UserSchema)
// 内部等价于 http.get('/users', { meta: { responseSchema: UserSchema } })
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

## 11. 测试目标

> **测试业务约束与安全边界，不测框架能力。**

- 纯 Zod schema、内置验证器**无需测试**
- 纯函数管线（如 `chart-data-parser`）必须有完整单测，覆盖各分支与错误原因
- 状态机转换表必须有单测（`transition` 是纯函数）
- 编译器（`compileBlueprint`）必须有单测，覆盖环、深度截断、诊断分级

## 12. 必须复用的工具函数

> ⚠️ AI 陷阱：AI 倾向于自己实现而非复用既有工具函数，导致重复代码。

| 场景 | 必须复用 | 位置 |
|---|---|---|
| 属性面板字段写入 | `buildNestedUpdate` | `property-schema/path-utils.ts` |
| 组件定位样式 | `resolveComponentContainerStyle` / `composeComponentTransform` | `registry/component-container-style.ts` |
| 高频回调节流 | `createRafThrottler` | `lib/raf-throttle.ts` |
| 数据解析管线 | `parseChartData` / `extractDataByPath` / `mapFieldsToChartData` / `applyLogicConfig` | `lib/chart-data-parser.ts` |
| 工具能力查询 | `getToolById` / `hasCapability` | `hooks/tool-registry.ts` |
| 组件定义查询 | `getDefinitionByType` / `getDefinitionsByCategory` / `searchComponentDefinitions` / `createComponentInstance` | `registry/index.ts` |
| 属性 Schema 查询 | `getSchemaForComponentType` | `property-schema/schemas.tsx` |

新增工具函数前，先检查上述清单是否已有现成实现。

## 13. 路由与导航约定

### 13.1 TanStack Router 文件系统路由

- 路由文件在 `apps/web/src/routes/`
- `routeTree.gen.ts` 自动生成，**禁止手改**
- `_app.` 前缀的路由共享鉴权布局

### 13.2 新增页面后

在 `apps/web/src/config/navigation.ts` 的 `menuGroups` 同步添加导航项（项目规则要求）。

## 14. 关联文档

- [系统总览](../architecture/system-overview.md)
- [大屏设计器架构](../architecture/screen-editor-architecture.md)
- [蓝图运行时架构](../architecture/blueprint-runtime-architecture.md)
- [开发指南](../architecture/development-guide.md)
- [_structure.md](../_structure.md) 文档结构说明
