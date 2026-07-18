# 大屏设计工具交互逻辑架构研究 Spec

## Why

Nebula 的大屏编辑器（`apps/web/src/features/screen/`）已经具备 Photoshop 风格的工具状态机、快捷键注册表、Zustand 编辑器 store、Moveable + Selecto 画布、双场景右键菜单等基础设施。但现有实现是逐功能堆叠而成的，缺少一份系统化的"交互逻辑架构契约"来统辖：

- **事件流分层**：当前事件直接由 React 组件捕获，没有显式的事件路由优先级（画布 vs 组件 vs Moveable 控件层 vs 浮层），导致 modal={false}、双击判定等需要逐处打补丁。
- **交互状态机**：仅存在"工具状态机"（select/hand/text/...），没有覆盖 idle/dragging/resizing/rotating/panning/zooming/text-editing/marquee-selecting 的完整交互状态模型，状态切换的副作用散落各处。
- **直接操作反馈**：缺少 PS 标志性的智能对齐线（Smart Guides 显示阈值）、变换预览浮层与属性面板数值的实时双向同步、像素网格吸附。
- **图层操作**：缺少图层拖拽重排、Alt 拖拽复制图层、空格/小键盘锁定滚动等成熟模式。
- **快捷键语义分层**：现有 `Escape` 已经实现"先退出活动分组，再清空选中"的分层语义，但缺少对 `Tab` 隐藏 UI、`F` 切换屏幕模式、`[`/`]` 调整画笔尺寸等 PS 级交互语义的体系化设计。

本研究的目标是从 Photoshop、Figma、Sketch 等成熟设计软件中提炼一套**可移植到 Web 大屏设计工具**的交互逻辑架构框架，作为 Nebula 后续重构与新功能的"宪法级"参考。

## What Changes

本研究为**纯文档型研究 + 框架定义**，不直接改动代码。产出物包括：

- 分析成熟设计软件（重点 Photoshop）的交互逻辑架构核心层
- 定义 Nebula 大屏编辑器的目标交互架构：**事件路由层 + 交互状态机 + 工具状态机 + 修饰键栈 + 直接操作反馈层 + 面板联动层**
- 提出"PS 交互模式适配表"：列出 PS 的每个交互模式 → Nebula 现状 → 目标状态 → 实现策略
- 识别现有代码的"散落副作用"热点（如 context-menu modal、selecto preventDefault、双击判定、wheel 缩放），给出归一化建议
- 给出与现有 `use-tool-state-machine.ts`、`shortcuts-registry.ts`、`editor-store.ts` 兼容的演进路线

## Impact

