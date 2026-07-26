# 事件蓝图重新设计 — 任务分解

> 状态：生效中
> 最近更新：2026-07-26
> 对应 Spec：[spec.md](./spec.md)

## 阶段一：Schema 与数据模型（基础设施）

### Task 1.1：V2 Blueprint Schema 编写
- [x] 在 `packages/shared/src/schemas/blueprint.schema.ts` 中新增 V2 schema（保留 V1 schema 供迁移使用）
- [x] 定义 `ComponentNodeSchema`（含 `globalType` 可选字段）
- [x] 定义 `DelayNodeSchema`（`config.delayMs`，含校验：>=0, <=60000）
- [x] 保留 `ConditionNodeSchema`、`CommentNodeSchema` 结构不变
- [x] 定义新的 `BlueprintEdgeSchema`，`sourceHandle`/`targetHandle` 改为 `evt:*` / `act:*` / `out` / `then` / `else` / `in`
- [x] 定义 `EVENT_BLUEPRINT_VERSION_V2 = 2`，`EventBlueprintV2Schema`
- [x] 导出 V1→V2 类型别名，避免命名冲突
- [x] 单测：V2 schema 结构校验、判别联合、空字段处理

### Task 1.2：V1→V2 迁移函数
- [x] 新建 `packages/shared/src/schemas/blueprint-migration.ts`
- [x] 实现 `migrateBlueprintV1ToV2(v1: EventBlueprint): EventBlueprintV2`
- [x] trigger type → eventId 映射表（componentClick→click, componentHover→hover, ...）
- [x] action type → actionId 映射表（setVisibility→show/hide/toggle, navigate→全局节点, ...）
- [x] pageLoad trigger → 全局 pageLoad 节点（单例，合并多个 pageLoad trigger 为一个节点）
- [x] navigate/requestApi action → 全局节点（同类型合并为单例）
- [x] interval trigger → 组件节点 + delay 节点组合
- [x] 边 handle 推导：V1 `out` → V2 `evt:{推导eventId}`，V1 `in` → V2 `act:{推导actionId}`
- [x] 无法推导的边保留但标记 `migrated: true` 元数据（供诊断 warning）
- [x] 单测：覆盖每种 trigger/action/condition/comment 的迁移路径

### Task 1.3：组件事件/动作注册表扩展
- [x] 在 `apps/web/src/features/screen/registry/` 中扩展 `ComponentDefinition`
- [x] 新增 `ComponentEventDefinition`、`ComponentActionDefinition` 类型
- [x] 新增 `DEFAULT_EVENTS`（click/hover）和 `DEFAULT_ACTIONS`（show/hide/toggleVisibility）
- [x] 新增 `DATASOURCE_EVENTS`（dataLoaded/dataError）和 `DATASOURCE_ACTIONS`（refreshData）
- [x] 新增 `CONTAINER_ACTIONS`（scrollTo）
- [x] 提供 `getComponentEvents(componentType)` / `getComponentActions(componentType)` 工具函数
- [x] 为现有组件类型补充 events/actions 声明（bar-chart/text/image/container 等）
- [x] 单测：默认事件/动作合并逻辑、数据源组件扩展、未声明组件回退默认

## 阶段二：引脚兼容性与编译器

### Task 2.1：引脚兼容性重写
- [x] 重写 `blueprint/lib/pin-compatibility.ts`（新增 `pin-compatibility-v2.ts`，保留 V1）
- [x] 支持 V2 语义化 handle 格式（`evt:*` / `act:*` / `out` / `then` / `else` / `in`）
- [x] 实现兼容性矩阵：evt→act, evt→in, out→act, out→in, then→act, then→in, else→act, else→in
- [x] 自环规则：组件节点 evt→act 同节点允许；逻辑节点自环禁止
- [x] 重复边检测
- [x] `getCompatibleTargetPins` 返回兼容锚点列表（供磁吸高亮）
- [x] 单测：每种源→目标组合的兼容性、自环例外、重复边

