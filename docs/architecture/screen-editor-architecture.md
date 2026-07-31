# 大屏设计器架构

> 状态：生效中
> 最近更新：2026-08-01
> 定位：核心 feature 的架构说明。读完应能理解画布/组件/工具/属性面板/数据层如何协作，以及在哪里扩展

> 注：本文档 State Shape 中的 `eventsEnabled` 字段已被 [introduce-canvas-interaction-modes](../specs/introduce-canvas-interaction-modes/spec.md) 规格替换为 `interactionMode: 'design' | 'interactive'`（状态栏"设计/交互"模式切换）。在本文档完成同步更新前，请以该规格与代码实现（`apps/web/src/features/screen/stores/editor-store.ts`）为准。

## 1. 定位与边界

大屏设计器是 Nebula 的核心 feature，位于 `apps/web/src/features/screen/`。它是一个类 Figma / GoView 的低代码可视化编辑器：

- **画布**：拖拽式布局，支持选择/移动/缩放/旋转/框选/创建
- **组件库**：文本/柱状图/矩形/椭圆/图片，可扩展
- **属性面板**：声明式 Schema 驱动渲染
- **事件蓝图**：节点编辑器编排交互逻辑（单独文档说明，见 [blueprint-runtime-architecture.md](./blueprint-runtime-architecture.md)）
- **数据层**：静态数据 / API 数据源 + 字段映射 + 逻辑层

**不在本文档范围**：蓝图系统（见独立文档）、后端 ScreenProject 持久化（见系统总览）。

## 2. 目录组织

```
features/screen/
├── index.ts                 feature 公共 API 出口
├── api.ts                   TanStack Query 数据 hooks（与后端通信）
├── hooks.ts                 转发常用 hook
├── stores/
│   └── editor-store.ts      Zustand 编辑器状态（唯一持久化数据源）
├── registry/                组件注册表
│   ├── index.ts             COMPONENT_DEFINITIONS 单一数据源
│   ├── renderer.tsx         ComponentRenderer 统一渲染器
│   ├── component-container-style.ts  容器样式纯函数
│   └── components/          各组件 renderer 实现
├── components/              编辑器壳层 UI
│   ├── screen-editor.tsx    编辑器主组件
│   ├── screen-canvas.tsx    画布（最复杂，~2000 行）
│   ├── toolbar/             工具栏
│   ├── panels/              左右面板（组件库/图层/属性）
│   ├── ui-primitives/       PanelSection / ToolbarButton 等基础件
│   └── ...                  对话框、状态栏、context-menu 等
├── property-schema/         属性面板声明式 Schema 系统
│   ├── types.ts             PropertyField / PropertySection / PropertySchema
│   ├── schemas.tsx          各组件的 Schema 注册表
│   ├── section-renderer.tsx 三层渲染器
│   ├── field-controls.tsx   字段控件（number/color/text/select/switch）
│   └── path-utils.ts        getByPath / buildNestedUpdate
├── hooks/                   编辑器会话、状态机、快捷键等
├── lib/                     纯函数库（事件路由/解析管线/智能对齐等）
└── blueprint/               事件蓝图子系统（独立文档）
```

**测试与源码同目录**：`*.test.ts(x)` 紧邻源码，覆盖率完整。

## 3. 编辑器状态管理（editor-store.ts）

### 技术选型

**Zustand + devtools middleware**。开发模式下在 `editor-store.ts` 中通过 `window.__screenEditorStore` 暴露给 Playwright E2E。

### State Shape 核心字段

```ts
{
  project: ScreenProject | null       // 当前项目（components/canvas/blueprint/name）
  selectedComponentIds: string[]
  canvasScale / canvasOffset          // 视口变换
  history: { past[]; future[] }       // 历史栈（三重快照：components + canvas + blueprint）
  clipboard / pasteCount              // 内存剪贴板（不入历史）
  snapEnabled / smartGuidesEnabled / gridEnabled / gridSize
  activeGroupId: string | null        // 当前进入的分组（Figma "Enter Frame" 语义）
  eventsEnabled: boolean              // 主编辑画布蓝图运行时总闸门（本地偏好）
  isDirty: boolean                    // 本地脏状态
  blueprintGesture: { active; baseline }  // 蓝图拖拽手势（高频合并入历史）
}
```

