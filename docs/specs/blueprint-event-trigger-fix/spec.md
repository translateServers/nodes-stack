# 事件蓝图事件触发链路修复 Spec

> 状态：生效中（代码已合并，自动化测试通过；手动浏览器验证项待确认，见 checklist.md 阶段 4）
> 最近更新：2026-07-29
> 定位：修复事件蓝图中 dataLoaded / dataError / interval 三类事件在生产代码中从未被触发的缺陷

## Why

事件蓝图的事件触发链路存在严重缺陷：`dataLoaded`、`dataError`、`interval` 三类事件在生产代码中从未被触发，导致用户在蓝图中配置的"数据加载完成 → 执行动作"、"数据加载失败 → 执行动作"、"定时触发 → 执行动作"完全无效。

根因：
1. `RendererComponentProps` 接口不包含 `componentId` 字段，组件无法知道自己的 ID，因此无法通过 `useComponentEvent()` 派发事件
2. `bar-chart-component.tsx` 声明了 `DATASOURCE_EVENTS`（`dataLoaded`/`dataError`）但内部从未派发
3. `use-blueprint-preview-runtime.ts` 没有为 `interval` 触发器建立 `setInterval` 调度

## What Changes

- **扩展 `RendererComponentProps`**：新增 `componentId` 字段，让组件能获取自己的 ID
- **`ComponentRenderer` 透传 `componentId`**：从 `component.id` 取值传给 renderer
- **`bar-chart-component.tsx` 派发数据事件**：监听 `apiState`/`datasetState` 状态变化，在 `success` 时派发 `dataLoaded`，在 `error` 时派发 `dataError`
- **`use-blueprint-preview-runtime.ts` 调度 V1/V2 `interval` 事件**：按每条规则自己的 `intervalMs` 建立独立 `setInterval`，且每个 timer 只执行所属规则
- **卸载时清理定时器**：避免浮动定时器与内存泄漏

## Impact

- Affected specs: `blueprint-redesign`
- Affected code:
  - `apps/web/src/features/screen/registry/renderer.tsx`：扩展 `RendererComponentProps` 与 `ComponentRenderer`
  - `apps/web/src/features/screen/registry/components/bar-chart-component.tsx`：派发数据事件
  - `apps/web/src/features/screen/components/preview-component-renderer.tsx`：透传 `componentId`
  - `apps/web/src/features/screen/components/screen-canvas.tsx`：编辑器画布的 `ComponentRenderer` 调用处透传 `componentId`（虽不消费，但保持接口一致）
  - `apps/web/src/features/screen/blueprint/runtime/use-blueprint-preview-runtime.ts`：新增 `interval` 调度
  - `apps/web/src/features/screen/blueprint/compiler/types.ts`（如需）：暴露 `intervalMs` 字段供 runtime 读取
  - `apps/web/src/features/screen/blueprint/compiler/v2-types.ts`（如需）：同上

## ADDED Requirements

### Requirement: 组件运行时事件派发

系统 SHALL 让组件在渲染时能获取自己的 `componentId`，并通过 `useComponentEvent()` 派发任意事件。

#### Scenario: 组件获取自身 componentId
- **WHEN** 组件在预览画布中渲染
- **THEN** `RendererComponentProps.componentId` 字段持有该组件的 ID
- **AND** 组件可通过 `useComponentEvent()` 获取回调并调用 `callback(componentId, eventId)`

#### Scenario: 编辑器画布运行时关闭时不派发事件
- **WHEN** 组件在编辑器画布中渲染且 `eventsEnabled=false`
- **THEN** 组件事件回调保持稳定，但运行时总闸门丢弃事件
- **AND** 不触发任何蓝图规则或动作

### Requirement: 数据源事件派发

系统 SHALL 在图表组件的数据源状态变化时派发 `dataLoaded` 与 `dataError` 事件。

#### Scenario: API 数据源加载成功
- **WHEN** 图表组件的 `useApiDataSource` 状态从 `loading` 变为 `success`
- **AND** 当前处于预览模式（`useComponentEvent` 返回非 null）
- **THEN** 系统派发 `{ kind: 'componentEvent', componentId, eventId: 'dataLoaded' }` 事件
- **AND** 触发所有匹配该 componentId + eventId 的蓝图规则

#### Scenario: API 数据源加载失败
- **WHEN** 图表组件的 `useApiDataSource` 状态从 `loading` 变为 `error`
- **AND** 当前处于预览模式
- **THEN** 系统派发 `{ kind: 'componentEvent', componentId, eventId: 'dataError' }` 事件

#### Scenario: 数据集数据源加载成功/失败
- **WHEN** 图表组件的 `useDatasetSource` 状态从 `loading` 变为 `success`/`error`
- **AND** 当前处于预览模式
- **THEN** 系统派发对应的 `dataLoaded`/`dataError` 事件

#### Scenario: 编辑器画布运行时关闭时不派发
- **WHEN** 组件在编辑器画布中渲染且 `eventsEnabled=false`
- **THEN** 即使数据源状态变化，事件也会被运行时总闸门丢弃
- **AND** 重新开启不会因回调换绑重放关闭期间已完成的数据状态

#### Scenario: 状态未变化时不重复派发
- **WHEN** 数据源状态从 `success` 因定时刷新再次变为 `success`
- **THEN** 仍派发 `dataLoaded` 事件（每次刷新成功都派发，符合用户配置定时刷新后期望每次刷新都触发动作的语义）

### Requirement: V1/V2 interval 触发器调度

系统 SHALL 在运行时为所有 V1/V2 蓝图的 `interval` 触发器建立隔离的 `setInterval` 调度。

#### Scenario: interval 触发器调度
- **WHEN** V1 蓝图编译后的规则集中存在 `triggerConfig.type === 'interval'` 的规则
- **AND** 预览运行时启用
- **THEN** 系统按 `triggerConfig.intervalMs` 建立 `setInterval`
- **AND** 每次 tick 仅执行该 timer 所属规则，不提前或重复执行其他周期的规则

#### Scenario: 卸载时清理
- **WHEN** 预览页卸载或蓝图变化导致规则集变化
- **THEN** 系统清理所有已建立的 `setInterval`，无浮动定时器

#### Scenario: 蓝图禁用时不调度
- **WHEN** `isEnabled === false`（无蓝图或编译失败）
- **THEN** 不建立任何 `setInterval`

## MODIFIED Requirements

### Requirement: RendererComponentProps

`RendererComponentProps` 新增 `componentId: string` 字段，所有组件 renderer 接收此字段（不强制消费）。

```typescript
export interface RendererComponentProps {
  componentId: string;  // 新增
  props: Record<string, unknown>;
  style: ComponentStyle;
  dataSource?: DataSourceConfig;
  logic?: LogicConfig;
  interaction?: InteractionConfig;
  apiRawDataOverride?: unknown;
}
```

### Requirement: use-blueprint-preview-runtime

新增 V1/V2 `interval` 触发器调度逻辑：
- 扫描编译规则中的 interval 规则，按每条规则的 `intervalMs` 建定时器
- 使用 `useEffect` 管理定时器生命周期，规则变化时清理重建
- timer 回调仅向执行器传入所属规则，避免多规则交叉触发

## REMOVED Requirements

无（向后兼容，不删除任何现有能力）。
