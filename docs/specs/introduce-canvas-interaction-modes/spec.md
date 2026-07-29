# 大屏画布交互模式与事件管控 Spec

> 状态：生效中
> 最近更新：2026-07-29
> 定位：从大屏设计器整体视角统一画布编辑输入、组件原生交互与事件蓝图运行时，采用小步快跑方式落地

## Why

当前底部状态栏的 `eventsEnabled` 仅以“Event”开关呈现，但实际会启用完整蓝图运行时，包括 click、hover、dataLoaded、dataError、pageLoad、interval 以及导航、请求、数据刷新、显隐等动作。与此同时，画布仍处于可选择、可拖拽、可缩放的编辑状态，导致设计器手势与组件业务事件争抢同一组鼠标输入。

系统需要从“大屏设计器工作模式”而非“单个蓝图开关”的角度建立统一规则：编辑时优先保障布局操作，调试时让画布交互可预测，完整预览时复用最终运行环境；并确保运行时状态不会污染设计数据。

## Goals

- 为用户建立明确的“设计—交互调试—完整预览”工作流。
- 默认设计状态下不触发组件业务交互和事件蓝图，避免拖拽、框选、缩放期间误触。
- 交互调试状态下由组件运行时接管画布组件区域，禁止选择、拖拽、缩放、旋转等冲突操作。
- 统一管控组件原生交互、容器事件和事件蓝图，不再只管控蓝图回调。
- 交互调试使用独立运行时会话，进入时初始化，退出时彻底清理，不写入项目数据和历史栈。
- 保持公开预览与编辑器预览的完整运行时语义，不降低现有预览能力。
- 先交付最小闭环，再按实际组件需求扩展 hover 离开、事件 payload 和高级调试能力。

## Non-Goals

本次规格不包含：

- 新增事件蓝图触发器或动作类型。
- 重构蓝图编译器、V1/V2 执行器及节点编辑器。
- 建设完整的断点、单步执行、事件时间线等高级调试器。
- 为所有未来图表库定义具体事件参数。
- 第一阶段实现触摸端多指手势、键盘业务事件或组件内部拖拽协议。
- 第一阶段将整个编辑器壳层变为只读；本次只保证画布直接编辑操作在交互调试状态下被禁止。

## Product Model

### 工作状态

系统面向用户提供三种工作状态，但不要求三者都存入同一个 Store 字段：

| 工作状态 | 所在位置 | 设计器画布操作 | 组件原生交互 | 事件蓝图 | 主要用途 |
| --- | --- | --- | --- | --- | --- |
| 设计 | 编辑器画布 | 开启 | 关闭 | 关闭 | 搭建布局、配置组件与蓝图 |
| 交互调试 | 编辑器画布 | 关闭冲突操作 | 开启 | 开启 | 在编辑器上下文中快速验证交互 |
| 完整预览 | 独立预览路由 | 全部关闭 | 开启 | 开启 | 验证最终大屏运行效果 |

编辑器内部状态只需要表达：

```ts
export type CanvasInteractionMode = 'design' | 'interactive';
```

“完整预览”继续使用现有 `/screen-editor-preview/$id` 与 `/screen-preview/$id` 路由，不作为编辑器画布内的第三个布尔组合。

### 输入所有权

画布输入按以下优先级处理：

```text
设计器系统命令
  → 当前工具与编辑手势
  → 组件原生交互
  → 事件蓝图派发
```

- `design` 下，设计器拥有组件区域的指针输入，组件业务交互和蓝图派发均关闭。
- `interactive` 下，组件运行时拥有组件区域的指针输入，Selecto、Moveable 和创建工具不得启动新的编辑手势。
- 完整预览下不存在编辑器输入层。
- 无论处于何种模式，蓝图事件派发入口都必须进行最终门控，不能只依赖 DOM 事件是否绑定。

### 运行时会话