### 关键设计：withHistory 高阶函数

所有"入历史栈 + 应用业务更新"封装为：

```ts
withHistory(set, actionName, updater)
```

自动推入快照、清空 future、置 `isDirty=true`。`updateCanvas` / `updateBlueprint` 含"无变化不入栈"短路（深比较 JSON.stringify）。

### 蓝图手势模式

蓝图节点拖拽是高频操作，每帧产生一条历史会导致 undo 栈爆炸：

- `beginBlueprintGesture`：记录 baseline，期间 `updateBlueprint` 仅更新数据 + 置脏，**不入栈**
- `endBlueprintGesture`：有净变化时补一条历史（快照取手势起点 baseline），使 undo 回到手势前

### 主要 Actions 分类（约 50+ 个）

| 类别 | Actions |
|---|---|
| 项目 | loadProject / renameProject |
| 选择 | selectComponent / selectComponents / clearSelection |
| 组件 CRUD | addComponent / renameComponent / updateComponent / removeComponent |
| 画布/蓝图 | updateCanvas / updateBlueprint + 手势 begin/end |
| 视口 | setCanvasScale / setCanvasOffset / resetViewport |
| 图层 | reorderComponent / reorderToTop / reorderToBottom |
| 复制粘贴 | duplicateSelected / copySelectedToClipboard / pasteFromClipboard |
| 历史 | undo / redo / canUndo / canRedo |
| 对齐分布 | alignSelectedHorizontal/Vertical / distributeSelected |
| 分组 | groupSelected / ungroupSelected / setActiveGroupId |

## 4. 组件注册表（registry/）

### COMPONENT_DEFINITIONS — 单一数据源

`registry/index.ts` 维护组件元数据表：

```ts
{
  type: string;             // 'text' | 'bar-chart' | 'rect' | 'ellipse' | 'image'
  name: string;             // 中文名
  category: string;         // 'chart' | 'text' | 'media' | 'decoration'
  icon: string;             // lucide-react 图标名
  keywords: string[];       // 搜索别名
  description: string;
  defaultProps: object;
  defaultSize: { width; height };
  defaultStyle?: object;
}
```

辅助函数：`getDefinitionByType` / `getDefinitionsByCategory` / `searchComponentDefinitions` / `createComponentInstance`。

### 渲染器分发

`renderer.tsx` 维护 `RENDERERS: Record<type, ComponentType>`，`ComponentRenderer` memo 化包装，根据 `component.type` 查表渲染，未注册类型显示"未知组件"占位。

`RendererComponentProps` 透传四层配置 + 蓝图 override：

```ts
{
  props / style           // 视觉层
  dataSource / logic      // 数据层 + 逻辑层
  interaction             // 交互层
  apiRawDataOverride?     // 蓝图 refreshDataSource 写入的覆盖数据
}
```

### 容器样式纯函数

`component-container-style.ts` 提供 `resolveComponentContainerStyle(component)`，输出 React CSSProperties。

**Canvas Drag Optimization**：组件定位用 `transform: translate()` 替代 `left/top`（GPU 合成层避免布局重排），store 层 `position.x/y` 语义不变。

### 新增组件步骤

1. 在 `@nebula/shared` 添加类型与默认 props
2. 在 `registry/components/` 新建 renderer，实现 `RendererComponentProps` 契约
3. 在 `registry/index.ts` 的 `COMPONENT_DEFINITIONS` 追加定义
4. 在 `registry/renderer.tsx` 的 `RENDERERS` 注册映射
5. 在 `property-schema/schemas.tsx` 注册属性 Schema（未注册回退 `DEFAULT_SCHEMA`）

