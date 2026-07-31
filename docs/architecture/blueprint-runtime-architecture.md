# 蓝图运行时架构

> 状态：生效中
> 最近更新：2026-08-01
> 定位：事件蓝图子系统的架构说明。读完应能理解触发器/动作/条件如何编排，编译器与执行器如何协作

> 注：本文档第 8 节"关键约束"中提到的 `eventsEnabled` 总闸门已被 [introduce-canvas-interaction-modes](../specs/introduce-canvas-interaction-modes/spec.md) 规格替换为 `interactionMode: 'design' | 'interactive'`（编辑器画布"设计/交互"模式切换，交互调试对应旧"开启"语义）。在本文档完成同步更新前，请以该规格与代码实现为准。

## 1. 定位与边界

事件蓝图是 Nebula 大屏设计器的交互编排子系统，位于 `apps/web/src/features/screen/blueprint/`。它基于 **@xyflow/react**（React Flow）节点编辑器，让用户用可视化方式编排"当 X 发生时，执行 Y"的规则链。

**核心特征**：**纯函数编译器 + 薄执行器 + 依赖注入**。编译产物可单测，执行器可注入 mock deps。

**不在本文档范围**：节点编辑器 UI 交互（拖拽/选择/快捷键）、蓝图抽屉与画布联动。这些见 [大屏设计器架构](./screen-editor-architecture.md)。

## 2. 目录组织

```
blueprint/
├── compiler/              纯函数编译器
│   ├── compile.ts         compileBlueprint 主入口
│   ├── indexes.ts         节点与边索引构建
│   ├── cycle.ts           环检测（DFS）
│   ├── validate.ts        参数诊断
│   ├── filter-by-component.ts  按组件过滤规则
│   └── types.ts           CompileResult / CompiledRule / Diagnostic
├── runtime/               执行器
│   ├── types.ts           TriggerEventType / RuntimeDeps / ActionResult
│   ├── executor.ts        executeRule / executeAction / triggerAndExecute
│   ├── matcher.ts         规则匹配
│   ├── plan.ts            执行计划展开（MAX_TRIGGER_DEPTH）
│   └── use-blueprint-preview-runtime.ts  预览集成 hook
├── nodes/                 React Flow 节点
│   ├── node-data-types.ts 4 种 NodeData 类型
│   ├── base-node.tsx      节点基类
│   ├── trigger-node.tsx
│   ├── action-node.tsx
│   ├── condition-node.tsx
│   └── comment-node.tsx
├── edges/                 连线
├── panels/                属性面板
│   ├── node-config-panel.tsx
│   ├── condition-builder.tsx  条件表达式构建器
│   ├── search-panel.tsx
│   ├── problems-panel.tsx     编译诊断
│   ├── execution-log-panel.tsx 执行日志
│   ├── align-distribute-toolbar.tsx
│   └── viewport-toolbar.tsx
├── hooks/                 蓝图编辑器内部 hooks
│   ├── use-blueprint-drag.ts
│   ├── use-blueprint-selection.ts
│   ├── use-blueprint-shortcuts.ts
│   ├── use-blueprint-viewport.ts
│   ├── use-blueprint-diagnostics.ts
│   ├── use-blueprint-clipboard.ts
│   ├── use-blueprint-sandbox-runtime.ts     沙盒运行时（调试）
│   ├── use-blueprint-sandbox-highlight.ts   沙盒高亮
│   ├── use-blueprint-preview-runtime.ts     预览运行时
│   └── use-blueprint-runtime-deps.ts        构造 RuntimeDeps
├── lib/                   纯函数库
│   ├── align-distribute.ts
│   ├── pin-compatibility.ts   引脚兼容性校验
│   ├── template-interpolation.ts  {{trigger.value}} 模板插值
│   ├── request-api-mask.ts    敏感 header 脱敏
│   └── snap-utils.ts
├── sheet/
│   └── blueprint-sheet.tsx    蓝图抽屉（与画布双向联动）
└── templates/              蓝图模板库
    ├── template-definitions.ts
    ├── template-gallery.tsx
    ├── create-template-blueprint.ts
    └── build-validated-template.ts
```

## 3. 节点类型

4 种节点，每种对应一个 `*NodeData extends Record<string, unknown>`：

### TriggerNodeData（触发器）

```ts
{
  config: BlueprintTriggerConfig  // componentClick / pageLoad / componentHover / dataLoaded / dataError / interval
  label: string
  componentId?: string            // componentClick/componentHover/dataLoaded/dataError 需要
  dangling?: boolean              // 是否悬空（未连接）
  inCycle?: boolean               // 是否在环中
}
```