一次交互调试由进入 `interactive` 开始，由退出到 `design`、切换项目或卸载编辑器结束。

会话状态包括：

- `visibilityOverrides`
- `apiDataOverrides`
- interval 定时器
- 数据刷新请求与 AbortController
- pageLoad 是否已触发
- 运行时内部引用与待执行异步任务

会话规则：

1. 进入交互调试时创建干净会话，并按完整运行时语义触发一次 `pageLoad`、启动有效 interval。
2. 交互调试期间，用户触发 click、hover、dataLoaded、dataError 时按现有 V1/V2 规则执行。
3. 编辑画布必须真实消费 `visibilityOverrides` 和 `apiDataOverrides`，使可见性与刷新数据动作可观察。
4. 退出交互调试时停止 interval、取消可取消请求、清空全部 override，不保留到下一次会话。
5. 运行时覆盖不得调用项目更新 API，不进入撤销/重做历史，不设置 `isDirty`。
6. 项目或蓝图上下文发生身份切换时，不得复用上一项目的运行时覆盖。

## Small-Step Delivery Strategy

### P0：模式语义与误触隔离

先将 `eventsEnabled` 升级为编辑器内部的 `interactionMode`，状态栏改成明确的“设计/交互”模式切换。交互调试时禁用画布选择、框选、拖拽、缩放、旋转和创建，设计模式下不绑定业务 click/hover、不向组件注入事件派发能力。

该阶段解决最核心问题：用户拖拽和布局时不会触发业务事件；需要测试交互时通过显式模式切换完成。

### P1：运行时会话闭环

让编辑画布消费蓝图可见性与数据覆盖，并在模式关闭、项目切换和组件卸载时重置运行时会话，保证交互调试结果可见且不泄漏。

### P2：体验与回归完善

补齐状态栏提示、模式视觉反馈、快捷退出、关键单元测试和浏览器级场景；同步修正文档中 pageLoad、编辑器预览和完整运行时边界的过期描述。

### Deferred：按需求扩展

以下能力不进入首轮实现，待真实组件需求出现后再独立立项：

- hoverEnd / pointerLeave 事件。
- 蓝图事件 payload 贯通。
- 只启用原生交互但不执行蓝图等高级调试组合。
- navigate、requestApi 的沙盒或二次确认策略。
- 事件执行时间线、断点与单步调试。
- 触摸端手势仲裁。

## What Changes

- 将 `eventsEnabled: boolean` 演进为 `interactionMode: 'design' | 'interactive'`。
- 将状态栏 `Event` 开关改为语义明确的画布模式控制，默认显示“设计”。
- 设计模式统一关闭组件业务 click、hover、组件内部事件派发和蓝图运行时。
- 交互调试模式统一开启组件原生交互和蓝图运行时，并暂停冲突的画布编辑能力。
- 为画布建立统一的交互能力派生结果，不让组件直接理解 Store 细节。
- 编辑画布消费运行时的可见性覆盖和 API 数据覆盖。
- 为蓝图预览运行时增加明确的会话重置边界。
- 保留完整预览路由现有行为，并明确其与编辑器交互调试的关系。
- 迁移既有本地偏好：`eventsEnabled=true` 不自动恢复为交互调试，统一安全回退到 `design`。
- **BREAKING**：移除状态栏和 Store 对 `eventsEnabled`、`toggleEvents` 的直接公开语义，相关调用迁移到 `interactionMode`、`setInteractionMode`。

## Impact

- Affected specs:
  - 大屏编辑器画布交互
  - 事件蓝图预览运行时
  - 编辑器状态栏与偏好持久化
  - 编辑器内预览与公开预览边界