详见 [development-guide.md](./development-guide.md)。

## 5. 画布系统（screen-canvas.tsx）

基于 **react-moveable + react-selecto** 实现"选择/拖拽/缩放/旋转/框选/创建"全套交互。约 2000 行，是编辑器最复杂的组件。

### 渲染结构

```
<div ref={containerRef} onPointerDown/Move/Up>           画布容器（接收 pointer 事件）
  <div ref={canvasTransformRef} style={translate3d+scale}> GPU 合成层变换
    <div ref={contentRef} style={canvas.width/height/bg}>  画布内容层（接收 onDrop）
      {visibleComponents.map(...)}                          CanvasComponentWrapper（memo 化）
      <Moveable ... />                                      控制框
    </div>
  </div>
  <Selecto ... />                                           框选
```

### 能力驱动 UI（核心架构）

Moveable/Selecto 的启用状态完全由 `TOOL_REGISTRY` 的 capabilities 派生：

```ts
moveableDraggable  = activeCapabilities.canDrag
moveableResizable  = activeCapabilities.canResize
moveableRotatable  = activeCapabilities.canRotate
selectoSelectByClick = activeCapabilities.canSelect
```

新增工具只需在 `TOOL_REGISTRY` 注册定义，画布自动响应。

### 双状态机正交

| 状态机 | 职责 | 实现位置 |
|---|---|---|
| **工具状态机** | activeTool/currentTool + 临时切换栈（按住 Space 临时抓手） | `hooks/use-tool-state-machine.ts` |
| **交互状态机** | 11 状态 × 21 事件的转换表（idle/dragging/resizing/rotating/panning/...） | `hooks/use-interaction-state-machine.ts` |

两者独立演进，通过 `useEditorSession` 组合为单一入口下发到画布/工具栏/状态栏/快捷键。

### 会话控制器（useEditorSession）

`ScreenEditor` 中创建一次，字段拥有者划分：

- **工具状态**：activeTool/currentTool/hasTemporaryTool/setTool/push/pop
- **交互状态**：interactionState/isInteracting/dispatchInteraction
- **活动工具能力**：activeCapabilities/hasCapability（从 TOOL_REGISTRY 派生，只读）
- **文本编辑**：textEditing/beginTextEditing/endTextEditing

`setToolWithCleanup`：切换工具派发 `cancel` 让交互状态机恢复 idle（避免残留状态卡死）。

### Moveable 事件链关键点

- **状态机仲裁**：所有手势开始处检查 `interactionState` 是否在 `SELECTO_ALLOWED_STATES`（idle/hovering/marquee-selecting），非法重入返回 false
- **Alt+拖拽复制（PS 风格）**：onDragStart 时 `cloneNode(true)` 克隆 DOM，拖拽中移动克隆体（原件不动），onDragEnd 调用 `duplicateSelectedToPosition`
- **Canvas Drag Optimization**：用 `e.beforeTranslate` 替代 left/top DOM 回读（无精度损失），通过 `composeComponentTransform` 合并 transform 链
- **PS 风格修饰键即时切换**：onResize/onRotate 中实时读取 `shiftRef/altRef`，支持拖拽中按键切换等比/中心模式
- **rAF 节流**：`gestureRafThrottlerRef` 节流 store 更新与 Smart Guides，DOM style 同步执行；手势结束 `cancel()` 丢弃挂起任务
- **状态机恢复**：所有 onDragEnd/onResizeEnd **无条件** `dispatchInteraction('pointer-up')`（修复纯点击零位移漏发）

### Selecto 框选逻辑

- **onDragStart**：非 canSelect 工具 `e.stop()`；点击未选中组件时 `flushSync(selectComponents) + moveableRef.dragStart` 同步启动拖拽（消除两步视觉抖动）
- **onSelectEnd**：委托纯函数 `handleSelectEnd`（lib/canvas-event-router.ts）决策 — 双击进入分组 / 单击顶层退出分组 / 单击分组内组件按 activeGroupId 决定选中