6 种触发事件：
- `componentClick` / `componentHover`：用户交互
- `pageLoad`：页面加载
- `dataLoaded` / `dataError`：组件数据加载完成/失败
- `interval`：定时触发

### ActionNodeData（动作）

```ts
{
  config: BlueprintActionConfig
  label: string
  targetComponentId?: string
  dangling?: boolean
  inCycle?: boolean
}
```

5 种动作：
- `setVisibility`：写预览可见性覆盖表（不改项目数据）
- `navigate`：按白名单打开 URL
- `scrollToComponent`：滚动到组件
- `refreshDataSource`：刷新目标组件数据源（复用取消协议）
- `requestApi`：独立 HTTP 请求（GET/POST/PUT/PATCH/DELETE），用于副作用，**不写回组件数据源**

### ConditionNodeData（条件）

```ts
{
  config: { expression: string }  // 条件表达式
  label: string
  dangling?: boolean
  inCycle?: boolean
}
```

有 `then` / `else` 两个输出引脚，按表达式求值结果选择分支。

### CommentNodeData（注释）

```ts
{
  config: { text: string }
  label: string
}
```

不参与执行，仅用于文档说明。

## 4. 编译器（compiler/）

`compile.ts` 的 `compileBlueprint(blueprint, context): CompileResult` 是**纯函数**，输入蓝图 JSON，输出编译后的规则集 + 诊断。

### 编译流程

```
1. buildIndexes — 构建节点与边索引，检测重复 id 与非法引用
2. detectCycles — 对每个 trigger 做 DFS 环检测（含 condition 分支节点）
3. 收集环涉及的节点（含环的 trigger 不产出规则；环中节点不产 orphan 诊断）
4. compileTrigger — 对每个 trigger 做 DFS 拓扑展开：
   - action 节点加入 actions 列表
   - condition 节点按 then/else 输出引脚分组，展开为 thenActions/elseActions
   - MAX_COMPILE_DEPTH = 100 防止无限递归
5. diagnoseNode — 对所有节点做参数诊断（dangling / empty-param）
6. 孤立子图诊断（未连接到任何 trigger 的非 comment 节点产出 info）
7. comment 节点 info 诊断（不参与执行）
```

### 编译产物

```ts
CompileResult = {
  rules: CompiledRule[]
  diagnostics: Diagnostic[]
}

CompiledRule = {
  triggerNodeId: string
  triggerConfig: BlueprintTriggerConfig
  actions: CompiledAction[]          // 串联动作
  conditions: CompiledCondition[]    // 条件分支
}

Diagnostic = {
  level: 'error' | 'warning' | 'info'
  code: DiagnosticCode       // 必填，文档原遗漏
  message: string
  nodeId?: string            // 实际可选，文档原说必填
  edgeId?: string            // 文档原遗漏
  fieldPath?: string[]       // 文档原遗漏
}
```

### 关键设计

- **环检测**：含环的 trigger 不产出规则，环中节点不产 orphan 诊断（避免噪声）
- **深度截断**：`MAX_COMPILE_DEPTH = 100`，超出记 warning
- **诊断分级**：error / warning / info，预览运行时排除 error 级触发器

## 5. 运行时（runtime/）

### RuntimeDeps — 依赖注入接口

执行器不直接访问 DOM/fetch/状态，所有副作用通过 `RuntimeDeps` 注入：

```ts
interface RuntimeDeps {
  applyVisibility(componentId, visible): void
  getVisibility(componentId): boolean
  openUrl(url: string, target: '_blank' | '_self'): void
  scrollToComponent(componentId): void
  refreshDataSource(componentId): Promise<void>
  hasComponent(componentId): boolean
  logWarning(message): void
  requestApi(params: RequestApiRuntimeParams): Promise<RequestApiRuntimeResult>
  getComponentValue(componentId, path): unknown
  getComponentData(componentId): unknown
}
```

**价值**：执行器可注入 mock deps 做单测；预览态与沙盒态可注入不同实现。

### executeRule — 薄执行器

```ts
executeRule(rule, event, deps): RuleExecutionLog
```

执行流程：

1. `planActions(rule)` 展开执行计划（含深度截断告警）
2. 主链动作按顺序执行（`interpolateActionConfig` 模板插值后调用 `executeAction`）
3. condition 节点按拓扑顺序求值：`evaluateConditionExpression` 选择 then/else 分支执行
4. 单动作失败不中断后续独立动作（try/catch 返回 failure）
5. dangling 动作跳过并记录

### executeAction — 5 种动作