### Task 2.2：编译器重写
- [x] 重写 `blueprint/compiler/` 模块（新增 `v2-compile.ts` / `v2-cycle.ts` / `v2-indexes.ts` / `v2-types.ts`，保留 V1）
- [x] `v2-indexes.ts`：构建节点索引 + 组件引用映射 + 锚点索引
- [x] `v2-cycle.ts`：DFS 三色环检测，组件节点 evt→act 自环不报错
- [x] `v2-compile.ts`：dangling 组件引用、空全局节点配置、delay 超范围
- [x] `v2-compile.ts`：从组件节点输出锚点出发 DFS 展开执行计划
  - 遇到 act:* → 生成 ActionStep（actionId 映射到具体执行逻辑）
  - 遇到 condition.in → 递归编译，then/else 分支独立展开
  - 遇到 delay.in → 生成 DelayStep
- [x] 定义 V2 `CompiledRule` / `CompiledStep` 类型（`compiler/v2-types.ts`）
- [x] 单测：编译流程、环检测、诊断产出、条件分支展开

### Task 2.3：执行计划类型定义
- [x] 在 `compiler/v2-types.ts` 中定义 V2 编译产物类型
- [x] `V2CompiledRule`：triggerNodeId + triggerEventId + triggerComponentId + steps[]
- [x] `V2CompiledStep`：判别联合（action / condition / delay）
- [x] `V2CompileResult`：rules[] + diagnostics[]
- [x] `V2Diagnostic`：保留 V1 结构（nodeId / level / message / code）

## 阶段三：运行时重写

### Task 3.1：RuntimeDeps 接口扩展
- [x] 重写 `runtime/v2-types.ts`
- [x] 新增 `triggerEvent(componentId, eventId, payload?)` 方法
- [x] 保留现有 hasComponent/getComponentValue/getComponentData/applyVisibility/getVisibility/refreshDataSource/scrollToComponent/openUrl/requestApi/logWarning
- [x] 定义 `ActionResult` 联合类型（success/skipped/failure），含 actionId 字段

### Task 3.2：执行器重写
- [x] 重写 `runtime/v2-executor.ts`（保留 V1 `executor.ts`）
- [x] `collectRules(rules, componentId, eventId)`：按组件 ID + 事件 ID 匹配（`v2-matcher.ts`）
- [x] `executeRule(rule, deps)`：按 steps 顺序执行
- [x] action step：按 actionId 分发到 deps 方法
  - show/hide/toggleVisibility → deps.applyVisibility
  - refreshData → deps.refreshDataSource
  - scrollTo → deps.scrollToComponent
  - navigate → deps.openUrl
  - requestApi → deps.requestApi
- [x] condition step：求值表达式，递归执行 then/else 分支
- [x] delay step：setTimeout 延时后继续执行（需可取消）
- [x] 单测：每种 step 类型的执行路径、condition 分支选择、delay 取消

### Task 3.3：预览运行时适配
- [x] 重写 `runtime/use-blueprint-preview-runtime.ts`
- [x] mount 时触发 pageLoad 事件（而非遍历 trigger 节点）
- [x] 暴露 `onComponentEvent(componentId, eventId)` 供组件调用
- [x] 组件注册事件回调：组件渲染时通过 Context 获取 `onComponentEvent`，在 onClick/onHover 时调用
- [x] 过滤带 error 诊断的规则

### Task 3.4：沙盒运行时适配
- [x] 重写 `runtime/use-blueprint-sandbox-runtime-v2.ts`
- [x] `simulateEvent(componentId, eventId)`：模拟指定组件的指定事件
- [x] deps 全 no-op（与 V1 一致）
- [x] 链路高亮逻辑适配 V2 编译产物（`use-blueprint-sandbox-highlight-v2.ts`）

## 阶段四：节点渲染重写

### Task 4.1：组件节点组件
- [x] 新建 `blueprint/nodes/component-node.tsx`
- [x] 从 `useComponentDefinition` hook 获取组件的 events/actions
- [x] 动态渲染 source handles（每个 event 一个，左侧，id=`evt:{eventId}`）
- [x] 动态渲染 target handles（每个 action 一个，右侧，id=`act:{actionId}`）
- [x] 节点标题栏显示组件图标 + 组件名 + 实例 ID
- [x] emerald 配色，dangling 态红色边框
- [x] 多事件/多动作时锚点垂直排列，显示中文名
- [x] 节点宽度自适应（min 180px, max 260px）