### 视口与缩放

- Alt/Ctrl/Cmd+滚轮统一走 `zoomWithBoundary`（边界 [0.1, 5] + 锚点不变性）
- 缩放工具点击：Alt 反向

### 编辑器画布蓝图运行时

- 底部状态栏 `Event` 控制主编辑画布的完整蓝图运行时，不只控制 `componentClick`
- 关闭时不调度 `pageLoad` / `interval`、不接收 click/hover/data 事件，并阻断异步链后续动作
- 开启时 `setVisibility` 与 `refreshDataSource` 的临时覆盖会在编辑画布即时呈现，不写入项目数据或历史栈
- 重新关闭会中止进行中的请求并恢复项目原始显隐与数据；独立预览页和蓝图沙盒不受此本地偏好影响

### 性能优化要点

- `componentMap`（Map<id, component>）替代 12 处 `Array.find`，O(N) → O(1)
- `visibleComponents` memo 化（filter hidden + sort by zIndex）
- `selectedGeometryFingerprint` 位置/尺寸指纹，仅在真正影响 rect 的字段变化时触发 `moveableRef.updateRect()`
- `SNAP_DIRECTIONS / ELEMENT_SNAP_DIRECTIONS` 模块级常量，避免每次渲染产生新引用
- `useDimensionStore` 独立 Zustand：拖拽过程中的尺寸/位置提示剥离，避免高频回调触发整个画布重渲染

## 6. 工具系统

### tool-registry.ts — 单一数据源

```ts
EditorTool = 'select' | 'hand' | 'text' | 'rect' | 'ellipse' | 'image' | 'zoom'

ToolCapabilities = {
  canSelect; canDrag; canResize; canRotate; canPan; canCreate; canZoom  // 全 readonly
}

ToolDefinition = { id; name; icon; shortcutId; cursor; capabilities; implemented }
```

辅助函数：`getToolById` / `getImplementedTools` / `hasCapability`。

**所有权边界**：`TOOL_REGISTRY` 拥有工具 ID/名称/图标/能力；`SHORTCUTS_REGISTRY` 拥有实际键位；两者通过 `shortcutId` 建立唯一引用。

### 快捷键系统

`shortcuts-registry.ts` 是约 60+ 条目的单一数据源，同时供 `use-keyboard-shortcuts.ts` 绑定和 `shortcuts-help-dialog.tsx` 渲染。

8 个 category：file/edit/view/component/align/help/tool/ui。

**防冲突方法论**：`browserConflict='overridable'` 必须搭配 `preventDefault='always'` 或 `'callback-only'`；DEV 环境自动 `validateRegistry` 输出警告。

## 7. 属性面板系统（property-schema/）

三层声明式架构，单向数据流（所有写入经 `onUpdate → store.updateComponent`）。

### 类型层

```ts
PropertyTabId = 'appearance' | 'data' | 'interaction' | 'events'

PropertyField =
  | DeclarativeField  // { kind: 'field'; control; label; path; defaultValue?; visibleWhen? }
  | CustomField       // { kind: 'custom'; render: (ctx) => ReactNode }  逃生舱

PropertySection = { id; title; tab; fields?: PropertyField[]; customRender?: (ctx) => ReactNode }
PropertySchema = PropertySection[]
```

**四大类分类语义**：所有分区按 `tab` 字段归入四大类——`appearance`（属性：位置/样式/文本/变换/层级/滤镜）、`data`（数据：数据源/字段映射/逻辑层）、`interaction`（交互：tooltip 等行为）、`events`（事件：QuickEventEditor 派生视图）。即使是 `customRender` 分区也必须声明 `tab`，由渲染器按 tab 归入对应容器。

### Schema 注册表

预定义可复用分区：