| 动作 | 实现 | 副作用范围 |
|---|---|---|
| `setVisibility` | 写预览可见性覆盖表 | 仅预览态，不改项目数据 |
| `navigate` | 按白名单打开 URL | 浏览器导航 |
| `scrollToComponent` | 滚动到组件 | DOM 滚动 |
| `refreshDataSource` | 复用取消协议刷新 | 写 apiRawDataOverride |
| `requestApi` | HTTP 请求 + 模板插值 + 超时取消 | 仅副作用，不写回数据源 |

### triggerAndExecute — 触发并执行

```ts
triggerAndExecute(rules, event, deps)
```

`collectRules` 匹配所有触发器对应的规则，顺序执行。

## 6. 模板插值

`lib/template-interpolation.ts` 支持：

- `{{trigger.value}}`：触发器上下文值
- `{{trigger.data.xxx}}`：触发器上下文数据（按路径取值）
- `{{event.componentId}}`：事件上下文

插值发生在 `interpolateActionConfig`，动作执行前对所有字符串字段做替换。

## 7. 条件求值

`ConditionValueSource` 支持两种数据来源：

- `componentProp`：读组件 props
- `componentData`：读组件最新解析数据（按 path 取值）

`evaluateConditionExpression` 求值表达式，选择 then/else 分支执行。

## 8. 预览集成（use-blueprint-preview-runtime.ts）

```ts
useBlueprintPreviewRuntime(blueprint, components, { enabled? })
```

### 职责

1. `compileBlueprint` 编译（memo 化，blueprint 引用变化时重新编译）
2. 排除带 error 级诊断的触发器
3. `useBlueprintRuntimeDeps` 构造执行器依赖
4. 以宿主传入的 `enabled` 作为运行时总闸门（默认 `true`）
5. 启用时触发 `pageLoad`、调度 `interval` 并接收组件事件
6. 关闭时清理定时器、中止请求、阻断异步链后续动作并清空临时覆盖
7. `apiDataOverrides` state（refreshDataSource 完成后写入）+ `visibilityOverrides` 通过 `BlueprintPreviewContextValue` 下发

### 关键约束

- **主编辑画布**调用本 Hook，并把状态栏 `eventsEnabled` 作为完整运行时总闸门；开启后临时应用可见性与数据覆盖，不改项目数据
- **编辑器内预览与公开预览**默认完整启用运行时，不读取编辑器本地偏好
- **蓝图沙盒**使用独立 mock 运行时，不受主画布总闸门影响，也不产生真实副作用

## 9. 沙盒运行时（调试）

`use-blueprint-sandbox-runtime.ts` 提供编辑器内调试能力：

- 在蓝图编辑器内模拟触发事件
- `use-blueprint-sandbox-highlight.ts` 高亮被触发的节点与连线
- 注入 mock deps，不产生真实副作用

## 10. 蓝图抽屉与画布联动

`sheet/blueprint-sheet.tsx` 实现双向联动：

- **蓝图 → 画布**：`flashComponent` 闪烁高亮目标组件
- **画布 → 蓝图**：`filterComponentId` 过滤显示与该组件相关的节点

## 11. 右侧面板派生视图

蓝图数据除了在 `BlueprintSheet` 全屏编辑器中编辑外，还在右侧属性面板的 events tab 提供**派生视图**，让用户无需打开蓝图抽屉即可快速查看与编辑当前选中组件相关的事件规则。

### 11.1 QuickEventEditor 派生

`apps/web/src/features/screen/components/quick-event-editor.tsx` 从 `ScreenProject.blueprint` 派生当前选中组件相关的事件规则：

- **派生数据源**：`project.blueprint`（项目级，与组件实例解耦），通过 `useScreenEditorStore((s) => s.project)` 读取
- **过滤语义**：与 `compiler/filter-by-component.ts` 一致——`trigger.config.componentId === componentId`（componentClick / componentHover / dataLoaded / dataError）与 `action.config.targetComponentId === componentId`（setVisibility / scrollToComponent / refreshDataSource）。实现上独立，因 QuickEventEditor 需要扩展支持 componentHover / dataLoaded / dataError 触发器，并通过 BFS 收集下游 action 链与上游 trigger 来源
- **派生纯函数**：`deriveTriggerRules` / `deriveActionRules` / `findDownstreamActions` / `findUpstreamTrigger`（均带 visited 防环）

### 11.2 写操作走 editor-store 统一历史栈

所有增删通过 `editor-store` 的 `updateBlueprint(nextBlueprint)` 写入：