### Task 4.2：全局节点组件
- [x] 新建 `blueprint/nodes/global-node.tsx`
- [x] 4 种子类型：pageLoad / navigate / requestApi / scrollTo
- [x] 虚线边框 + Globe 图标
- [x] 固定锚点（不动态派生）
- [x] 配置区显示 URL/method/targetComponentId 等摘要

### Task 4.3：延时节点组件
- [x] 新建 `blueprint/nodes/delay-node.tsx`
- [x] amber 配色，in + out 单输出
- [x] 显示延时毫秒数（如 "延时 500ms"）
- [x] 配置区可编辑 delayMs

### Task 4.4：条件节点适配
- [x] 修改 `blueprint/nodes/condition-node.tsx` 适配 V2（结构基本不变，锚点 id 约定不变）
- [x] 适配 V2 诊断 Context

### Task 4.5：注释节点适配
- [x] 修改 `blueprint/nodes/comment-node.tsx` 适配 V2（结构不变）

### Task 4.6：BaseNodeShell 重构
- [x] 修改 `blueprint/nodes/base-node.tsx` 支持 V2 配色方案
- [x] 新增 `emerald` 配色（替代 V1 的 trigger/action 二色）
- [x] 支持动态锚点渲染（传入 events[]/actions[] 数组）
- [x] 支持虚线边框模式（全局节点）

## 阶段五：Sheet 容器与交互

### Task 5.1：BlueprintSheet V2 重写
- [x] 新建 `blueprint/sheet/blueprint-sheet-v2.tsx`（保留 V1 `blueprint-sheet.tsx` 作兼容）
- [x] 注册新 nodeTypes：component / global / condition / delay / comment
- [x] 蓝图 ↔ ReactFlow 双向转换适配 V2 schema
- [x] 节点选中态/measured 字段合并逻辑保留
- [x] 历史手势合并逻辑保留
- [x] 过滤视图（filterBlueprintByComponent）适配 V2（`v2-filter-by-component.ts`）

### Task 5.2：连线校验集成
- [x] `isValidConnection` 使用 V2 `isConnectionValid`
- [x] `onConnect` 处理 V2 handle 格式
- [x] 连线松手落空白时搜索面板（connect 模式）过滤为兼容目标节点（`v2-search-panel.tsx`）

### Task 5.3：锚点磁吸
- [x] 新建 `blueprint/hooks/use-anchor-snap.ts`
- [x] `onConnectStart` 记录源锚点，计算兼容目标锚点列表
- [x] `onMouseMove` 检测 20px 范围内最近的兼容锚点
- [x] 兼容锚点添加高亮（`.blueprint-anchor-snap-target` CSS 类）
- [x] `onConnectEnd` 若附近有兼容锚点则吸附连线
- [x] 单测：`use-anchor-snap.test.ts` 覆盖磁吸检测、兼容性过滤、DOM 高亮、connectEnd 清理

### Task 5.4：左侧节点面板
- [x] 新建 `blueprint/panels/v2-search-panel.tsx` + `v2-node-options.tsx`（替代/增强 search-panel）
- [x] 三分组：组件实例 / 逻辑节点 / 全局节点
- [x] 组件实例从 `project.components` 派生，按组件类型分组
- [x] 拖拽到画布创建节点（onDrop 处理）
- [x] 搜索框过滤
- [x] 保留 search-panel 作为双击空白快捷创建入口

### Task 5.5：右键菜单适配
- [x] 修改 `blueprint/sheet/blueprint-context-menu.tsx` 适配 V2
- [x] 组件节点新增「定位到画布组件」菜单项
- [x] 全局节点新增「配置」菜单项
- [x] 保留复制/剪切/粘贴/对齐/分布/删除等通用操作

### Task 5.6：配置面板适配
- [x] 重写 `blueprint/panels/node-config-panel-v2.tsx`
- [x] 组件节点：显示组件信息（无配置，锚点自动派生）
- [x] 全局节点：按 globalType 分发配置表单（navigate: URL+target / requestApi: method+url+headers+body / scrollTo: 组件选择）
- [x] delay 节点：delayMs 输入
- [x] condition 节点：保留现有 ConditionBuilder
- [x] comment 节点：保留现有文本域

## 阶段六：模板与空态