| 分区 | tab | 说明 |
|---|---|---|
| `POSITION_SECTION` | appearance | 位置/尺寸/旋转 |
| `STYLE_SECTION` | appearance | 背景/透明度/边框/圆角 |
| `TEXT_PROPS_SECTION` | appearance | 文本属性（含字间距 `letterSpacing` / 描边宽度 `textStrokeWidth` / 描边色 `textStrokeColor`） |
| `TRANSFORM_SECTION` | appearance | 水平/垂直翻转 |
| `LAYER_STATUS_SECTION` | appearance | 层级状态：名称（`name`）/ 层级（`zIndex`）/ 锁定（`status.locked`）/ 隐藏（`status.hidden`），默认折叠 |
| `FILTER_SECTION` | appearance | 组件滤镜，6 个 CSS filter 参数：`hueRotate` / `saturate` / `brightness` / `contrast` / `blur` / `grayscale`，默认折叠 |
| `EVENTS_SECTION` | events | customRender 挂载 `<QuickEventEditor>`，派生当前组件相关事件规则 |

```ts
PROPERTY_SCHEMAS: Record<string, PropertySchema> = {
  text: TEXT_SCHEMA,
  'bar-chart': BAR_CHART_SCHEMA,  // 按 tab 分布：appearance 视觉层 / data 数据源+逻辑 / interaction 悬停提示 / events QuickEventEditor
}
```

未注册类型回退到 `DEFAULT_SCHEMA`：位置 + 样式 + 变换 + 层级状态 + 滤镜 + 数据占位 + 交互占位 + 事件，构成完整四 tab 语义边界。

### 渲染器三层

1. `PropertySchemaRenderer`：按 tab 分组，**涉及 2+ tab 时始终启用 Tabs 容器**（不再因 customRender 退化为平铺）；customRender 分区按其 `tab` 字段归入对应 tab 的 `TabsContent`，Radix `TabsContent` 仅渲染活跃 tab 内容
2. `PropertySectionRenderer`：customRender 直接输出（不套 PanelSection，由子组件自行渲染）；否则套 PanelSection + 字段列表
3. `DeclarativeFieldRenderer`：从 `FIELD_CONTROLS` 查控件，`getByPath` 取值 + `buildNestedUpdate` 构造嵌套 partial

### 未选中组件时的入口