- Affected specs: 无（首个 spec，未来交互相关 spec 都应引用本文档）
- Affected code（仅作为后续重构的参考面，本 spec 不直接修改）:
  - [apps/web/src/features/screen/components/screen-canvas.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx) — 事件路由、状态切换副作用
  - [apps/web/src/features/screen/components/canvas-context-menu.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/canvas-context-menu.tsx) — modal=false 补丁、右键重新派发
  - [apps/web/src/features/screen/components/screen-editor.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-editor.tsx) — 顶层架构布局
  - [apps/web/src/features/screen/components/layer-panel.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/layer-panel.tsx) — 图层交互
  - [apps/web/src/features/screen/components/property-panel.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/property-panel.tsx) — 数值同步
  - [apps/web/src/features/screen/hooks/use-tool-state-machine.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-tool-state-machine.ts) — 工具状态机骨架
  - [apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts) — 快捷键集中 hook
  - [apps/web/src/features/screen/hooks/shortcuts-registry.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/shortcuts-registry.ts) — 快捷键单一数据源
  - [apps/web/src/features/screen/hooks/use-modifier-keys.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-modifier-keys.ts) — 修饰键集中监听
  - [apps/web/src/features/screen/stores/editor-store.ts](file:///c:/worker/nebula/apps/web/src/features/screen/stores/editor-store.ts) — 编辑器状态与历史栈

---

## ADDED Requirements

### Requirement: 交互逻辑架构分层模型

系统 SHALL 定义并文档化一个由 6 个正交层组成的交互逻辑架构，每层职责单一、单向依赖、可独立测试：

1. **事件路由层（Event Routing Layer）**：基于 DOM 捕获/冒泡阶段与命中区域（hit-region）的优先级仲裁，决定事件是交给画布、组件、Moveable 控件层、上下文菜单还是浮层。对应现有代码：[canvas-context-menu.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/canvas-context-menu.tsx) 的 `findComponentIdAtPoint` 与 `getComponentIdFromElement` 函数（96–116 行）。
2. **交互状态机（Interaction State Machine）**：覆盖 `idle / hovering / marquee-selecting / dragging / resizing / rotating / panning / zooming / text-editing / context-menu-open` 的正交状态机，与工具状态机解耦。对应现有代码：当前散落在 [screen-canvas.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx) 的 `panState`、`lastClickRef`、`isPanning` 等局部状态中。
3. **工具状态机（Tool State Machine）**：保留并扩展现有 `use-tool-state-machine.ts`，明确"主工具 + 临时栈"双轨模型，覆盖 PS 的 V/H/T/R/E/I/Z + 吸管 + 标尺等工具。对应现有代码：[use-tool-state-machine.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-tool-state-machine.ts) 全文。
4. **修饰键栈（Modifier Stack）**：扩展现有 `use-modifier-keys.ts`，明确定义 Shift（约束/比例/角度吸附）、Alt（中心变换/吸管/复制）、Ctrl/Cmd（多选/直接选择）、Space（抓手临时切换）的语义表。对应现有代码：[use-modifier-keys.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-modifier-keys.ts) 全文。
5. **直接操作反馈层（Direct Manipulation Feedback）**：智能对齐线显示阈值（PS: 元素接近 5px 显示，吸附阈值 3px）、变换预览浮层（W/H/X/Y/Rotation 实时双向同步到属性面板）、像素网格吸附。对应现有代码：[screen-canvas.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx#L42-L56) 的 `DimensionTooltip` 与 `verticalGuidelines`/`horizontalGuidelines` 的 memo 化（298–311 行）。
6. **面板联动层（Panel Synchronization）**：画布 ↔ 属性面板 ↔ 图层面板 ↔ 状态栏的双向状态同步契约，确保选中/变换/层级/状态变更的延迟 < 1 帧（16ms）。对应现有代码：[property-panel.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/property-panel.tsx)、[layer-panel.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/layer-panel.tsx)、[canvas-status-bar.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/canvas-status-bar.tsx) 三处的 `useScreenEditorStore` 订阅。

#### 层间依赖图（单向依赖，无环）

```
┌──────────────────────────────────────────────────────────────────┐
│  面板联动层（Panel Synchronization）                              │
│  PropertyPanel / LayerPanel / StatusBar                          │
└──────────────────────────────────────────────────────────────────┘
                              ▲ 订阅
                              │
┌──────────────────────────────────────────────────────────────────┐
│  直接操作反馈层（Direct Manipulation Feedback）                    │
│  Smart Guides / DimensionTooltip / 像素网格吸附                    │
└──────────────────────────────────────────────────────────────────┘
                              ▲ 读取
                              │
┌────────────────────────┐  ┌─────────────────────────────────────┐
│  工具状态机              │  │  修饰键栈                            │
│  Tool State Machine     │  │  Modifier Stack                     │
│  (use-tool-state-machine)│  │  (use-modifier-keys)                │
└────────────────────────┘  └─────────────────────────────────────┘
                              ▲ 派生 activeTool / 修饰键状态
                              │
┌──────────────────────────────────────────────────────────────────┐
│  交互状态机（Interaction State Machine）                          │
│  idle / dragging / resizing / rotating / panning / zooming /      │
│  text-editing / marquee-selecting / context-menu-open              │
└──────────────────────────────────────────────────────────────────┘
                              ▲ 状态切换
                              │
┌──────────────────────────────────────────────────────────────────┐
│  事件路由层（Event Routing Layer）                                │
│  capture/bubble 阶段 + elementsFromPoint 命中区域仲裁             │
└──────────────────────────────────────────────────────────────────┘
                              ▲ DOM 事件
                              │
                          浏览器原始事件
```

依赖规则：
- 上层可读取下层状态，但下层不感知上层
- 工具状态机与修饰键栈互不依赖（两者均为底层）
- 面板联动层是顶层消费者，不向其它层反向写入副作用
- 禁止跨层直连（如面板联动层不直接监听 DOM 事件）

#### Scenario: 事件路由层仲裁右键菜单与 Moveable 控件
- **GIVEN** 用户已选中一个组件，Moveable 控件层覆盖在该组件上方
- **WHEN** 用户在已选中的组件上方右键
- **THEN** 事件路由层在 capture 阶段使用 `elementsFromPoint` 跳过 `.moveable-control-box` 与 `[data-radix-popper-content-wrapper]`，找到真实 `data-component-id` 元素
- **AND** 根据命中结果是组件还是空白切换 context-menu mode 为 `component` 或 `canvas`
- **AND** 不破坏 modal={false} 设定的画布 pointer-events 可用性

#### Scenario: 事件路由层处理菜单已打开时的再次右键
- **GIVEN** 上下文菜单已打开（Radix Presence 退出动画期间旧 Content 仍在 DOM）
- **WHEN** 用户在另一坐标再次右键
- **THEN** 事件路由层在 `pointerdown` capture 阶段仅视觉隐藏旧菜单，不阻止事件传播
- **AND** 在 `contextmenu` capture 阶段拦截事件，flushSync 关闭旧菜单并递增 menuKey 强制重建
- **AND** 等待双 rAF 后在原坐标重新派发完整事件序列，确保 DOM 清理后新菜单能正确锚定到新坐标

#### Scenario: 交互状态机隔离拖拽与文本编辑
- **GIVEN** 用户选中了一个文本组件，画布处于 `idle` 状态
- **WHEN** 用户在文本组件上双击进入 `text-editing` 状态
- **THEN** 交互状态机标记 `isEditingText=true`，触发 `useKeyboardShortcuts` 的 `canvasEnabled` 返回 false
- **AND** 文本组件的 `native onClick/onHover` 仍可被 `nativeEventEnabled` 开关独立控制（避免与编辑态相互污染）
- **AND** 按 Escape 时状态机先退出 `text-editing` 再进入 `idle`，不会跳过中间状态

#### Scenario: 交互状态机从框选到拖拽的转换
- **GIVEN** 用户在画布空白处按下鼠标开始框选（`marquee-selecting`）
- **WHEN** 框选命中已选中的组件并开始拖拽
- **THEN** 状态机从 `marquee-selecting` 转为 `dragging`，触发 `setTimeout(() => moveableRef.current?.dragStart(e.inputEvent), 0)`
- **AND** 转换期间 `lastClickRef` 双击判定状态被清空，避免与单次框选产生冲突

#### Scenario: 修饰键栈处理嵌套临时切换
- **GIVEN** 用户当前在 select 工具
- **WHEN** 用户先按住 Space（切换到 hand）然后同时按住 Alt（叠加 eyedropper）
- **THEN** 修饰键栈返回栈顶为 `eyedropper`，`activeTool=eyedropper`
- **AND** 松开 Alt 后栈顶回到 `hand`，松开 Space 后回到 `select`
- **AND** 栈状态变化不触发画布重渲染（用 ref 维护，仅暴露派生 state）

#### Scenario: 修饰键栈在 window blur 时兜底重置
- **GIVEN** 用户按住 Space 后切走窗口（Alt+Tab）导致 keyup 事件丢失
- **WHEN** window 触发 `blur` 事件
- **THEN** 修饰键栈将 `spaceRef/shiftRef/altRef/ctrlRef` 全部置为 false
- **AND** 同时通过 `setSpaceHeld/setShiftHeld/setAltHeld/setCtrlHeld` 触发 UI 重渲染
- **AND** 防止画布 cursor 卡在 `grab` 状态

#### Scenario: 工具状态机切换主工具时清空临时栈
- **GIVEN** 用户当前在 select 工具并按住 Space 临时切到 hand
- **WHEN** 用户按下 V 键显式切换到 select 主工具
- **THEN** 工具状态机的 `setTool` 函数清空临时栈并设置 `currentTool=select`
- **AND** `setTemporaryTop(null)` 触发 `activeTool` 重新计算为 select
- **AND** 临时栈的清空是幂等的（多次调用同一 setTool 不产生副作用累积）

#### Scenario: 工具状态机的临时切换栈防止重复压栈
- **GIVEN** 用户按住 Space 键，键盘触发多次 keydown repeat 事件
- **WHEN** 第二次及以后的 keydown 事件到达
- **THEN** `pushTemporaryTool('hand')` 检测到栈顶已是 hand，直接 return，不重复压栈
- **AND** 也检测栈中是否已存在该工具实例，避免同一工具在栈中重复出现

#### Scenario: 直接操作反馈层的智能对齐线显示阈值
- **GIVEN** 用户正在拖动一个组件，画布中有其他参考组件
- **WHEN** 被拖动组件的边/中心与其他组件的边/中心距离 < 5px
- **THEN** 反馈层在画布上绘制虚线辅助线并显示距离标签（如 "12 px"）
- **AND** 当距离 < 3px 时，反馈层调用 Moveable 的 snap 机制将组件吸附到该参考线
- **AND** 拖拽结束后辅助线立即消失，不残留

#### Scenario: 直接操作反馈层与属性面板的实时同步
- **GIVEN** 用户正在调整选中组件的尺寸，DimensionTooltip 显示 W/H 数值
- **WHEN** 调整过程中数值变化
- **THEN** 反馈层通过独立的 `useDimensionStore` 更新 tooltip，不触发画布主组件重渲染
- **AND** 属性面板的 NumberInput 通过订阅 editor-store 的 components 变化同步显示最新数值
- **AND** 同步延迟 < 1 帧（16ms），用户感知不到滞后

#### Scenario: 面板联动层的选中状态同步
- **GIVEN** 用户在画布上点击一个组件
- **WHEN** editor-store 的 `selectedComponentIds` 更新
- **THEN** 属性面板的 `useScreenEditorStore((s) => s.selectedComponentIds)` 触发重渲染，显示该组件的属性
- **AND** 图层面板的 `selectedIdSet` 重新计算，对应行高亮
- **AND** 状态栏的"已选中 N 个"文本同步更新
- **AND** 三处订阅在同一 React commit 中完成，无视觉错位

#### Scenario: 面板联动层的双向写入（属性面板修改触发画布更新）
- **GIVEN** 用户在属性面板修改组件的 X 坐标
- **WHEN** NumberInput 触发 `updateComponent(id, { position: { ...position, x: v } })`
- **THEN** editor-store 通过 `pushHistory + set` 更新 project.components 数组
- **AND** 画布的 `useScreenEditorStore((s) => s.project)` 订阅触发 `CanvasComponentWrapper` 重渲染
- **AND** Moveable 的 `useEffect([selectedComponentIds, project?.components])` 调用 `updateRect()` 同步控件层位置
- **AND** 整个写入路径在单一 React commit 内完成，无中间闪烁状态

### Requirement: Photoshop 交互模式适配表

系统 SHALL 在 spec 中提供一张完整的"PS 交互模式 → Nebula 现状 → 目标状态 → 实现策略"适配表，至少覆盖以下 20 项交互模式：

| # | PS 交互模式 | Nebula 现状 | 目标状态 | 实现策略摘要 |
|---|---|---|---|---|
| 1 | V 选择工具 | **部分实现** — 已有 select 工具 | 完整 V 工具，含直接点击/框选/Ctrl 多选 | 复用现有，纳入工具状态机契约 |
| 2 | H/Space 抓手临时切换 | **已达标** — 已有 Space 临时栈 + H 主切换 | 保持 | 已达标 |
| 3 | T 文字工具直接点击画布创建 | **未实现** — 仅从组件库拖拽 | T 工具点击空白处创建文本组件 | 扩展工具状态机副作用 |
| 4 | R/E 矩形/椭圆工具绘制 | **未实现** — 已定义未实现 | 工具激活后画布拖拽绘制组件 | 实现 R/E 工具的画布 mousedown→mousemove→mouseup 流程 |
| 5 | I 吸管（Alt 临时） | **未实现** — 已定义未实现 | Alt 按下吸管，松开恢复 | 接入修饰键栈 + 画布 cursor 切换 |
| 6 | Z 缩放工具 | **部分实现** — Alt+滚轮 已有 | Z 工具下点击放大，Alt+点击缩小 | 扩展工具状态机副作用 |
| 7 | 智能对齐线（Smart Guides） | **部分实现** — Moveable snappable 已有 | PS 风格的阈值显示（5px 内虚线 + 距离标签） | 自定义 Moveable snap 渲染 |
| 8 | 像素网格吸附 | **未实现** — 无 | 网格显示开关 + 移动吸附到整数像素 | editor-store 增 grid 配置 + Moveable horizontal/verticalGuidelines |
| 9 | 变换预览浮层 | **部分实现** — 已有 DimensionTooltip | 增加 W/H 在调整尺寸时显示，并实时同步属性面板 | 扩展 DimensionTooltip + 属性面板订阅 |
| 10 | Shift 约束比例/角度 | **已达标** — 已有 keepRatio + 15° 角度吸附 | 保持 | 已达标 |
| 11 | Alt 中心变换 | **未实现** — 无 | Resize 时按住 Alt 以中心为原点对称缩放 | Moveable onResize 中处理 |
| 12 | Alt+拖拽复制图层 | **未实现** — 无 | Alt+鼠标拖拽已选组件 → 复制后移动 | onSelectEnd 检测 altKey |
| 13 | Ctrl+点击加入/移出多选 | **已达标** — 已有 Selecto toggleContinueSelect | 保持 | 已达标 |
| 14 | 双击进入分组 | **已达标** — 已有手动判定（400ms） | 保持 | 已达标 |
| 15 | Esc 分层退出 | **已达标** — 已有（先退分组再清选） | 保持 | 已达标 |
| 16 | Tab 隐藏 UI 聚焦画布 | **未实现** — 无 | Tab 切换全屏画布模式（隐藏面板） | editor-store 增 UI 可见性状态 |
| 17 | F 屏幕模式切换 | **未实现** — 无 | 标准/带菜单/全屏三档 | 同上 |
| 18 | [ / ] 调整画笔尺寸 | **未实现** — 无 | Nebula 适配为调整选中组件边框宽度 | shortcuts-registry 新增条目 |
| 19 | 数值输入框 Arrow 微调 | **未实现** — 无 | 属性面板 NumberInput 支持 ↑↓ 1px / Shift+↑↓ 10px | 扩展 NumberInput |
| 20 | 图层拖拽重排 | **部分实现** — 仅 ChevronsUp/Down 按钮 | 图层树支持原生 drag-and-drop 重排 | layer-panel 接入 dnd-kit |

#### 阶段 3 实施记录（适配表 #7–#12, #16–#20）

> 以下记录阶段 3 各项交互模式的实际实现状态，对照适配表的目标状态逐项核对。所有改动均通过 `pnpm typecheck` + `pnpm --filter @nebula/web test`（253 个单测全通过），biome 格式检查针对本次改动文件 0 错误。预存 lint 警告（`e.datas`/`e.lastEvent` 的 `any` 类型访问、`JSON.parse` 返回 `any`、`selectComponent` 未使用）与本阶段无关，不在本次修复范围。

- **#7 Smart Guides（Task 3.1–3.5）**：新增 `lib/smart-guides.ts` 纯函数模块（`findAlignmentLines` / `snapPosition` / `filterSnappableLines`）+ `SmartGuidesOverlay` 组件（独立 Zustand store 避免拖拽高频回调触发画布重渲染）；Moveable `onDrag` 接入 5px 显示阈值 + 3px 吸附阈值。30 个单测全通过。
- **#8 像素网格吸附（Task 3.6–3.8）**：editor-store 新增 `gridEnabled` / `gridSize` 会话级配置 + canvas-settings-dialog 添加 shadcn Switch + NumberInput UI；Moveable `verticalGuidelines` / `horizontalGuidelines` 合并网格坐标数组，`snappable={snapEnabled || gridEnabled}`。
- **#9 变换预览浮层（Task 3.9–3.10）**：DimensionTooltip 加 px 单位后缀 + onDragStart 同步 W/H 到 dimension store；property-panel.tsx 改用细粒度订阅 `s.project?.components` / `s.project?.canvas`（拖拽 onDragEnd 创建新数组引用，属性面板数值实时同步肉眼无滞后）。
- **#11 Alt 中心变换（Task 3.20）**：DimensionInfo 加 `mode?: string` 字段；onResizeStart 检测 `e.inputEvent.altKey` 记录 `origX`/`origY` + `isAltCenter`；onResize 按公式 `newX = origX + (origW - w) / 2` 调整 left/top 抵消尺寸变化使中心点位置不变；DimensionTooltip 显示 `[中心变换]` 模式提示。
- **#12 Alt+拖拽复制图层（Task 3.19）**：editor-store 新增 `duplicateSelectedToPosition(x, y)` action（计算选中组件边界框左上角偏移，整体平移保持多选相对位置，入历史栈）；Moveable `onDragStart` 检测 `e.inputEvent.altKey` 标记 `datas.isAltCopy`，`onDragEnd` 走复制分支（原件保持原位）；`altHeld` 状态下画布 cursor 切换为 `copy`。
- **#16 Tab UI 显隐（Task 3.11–3.13）**：editor-store 新增 `uiVisible` 状态（默认 true）+ `toggleUI` action；use-keyboard-shortcuts 注册 Tab 快捷键（不启用 `enableOnFormTags` 避免与表单 Tab 冲突，`preventDefault` 阻止浏览器焦点跳转）；screen-editor.tsx 派生 `showToolbar` / `showPanels` 布尔组合 `uiVisible && screenMode !== 'fullscreen'` 控制显隐。
- **#17 F 屏幕模式（Task 3.14–3.16）**：editor-store 新增 `screenMode: 'standard' | 'withMenu' | 'fullscreen'` 状态（默认 standard）+ `cycleScreenMode` action（三档循环）；use-keyboard-shortcuts 注册 F 快捷键（`canvasEnabled` 作用域）；screen-editor.tsx 派生 `showToolbar`（`uiVisible && screenMode !== 'fullscreen'`）/ `showPanels`（`uiVisible && screenMode === 'standard'`），`uiVisible=false` 优先级更高强制隐藏所有 UI。
- **#18 [/] 边框宽度（Task 3.21）**：editor-store 新增 `adjustBorderWidth(delta)` action（仅调整非 text 类型选中组件的 `style.borderWidth`，范围 [0, 20]px，步长 1px，入历史栈）；use-keyboard-shortcuts 注册 `brushSizeDecrease`（`[`）与 `brushSizeIncrease`（`]`）绑定（复用 Task 2.2 已建条目）。
- **#19 NumberInput 微调（Task 3.17–3.18）**：新建 `components/number-input.tsx` 组件（draft 模式 `useState<string | null>(null)` 避免每次按键入历史栈，仅 Enter/Blur/ArrowKey 时提交；ArrowUp/Down 步进 step 默认 1，Shift+ArrowUp/Down 步进 shiftStep 默认 10；min/max 钳制；Enter 提交+blur、Esc 放弃+blur、Blur 提交；onFocus 自动全选），22 个单测全通过；property-panel.tsx 删除内联 NumberInput 改用 `./number-input` 导入的组件，为透明度加 `step=0.1`/`shiftStep=0.5`/`min=0`/`max=1`，为宽高/字号/边框加 `min`。
- **#20 图层拖拽重排（Task 3.22–3.23）**：dnd-kit 依赖（`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`）已在 `apps/web/package.json` 中声明并完成 `pnpm install`；layer-panel.tsx 接入 `DndContext` + `SortableContext`（`verticalListSortingStrategy`）+ `SortableLayerRow` 包装器（PointerSensor + 8px 激活距离避免点击误触发，isDragging 时 opacity 0.4）；editor-store 新增 `reorderLayerToIndex(id, toIndex)` action（仅重排顶层组件 zIndex，保留分组子组件相对顺序，maxZ 对齐避免越界）；ChevronsUp/Down 按钮保留作为兜底。

#### 不适用（N/A）的 PS 交互模式

以下 PS 交互模式**不纳入 Nebula 范围**，原因如下：

| PS 交互模式 | 不适用理由 |
|---|---|
| 3D 对象编辑（3D Layer / 3D Mode） | Nebula 是 2D 大屏组件编辑器，无 3D 渲染管线 |
| Camera Raw 滤镜 | Nebula 不处理原始相机数据，组件库无图像滤镜需求 |
| 视频时间轴（Timeline Panel） | Nebula 不支持视频/动画时间轴编辑 |
| 动画面板（Animation Panel / Frame Animation） | 同上，静态大屏场景不适用 |
| 历史记录画笔（History Brush） | 已通过 `editor-store.ts` 的 `undo/redo` 实现，无需像素级历史画笔 |
| 颜色面板（CMYK / Lab / Spot Color） | 大屏组件使用 RGB 颜色，无需印刷色空间 |
| 文字沿路径排列（Type on a Path） | 大屏组件库暂不支持路径文字，超出当前范围 |
| 通道混合（Channels Panel） | 无图像像素操作，无通道概念 |

### Requirement: 散落副作用归一化清单

系统 SHALL 在 spec 中列出当前代码中"散落的副作用热点"，并为每一项给出归一化建议。至少覆盖以下热点：

#### 热点 1: `canvas-context-menu.tsx` modal={false} 补丁

- **当前位置**：[canvas-context-menu.tsx:545](file:///c:/worker/nebula/apps/web/src/features/screen/components/canvas-context-menu.tsx#L545) — `<ContextMenu key={menuKey} open={open} onOpenChange={handleOpenChange} modal={false}>`
- **副作用描述**：手动设置 `modal={false}` 避免 Radix 在菜单打开时设置 `body { pointer-events: none }`，否则画布元素继承 none 导致 Moveable 无法接收 pointerdown，用户右键菜单后无法直接拖拽组件。
- **归一化目标**：**事件路由层契约**。在 context-menu 打开时不设置 `body { pointer-events: none }` 作为通用契约，由事件路由层的"上下文菜单浮层"hit-region 显式声明该行为，而非依赖每个 Radix 组件手动加 `modal={false}`。
- **向后兼容性**：保留现有 `modal={false}` 作为兜底，事件路由层契约作为新的统一规范，未来其它浮层（Tooltip、DropdownMenu）按契约实现。
- **实施记录**：
  - Task 1.8 完成：在 [canvas-event-router.ts](file:///c:/worker/nebula/apps/web/src/features/screen/lib/canvas-event-router.ts) 顶部新增 `CONTEXT_MENU_POINTER_EVENTS_CONTRACT` 文档常量，声明"上下文菜单浮层 hit-region 不设置 body pointer-events: none"契约，并附实现路径（`<ContextMenu modal={false}>` + `restorePointerEvents` 兜底）与影响范围（Moveable 可在菜单打开期间接收 pointerdown）。
  - `canvas-context-menu.tsx:545` 的 `modal={false}` 保留作为兜底实现（阶段 1 不移除）。
  - `redistributeContextMenu` 内部调用 `restorePointerEvents` 作为契约的兜底执行点。

#### 热点 2: `screen-canvas.tsx` 手动双击判定（lastClickRef）

- **当前位置**：[screen-canvas.tsx:182-183](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx#L182-L183) — `const lastClickRef = useRef<{ id: string; time: number } | null>(null);`；判定逻辑在 [screen-canvas.tsx:661-685](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx#L661-L685)
- **副作用描述**：因 react-selecto 的 `click` 事件 `preventDefault()` 抑制原生 `dblclick`，需要在 `onSelectEnd` 中通过 `lastClickRef` 跟踪 componentId + 时间戳，手动判定 400ms 内两次单击为双击。
- **归一化目标**：**交互状态机的 `double-click-detector` 子模块**。封装为纯函数 `detectDoubleClick(prev, current, thresholdMs=400)`，可独立单元测试，且可被图层面板等其它需要双击判定的场景复用。
- **向后兼容性**：保留现有 `lastClickRef` 实现作为兜底，新增子模块作为目标规范，迁移后旧代码可移除。
- **实施记录**：
  - **阶段 2 完成**：
    - Task 2.9：在 [canvas-event-router.ts](file:///c:/worker/nebula/apps/web/src/features/screen/lib/canvas-event-router.ts) 新增 `ClickRecord` 接口与 `detectDoubleClick(prev, current, thresholdMs=400)` 纯函数，8 个单元测试覆盖 prev 为 null / 不同 id / 时间超阈值 / 时间内 / 负时间兜底等场景。
    - Task 2.10：重构 [screen-canvas.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx) 的 `lastClickRef` 类型从 `{ id, time } | null` 改为 `ClickRecord | null`，由 `handleSelectEnd` 内部统一调用 `detectDoubleClick`，删除内联时间戳比较逻辑。

#### 热点 3: `screen-canvas.tsx` wheel 事件中的 Alt+滚轮缩放

- **当前位置**：[screen-canvas.tsx:257-279](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx#L257-L279) — `useEffect` 内的 `handleWheel` 函数
- **副作用描述**：直接监听 `containerRef.current` 的 wheel 事件，仅响应 `e.altKey`，计算光标位置为中心的缩放，直接调用 `setCanvasScaleAndOffset`。
- **归一化目标**：**交互状态机的 `zooming` 状态副作用**。与 Z 工具下的点击放大、`Ctrl+=`/`Ctrl+-` 共享同一套 `zoomAtPoint(scale, cursorX, cursorY)` 函数，避免缩放逻辑在 3 处重复实现。
- **向后兼容性**：保留现有 wheel 监听，重构为调用 `zoomAtPoint` 后语义不变。
- **实施记录**：
  - **阶段 2 完成**：
    - Task 2.11：在 [canvas-event-router.ts](file:///c:/worker/nebula/apps/web/src/features/screen/lib/canvas-event-router.ts) 新增 `ZoomAtPointParams` / `ZoomAtPointResult` 接口与 `zoomAtPoint(params)` 纯函数，7 个单元测试覆盖放大 / 缩小 / factor=1 / scale 边界 0 等场景。
    - Task 2.12：重构 [screen-canvas.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx) 的 wheel handler 调用 `zoomAtPoint`，包含 scale 边界限制 `[0.1, 5]` 与 factor 反算逻辑，预留 Z 工具 / `Ctrl+=` / `Ctrl+-` 接入点（TODO 注释）。

#### 热点 4: `use-keyboard-shortcuts.ts` 中散落的 nudge 1px / 10px 绑定

- **当前位置**：[use-keyboard-shortcuts.ts:239-254](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts#L239-L254) — 8 个独立的 `useHotkeys('up'/'down'/'left'/'right'/'shift+up'/...)` 调用
- **副作用描述**：nudge 快捷键直接在 hook 中硬编码键位，未通过 `shortcuts-registry.ts` 注册，导致快捷键帮助面板不显示这些条目。
- **归一化目标**：**shortcuts-registry 单一数据源**。新增 `nudgeUp/nudgeDown/nudgeLeft/nudgeRight/nudgeUp10/nudgeDown10/nudgeLeft10/nudgeRight10` 8 个条目，`use-keyboard-shortcuts.ts` 通过 `getShortcutById('nudgeUp')!.keys` 查找键位。
- **向后兼容性**：纯重构，行为不变。新增 8 个 registry 条目后帮助面板自动显示。
- **实施记录**：
  - **阶段 2 完成**：
    - Task 2.1：扩展 [shortcuts-registry.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/shortcuts-registry.ts) 的 `ShortcutCategory` 联合类型新增 `'tool' | 'ui'`，`SHORTCUT_CATEGORY_LABELS` 同步新增 `tool: '工具'` 与 `ui: '界面'`。
    - Task 2.2/2.3：新增 5 个新分类条目（`brushSizeDecrease` / `brushSizeIncrease` / `eyedropperTemp` / `toggleUI` / `cycleScreenMode`）。
    - Task 2.4：新增 8 个 nudge 条目（`nudgeUp/Down/Left/Right` + `nudgeUp10/Down10/Left10/Right10`）到 `component` 分类。
    - Task 2.5：重构 [use-keyboard-shortcuts.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts) 8 个 `useHotkeys` 调用从硬编码字符串改为 `getShortcutById('nudgeUp')!.keys` 动态获取，帮助面板自动显示新条目。

#### 热点 5: `screen-canvas.tsx` Selecto onSelectEnd 中的 activeGroupId 切换副作用

- **当前位置**：[screen-canvas.tsx:651-718](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx#L651-L718) — `onSelectEnd` 回调内包含双击判定、单点击分组切换、框选清空等多重副作用
- **副作用描述**：在 `onSelectEnd` 回调内直接调用 `setActiveGroupId` / `selectComponent` / `selectComponents` / `setActiveGroupId(null)` 多个 store action，逻辑分散难以测试。
- **归一化目标**：**交互状态机的 `select-end → after-select` 转换钩子**。将"判定 + 选择 + 分组切换"逻辑抽取为纯函数 `handleSelectEnd({ selected, inputEvent, lastClick, activeGroupId, components })`，返回 `{ selection, activeGroupId, isDoubleClick }`，由 Selecto 调用方应用副作用。
- **向后兼容性**：纯重构，行为不变。纯函数可独立单元测试。
- **实施记录**：
  - **阶段 2 完成**：
    - Task 2.13：在 [canvas-event-router.ts](file:///c:/worker/nebula/apps/web/src/features/screen/lib/canvas-event-router.ts) 新增 `SelectableComponent` / `HandleSelectEndParams` / `HandleSelectEndResult` 接口与 `handleSelectEnd(params)` 纯函数，11 个单元测试覆盖单点选 / Ctrl 多选 / 框选 / 双击进入分组 / 双击顶层退出分组 / 单击顶层退出分组 / 同分组内单击等场景。
    - Task 2.14：重构 [screen-canvas.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx) 的 `onSelectEnd` handler 从约 60 行内联逻辑改为调用 `handleSelectEnd` 纯函数 + 应用副作用（`lastClickRef.current = result.newLastClick` / `setActiveGroupId` / `selectComponents` / `moveableRef.dragStart`），缩减为约 15 行。

#### 热点 6: `canvas-context-menu.tsx` flushSync + 双 rAF 重新派发右键

- **当前位置**：[canvas-context-menu.tsx:394-527](file:///c:/worker/nebula/apps/web/src/features/screen/components/canvas-context-menu.tsx#L394-L527) — `useEffect` 内的 `dispatchRightClickAt` + `handleContextMenuCapture` + `handlePointerDownCapture`
- **副作用描述**：菜单已打开时再次右键，需先 flushSync 关闭旧菜单 → 递增 menuKey 强制重建 → 双 rAF 等待 DOM 清理 → 在原坐标重新派发 pointerdown→mousedown→pointerup→mouseup→contextmenu 完整事件序列。
- **归一化目标**：**事件路由层的"菜单已打开时右键"统一处理路径**。抽取为独立的 `redistributeContextMenu(newX, newY)` 函数，由事件路由层在所有 Radix 浮层场景中复用。
- **向后兼容性**：保留现有实现作为兜底，新路径作为事件路由层契约的参考实现。
- **实施记录**：
  - **阶段 1 完成**：
    - Task 1.5：抽取 `redistributeContextMenu(x, y)` 与内部辅助 `restorePointerEvents` 到 [canvas-event-router.ts](file:///c:/worker/nebula/apps/web/src/features/screen/lib/canvas-event-router.ts)，6 个单元测试覆盖事件序列 / 坐标 / button 字段 / 跳过覆盖层 / 兜底派发到 body / 清除 pointer-events。
    - Task 1.6：抽取 `attachContextMenuRedistributor(callbacks)` 与 `ContextMenuRedistributorCallbacks` 接口，15 个单元测试覆盖注册/清理/事件拦截/双 rAF 调度/`isRedistributing` 防重入/`onReopenIfClosed` 逻辑。
    - Task 1.7：重构 [canvas-context-menu.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/canvas-context-menu.tsx) 的 useEffect 从原 130 行实现改为调用 `attachContextMenuRedistributor`，删除 `redispatchedRef` 与所有本地辅助函数（`dispatchRightClickAt` / `handlePointerDownCapture` / `handleContextMenuCapture` / `restorePointerEvents`），useEffect 主体缩减为 24 行。
  - 单测覆盖：`canvas-event-router.test.ts` 共 33 个测试全部通过。
  - 手动回归验证清单（建议在浏览器执行）：
    - 右键画布空白 → 显示画布菜单
    - 右键命中组件 → 显示组件菜单
    - 菜单已打开时再次右键 → 新菜单锚定到新坐标（验证 `attachContextMenuRedistributor` + `redistributeContextMenu` 链路）
    - 菜单打开后直接拖拽组件 → Moveable 正常接收 pointerdown（验证 `modal={false}` 兜底 + `restorePointerEvents` 仍生效）

#### 热点 7: `editor-store.ts` pushHistory 在多个 action 中重复调用

- **当前位置**：[editor-store.ts:129-142](file:///c:/worker/nebula/apps/web/src/features/screen/stores/editor-store.ts#L129-L142) — `pushHistory` 函数定义；调用点散布于 `addComponent`（174）、`updateComponent`（191）、`updateComponentsBatch`（210）、`removeComponent`（237）、`removeSelectedComponents`（256）、`reorderComponent`（309）、`reorderToTop`（328）、`reorderToBottom`（351）、`duplicateSelected`（376）、`nudgeSelected`（408）、`setLocked`（433）、`setHidden`（452）、`pasteFromClipboard`（612）、`alignSelectedHorizontal`（间接）、`alignSelectedVertical`（间接）、`distributeSelectedHorizontal`（间接）、`distributeSelectedVertical`（间接）、`groupSelected`（760）、`ungroupSelected`（783）共 19 处。
- **副作用描述**：每个会修改 project.components 的 action 都需在 `set` 前显式调用 `pushHistory(set)`，遗漏会导致历史栈丢失。
- **归一化目标**：**`withHistory(set, action)` 高阶函数**。包装形式：`withHistory(set, 'addComponent', (state) => ({ project: ... }))`，自动在 set 前调用 pushHistory。
- **向后兼容性**：重构后所有 action 行为不变。可以增量迁移（先迁移 1 个 action 验证，再批量替换）。
- **实施记录**：
  - **阶段 2 完成**：
    - Task 2.15：在 [editor-store.ts](file:///c:/worker/nebula/apps/web/src/features/screen/stores/editor-store.ts) 新增 `ScreenEditorSet` 类型别名与 `withHistory(set, actionName, updater)` 高阶函数，内部调用 `pushHistory(set)` 然后 `set(updater, false, actionName)`。新增 [editor-store.test.ts](file:///c:/worker/nebula/apps/web/src/features/screen/stores/editor-store.test.ts) 9 个单元测试覆盖调用顺序 / actionName 透传 / pushHistory updater 行为（null project / 存在 project / 保留旧快照 / HISTORY_LIMIT FIFO）/ 集成模拟 store 验证。
    - Task 2.16–2.20：增量迁移 13 个 action 到 `withHistory`：
      - Task 2.16：`addComponent`（试点）
      - Task 2.17：`updateComponent` + `updateComponentsBatch`
      - Task 2.18：`removeComponent` + `removeSelectedComponents`
      - Task 2.19：`reorderComponent` + `reorderToTop` + `reorderToBottom` + `duplicateSelected`
      - Task 2.20：`nudgeSelected` + `setLocked` + `setHidden` + `pasteFromClipboard` + `groupSelected` + `ungroupSelected`
    - `alignSelectedHorizontal` / `alignSelectedVertical` / `distributeSelectedHorizontal` / `distributeSelectedVertical` 4 个 action 通过 `get().updateComponentsBatch(updates)` 间接使用 `withHistory`，无需直接迁移。
    - 迁移后 `editor-store.ts` 中 `pushHistory(set)` 直接调用仅余 `withHistory` 内部 1 处，所有 action 调用模式统一为 `withHistory(set, actionName, (state) => updater)`。

#### 热点 8（补充）: `screen-canvas.tsx` Moveable onDrag/onResize/onRotate 直接操作 DOM style

- **当前位置**：[screen-canvas.tsx:411-434](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx#L411-L434)（onDrag）、446-480（onResize）、508-524（onRotate）等
- **副作用描述**：在 Moveable 回调中直接操作 `e.target.style.left/top/width/height/transform`，依赖 `CanvasComponentWrapper` 的 `memo` 避免重渲染时 React 覆盖 Moveable 的 DOM 操作。
- **归一化目标**：**直接操作反馈层的"变换进行中"状态**。将 DOM style 操作与状态机 `dragging/resizing/rotating` 状态绑定，状态进入时锁定 memo，状态退出时通过 `updateComponent` 提交最终值。
- **向后兼容性**：现有 `memo` + 直接 DOM 操作路径保留作为兜底（性能关键路径），反馈层状态机作为统一规范。
- **实施记录：阶段 3 完成反馈层状态机**：直接操作反馈层已通过以下扩展落地（未引入显式状态机枚举，而是通过 Moveable datas 字段 + DimensionTooltip mode 提示实现"变换进行中"语义）：
  - `DimensionTooltip` 新增 `mode` 字段，Alt 中心变换时显示 `[中心变换]` 提示（Task 3.20）
  - `onDragStart` 检测 `e.inputEvent.altKey` 标记 `datas.isAltCopy`，`onDragEnd` 根据标记走"复制"或"移动"分支（Task 3.19）
  - `onResizeStart` 检测 `e.inputEvent.altKey` 标记 `datas.isAltCenter` + 记录 `origX`/`origY`，`onResize` 据此切换"普通 resize"或"中心对称 resize"路径（Task 3.20）
  - 所有路径仍通过 `updateComponent` 提交最终值入历史栈，`memo` + 直接 DOM 操作作为性能兜底保留
  - 显式 `InteractionState` 状态机（阶段 2 Task 2.6–2.8）作为后续迭代的统一规范入口，当前反馈层扩展与之兼容（状态进入/退出时机由 Moveable 生命周期事件驱动）

### Requirement: 演进路线与兼容性约束

系统 SHALL 在 spec 中给出与现有架构兼容的演进路线，满足：

1. **零破坏性**：现有 `use-tool-state-machine.ts`、`shortcuts-registry.ts`、`editor-store.ts` 的对外 API 保持向后兼容。
2. **可分阶段实施**：至少分 3 个阶段（事件路由层 / 交互状态机 / 反馈层与面板联动），每阶段可独立交付与验证。
3. **不引入新依赖**：尽量复用现有 `react-moveable`、`react-selecto`、`react-hotkeys-hook`、`zustand`、`radix-ui`、`shadcn/ui` 能力；如需 dnd-kit 等新库需在 tasks.md 单独列出。
4. **遵守项目工程规范**：
   - TypeScript strict + strictNullChecks，禁止 `@ts-ignore` / `as any`
   - ESLint `recommendedTypeChecked` 全通过
   - Biome 格式化（单引号 / 分号 / 2 空格 / 行宽 100 / 尾随逗号 all / 箭头函数参数始终加括号）
   - 画布渲染组件不使用 shadcn/ui，编辑器外壳组件（toolbar/panels/forms）使用 shadcn/ui
   - 异步操作必须正确处理 Promise，禁止浮动 Promise
5. **可测试性**：每个新增层需提供单元测试钩子（状态机的纯函数转换可独立测试；事件路由的命中区域函数可独立测试）。

#### 阶段划分与依赖关系

**阶段 1: 事件路由层归一化**
- 范围：抽取 `findComponentIdAtPoint` / `getComponentIdFromElement` 为独立模块；定义"上下文菜单浮层"hit-region 契约；归一化热点 1（modal={false}）与热点 6（flushSync 双 rAF）。
- 前置依赖：无（最底层）。
- 可并行项：与阶段 2 的"工具状态机扩展契约"无冲突，可并行。
- 交付物：新增 `lib/canvas-event-router.ts`（或 `hooks/use-canvas-event-router.ts`）+ 单元测试。
- 验证：现有右键菜单行为不变；新增的事件路由 API 通过单元测试。

**阶段 2: 交互状态机与工具/修饰键栈扩展**
- 范围：新增 `use-interaction-state-machine.ts`（覆盖 idle/dragging/resizing/...）；归一化热点 2（双击判定）、热点 3（wheel 缩放）、热点 4（nudge 散落绑定）、热点 5（onSelectEnd 副作用）。
- 前置依赖：阶段 1（事件路由层作为底层）。
- 可并行项：工具状态机扩展（新增 `tool`/`ui` ShortcutCategory）与修饰键栈扩展可并行。
- 交付物：新增 `hooks/use-interaction-state-machine.ts` + 纯函数 `detectDoubleClick` / `handleSelectEnd` / `zoomAtPoint` + 单元测试。
- 验证：现有画布交互行为不变；新增状态机转换通过单元测试。

**阶段 3: 直接操作反馈层与面板联动**
- 范围：实现 Smart Guides 阈值显示（5px/3px）、像素网格吸附、属性面板 NumberInput Arrow 微调、Tab/F 屏幕模式、`[`/`]` 调整边框宽度、图层拖拽重排（dnd-kit）。
- 前置依赖：阶段 2（交互状态机提供 dragging/resizing 状态）。
- 可并行项：Smart Guides 与图层拖拽重排可并行。
- 交付物：扩展 `DimensionTooltip`、新增 `lib/smart-guides.ts`、扩展 `property-panel.tsx` 的 NumberInput、扩展 `layer-panel.tsx` 接入 dnd-kit。
- 验证：智能对齐线在 5px 内显示；NumberInput 支持 Arrow 微调；图层拖拽重排可用。

#### 可能新增的依赖

- **dnd-kit**（`@dnd-kit/core` + `@dnd-kit/sortable`）：用于图层树拖拽重排（阶段 3）。需在 `apps/web/package.json` 的 `dependencies` 中新增，并安装 `@types/*` 类型声明包。
- 其它建议尽量复用现有依赖，避免新增。

#### 单元测试钩子

每个新增层需提供可独立测试的纯函数或 hook：

| 层 | 可测试单元 | 测试形式 |
|---|---|---|
| 事件路由层 | `findComponentIdAtPoint(x, y)` / `getComponentIdFromElement(el)` | Vitest 单元测试，mock `document.elementsFromPoint` |
| 交互状态机 | `detectDoubleClick(prev, current, thresholdMs)` / `handleSelectEnd({...})` / `zoomAtPoint(scale, cursorX, cursorY, currentScale, currentOffset)` | Vitest 纯函数测试 |
| 工具状态机 | 现有 `useToolStateMachine` 已可测试 | Vitest + @testing-library/react hooks 测试 |
| 修饰键栈 | 现有 `useModifierKeys` 已可测试 | Vitest + 模拟 keydown/keyup |
| 反馈层 | Smart Guides 阈值计算函数 | Vitest 纯函数测试 |
| 面板联动层 | editor-store 的 `selectComponent` / `updateComponent` | 已有测试覆盖（参考 `editor-store.ts` 现有测试模式） |

### Requirement: 研究方法论与参考依据

系统 SHALL 在 spec 中说明本研究的方法论与参考依据：

1. **代码考古**：直接阅读 Nebula 现有 `apps/web/src/features/screen/` 下的全部组件、hooks、store，作为现状分析的事实基础。
2. **PS 交互模式归纳**：基于 Photoshop 公开交互模式（V/H/T/R/E/I/Z 工具、Smart Guides、Transform 预览、图层操作、屏幕模式）提炼可移植模式。
3. **UX 最佳实践数据库**：调用 `ui-ux-pro-max` skill 的 ux 域查询，至少覆盖：focus states、keyboard navigation、hover states、active states、disabled states、loading states、stacking context、z-index management、transform performance、reduced motion。
4. **设计系统生成**：调用 `ui-ux-pro-max --design-system` 获取与"专业设计工具 dark mode"匹配的色板、字体、效果推荐。
5. **不引入未验证假设**：所有"PS 交互模式"必须是 Photoshop 公开文档或长期广泛使用所确认的行为，不得基于猜测。

---

## MODIFIED Requirements

### Requirement: 工具状态机扩展契约

[基于现有 `use-tool-state-machine.ts` 的契约扩展，不破坏 API]

现有 `EditorTool` 枚举：`select | hand | text | rect | ellipse | image | zoom | eyedropper`

修改后契约：

- 保留 `activeTool` / `currentTool` / `hasTemporaryTool` / `setTool` / `pushTemporaryTool` / `popTemporaryTool` / `isEditingText` / `setEditingText` 全部对外 API。
- 在内部增加"工具副作用注册表"概念（仅作为 spec 描述，不在本 spec 实施）：每个 EditorTool 关联一个 `onActivate` / `onDeactivate` 副作用函数，由调用方按需注册。
- 现有调用方（`screen-editor.tsx`）继续按 `activeTool` 渲染光标样式即可，无需改动。

### Requirement: shortcuts-registry 扩展契约

[基于现有 `shortcuts-registry.ts` 的契约扩展，不破坏 API]

现有 `ShortcutCategory` 枚举：`file | edit | view | component | align | help`

修改后契约：

- 新增 `ShortcutCategory` 值：`tool`（V/H/T/R/E/I/Z 工具切换）与 `ui`（Tab/F 屏幕模式、面板显隐）。
- 现有所有 `ShortcutDefinition` 条目保持兼容。
- 新增条目示例：`brushSizeDecrease`（`[`）、`brushSizeIncrease`（`]`）、`toggleUI`（`tab`）、`cycleScreenMode`（`f`）、`eyedropperTemp`（`alt`）。

---

## 快捷键防冲突方法论

### 背景

阶段 3 实施过程中发现快捷键与浏览器默认行为存在 7 类冲突（详见 `.trae/documents/browser-default-action-conflict-resolution.md`）：

1. nudge 方向键未 preventDefault，画布在可滚动容器内时页面同时滚动
2. Alt+方向键未注册 noop，macOS/Firefox 触发浏览器历史导航
3. Ctrl/Cmd+滚轮未实现且不拦截，浏览器原生页面缩放导致画布模糊
4. lock/unlock/hide/clearSelection/toggleBorderGuides 未 preventDefault
5. Tab toggleUI 无 enabled 限制，干扰 Radix Popover/Dialog 焦点流转
6. 无 activeElement/isContentEditable 手写判断，contenteditable 元素聚焦时全局快捷键仍触发
7. `mod+=` 与 `mod+shift+=` 歧义，US 键盘 `+` 需要 Shift+=

### 5 条规则

#### 规则 1：显式声明 preventDefault 语义

每条 registry 条目必须显式声明 `preventDefault` 字段（`ShortcutDefinition.preventDefault`），取值：

- `'always'`：始终阻止默认行为（与浏览器原生冲突的键必须用此值）
- `'callback-only'`：仅在 callback 执行路径内阻止（用于条件性 preventDefault，如 canvasEnabled 时才阻止）
- `'none'`：不阻止默认行为

#### 规则 2：标注浏览器冲突类别

每条 registry 条目必须声明 `browserConflict` 字段（`ShortcutDefinition.browserConflict`），取值：

- `'reserved'`：浏览器保留键，JS 无法拦截（F5、Ctrl+W 等）— 不应注册
- `'overridable'`：浏览器有默认行为但 JS 可拦截 — 必须 `preventDefault='always'` 或 `'callback-only'`
- `'none'`：无浏览器默认行为冲突

校验函数 `validateRegistry()` 在 dev 模式下自动检查违规条目并 `console.warn`。

#### 规则 3：显式声明 scope 与 enableOnFormTags

- `scope: 'global'` 必须明确 `enableOnFormTags: true | false`
- `scope: 'canvas'` 默认 `enableOnFormTags: false`，可不写
- `scope: 'global'` + `enableOnFormTags: false` 的组合（如 toggleUI）必须在条目注释中说明"为何在表单中禁用"

#### 规则 4：键盘 + 鼠标组合操作必须在 pointerdown / wheel 阶段 preventDefault

- 不要依赖 keydown 阶段阻止（用户先按下鼠标再按修饰键的时序无法用 keydown 拦截）
- wheel 事件必须在 `passive: false` 监听器内 preventDefault（screen-canvas.tsx 已正确配置）
- 任何 `e.altKey / e.ctrlKey / e.metaKey / e.shiftKey` 分支必须显式 preventDefault

#### 规则 5：新增快捷键前的检查清单

```
[ ] 该组合键是否与浏览器原生冲突？（查 MDN + 实测）
[ ] 若冲突，是否标注 browserConflict='overridable' 并 preventDefault='always' | 'callback-only'
[ ] 是否声明 scope 与 enableOnFormTags
[ ] 是否在 shortcuts-help-dialog 中可见（hidden 条目除外）
[ ] 是否需要别名（如 mod+= 与 mod+shift+=）
[ ] 是否需要处理 contenteditable 焦点情况（use-modifier-keys 的 isFormElementFocused）
```

### 实施记录（本次修复的 7 类冲突）

| # | 冲突 | 修复方式 | 改动文件 |
|---|---|---|---|
| 1 | nudge 方向键未 preventDefault | registry 标 `preventDefault='callback-only'`，callback 内加 `e.preventDefault()` | shortcuts-registry.ts + use-keyboard-shortcuts.ts |
| 2 | Alt+方向键未注册 noop | 新增 4 个 noop 条目（hidden=true），合并为一次 useHotkeys 调用 | shortcuts-registry.ts + use-keyboard-shortcuts.ts |
| 3 | Ctrl/Cmd+滚轮未实现 | handleWheel 触发条件扩展为 `altKey \|\| ctrlKey \|\| metaKey` | screen-canvas.tsx |
| 4 | lock/unlock/hide/toggleBorderGuides 未 preventDefault | registry 标 `preventDefault='callback-only'`，callback 内加 `e.preventDefault()` | shortcuts-registry.ts + use-keyboard-shortcuts.ts |
| 5 | Tab toggleUI 无 enabled 限制 | buildHotkeysOptions 统一传 `enabled: canvasEnabled` | use-keyboard-shortcuts.ts |
| 6 | 无 contenteditable 焦点判断 | 新增 `isFormElementFocused()`，space keydown callback 内判断 | use-modifier-keys.ts |
| 7 | `mod+=` 与 `mod+shift+=` 歧义 | zoomIn 新增 `aliases: ['mod+shift+=']`，getAllKeys 合并主键位与别名 | shortcuts-registry.ts + use-keyboard-shortcuts.ts |

### 落地形式

- **类型层**：`ShortcutDefinition` 新增 `preventDefault` / `browserConflict` / `aliases` / `hidden` 字段
- **校验层**：`validateRegistry()` 纯函数 + `import.meta.env.DEV` 下自动校验
- **执行层**：`buildHotkeysOptions(entry, enabled)` 统一生成 useHotkeys 选项，消除"option preventDefault / callback preventDefault"双轨制
- **文档层**：本小节固化 5 条规则与检查清单

---

## REMOVED Requirements

无（本研究为新增 spec，不删除任何现有需求）。