### Task 6.1：模板重写
- [x] 重写 `blueprint/templates/template-definitions.ts`
- [x] "点击跳转"：组件 A 的 evt:click → 全局 navigate 节点的 act:navigate
- [x] "显隐切换"：组件 A 的 evt:click → 组件 B 的 act:toggleVisibility
- [x] "页面加载刷新"：全局 pageLoad 节点的 evt:pageLoad → 组件 B 的 act:refreshData
- [x] 新增"延时执行"模板：组件 A 的 evt:click → delay 节点 → 组件 B 的 act:show
- [x] 更新 `create-template-blueprint.ts` 构造 V2 格式蓝图
- [x] 更新 `build-validated-template.ts` 使用 V2 schema

### Task 6.2：空态适配
- [x] 修改 `blueprint/templates/empty-blueprint-state.tsx` 适配 V2
- [x] 模板画廊展示 V2 模板

## 阶段七：组件集成

### Task 7.1：组件事件回调注册
- [x] 新建 `blueprint/runtime/component-event-context.ts`，提供 `onComponentEvent(componentId, eventId)` 通过 React Context 注入
- [x] 预览运行时通过 Context Provider 注入回调
- [x] 组件渲染时消费 Context，在 onClick/onHover 时调用 `onComponentEvent`
- [x] 编辑态不注入 Provider（组件事件回调为空）

### Task 7.2：画布组件适配
- [x] 在 `screen-canvas.tsx` 中注入 BlueprintEventContext.Provider（预览态）
- [x] 现有组件（bar-chart/text/image 等）的 onClick/onHover 回调中调用 `onComponentEvent`
- [x] 保留现有组件 interaction 字段的直接配置能力（与蓝图并存）

## 阶段八：迁移与兼容

### Task 8.1：项目加载时自动迁移
- [x] 在 `editor-store.ts` 的项目加载流程中检测 `blueprint.version`
- [x] version === 1 时调用 `migrateBlueprintV1ToV2`，更新 project.blueprint
- [x] 迁移后标记 `project.metadata.blueprintMigrated = true`，避免重复迁移
- [x] 迁移失败时保留 V1 原文并显示警告 toast

### Task 8.2：剪贴板载荷适配
- [x] 更新 `BlueprintClipboardSchema` 为 V2 格式
- [x] `use-blueprint-clipboard-v2.ts` 适配 V2 节点结构
- [x] 跨项目粘贴时校验组件引用是否存在

## 阶段九：质量保障

### Task 9.1：现有测试迁移
- [x] 迁移 `pin-compatibility.test.ts` 到 V2（新增 `pin-compatibility-v2.test.ts`，保留 V1）
- [x] 迁移 `align-distribute.test.ts`（结构不变，节点类型适配）
- [x] 迁移 `template-interpolation.test.ts`（结构不变）
- [x] 迁移 `align-distribute.integration.test.ts`
- [x] 迁移 `filter-by-component.test.ts`（新增 `v2-filter-by-component.test.ts`）
- [x] 迁移 `get-node-locate-component.test.tsx`（新增 `v2-get-node-locate-component.test.ts`）
- [x] 迁移 `build-validated-template.test.ts`
- [x] 迁移 `create-template-blueprint.test.ts`

### Task 9.2：新增测试
- [x] V2 schema 单测（Task 1.1）— `blueprint.schema.test.ts`
- [x] V1→V2 迁移单测（Task 1.2）— `blueprint-migration.test.ts`
- [x] 组件注册表扩展单测（Task 1.3）— `component-events-actions.test.ts`
- [x] V2 引脚兼容性单测（Task 2.1）— `pin-compatibility-v2.test.ts`
- [x] V2 编译器单测（Task 2.2）— `v2-compile.test.ts`
- [x] V2 执行器单测（Task 3.2）— `v2-executor.test.ts`
- [x] 锚点磁吸交互测试（Task 5.3）— `use-anchor-snap.test.ts`
- [x] 左侧节点面板测试（Task 5.4）— `nodes.v2.test.tsx`
- [x] V2 预览运行时测试 — `use-blueprint-preview-runtime-v2.test.tsx`

### Task 9.3：质量门
- [x] `pnpm typecheck` 通过（4/4 tasks）
- [x] `pnpm lint` 通过（3/3 tasks）
- [x] `pnpm test` 全量通过（2356 passed, 14 skipped, 2370 total）
- [x] `pnpm biome:check` 通过