未选中任何组件时右侧面板不渲染 Schema，改为渲染「画布设置」分区与「全局变量管理面板」（`components/global-variables-panel.tsx`）。全局变量是项目级共享的命名变量，可在数据源参数与蓝图模板中通过 `{{globalVars.xxx}}` 引用，详见 [蓝图运行时架构 - 右侧面板派生视图](./blueprint-runtime-architecture.md#右侧面板派生视图)。

### 字段控件

```ts
FIELD_CONTROLS = {
  number: NumberField,    // PS 风格微调 + draft 提交
  color: ColorField,      // 取色器 + 文本输入
  text: TextField,
  textarea: TextAreaField,
  select: SelectField,    // Radix Select
  switch: SwitchField,    // Radix Switch
}
```

### 路径工具

- `getByPath(source, 'style.fontSize')`：点分路径读
- `buildNestedUpdate(source, 'position.x', 100) → { position: { ...source.position, x: 100 } }`：不可变嵌套 partial

## 8. 数据层架构

### DataSourceConfig 判别联合

```ts
type DataSourceConfig =
  | { type: 'static'; staticData; dataPath?; fieldMapping? }
  | { type: 'api'; apiConfig; dataPath?; fieldMapping? }
```

`LogicConfig`：`sortField` / `sortDirection` / `limit`。

### chart-data-parser.ts — 纯函数管线

4 步管线：

1. **extractDataByPath**：点分路径提取（支持数组索引）
2. **mapFieldsToChartData**：字段映射 + 类型校验，未配置时 `inferFieldMapping` 推断
3. **applyLogicConfig**：排序 + 条数限制
4. **parseChartData**：统一入口，产出 `ParseResult` 判别联合

`ParseResult = ParseSuccess | ParseEmpty | ParseError`，错误原因可区分（not-an-array / path-not-found / missing-dimension-field 等），面向用户可读。

### 数据流（以 BarChartComponent 为例）

```
effectiveDataSource = dataSource ?? (props.data 存在时回退 static)
  ↓
apiConfig = effectiveDataSource.type === 'api' ? effectiveDataSource.apiConfig : undefined
  ↓
apiState = useApiDataSource(apiConfig)      // GET 请求 + 三态 + 取消协议
  ↓
apiRawData = apiRawDataOverride ?? (apiState.success ? apiState.data : undefined)
  ↓
parseResult = useChartData(effectiveDataSource, logic, apiRawData)
  ↓
按 parseResult.status 渲染：loading / error / empty / success
```

**四层分层**贯穿整个组件配置：数据层（dataSource）/ 逻辑层（logic）/ 视觉层（props+style）/ 交互层（interaction）。

## 9. 核心库函数（lib/）

| 文件 | 职责 |
|---|---|
| `canvas-event-router.ts` | 事件路由纯函数：hit-test / 双击判定 / 缩放数学 / Selecto 决策 |
| `chart-data-parser.ts` | 数据解析管线 |
| `smart-guides.ts` | 智能对齐线：9 水平 + 9 垂直对齐组合 |
| `raf-throttle.ts` | `createRafThrottler()`，同帧多次调用仅最后一次生效 |
| `zoom-boundary.ts` | 缩放边界约束 [0.1, 5] + 锚点不变性 |
| `shape-creation-geometry.ts` | 拖拽创建形状几何计算 |
| `text-editing-contract.ts` | 文本编辑契约（提交/取消/新建删除语义） |
| `image-file-adapter.ts` | 图片文件选择与 dataUrl 转换 |
| `layer-commands.ts` | 图层命令（置顶/置底等） |
| `preferences-persist.ts` | localStorage 持久化偏好 |
| `data-source-migration.ts` | 旧 props.data 迁移到 dataSource.staticData |
| `finalize-cancel-protocol.ts` | API 数据源 AbortController 管理 |

## 10. 关键架构亮点

1. **会话控制器单一入口**：`useEditorSession` 组合双状态机 + 能力派生 + 文本编辑，画布/工具栏/快捷键共享同一实例
2. **能力驱动 UI**：Moveable/Selecto 完全由 `TOOL_REGISTRY` capabilities 派生，新增工具只需注册定义
3. **Canvas Drag Optimization**：transform translate + beforeTranslate + rAF 节流 + 模块级常量
4. **声明式属性面板**：Schema → Section → Field 三层 + customRender 逃生舱
5. **数据层纯函数管线**：4 步解析，判别联合 ParseResult 可区分错误
6. **历史栈三重快照**：components + canvas + blueprint 共享时间线，蓝图手势合并高频拖拽
7. **快捷键单一数据源**：同时驱动绑定与帮助面板，防冲突方法论
8. **事件路由层归一化**：hit-test、双击、缩放、Selecto 决策抽取为纯函数

## 11. 扩展指南

| 我想... | 看哪里 |
|---|---|
| 新增一个大屏组件 | [development-guide.md](./development-guide.md) "新增大屏组件" |
| 新增一个工具 | `tool-registry.ts` + `shortcuts-registry.ts` |
| 新增属性面板字段类型 | `property-schema/field-controls.tsx` 的 `FIELD_CONTROLS` |
| 新增数据源类型 | `@nebula/shared` 的 `DataSourceConfigSchema` + `chart-data-parser.ts` |
| 改画布交互 | `screen-canvas.tsx` + `lib/canvas-event-router.ts` |
| 加快捷键 | `shortcuts-registry.ts` |
| 加蓝图节点/动作 | [blueprint-runtime-architecture.md](./blueprint-runtime-architecture.md) |

## 12. 关联文档

- [系统总览](./system-overview.md)
- [蓝图运行时架构](./blueprint-runtime-architecture.md)
- [编码规范](../conventions/coding-standards.md)
- [开发指南](./development-guide.md)