- Affected code:
  - `apps/web/src/features/screen/stores/editor-store.ts`
  - `apps/web/src/features/screen/lib/preferences-persist.ts`
  - `apps/web/src/features/screen/components/canvas-status-bar.tsx`
  - `apps/web/src/features/screen/components/screen-canvas.tsx`
  - `apps/web/src/features/screen/components/screen-preview-canvas.tsx`
  - `apps/web/src/features/screen/registry/renderer.tsx`
  - `apps/web/src/features/screen/components/preview-component-renderer.tsx`
  - `apps/web/src/features/screen/blueprint/runtime/component-event-context.ts`
  - `apps/web/src/features/screen/blueprint/runtime/use-blueprint-preview-runtime.ts`
  - `apps/web/src/features/screen/blueprint/runtime/use-blueprint-runtime-deps.ts`
  - 对应单元测试与 E2E 测试
- Persistence impact:
  - 不修改后端数据库或 `ScreenProject` Schema。
  - 交互模式是浏览器会话/用户偏好，不属于项目设计数据。

## ADDED Requirements

### Requirement: 编辑器画布模式

系统 SHALL 在编辑器画布提供 `design` 与 `interactive` 两种互斥模式，默认模式为 `design`。

#### Scenario: 首次打开编辑器

- **WHEN** 用户首次打开任意大屏项目
- **THEN** 画布处于设计模式
- **AND** 用户可以选择、框选、拖拽、缩放和旋转组件
- **AND** 组件业务 click、hover 与事件蓝图不会触发

#### Scenario: 切换到交互调试

- **WHEN** 用户在状态栏将画布切换到交互调试
- **THEN** 组件原生交互和事件蓝图运行时启用
- **AND** 组件选择、框选、拖拽、缩放、旋转和创建操作不再启动
- **AND** 状态栏和画布提供可识别的“交互调试中”视觉反馈

#### Scenario: 返回设计模式

- **WHEN** 用户切回设计模式或按下 Escape
- **THEN** 画布立即恢复设计操作能力
- **AND** 组件业务事件与蓝图运行时立即停止
- **AND** 交互调试产生的临时运行状态被清理

### Requirement: 统一事件门控

系统 SHALL 通过统一的画布交互上下文派生原生交互、蓝图派发和设计器操作能力，不允许各组件自行读取 `eventsEnabled` 决定行为。

最低能力契约为：

```ts
interface CanvasInteractionCapabilities {
  mode: CanvasInteractionMode;
  canEditCanvas: boolean;
  canDispatchNativeEvents: boolean;
  canDispatchBlueprintEvents: boolean;
}
```

#### Scenario: 设计模式中的点击

- **WHEN** 用户在设计模式下点击一个带 click 蓝图规则的组件
- **THEN** 组件按现有设计器规则被选中
- **AND** click 蓝图规则不执行
- **AND** 组件内部按钮、图表点击等业务行为不执行

#### Scenario: 设计模式中的悬停

- **WHEN** 用户在设计模式下把鼠标移入带 hover 规则或 tooltip 的组件
- **THEN** hover 蓝图规则不执行
- **AND** 业务 tooltip 不显示
- **AND** 设计器自身的悬停命中和光标反馈可以继续工作

#### Scenario: 交互调试中的点击

- **WHEN** 用户在交互调试模式下点击组件
- **THEN** 组件原生 click 行为可以执行
- **AND** 对应蓝图 click 规则可以执行
- **AND** 本次操作不会选中或拖拽组件

#### Scenario: 派发入口兜底

- **WHEN** 某组件在不允许派发蓝图事件的状态下调用统一事件回调
- **THEN** 运行时忽略该事件
- **AND** 不执行任何蓝图动作

### Requirement: 编辑能力门控

系统 SHALL 在交互调试模式下通过工具能力和画布手势入口共同阻止直接编辑操作，而不是依赖全局 `pointer-events: none` 或捕获阶段粗暴阻断全部 DOM 事件。

#### Scenario: 交互调试时尝试拖拽

- **WHEN** 用户在交互调试模式下按住组件并移动鼠标
- **THEN** 组件位置不改变
- **AND** Moveable 不进入 dragging 状态
- **AND** 不产生历史记录或 `isDirty` 变化