- `updateBlueprint` 内部走 `withHistory` 高阶函数，推入三重快照（components + canvas + blueprint），与组件/画布操作共享同一时间线，支持 `Ctrl/Cmd+Z` 撤销
- 蓝图手势期间（`beginBlueprintGesture` / `endBlueprintGesture`）高频更新合并为一次历史，QuickEventEditor 的离散增删不进入手势模式，每次操作都立即入栈

### 11.3 「打开事件蓝图」联动

顶部「打开事件蓝图」按钮调用 `editor-store.openBlueprintSheet({ focusComponentId: componentId })`：

- `openBlueprintSheet` 是 `editor-store` 提供的入口（无需依赖 React state 拉起，便于跨组件触发）
- Sheet 打开后自动应用 `focusComponentId` 过滤模式（复用 §10 的 `filterComponentId` 机制），只展示与该组件相关的节点

### 11.4 全局变量插值

`@nebula/shared` 的 `GlobalVariableSchema` 定义项目级全局变量，存储于 `ScreenProject.globalVariables`。三种类型：

- `static`：静态值
- `api`：按 `refreshInterval`（毫秒）定时拉取
- `computed`：表达式（当前预留）

**插值语法**：`{{globalVars.<name>}}`，在两处生效：

1. **数据源参数**：组件 `DataSourceConfig` 的 `apiConfig.url` / `apiConfig.headers` 等字符串字段
2. **蓝图模板**：动作执行前的 `interpolateActionConfig` 阶段（与 `{{trigger.value}}` / `{{event.componentId}}` 同一插值管线，见 [§6 模板插值](#6-模板插值)）

**管理入口**：`apps/web/src/features/screen/components/global-variables-panel.tsx` 在右侧属性面板「未选中组件」分支下渲染，提供 `addGlobalVariable` / `updateGlobalVariable` / `removeGlobalVariable` 三个 action，均走历史栈。详见 [大屏设计器架构 - 未选中组件时的入口](./screen-editor-architecture.md#未选中组件时的入口)。

## 12. 敏感信息脱敏

`lib/request-api-mask.ts` 对 `requestApi` 动作的日志脱敏：

- 用户通过 `secretHeaderKeys` 显式声明需要脱敏的 header 键名（大小写不敏感）；默认为空数组，不自动识别任何 header
- `secretHeaderKeys` 声明的 header 替换为 `***`
- 脱敏逻辑在前端 `apps/web/src/features/screen/blueprint/lib/request-api-mask.ts` 实现；schema 中的 `secretHeaderKeys` 字段在 `@nebula/shared` 中定义

## 13. 关键架构亮点

1. **纯函数编译器**：图 → 规则集 + 诊断，编译产物可单测，不依赖运行时
2. **薄执行器 + 依赖注入**：RuntimeDeps 外置所有副作用，可测试可隔离
3. **诊断分级**：error 级触发器在预览运行时排除，避免运行时崩溃
4. **环检测**：含环的 trigger 不产出规则，环中节点不产 orphan 诊断
5. **模板插值统一入口**：动作执行前统一插值，支持 trigger/event/globalVars 上下文
6. **沙盒运行时**：编辑器内可调试，注入 mock deps 不产生真实副作用
7. **宿主边界明确**：主编辑画布由本地总闸门控制；独立预览常开；沙盒隔离且无真实副作用
8. **右侧面板派生视图**：QuickEventEditor 从 blueprint 派生当前组件相关规则，写操作复用统一历史栈，无需打开 Sheet 即可快速编辑

## 14. 扩展指南

| 我想... | 看哪里 |
|---|---|
| 新增触发器类型 | `@nebula/shared` 的 `BlueprintTriggerConfig` + `nodes/trigger-node.tsx` + `runtime/matcher.ts` |
| 新增动作类型 | `@nebula/shared` 的 `BlueprintActionConfig` + `nodes/action-node.tsx` + `runtime/executor.ts` 的 `executeAction` |
| 新增条件求值数据源 | `ConditionValueSource` + `runtime/executor.ts` 的 `resolveConditionSource` |
| 改模板插值语法 | `lib/template-interpolation.ts` |
| 加蓝图模板 | `templates/template-definitions.ts` |
| 改 QuickEventEditor 派生规则 | `components/quick-event-editor.tsx` 的 `deriveTriggerRules` / `deriveActionRules` |
| 加全局变量类型 | `@nebula/shared` 的 `GlobalVariableSchema` + `components/global-variables-panel.tsx` |

## 15. 关联文档

- [系统总览](./system-overview.md)
- [大屏设计器架构](./screen-editor-architecture.md)
- [编码规范](../conventions/coding-standards.md)
- [开发指南](./development-guide.md)