#### Scenario: 交互调试时尝试框选

- **WHEN** 用户在画布空白区域拖动鼠标
- **THEN** Selecto 不开始框选
- **AND** 当前选择状态不因该手势改变

#### Scenario: 交互调试时使用视口能力

- **WHEN** 用户在交互调试模式下使用状态栏缩放、适应画布或允许的视口操作
- **THEN** 视口能力保持可用
- **AND** 不触发组件设计数据修改

### Requirement: 独立运行时会话

系统 SHALL 为每次交互调试建立独立运行时会话，并在会话边界清理所有临时状态和资源。

#### Scenario: 进入交互调试

- **WHEN** 画布从设计模式切换到交互调试
- **THEN** 系统使用当前项目组件和蓝图创建干净运行时会话
- **AND** pageLoad 仅执行一次
- **AND** 有效 interval 规则开始调度

#### Scenario: 退出交互调试

- **WHEN** 画布从交互调试切回设计模式
- **THEN** interval 定时器停止
- **AND** 可取消的数据请求被取消
- **AND** `visibilityOverrides` 与 `apiDataOverrides` 被清空
- **AND** 再次进入交互调试时不会看到上一次会话的临时结果

#### Scenario: 切换项目

- **WHEN** 编辑器加载另一个项目
- **THEN** 当前交互调试会话结束
- **AND** 新项目默认进入设计模式
- **AND** 前一项目的运行时状态不会泄漏到新项目

### Requirement: 运行时覆盖在编辑画布可见

系统 SHALL 在交互调试模式下以“设计数据 + 运行时覆盖”的方式渲染组件，不修改项目持久数据。

#### Scenario: 蓝图隐藏组件

- **WHEN** 交互调试中的蓝图动作将目标组件设为不可见
- **THEN** 目标组件在当前交互调试会话中不可见
- **AND** `component.status.hidden` 不被修改
- **AND** 退出交互调试后目标组件按设计数据重新显示

#### Scenario: 蓝图刷新数据源

- **WHEN** `refreshDataSource` 成功返回新数据
- **THEN** 目标组件在交互调试中使用 `apiDataOverrides` 渲染新数据
- **AND** 原始 `dataSource` 配置不被修改
- **AND** 退出交互调试后覆盖数据被清理

#### Scenario: 历史栈隔离

- **WHEN** 任意蓝图动作只改变运行时覆盖
- **THEN** 撤销/重做历史不增加记录
- **AND** 编辑器 `isDirty` 不因该动作改变

### Requirement: 状态栏模式反馈

系统 SHALL 将当前 `Event` 开关替换为用户可理解的画布模式控制，并明确说明当前模式的输入所有权。

#### Scenario: 设计模式状态栏

- **WHEN** 当前模式为设计
- **THEN** 状态栏显示“设计”
- **AND** tooltip 说明“用于选择和调整组件，组件交互与蓝图事件关闭”
- **AND** 控件具备正确的可访问名称和当前状态

#### Scenario: 交互调试状态栏

- **WHEN** 当前模式为交互调试
- **THEN** 状态栏显示“交互”或等价明确文案
- **AND** tooltip 说明“画布编辑暂停，组件交互与蓝图运行时开启”
- **AND** 画布区域具有不遮挡内容的模式标识

### Requirement: 完整预览边界

系统 SHALL 保持编辑器交互调试与独立完整预览的职责边界，完整预览继续使用现有预览路由和完整运行时。

#### Scenario: 打开编辑器预览

- **WHEN** 用户执行现有“预览”命令
- **THEN** 系统打开 `/screen-editor-preview/$id`
- **AND** 页面不包含 Moveable、Selecto、选中框和编辑器工具手势
- **AND** pageLoad、interval、组件事件和蓝图动作按完整运行时语义工作

#### Scenario: 公开预览

- **WHEN** 访问已发布项目的 `/screen-preview/$id`
- **THEN** 公开预览行为不受编辑器当前交互模式影响
- **AND** 公开预览拥有独立运行时会话

### Requirement: 安全的偏好迁移

系统 SHALL 将交互模式作为安全优先的编辑器偏好处理，不允许旧版 `eventsEnabled=true` 使项目打开后自动执行蓝图副作用。

#### Scenario: 读取旧偏好

- **WHEN** localStorage 中存在旧版 `eventsEnabled=true`
- **THEN** 新版本忽略该自动开启意图并进入 `design`
- **AND** 后续保存使用新的 `interactionMode` 字段

#### Scenario: 读取无效偏好

- **WHEN** `interactionMode` 缺失或值不合法
- **THEN** 系统回退到 `design`

## MODIFIED Requirements

### Requirement: 编辑器画布蓝图集成

原要求“`eventsEnabled` 控制编辑器画布是否派发蓝图事件”修改为：

- 编辑器画布以 `interactionMode` 作为工作模式单一数据源。
- `design` 不编译或运行画布蓝图，不绑定业务 click/hover，不向组件注入事件回调。
- `interactive` 创建完整且隔离的运行时会话，执行 pageLoad、interval、组件事件和动作。
- 编辑画布消费运行时可见性与数据覆盖。
- 模式退出、项目切换和卸载均触发会话清理。

### Requirement: 编辑器内预览

原文档中“编辑器内预览不触发 pageLoad”的描述修改为：

- `/screen-editor-preview/$id` 是完整预览环境。
- 页面加载后触发一次 pageLoad，并按现有规则运行 interval 和组件事件。
- 其运行时状态与编辑器画布、公开预览相互隔离。

### Requirement: 组件 hover 语义

现阶段 `hover` 保持“指针首次进入组件区域时触发一次”的既有语义，并在设计模式下关闭、交互调试和完整预览中开启。

- 本次不新增 hoverEnd。
- 同一组件内部子节点切换不得重复触发容器 hover。
- 后续若需要“移入显示、移出隐藏”，另行增加 `pointerLeave`/`hoverEnd` 事件规格。

## REMOVED Requirements

### Requirement: Event 布尔开关

**Reason**：布尔值无法表达画布输入所有权、组件原生交互和完整蓝图运行时之间的关系，且当前 UI 描述与实际 pageLoad、interval、requestApi 等行为不一致。

**Migration**：

- `eventsEnabled=false` 迁移为 `interactionMode='design'`。
- `eventsEnabled=true` 也安全回退为 `interactionMode='design'`，避免打开项目即执行副作用。
- `toggleEvents()` 替换为 `setInteractionMode(mode)`；如实现需要，可提供仅供 UI 使用的显式切换函数，但不得恢复模糊的 Event 语义。

### Requirement: 编辑器画布同时编辑并触发业务事件

**Reason**：同一指针手势同时承担选中/拖拽与 click/hover 业务语义，会产生不可预测的事件竞争，也增加对 Moveable、Selecto 和浏览器 click 合成时机的依赖。

**Migration**：用户通过明确的“设计/交互”模式切换决定当前画布输入所有权；交互调试中暂停直接画布编辑，返回设计模式后恢复。

## Acceptance Boundaries

首轮实现达到以下边界即可交付：

1. 设计模式下，拖拽、缩放、框选和悬停均不会触发组件业务事件或蓝图动作。
2. 交互调试下，click/hover 和完整蓝图运行时可工作，但组件不能被直接移动或变形。
3. 蓝图显隐与刷新数据动作可在编辑画布中观察，退出模式后恢复设计态。
4. 模式切换和项目切换不会遗留定时器、请求或 override。
5. 公开预览和编辑器预览无回归。
6. 不要求首轮提供高级事件调试器、hoverEnd、payload 或副作用沙盒。
