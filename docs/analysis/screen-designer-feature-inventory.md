# 大屏设计器功能点全量清单

> 状态：生效中
> 最近更新：2026-08-05
> 范围：`packages/screen-editor-core`（编辑器内核）+ `packages/screen-sdk` + `packages/screen-component-sdk` + `packages/screen-dynamic-sdk`（动态设计器/查看器交付物）+ `apps/web/src/features/screen`（宿主集成）
> 性质：现状审计（功能点总览），不评估好坏，不提改进建议

## 0. 模块与规模

| 模块 | 路径 | 关键文件（体积） |
|---|---|---|
| 画布交互 | `screen-editor-core/src/components/` | `screen-canvas.tsx` 95KB / 2208行、`moveable-container.tsx` |
| 事件路由 | `src/lib/` | `canvas-event-router.ts` 634行 |
| 状态机 | `src/hooks/` | `use-interaction-state-machine.ts` 415行、`use-tool-state-machine.ts` |
| 快捷键 | `src/hooks/` | `shortcuts-registry.ts` 887行、`use-keyboard-shortcuts.ts` 22KB |
| Store | `src/stores/` | `editor-store.ts` 68KB / 1797行 |
| 图层 | `src/components/` | `layer-panel.tsx` 43KB / 1160行 |
| 事件蓝图 | `src/blueprint/` | `blueprint-sheet.tsx` 55KB，39个源文件 |
| 属性面板 | `src/property-schema/` | `schemas.tsx` 18.8KB、`bar-chart-config-sections.tsx` 38.7KB |
| 组件注册 | `src/registry/` | 20个文件，`custom-element-renderer.tsx` 408行 |
| 宿主控制 | `src/host/` | `screen-host-controller.ts` 30KB |
| 动态设计器/查看器 | `packages/screen-dynamic-sdk/src/` | `element/nebula-screen-designer-element.ts`、设计器/查看器工作台、运行时 |
| 编辑器 Web Component | `packages/screen-sdk/src/` | `element/nebula-screen-editor-element.ts`、静态运行时、主题 |
| 组件扩展 SDK | `packages/screen-component-sdk/src/` | `contracts/manifest.ts`、`validation/*` 校验层 |

---

## 1. 快捷键系统

### 1.1 架构：单一数据源 + 防冲突方法论

`hooks/shortcuts-registry.ts` 是唯一数据源，同时驱动 `use-keyboard-shortcuts.ts`（实际绑定）与 `shortcuts-help-dialog.tsx`（帮助面板渲染），避免"描述与绑定脱节"。

每条 `ShortcutDefinition` 必填 8 个字段（`shortcuts-registry.ts:36-74`）：

| 字段 | 取值 | 语义 |
|---|---|---|
| `id` | string | 唯一标识，供绑定层查找 |
| `keys` | react-hotkeys-hook 表达式 | `mod` 跨平台（Mac→⌘/Win→Ctrl），`,` 表任一触发，`+` 表组合 |
| `scope` | `global` / `canvas` / `blueprint` | 作用域三分 |
| `preventDefault` | `always` / `callback-only` / `none` | 阻止默认行为的时机 |
| `browserConflict` | `reserved` / `overridable` / `none` | 浏览器冲突类别 |
| `enableOnFormTags` | boolean | 输入框聚焦时是否触发（不传按 scope 推断） |
| `aliases` | string[] | 别名键位，行为完全一致 |
| `hidden` | boolean | 帮助面板中隐藏（noop 拦截条目） |

**自动校验**：`validateRegistry()`（`:867-880`）+ DEV 期自动执行（`:882-887`），两条硬规则：
- `browserConflict='overridable'` 必须搭配 `preventDefault='always'|'callback-only'`，否则警告"将触发浏览器默认行为"
- `browserConflict='reserved'` 不应注册（JS 无法拦截，如 F5 / Ctrl+W），警告"注册无效"

**code 名而非字面量**：react-hotkeys-hook 5.x 用 `e.code` 匹配，所以符号键存 code 名（`equal`/`minus`/`semicolon`/`bracketleft`/`bracketright`/`slash`），再通过 `CODE_TO_DISPLAY`（`:809-832`）映射回可读字符给帮助面板。

### 1.2 文件类（scope: global）

| 键位 | 功能 | preventDefault | 表单内触发 |
|---|---|---|---|
| `Ctrl/⌘+S` | 保存项目 | always | ✅ |

### 1.3 编辑类

| 键位 | 功能 | scope | 备注 |
|---|---|---|---|
| `Ctrl/⌘+Z` | 撤销 | global | **`enableOnFormTags: false` 故意禁用** |
| `Ctrl/⌘+Shift+Z` | 重做 | global | 同上 |
| `Delete` / `Backspace` | 删除选中 | canvas | |
| `Ctrl/⌘+A` | 全选 | canvas | 过滤 `locked`/`hidden` |
| `Ctrl/⌘+C` | 复制 | canvas | 有原生文本选区时让位浏览器 |
| `Ctrl/⌘+V` | 粘贴 | canvas | |
| `Ctrl/⌘+D` | 原地复制 | canvas | |

`undo`/`redo` 的 `enableOnFormTags: false` 是一处重要设计决策（`:98-102`）：input/textarea 聚焦时让位给浏览器原生输入撤销。否则画布 undo 会劫持 `mod+z` 并 preventDefault，导致属性面板输入框"既无法原生撤销、又被回退到无关的历史快照"，表现为"撤销完全失效"。与 `toggleUI` 保留 input 内 Tab 焦点切换属同一处理模式。

### 1.4 视图类

| 键位 | 功能 | scope | 别名 |
|---|---|---|---|
| `Ctrl/⌘+=` | 放大画布 | global | `mod+shift+equal`（兼容 US 键盘 Ctrl++） |
| `Ctrl/⌘+-` | 缩小画布 | global | |
| `Ctrl/⌘+0` | 适应屏幕 | global | |
| `Ctrl/⌘+K` | 切换边框参考线 | canvas | |
| `Ctrl/⌘+;` | 切换参考线显示 | global | |

### 1.5 组件类（scope: canvas）

| 键位 | 功能 |
|---|---|
| `Ctrl/⌘+]` | 置顶 |
| `Ctrl/⌘+[` | 置底 |
| `Ctrl/⌘+G` | 成组 |
| `Ctrl/⌘+Shift+G` | 解组 |
| `Ctrl/⌘+L` | 锁定选中 |
| `Ctrl/⌘+Shift+L` | 解锁选中 |
| `Ctrl/⌘+H` | 隐藏选中 |
| `Esc` | 清空选中（分层：第一次清 activeGroupId 保留选择，第二次 clearSelection） |
| `↑↓←→` | 微移 1px |
| `Shift+↑↓←→` | 微移 10px |

**4 条隐藏 noop 拦截条目**（`hidden: true`）：`alt+left` / `alt+right` / `alt+up` / `alt+down`，专门拦截 macOS / Firefox 的 Alt+方向键浏览器历史导航。

微移步长固定 1px / 10px，**不跟随 gridSize**；跳过 locked 组件。

### 1.6 对齐类（scope: canvas，全部 `browserConflict: none`）

| 键位 | 功能 |
|---|---|
| `Ctrl/⌘+Alt+L` | 左对齐 |
| `Ctrl/⌘+Alt+C` | 水平居中 |
| `Ctrl/⌘+Alt+R` | 右对齐 |
| `Ctrl/⌘+Alt+T` | 顶对齐 |
| `Ctrl/⌘+Alt+M` | 垂直居中 |
| `Ctrl/⌘+Alt+B` | 底对齐 |
| `Ctrl/⌘+Alt+H` | 水平等距分布 |
| `Ctrl/⌘+Alt+V` | 垂直等距分布 |

### 1.7 工具类（scope: canvas，单字母，`preventDefault: none`）

| 键位 | 工具 | 光标 |
|---|---|---|
| `V` | 选择 | `default` |
| `H` | 抓手 | `grab` |
| `T` | 文字 | `text` |
| `R` | 矩形 | `crosshair` |
| `E` | 椭圆 | `crosshair` |
| `I` | 图片 | `crosshair` |
| `Z` | 缩放 | `zoom-in` |
| `Space`（按住） | 临时抓手 | keydown 压栈 / keyup 出栈 |
| `[` / `]` | 减小/增大画笔尺寸 | |

3 条鼠标/滚轮快捷键（不经 `useHotkeys`，仅文档化以保持帮助面板与实际行为一致）：
- `Alt+拖拽` → 拖拽复制组件（`onDragStart` 检测 `altKey`）
- `Alt+滚轮` → 反向缩放（`onWheel` 检测 `altKey`）

### 1.8 界面类

| 键位 | 功能 | 备注 |
|---|---|---|
| `Tab` | 切换面板显示 | `enableOnFormTags: false`，保留 input 内焦点切换；仅 `canvasEnabled` 时触发，避免干扰 Radix Popover 焦点流转 |
| `F` | 切换屏幕模式 | `standard → withMenu → fullscreen → standard` |

**屏幕模式三态**（`editor-store.ts:145-152`）：

| 模式 | 含义 | 派生 |
|---|---|---|
| `standard` | 完整编辑器（工具栏+侧边栏+属性面板+状态栏） | `showToolbar && showPanels` |
| `withMenu` | 仅顶部工具栏+画布 | `showToolbar` only |
| `fullscreen` | 仅画布，零 UI 干扰 | 全隐藏 |

`uiVisible=false`（Tab）优先级更高，强制隐藏全部 UI。派生逻辑（`screen-editor-workbench.tsx:254-255`）：
```
showToolbar = uiVisible && screenMode !== 'fullscreen'
showPanels  = uiVisible && screenMode === 'standard'
```

### 1.9 帮助类

| 键位 | 功能 |
|---|---|
| `Ctrl/⌘+/` | 快捷键帮助（scope 同时注册 global + blueprint） |

### 1.10 蓝图作用域（scope: blueprint，仅 BlueprintSheet 弹层内生效）

独立注册 14 条，前缀 `bp-`：`mod+s` 保存、`mod+z` 撤销、`mod+shift+z` 重做、`delete/backspace` 删除选中节点/边、`mod+a` 全选、`mod+c` 复制节点、`mod+v` 粘贴节点、`mod+d` 原地复制节点、`mod+equal` 放大视图、`mod+minus` 缩小视图、`mod+0` 适配视图、`space` 按住平移画布、`escape` 四层降级、`mod+slash` 快捷键帮助。

蓝图撤销/重做与画布不同：`preventDefault: 'always'` + `enableOnFormTags: true`。

**蓝图 Escape 四层降级**（`use-blueprint-shortcuts.ts:127-153`）：
1. 关闭搜索面板（若可见）
2. `isConnectingRef.current` 为真 → return，让 React Flow 取消连线
3. 清空节点+边选择（若有）
4. 关闭 Sheet

蓝图快捷键监听在 window keydown **捕获阶段**，通过 `opts.isActive()` 做多实例焦点仲裁；剪贴板快捷键在独立的**冒泡阶段监听器**（`use-blueprint-clipboard.ts:165-196`），额外守卫 `isFormElementFocused()` 与 `hasNativeSelection()`。

### 1.11 帮助面板渲染

`formatKeys(keys)`（`:834-857`）：`mod`→`⌘`/`Ctrl`、`alt`→`Option`/`Alt`、`ctrl`→`⌃`/`Ctrl`、`shift`→`Shift`；多键位逗号分隔时只显示第一个（`delete,backspace` → `Delete`）；单字母大写；code 名映射回符号。`isMac()` 通过 `navigator.platform` 正则判定。`shortcut-badge.tsx` 渲染为 `<kbd>`。

### 1.12 全局启用闸门

```
globalEnabled = isActive() && !suspended
canvasEnabled = isActive() && !isEditingText && !suspended
```
`suspended` = `showEventBlueprint || blueprintSheetOpen || showComponentJsonEditor || hostMutationPending`。文本编辑时 overlay 内 `stopPropagation()` 双重隔离。

---

## 2. 工具系统

### 2.1 工具注册表（`hooks/tool-registry.ts`）

7 个工具，全部 `implemented: true`。所有权边界明确（`:7-10`）：registry 拥有 id/name/icon/shortcutId/cursor/capabilities/implemented；`SHORTCUTS_REGISTRY` 拥有实际键位/scope/preventDefault；两者仅通过 `shortcutId` 关联。

**能力矩阵**（`ToolCapabilities`，7 个布尔位）：

| 工具 | canSelect | canDrag | canResize | canRotate | canPan | canCreate | canZoom |
|---|---|---|---|---|---|---|---|
| select | ✅ | ✅ | ✅ | ✅ | | | |
| hand | | | | | ✅ | | |
| text/rect/ellipse/image | | | | | | ✅ | |
| zoom | | | | | | | ✅ |

吸管工具（eyedropper）在 Phase 1 被明确移除，有测试断言守护。

### 2.2 工具状态机（`hooks/use-tool-state-machine.ts`）

- `currentTool` / `temporaryTop` 用 `useState`，**临时栈本体用 `useRef<EditorTool[]>`**，避免高频 keydown 引起重渲染
- `activeTool = temporaryTop ?? currentTool`
- `setTool(tool)` **清空临时栈**再设置
- `pushTemporaryTool` **双重幂等**：栈顶相同（keydown repeat）返回；栈内已存在（不允许重复）返回
- `popTemporaryTool` 用 `filter` 移除所有实例
- **`window blur` 清空临时栈**：用户按住 Space 时 Alt-Tab，keyup 永不到达，`activeTool` 会永久卡在 `hand`
- Space keyup 绑定 `enabled: true` 无条件 + `enableOnContentEditable/enableOnFormTags: true` —— 清理型 keyup 必须跨实例切换始终执行

### 2.3 工具切换的连带清理

- `use-editor-session.ts:182-191` `setToolWithCleanup`：交互状态非 idle/hovering 时先 `dispatchInteraction('cancel')`
- `screen-editor-workbench.tsx:342-347`：`currentTool` 任何变化触发 `clearSelection()`

### 2.4 光标优先级

`isPanning → 'grabbing'` > `altHeld && canDrag → 'copy'` > `toolCursor`

---

## 3. 交互状态机（互斥仲裁核心）

`hooks/use-interaction-state-machine.ts`，11 状态 × 21 事件转换表。

### 3.1 11 个状态

`idle` · `hovering` · `marquee-selecting` · `dragging` · `resizing` · `rotating` · `panning` · `zooming` · `text-editing` · `context-menu-open` · `creating`

### 3.2 21 个事件

`pointer-enter` `pointer-leave` `pointer-down` `start-drag` `start-resize` `start-rotate` `start-pan` `start-zoom` `start-create` `commit-create` `double-click` `open-context-menu` `pointer-up` `end-zoom` `close-context-menu` `escape` `commit` `cancel` `window-blur` `pointer-cancel` `lost-pointer-capture`

### 3.3 完整转换表

| 状态 | 事件 → 目标 |
|---|---|
| `idle` | pointer-enter→hovering; pointer-down→marquee-selecting; start-drag→dragging; start-resize→resizing; start-rotate→rotating; start-pan→panning; **start-zoom→zooming**; start-create→creating; double-click→text-editing; open-context-menu→context-menu-open |
| `hovering` | pointer-leave→idle; pointer-down→marquee-selecting; start-drag→dragging; start-resize→resizing; start-rotate→rotating; start-pan→panning; start-create→creating; double-click→text-editing; open-context-menu→context-menu-open（**无 start-zoom**） |
| `marquee-selecting` | start-drag→dragging; pointer-up→idle; open-context-menu→context-menu-open; double-click→text-editing |
| `dragging`/`resizing`/`rotating`/`panning` | pointer-up→idle |
| `zooming` | end-zoom→idle |
| `text-editing` | escape→idle; commit→idle |
| `context-menu-open` | close-context-menu→idle; escape→idle; open-context-menu→context-menu-open（自转，重定位锚点） |
| `creating` | commit-create→idle; pointer-up→idle; **double-click→text-editing** |

`creating → text-editing` 这条规则至关重要：文字工具点击后先派 `start-create` 再派 `double-click`。若缺失，状态会卡在 `creating`，工作台的外部 cancel 清理 effect 会立刻删掉刚创建的文本组件，导致**文字工具完全不可用**。

### 3.4 3 条守卫分支（优先于查表）

1. **pointer-down 分支**：`idle`/`hovering` 下 → `payload.isPanGesture` 为真则 `panning`，否则**无条件** `marquee-selecting`（不管 `hitComponent`）
2. **异常退出分支**：`escape` | `cancel` | `window-blur` 从任何非 idle 状态 → `idle`。包含 `text-editing`（"text-editing 优先退出"），修复 Escape 卡在 dragging/resizing/rotating/panning/creating
3. **指针丢失分支**：`pointer-cancel` | `lost-pointer-capture` → 仅当状态 ∈ `POINTER_CAPTURE_STATES` 时 → `idle`

**非法转换永不抛错**，返回当前状态（设计原则）。

### 3.5 三个导出状态集（互斥闸门）

| 集合 | 成员 | 用途 |
|---|---|---|
| `POINTER_CAPTURE_STATES` | marquee-selecting, dragging, resizing, rotating, panning, creating | 指针捕获恢复 |
| `CONTEXT_MENU_ALLOWED_STATES` | idle, hovering, marquee-selecting, context-menu-open | 右键菜单可开 |
| `SELECTO_ALLOWED_STATES` | **仅 idle, hovering** | Selecto/新手势可起 |

### 3.6 非法转换诊断

- 去重窗口 `ILLEGAL_TRANSITION_WARN_WINDOW_MS = 1000`
- `Map<'${state}+${event}', number>` 键控去重
- 警告文案：`[InteractionStateMachine] 非法转换: ${state} + ${event} → 保持 ${state}（无对应转换规则）`
- 生产环境静默；`resetIllegalTransitionWarnCache()` 供测试
- `window blur` 监听器派发 `window-blur`，绑定 `options.ownerWindow ?? window`（iframe 安全）

### 3.7 finalize/cancel 协议（`lib/finalize-cancel-protocol.ts`）

7 类瞬时交互（`InteractionKind`）统一的完成/取消/清理契约。协议本身不执行副作用，只描述"应该做什么"。

**5 项清理描述符**（`InteractionCleanup`）：`hideDimensionTooltip` / `clearAlignmentLines` / `releasePointerCapture` / `clearTemporaryTools` / `resetInteractionState`

| 路径 | 提交历史 | 清理集 |
|---|---|---|
| `finalizeInteraction(hasChanges)` | `hasChanges` 为真才提交（避免空历史） | `FULL_CLEANUP`（clearTemporaryTools=false） |
| `cancelInteraction()` | 永不提交 | `RECOVERY_CLEANUP`（clearTemporaryTools=true） |

变化判定：`hasDragChanges` 逐组件比 id/x/y/width/height/rotate；`hasSelectionChanges` 用 Set 比较。

---

## 4. 拖拽（Drag）全景

### 4.1 组件库 → 画布（HTML5 原生 DnD）

**非指针事件，走原生 drag-and-drop。**

| 环节 | 实现 |
|---|---|
| 拖拽源 | `<div draggable>` 组件卡片，class `cursor-grab active:cursor-grabbing` |
| **dataTransfer key** | **字面量自定义格式 `'component-type'`**（非 `text/plain`、非 `application/json`） |
| effectAllowed | `'copy'` |
| dragOver | `preventDefault()` + `dropEffect = 'copy'` |
| 坐标换算 | `x = Math.round((clientX - rect.left) / canvasScale)`（drop 目标是内层已 transform 的 div，rect 已含 translate+scale，故不再减 offset） |
| zIndex | `maxZ = reduce(max, zIndex, 0)` → `maxZ + 1` |
| 实例创建 | `createComponentInstanceFromRegistry(registry, type, x, y, maxZ+1, components)` |
| 最近使用记录 | 仅在成功 `addComponent` 之后才 `recordComponentUsage` |

### 4.2 组件移动拖拽（react-moveable）

**onDragStart**：
- 状态守卫：仅 `{idle, hovering, marquee-selecting}` 允许，否则 `return false`
- `getComponentIdFromTarget` 沿 `parentElement` 上溯找 `data-component-id`
- `comp.status.locked` → `return false`
- 写入 `DragDatas` 包：`id/startX/startY/origW/origH/rotation/flipX/flipY/isAltCopy/altCopyClone`
- **Alt-copy 克隆**：`e.target.cloneNode(true)`，设 `position:absolute` `pointerEvents:none` `userSelect:none` `data-alt-copy-clone="true"`，挂到 `contentRef`

**onDrag**：
- 用 `e.beforeTranslate`，**不回读 DOM 的 left/top**
- `composeComponentTransform(tx, ty, rotation, flipX, flipY)`，顺序 `translate → rotate → scaleX(-1) → scaleY(-1)`
- Alt-copy 时 transform 写到**克隆体**，原件不动
- rAF 节流**仅节流 store 更新**（`setDimension`），DOM style 写入保持同步

**onDragEnd**：
- **无条件先派 `pointer-up`**（修复零位移点击 `isDrag===false` 时状态卡在 `dragging`）
- 应用 `pendingDragSelectionRef`
- `gestureRafThrottler.cancel()`
- Alt-copy 克隆即使零位移/异常结束也移除
- `if (!e.isDrag) return`
- Alt-copy → `duplicateSelectedToPosition(...)`；否则 `updateComponent(id, {position: {...}})`

**组拖拽**：`onDragGroupStart/Group/GroupEnd`，同一状态守卫集；**任一成员 locked 则整组拒绝**；`GroupDragDatas` 含 `ids/isAltCopy/altCopyClones[]/transforms[]`；提交走 `updateComponentsBatch` 单条历史；数量不符时 `console.warn`。组拖拽**故意不做 rAF 节流**（手势期间无 store 更新，只有 style 写入）。

### 4.3 Selecto 直接拖拽移交（点击未选中组件即拖）

`Selecto onDragStart` 内（`screen-canvas.tsx:2009-2061`）：
- 命中组件且不在 `selectedComponentIds` 中，且 `activeTool==='select'`，且状态 ∈ `SELECTO_ALLOWED_STATES`
- **双击预判**：`detectDoubleClick(...)` 避免"先选整组再缩到单个"的闪烁
- `selectionToApply` = 整组 ids（`groupPid != null && activeGroupId !== groupPid && !isPotentialDoubleClick`）否则 `[targetId]`
- `flushSync(() => setTargets(...))`
- locked → 只 `selectComponents`，不拖拽
- 否则 `pendingDragSelectionRef = selection`，`directDragHandoffRef = true`，`moveableRef.current.dragStart(mouseEvt)`
- `e.stop()`
- `onSelectEnd` 检测到 `directDragHandoffRef` 时提前返回

### 4.4 框选（marquee / rubber-band，react-selecto）

**配置**：

| 属性 | 值 |
|---|---|
| `selectableTargets` | 函数，返回 `contentRef.querySelectorAll('[data-component-id]')` |
| `selectByClick` | `!readonly && canEditCanvas && canSelect` |
| `selectFromInside` | `false` |
| **`hitRate`** | **`0`**（任意重叠即命中） |
| **`toggleContinueSelect`** | **`['ctrl']`**（Ctrl 追加选择） |

Selecto 无 `disabled` 属性，闸门在 `onDragStart` 内用 `e.stop()` 实现，6 层依序判定：
1. `readonly || !canEditCanvas` → stop
2. `!capabilities.canSelect` → stop（hand/create/zoom 工具）
3. `!SELECTO_ALLOWED_STATES.has(state)` → stop
4. `moveableRef.isMoveableElement(target)` → stop（点在控制手柄上）
5. 命中组件 → 直接拖拽移交 → stop
6. 空白画布 → `dispatchInteraction('pointer-down')` 启动 `marquee-selecting`

**onSelectEnd** 把决策委托给纯函数 `handleSelectEnd`（见 §9.2），并把触摸/指针事件规范化成 `MouseEvent` 以类型安全读取修饰键。

### 4.5 平移（Pan）

三条入口，全部汇聚到 `activeTool === 'hand'`：
1. 抓手工具（H）作为主工具
2. **Space 按住** → `pushTemporaryTool('hand')`（画布不再消费 `spaceRef`，平移完全由 `activeTool` 仲裁）
3. **中键平移：未实现** —— `handlePanStart` 要求 `e.button === 0`。状态机确实文档化了 `isPanGesture`（"空格按住或中键按下"）且 `transition` 尊重该 payload，但无调用点传入，属"已文档化未接线"能力

**handlePanStart 9 级派发链**（严格顺序）：
```
e.button !== 0 → return
!canEditCanvas && canCreate → return   （交互调试模式下创建工具禁用但视口工具仍可用）
activeTool==='text'    && canCreate → handleCreateText
activeTool==='rect|ellipse' && canCreate → handleCreateShapeStart
activeTool==='image'   && canCreate → handleCreateImage
activeTool==='zoom'    && canZoom   → handleZoomToolClick
activeTool!=='hand' → return
!SELECTO_ALLOWED_STATES.has(state) → return
preventDefault + stopPropagation + trySetPointerCapture → panState 记录 → 派 start-pan
```

**handlePanMove**：形状创建分支优先；**直接 DOM 写入** `translate3d(x,y,0) scale(s)`，无 React state、无 rAF；同步 `canvasOffsetRef` 与 `rulersRef.syncScroll`；手势期间不更新 Store。

**handlePanEnd**：用正则从 DOM 回读最终 transform
```
/translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)\s*scale\(([\d.]+)\)/
```
再 `setCanvasScaleAndOffset(finalScale, finalOffset)` 一次性提交。`isPanning` 是派生值（`interactionState === 'panning'`），非存储态。

### 4.6 缩放手柄（Resize）

- **`renderDirections = ['n','nw','ne','s','se','sw','e','w']`** —— 全 8 个手柄（4 角 + 4 边）
- `throttleResize = 1`（1px 粒度）
- `origin = false`（隐藏原点）
- `onResizeStart` 存 `ResizeDatas`（`id/origW/origH/origX/origY/rotation/flipX/flipY`）；`altRef` 为真时预置 `setDimension({mode:'中心变换'})`
- `onResizeEnd` **必须重新应用中心变换公式**：Moveable 内部 `drag.beforeTranslate` 从未用过中心公式，跳过会在鼠标松开时产生跳动
- 组缩放：`onResizeGroupStart/Group/GroupEnd`，全成员未锁检查，批量提交

### 4.7 旋转（Rotate）

- `throttleRotate = shiftHeld ? 15 : 0`
- `onRotateStart` 存 `RotateDatas`，其中 **`snapRotate` 捕获手势开始时的 `shiftRef`**
- `onRotate`：`snapRotate` 为真 → `Math.round(rotation / 15) * 15`；translate 保持不变（旋转围绕组件中心，`transform-origin` 默认 50% 50%）
- **非对称设计**：resize 每帧**实时**读 Shift/Alt；rotate 用**手势开始时**的 Shift 值

### 4.8 参考线拖拽

见 §6.2。

### 4.9 图层面板拖拽排序（@dnd-kit）

- 库：`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- Sensor：`PointerSensor` + **`activationConstraint: { distance: 8 }}`**（8px 激活距离，消除点击/拖拽歧义）
- 碰撞检测 `closestCenter`；策略 `verticalListSortingStrategy`
- `SortableContext.items` = **仅顶层组件 id**（组行与组内子项被刻意排除）
- 拖拽中样式：`opacity: 0.4`、`cursor: 'grab'`、`CSS.Transform.toString(transform)`
- **无落点指示器**：无 `DragOverlay`、无插入线、无 drop 高亮。反馈仅靠 0.4 透明度 + dnd-kit 自身的邻居位移
- **不支持改变父子关系（reparenting）**：不能拖进/拖出组，不能在组内排序。只能平铺重排顶层，且只经 `reorderLayerToIndex`
- 虚拟化路径下拖拽**完全禁用**（`DndContext` 子树不渲染），退化为每行的置顶/置底按钮

### 4.10 蓝图节点拖拽

见 §17.5。

---

## 5. 修饰键（Modifier Keys）

### 5.1 `useModifierKeys`（`hooks/use-modifier-keys.ts`）

4 键 × 2 表示：`spaceRef/shiftRef/altRef/ctrlRef`（ref 供高频指针回调，避免闭包过期）+ `spaceHeld/shiftHeld/altHeld/ctrlHeld`（state 供 UI 重渲染如光标）。

- **`window blur` 重置全部 4 ref + 4 state**，防止 `spaceHeld` 死锁
- 每键一个 keydown hook + 一个 keyup hook：keydown 受 `isFormElementFocused` 门控 + `enableOnFormTags: false`；**keyup 无条件 `enabled: true` + `enableOnContentEditable/FormTags: true`**（清理必达）
- `isFormElementFocused(root?)` 导出复用：**递归穿透嵌套 `shadowRoot.activeElement` 链**；判定 input/textarea/select 标签名或 `isContentEditable`。原因：`enableOnFormTags` 覆盖不到 contenteditable
- Mac 上 `cmd` 由 `mod` 处理，本 hook 只管纯 `ctrl`

### 5.2 各手势下修饰键行为矩阵

| 手势 | Shift | Alt | Ctrl / Meta | Space |
|---|---|---|---|---|
| **Selecto 选择** | 计入 `hasModifier` → 关闭单击/双击语义，保留原始 `selected` 与当前 `activeGroupId` | — | `toggleContinueSelect=['ctrl']` 追加选择；也计入 `hasModifier`（含 Cmd） | — |
| **组件拖拽** | 无 | **Alt+拖拽 = 复制**（PS 风格）。手势开始读 `altKey`，立即建克隆，原件不动；结束 `duplicateSelectedToPosition`。光标变 `copy` | — | — |
| **缩放** | `keepRatio` **每帧实时**读 → 锁定宽高比 | `isAltCenter` **每帧实时**读 → 中心变换；尺寸提示显示 `[中心变换]`；End 时按松手瞬间的 Alt 状态重算 | — | — |
| **旋转** | **手势开始时**捕获 → 15° 步进吸附 | — | — | — |
| **形状创建** | 无效果（未实现正方形/圆约束） | 无效果（未实现中心起点） | — | — |
| **缩放工具点击** | — | `zoomOut = e.altKey` → 因子 `1/1.5` | — | — |
| **滚轮** | — | 三个等价缩放触发键之一 | 三个等价缩放触发键之一 | — |
| **平移** | — | — | — | 临时抓手（压栈/出栈） |
| **文本编辑浮层** | — | — | `Ctrl/Cmd+Enter` = 提交 | 普通 Space 输入空格 |

---

## 6. 辅助线体系（标尺 / 参考线 / 网格 / 智能对齐）

### 6.1 标尺（`components/canvas-rulers.tsx`）

底层库 `@scena/react-ruler`。

| 项 | 值 |
|---|---|
| **`RULER_SIZE`** | **`20`** px（在 `canvas-guides.tsx:5` 重复定义，在 workbench 硬编码为 `{top:20, left:20}`） |
| 层级 | `z-50` + **`pointer-events-none`**（所有交互性来自 CanvasGuides 覆盖的热区） |
| 单位 | 仅 px，左上角 20×20 角块内容为字面量 `px`，无单位切换器 |
| **刻度间隔** | **`unit = Math.max(1, Math.floor(50 / scale))`** |
| `segment` | **`2`**（每个主刻度间只有 1 个中点次刻度；库默认是 10） |
| `negativeRuler` | 绘制负坐标 |
| textOffset | 横 `[0,10]`，纵 `[10,0]` |
| 库默认继承 | `longLineSize:10`, `shortLineSize:7`, `lineWidth:1`, `font:'10px sans-serif'` |

**刻度间隔随缩放实测表**（设计意图：任何缩放下屏幕主刻度间距恒为 ~50px）：

| scale | unit（画布 px） | 屏幕间距 |
|---|---|---|
| 0.10（MIN） | 500 | 50 |
| 0.25 | 200 | 50 |
| 0.50 | 100 | 50 |
| 0.75 | 66 | 49.5 |
| 1.00 | 50 | 50 |
| 1.25 | 40 | 50 |
| 1.50 | 33 | 49.5 |
| 2.00 | 25 | 50 |
| 5.00（MAX） | 10 | 50 |

代价：0.75/1.5 等非整比缩放下标签值是 66 / 33 这种非整数，无"漂亮数字"取整逻辑。

**滚动同步**：`RulersHandle` 只暴露 `syncScroll(scale?, offset?)`。
```
scrollX = -(rect.left - offset.x) / scale
scrollY = -(rect.top  - offset.y) / scale
```
**关键 memo 比较器**：`(prev, next) => prev.scale === next.scale` —— 组件**只在 scale 变化时重渲染**，offset 变化永不触发渲染，必须靠命令式推送。调用点 5 处（layoutEffect、适应屏幕、平移、滚轮缩放、其它缩放路径）。

**主题**：`LIGHT_PALETTE`（bg `#ffffff`、line `#e4e4e7`、text `#71717a`）/ `DARK_PALETTE`（bg `#1e1e2f`、line `#3a3a4e`、text `#a0a0b2`）。

**标尺缺失能力**：无鼠标位置指示器（库支持 `marks`+`markColor` 但从未传入）；无参考线拖拽时的数值读数（`hoverPos` 只渲染半透明预览线，无数字 tooltip）；无 `selectedRanges` 画布范围高亮；无 cm/in 单位切换。

### 6.2 用户参考线（`components/canvas-guides.tsx`）

**存储格式**（`GuidesState`）：
```
vertical:   number[]   // x 坐标，画布坐标系
horizontal: number[]   // y 坐标
visible:    boolean
locked:     boolean
```

关键特征：
- 参考线是**纯数字，非对象，无 id**，身份 = 数组下标；每次变更后升序排序
- **不属于 `project`** → 不落后端、不入 undo/redo 的 `HistoryEntry`。所有 guide 操作传 `replace=false` 且不包 `withHistory` → **参考线不可撤销**
- 仅 `visible` 持久化到 localStorage；`vertical`/`horizontal`/`locked` 是会话级

**坐标反变换**（导出供测试）：
```
x = (screenX - rect.left - RULER_SIZE - offset.x) / scale
y = (screenY - rect.top  - RULER_SIZE - offset.y) / scale
```
代码注释记录了历史 bug：漏掉 `RULER_SIZE` 会使落点偏移 `20/scale` 个画布单位。

**Store 动作 6 个**：

| 动作 | 行为 |
|---|---|
| `addGuide(orientation, pos)` | append + 升序 sort。无去重、无边界钳制、无取整 |
| `updateGuide(orientation, index, pos)` | 下标守卫 + 重排序。**拖拽中重排序会改变被拖项的下标 —— 一个潜在身份 bug**（把一条线拖过另一条时） |
| `removeGuide(orientation, index)` | 下标 filter |
| `clearGuides()` | 只清两个数组，不动 `visible`/`locked` |
| `toggleGuidesVisibility()` | 翻转 + 持久化 `guidesVisible` |
| `toggleGuidesLock()` | 翻转，不持久化 |

只读模式**不**门控参考线动作（readonly 下参考线仍可编辑）。

**创建（从标尺拖出）**：
- 两个热区，**仅 `!guides.locked` 时渲染**：顶部 `{left:20, right:0, top:0, height:20}` `cursor-ns-resize`；左侧 `{top:20, bottom:0, left:0, width:20}` `cursor-ew-resize`
- `index: -1` 是"新建中"哨兵值
- `trySetPointerCapture` 吞掉非活动指针的 `NotFoundError`，拖拽靠 window 监听器继续
- **仅在 pointerup 且落点在画布范围内才提交**：`canvasPos = Math.round(...)`，要求 `0 <= pos <= canvasWidth|canvasHeight`；越界则静默丢弃
- 预览线：`width/height: 1`，`backgroundColor 'rgb(56 132 209)'`，`opacity 0.5`；预览不钳制不取整（用原始 `hoverPos.pos`）

**拖动已有参考线**：window 监听器绑定 `containerRef.ownerDocument.defaultView ?? window`（iframe 安全）；`handleMove` 从 `dragStateRef` 读最新状态，**每次 move 都调 `updateGuide`（无 rAF 节流）**。

**删除两种机制**：
1. **双击参考线** → `removeGuide`（locked 时元素 `pointerEvents:'none'` 不可达）
2. **拖出容器**：**`REMOVE_THRESHOLD = 30`** px
   ```
   relative < RULER_SIZE - 30  ||  relative > rect.width + 30
   ```
   即 `relative < -10` 或 `> rect.width+30`。
   > 已知 bug：两个方向都用 `rect.width`，横向参考线的纵向拖出量被拿去和容器**宽度**比较，而非高度。

**渲染细节**：
- 根 `pointer-events-none absolute inset-0 z-40`；`if (!guides.visible) return null` → 隐藏参考线会连带禁用标尺拖出热区
- 模块级静态 style 对象（性能）：`width/height: 1`，颜色硬编码 `'rgb(56 132 209)'`（不随主题变）
- **命中区域 7px 宽**：`VERTICAL_GUIDE_HIT_AREA_STYLE = {left:-3, width:7}`，横向 `{top:-3, height:7}`
- 透明度：正在拖的 `opacity-100`，其它 `opacity-90`
- React key `` `v-${pos}-${i}` `` —— 位置在 key 里，拖拽每帧 key 都变
- 锁定：逐元素 `pointerEvents: locked ? 'none' : 'auto'`

**参考线 UI 入口**：状态栏 `Guide` 开关；视图菜单三项（`显示参考线` 复选框 + `mod+;` 徽章、`锁定参考线` 复选框 + `Lock/Unlock` 图标 + `disabled={!guides.visible}`、`清除参考线` + `disabled={!visible || !hasGuides}`）；快捷键 `mod+semicolon`。锁定与清除**无快捷键**，仅菜单。

### 6.3 网格（Grid）

| 项 | 值 |
|---|---|
| `gridEnabled` | 默认 **`false`**，**会话级，不持久化** |
| `gridSize` | 默认 **`10`**（注释建议取值 4/5/8/10/20） |
| 与 snap/smartGuides 关系 | **完全独立的三个开关** |
| Setter 校验 | `setGridSize` 无校验（"调用方负责边界校验"），Dialog 侧 `min={1}` + JS 守卫 |

**网格线生成**：
```
for (let x = gridSize; x < canvas.width; x += gridSize) lines.push(x)
```
起点为 `gridSize`（排除 0，已作为画布边界加入），严格 `<`（排除远端边，同样已加入）。1920×1080 + gridSize 10 → **191 + 107 = 298 条数字参考线**，全部 stringify 塞进 Moveable 的 guideline 数组。

**吸附网格的数学：画布侧没有专门的取整函数。** 网格吸附**完全**由"把网格坐标喂给 Moveable 静态 guidelines + 让 Moveable 的 `snapThreshold={5}` 做邻近吸附"实现。后果：
- 有效网格吸附阈值 = **5**（Moveable 阈值，在其自身坐标系内，`zoom={1/canvasScale}`）
- 若 `gridSize <= 2 * snapThreshold` 网格实际变成连续吸附
- 代码明确注释自定义 `computeSnappedPosition` 已被移除

**网格渲染：设计画布上完全没有网格绘制。** 网格只作为不可见的吸附目标存在。唯一可见的网格状图案是工作台的装饰性径向点阵（`radial-gradient(circle, var(--border) 1px, transparent 1px)` / `backgroundSize: 24px 24px`），与 `gridSize` 无关，也不受 `gridEnabled` 影响。

### 6.4 智能对齐线（Smart Guides）

#### 6.4.1 纯函数层（`lib/smart-guides.ts`）

| 常量 | 值 | 说明 |
|---|---|---|
| **`DEFAULT_SMART_GUIDES_THRESHOLD`** | **`5`** | 显示阈值（"与 Photoshop Smart Guides 一致"） |
| **`SMART_GUIDES_SNAP_THRESHOLD`** | **`3`** | 吸附阈值 |

类型：`AlignmentAxis = 'horizontal' | 'vertical'`（水平线=y 固定，垂直线=x 固定）；`AlignmentEdge = 'top'|'center'|'bottom'|'left'|'right'` —— 注意 **`'middle'` 不在联合类型中，`'center'` 同时表示 y 中线和 x 中线，靠 `axis` 字段消歧**。`AlignmentLine.position` 始终是**参考矩形**的边坐标。

**`findAlignmentLines`：9 水平 + 9 垂直 = 每个参考矩形 18 组候选**

预计算被移动矩形 6 边：`top=y`, `middle=y+h/2`, `bottom=y+h`, `left=x`, `center=x+w/2`, `right=x+w`。

水平 9 对（严格顺序）：
```
[top,top] [top,center] [top,bottom]
[center,top] [center,center] [center,bottom]
[bottom,top] [bottom,center] [bottom,bottom]
```
垂直 9 对：
```
[left,left] [left,center] [left,right]
[center,left] [center,center] [center,right]
[right,left] [right,center] [right,right]
```
判定 `Math.abs(movedPos - otherPos) <= threshold`（**闭区间**）。返回顺序：每个参考矩形先全部水平再全部垂直，参考矩形按输入顺序。**不对相同 `position` 去重** → 完全重叠的矩形产出 6 条零距离线（3H+3V）。

**`filterSnappableLines`**：`filter(distance < 3)`（严格小于）。

**`snapPosition` 多候选消解规则**：
- 每轴独立初始化 `minHDistance = minVDistance = 3`
- 跳过 `distance >= 3` 的线
- 每轴**最近优先**（`distance < min` 后更新 min），H 与 V 独立消解
- 水平线调 `top`：`top`→`position`，`center`→`position - h/2`，`bottom`→`position - h`
- 垂直线调 `left`：`left`→`position`，`center`→`position - w/2`，`right`→`position - w`
- **平局（距离相等）时先遇到者胜**（严格 `<`），因此由上面的对序决定

#### 6.4.2 状态：纯函数层是"保留但未接线"的死代码

全仓 grep：`SmartGuidesOverlay` 只出现在自身定义文件和 `lib/smart-guides.ts` 的文档注释里，无任何 import / 渲染；`useAlignmentLinesStore().setLines(...)` 除测试外无调用点；`findAlignmentLines` / `filterSnappableLines` / `snapPosition` **仅被 `smart-guides.test.ts` 引用**。

替代方案在 `screen-canvas.tsx:1243-1244` 明确写出："Canvas Drag Optimization：替代自定义 Smart Guides 的 findAlignmentLines 计算，由 Moveable 内置 snappable + elementGuidelines 完成组件间对齐吸附与辅助线渲染"。

未接线的 Overlay 细节（供参考）：`isSnappable = distance < 3`（**魔法字面量 3，未用导入常量**）；颜色 pink-500 `'rgb(236 72 153)'`（可吸附）/ `'rgb(236 72 153 / 0.7)'`；`1px dashed`；`DistanceLabel` 仅在 `distance > 0 && movedRect` 时渲染，**1 位小数**（`Math.round(d*10)/10`），10px 等宽字体，`rgb(236 72 153 / 0.9)` 背景。

#### 6.4.3 实际生效路径：Moveable 配置

| 属性 | 值 |
|---|---|
| `snappable` | `{snapEnabled}` |
| **`snapThreshold`** | **`5`** |
| **`snapGap`** | **`false`** |
| `flushSync` | react-dom 的 `flushSync`（React 18 并发） |
| `keepRatio` | `shiftHeld` |
| `throttleDrag` / `throttleResize` | `1` / `1` |
| `throttleRotate` | `shiftHeld ? 15 : 0` |
| `hideChildMoveableDefaultLines` | `targets.length > 1` |
| `snapDirections` / `elementSnapDirections` | `SNAP_DIRECTIONS`（同一对象） |
| `isDisplaySnapDigit` | `true` |
| `isDisplayInnerSnapDigit` | `false` |
| `zoom` | `1 / canvasScale`（控制手柄保持恒定屏幕尺寸） |
| `origin` | `false` |
| `renderDirections` | 8 个手柄 |

**`SNAP_DIRECTIONS = { top, bottom, left, right, center, middle }` 全 6 边/中线均为 `true`** —— 这正是实际行为在覆盖面上等价于纯函数 9×9 矩阵的原因（Moveable 术语里 `center`=x 中线，`middle`=y 中线）。

`filteredElementGuidelines` 排除当前被拖 targets（元素永不吸附自身）。`elementGuidelines` 源：`if (!smartGuidesEnabled) return []`，否则 `visibleComponents.map(c => componentRefs.get(c.id)).filter(非空)`，deps 含 `componentRefsVersion` 以捕获新挂载 DOM。

**`smartGuidesEnabled` 默认 `true`，会话级，且完全无 UI** —— 无菜单项、无状态栏开关、无快捷键，只能程序化触达。

#### 6.4.4 等距/分布检测：不存在

`lib/smart-guides.ts` 无任何间距逻辑；实际配置明确禁用 `snapGap={false}` + `isDisplayInnerSnapDigit={false}`。设计画布上没有"等间距"徽标/箭头。唯一的间距智能是显式的分布命令。

### 6.5 边框参考线（`Ctrl/⌘+K`）

- `showBorderGuides` 默认 `false`，会话级，不持久化，不入历史，不受 readonly 门控
- **精确效果**：纯粹是给每个**未选中**组件加静态描边，**与吸附毫无关系**
  ```
  outline: showBorderGuides && !selected ? '1px dashed rgba(147, 197, 253, 0.5)' : undefined
  ```
  即 1px 虚线 blue-300 @50%。**不新增 guideline，不改 vertical/horizontalGuidelines，不影响 elementGuidelines。** 本质是"告诉我不可见/透明组件在哪"的线框开关
- 入口：视图菜单 `组件边框参考线` 复选框（`Square` 图标）+ `mod+k`

### 6.6 画布边界与中心吸附

- **画布边界始终吸附**：`'0'` 和 `${canvas.width}` / `${canvas.height}` 无条件作为 `vertical/horizontalGuidelines` 前两项，与 `guidesVisible`/`gridEnabled` 无关（只要 `canvas` 非空）。阈值 = Moveable `snapThreshold=5`
- **画布中心参考线：未实现**。任何地方都没有 `canvas.width/2` 或 `canvas.height/2` 条目。`SNAP_DIRECTIONS` 的 `center`/`middle` 指的是**被移动元素**的中线去吸附 guideline 位置，而非画布中线 guideline
- Moveable 的 `bounds`/`innerBounds` 未使用 → 组件可自由拖到画布外
- 参考线创建**有**画布范围钳制（`0..canvasWidth`），但 `addGuide` 本身无钳制

### 6.7 吸附来源汇总（`snapEnabled` 总闸门）

| 来源 | 条件 | 阈值 |
|---|---|---|
| 画布边界 0 / width / height | 无条件（canvas 非空） | 5 |
| 用户参考线 | **仅 `guides.visible` 为真** | 5 |
| 网格线 | 仅 `gridEnabled` 为真 | 5 |
| 组件间对齐（元素 6 边/中线全向） | 仅 `smartGuidesEnabled` 为真 | 5 |

`snapEnabled` 默认 `true`，**持久化**到 localStorage，状态栏 `Snap` 开关切换。

### 6.8 蓝图侧吸附（对比）

| 常量 | 值 |
|---|---|
| `DEFAULT_GRID_SIZE` | `8` |
| `DEFAULT_ALIGNMENT_THRESHOLD` | `4`（对齐吸附） |
| `MAX_COMPILE_DEPTH` | `100` |
| `SNAP_THRESHOLD_PX` | `20`（锚点磁吸，屏幕像素，欧氏距离） |
| `SNAP_HIGHLIGHT_CLASS` | `blueprint-anchor-snap-target` |

`snapToGrid` = `Math.round(value / gridSize) * gridSize`，带 `-0` 守卫（`Math.round(-0.375) * 8 === -0`）。

`getAlignmentGuides` 3×3 全对全比较（`每个 dragged 边 vs 每个 other 边`），用 `Set` 去重并升序返回。

`applyAlignmentSnap` 解析策略与画布侧**不同**：按**坐标升序**遍历（不是距离），左/中/右 按顺序检查，`break`。**最低坐标优先 vs 最近优先**。

**优先级**：对齐吸附 **先于** 网格吸附；对齐命中即返回（即便 grid 也启用）。`onNodeDrag` 是**有意的 no-op**（"拖拽中间态不更新 nodes，避免每帧 setState 与历史膨胀"），所以**蓝图无实时对齐参考线渲染**，仅有磁吸落点（高亮 box-shadow）。

蓝图视觉背景是 `BackgroundVariant.Dots gap=20 size=1.5` —— **gap=20 ≠ 网格 8**；React Flow 自身的 `snapToGrid`/`snapGrid` prop **未使用**。

### 6.9 状态栏（`components/canvas-status-bar.tsx`）

布局 `h-7`（28px），`TooltipProvider` 自带。

| 段 | 内容 |
|---|---|
| 左 | 当前工具图标+名（`getToolById(activeTool).name`）；分隔线；选择信息（`未选中` / 单选名称 / `已选中 N 个组件`），**`useDeferredValue` 包**（Moveable 控制框先渲染） |
| 中 | 尺寸指示器（`X:{x} Y:{y} [+ W/H [+ R]] [+ [mode]]`）。`dimension.visible` 触发；文本用 `store.subscribe + el.textContent` **绕过 React** 逐帧写 |
| 右 | `Snap` 开关（`snapEnabled`）、`Guide` 开关（`guidesVisible`）、分隔线、交互模式开关（`design`↔`interactive`，amber）、分隔线、缩放下拉（`[25, 50, 75, 100, 125, 150, 200]`，`Math.round(scale*100)%`） |

**未显示**：网格、`smartGuidesEnabled`、参考线锁、标尺开关、光标/鼠标坐标、FPS、组件数、脏标记。

Dimension mode 实际观测值：`'中心变换'`（Alt+缩放时），在 `onResizeStart`/`onResize` 设，`onResizeEnd` 清。

### 6.10 画布设置对话框（`components/canvas-settings-dialog.tsx`）

`DialogContent sm:max-w-md`；本地 draft 模式（避免每次按键重渲染画布）；`useId` 多实例 Label/Switch 隔离。

| 选项 | 控件 | 默认 | 范围/校验 |
|---|---|---|---|
| `width` | `NumberField` | **1920**（`screen.schema.ts:38`） | 无 `min`，Apply 时 `Math.max(1, Math.floor(draft.width))` |
| `height` | `NumberField` | **1080** | 同上 |
| `backgroundColor` | `ColorField`（`<input type="color">` + 文本 `Input`） | **`'#000000'`** | 无校验，任意字符串 |
| `backgroundImage` | 文本 `Input` + 图标 | `undefined` | 空串→`undefined`；无 URL 校验；渲染 `background-size:cover` |
| `scaleMode` | `Select` 5 项 | **`'fit'`** | `fit` 等比缩放、`full` 拉伸铺满、`width` 宽度铺满、`height` 高度铺满、`none` 原始尺寸 |
| `gridEnabled` | `Switch`（独立 `border-t pt-3` 段） | `false` | **会话级，旁路 draft，实时生效** |
| `gridSize` | `NumberField` 后缀 `px` | `10` | `min={1}` + JS 守卫 `>= 1` 取整，无上限；`disabled={!gridEnabled}`；**实时生效** |

**不可配置**：参考线显隐/锁、`smartGuidesEnabled`、Moveable `snapThreshold`、标尺显隐、画布名、交互模式。

`gridSwitchId = useId()` 防多实例 `Label htmlFor`/`Switch id` 冲突。

底部 `取消`（丢 draft）/`应用`（`updateCanvas({...})` 一次性提交）。测试断言：多次编辑+Apply=**一条**历史；无变化+Apply 不入空历史。

---

## 7. 缩放与视口

### 7.1 常量（`lib/zoom-boundary.ts`）

| 常量 | 值 |
|---|---|
| **`MIN_SCALE`** | **`0.1`**（10%） |
| **`MAX_SCALE`** | **`5`**（500%） |
| **`ZOOM_TOOL_IN_FACTOR`** | **`1.5`** |
| **`ZOOM_TOOL_OUT_FACTOR`** | `1 / 1.5 ≈ 0.6667`（刻意取倒数，使 in/out 反复后精确回到原 scale） |
| **`WHEEL_ZOOM_FACTOR`** | **`1.1`** |

函数：`clampScale`；`computeClampedFactor(current, desired)` = `clampScale(current*desired)/current`，`current===0` 时返回 `1`（除零守卫）；`zoomWithBoundary` 在 `actualFactor===1`（已到边界）时返回原值 no-op。

### 7.2 定点缩放数学（`canvas-event-router.ts:472-480`）

模型 `screen = canvas * scale + offset`，不变量"光标下的画布点保持不动"：
```
(cursor − offset_old)/scale_old = (cursor − offset_new)/scale_new
⇒ offset_new = cursor − (cursor − offset_old) * (scale_new / scale_old)
```
`newScale <= 0` 时返回原值。该函数替换了原先三处重复实现（滚轮 handler、Z 工具点击、Ctrl+=/-）。

### 7.3 滚轮缩放

- 注册为 `containerRef` 上的**原生监听器** + **`{passive: false}`**（`preventDefault` 才生效）
- **闸门**：`isZoomGesture = e.altKey || e.ctrlKey || e.metaKey`；`!isZoomGesture` → return。
  **即 Ctrl+滚轮、Cmd+滚轮、Alt+滚轮三者完全等价**；**纯滚轮什么都不做**（无滚动平移）。
  > 注意：这里没有"Alt = 反向"行为，尽管 `shortcuts-registry` 里有 `zoomReverse: 'alt+wheel'` 的文档化条目
- 光标锚点为容器相对：`clientX - rect.left`
- 方向：`factor = deltaY > 0 ? 1/1.1 : 1.1`（下滚 = 缩小）
- 流程：`zoomWithBoundary` → 同步 refs → 直接 DOM transform 写入 → `syncScroll` → store 更新走 rAF 节流

### 7.4 缩放工具点击

- `e.button !== 0` → return；状态需 ∈ `SELECTO_ALLOWED_STATES`
- **`zoomOut = e.altKey`** —— Alt+左键 = 缩小，纯左键 = 放大
- 派 `start-zoom` → `zoomToolClick` → refs → 直接 transform → `setCanvasScaleAndOffset` → `syncScroll` → 派 `end-zoom` → `preventDefault + stopPropagation`
- 与 Alt+拖拽复制无冲突：缩放工具 `canDrag === false`
- start-zoom/end-zoom 纯为互斥仲裁与诊断存在（操作本身同步瞬时）

### 7.5 步进缩放与适应屏幕（`screen-editor-workbench.tsx`）

| 操作 | 实现 | 注意 |
|---|---|---|
| `handleZoomIn` | `setCanvasScale(Math.min(5, scale + 0.1))` | 加性 ±0.1 步长；硬编码 `5` 未复用 `MAX_SCALE`；无光标锚定（offset 不变） |
| `handleZoomOut` | `setCanvasScale(Math.max(0.1, scale - 0.1))` | 硬编码 `0.1` |
| `handleFitToScreen` | `scale = Math.min((rect.w-60)/canvas.w, (rect.h-60)/canvas.h, 1)` 然后居中 | 60px 总内边距，**上限 1（永不放大过 100%）** |

`setCanvasScale`（store）是裸 `set`，无边界钳制、无 offset 补偿。

### 7.6 缩放预设

- 状态栏下拉：`[25, 50, 75, 100, 125, 150, 200]`，`data-testid="zoom-display"`，显示 `Math.round(canvasScale*100)%`
- 工具栏下拉：`[50, 100, 200]` + `适应屏幕` 项

### 7.7 画布 transform 应用

专用 `canvasTransformRef` div：`translate3d(x,y,0) scale(s)` + `transformOrigin: 'top left'`，由 `useLayoutEffect([canvasScale, canvasOffset])` 同步并连带 `syncScroll`。

### 7.8 蓝图视口（`hooks/use-blueprint-viewport.ts`）

| 常量 | 值 |
|---|---|
| `MIN_ZOOM` | `0.25` |
| `MAX_ZOOM` | `2` |
| `ZOOM_STEP` | `0.2` |

| 配置 | 值 |
|---|---|
| `panOnScroll` | `false` |
| `zoomOnScroll` | `true` |
| `zoomOnPinch` | `true` |
| `panOnDrag` | `isSpacePanning`（Space 按住→拖拽平移） |
| `selectionOnDrag` | `!isSpacePanning`（普通左拖=框选） |
| `zoomOnDoubleClick` | **`false`**（双击改开搜索面板而非放大） |
| `selectionMode` | `Partial` |
| 默认缩放 | `1` |

`fitView` padding `0.2` duration `200`；`fitViewToNodes(ids)` padding `0.3`，空 ids 降级 fitView。视口**持久化**（`useOptionalBlueprintViewportCache` + 卸载时缓存）；`restoreViewport` 一次性还原（`restoredRef` 哨兵），`duration:0`。

视口工具条：放大 / 缩放标签 (`formatZoom` = `Math.round(z*100)%` / `data-testid="zoom-label"`) / 缩小 / 适配所有 / 缩放到选区（`selectedCount===0` 禁用）/ 重置到 100%。Space 按下时容器加 `ring-2 ring-ring/50`。

MiniMap 启用（`<MiniMap pannable zoomable>`），无 `<Controls>` 组件。

---

## 8. 形状创建几何（`lib/shape-creation-geometry.ts`）

| 常量 | 值 |
|---|---|
| **`DEFAULT_MIN_SHAPE_SIZE`** | **`4`** px（"小于此为误触"） |

- `normalizeRect`：`x=min(startX,curX)`, `y=min(...)`, `w=abs(dx)`, `h=abs(dy)` —— 处理全部 4 个拖拽方向，始终产出左上角 + 非负宽高
- `hasValidSize(w, h, minSize=4)`：`w >= 4 && h >= 4` —— 两个维度都要过（任一不足即取消，对齐 Photoshop）
- 纯函数，无 DOM 读取，输入已是画布坐标
- 状态机耦合：start→`start-create`；commit→`commit-create`；cancel→`cancel`；指针取消→`pointer-cancel`

**拖拽创建流程**：
- Start：`button!==0` / 状态不符 → return；坐标 `(clientX - rect.left - off.x)/scale`；`start*`与`current*`同点；`trySetPointerCapture`；派 `start-create`
- Move：在 `handlePanMove` 内，形状创建分支优先于平移
- End：`computeShapeCreation` → 有效尺寸则 `createComponentInstance(tool, x, y, maxZ+1, comps, {customSize})` → `addComponent` + `selectComponent` + 派 `commit-create`；实例为 null 则 `cancel`；尺寸不足则 `cancel` 且不入历史
- **实时预览**：矩形 `rgba(59,130,246,0.5)`，椭圆 `rgba(16,185,129,0.5)`；`border: '1px dashed #ffffff'`；椭圆 `borderRadius: '50%'`

**Shift 正方形/圆 与 Alt 中心起点：均未实现。** `handleCreateShapeStart` 完全不读修饰键；`shiftRef`/`altRef` 只出现在 Moveable resize/rotate 与光标派生中。

**点击不拖拽的默认尺寸**——两种截然不同的行为：
- **rect / ellipse**：位移 <4px 的点击**什么都不创建**（`hasValidSize` 失败→cancel），无兜底默认尺寸
- **text / image**：仅点击，无拖拽，尺寸取自 registry `defaultSize`

**各组件默认尺寸**：text `200×60`、rect `200×120`、ellipse `200×200`、image `320×240`（被自然尺寸的 `customSize` 覆盖）、button `120×48`、bar-chart `400×300`。

`createComponentInstance` 统一产出：`id: crypto.randomUUID()`；名称按类型自增（`${def.name} ${n+1}`）；基础样式 `{opacity:1, borderWidth:0, borderRadius:0, overflow:'hidden', ...defaultStyle}`；`status:{locked:false,hidden:false}`；`parentId: null`。

---

## 9. 选择模型与分组

### 9.1 三元选择状态

| 字段 | 语义 |
|---|---|
| `selectedComponentIds: string[]` | 逻辑选择 |
| `targets: HTMLElement[]` | Moveable 控制框目标（**只有画布写**，图层面板不写） |
| `activeGroupId: string \| null` | 进入的分组（Figma "Enter Frame" 模型） |

`selectComponent`/`selectComponents` 不动 `targets`；`clearSelection` 同时清两者。全部选择动作不入历史、不置 dirty。

### 9.2 `handleSelectEnd` 纯函数决策表（`canvas-event-router.ts:562-634`）

```
hasModifier   = ctrlKey || metaKey || shiftKey
isSingleClick = isDragStart && !hasModifier && selected.length === 1
```

| 场景 | selection | activeGroupId | lastClick |
|---|---|---|---|
| 修饰键 / 框选（`!isSingleClick`） | `selected` 原样 | **不变** | `null` |
| 单击 + 检测到双击，组件有 parentId | `[clickedId]` | `= parentId`（进入组） | `null`（防三击链） |
| 单击 + 双击，顶层组件 | `[clickedId]` | `null`（退出） | `null` |
| 单击，子项，`activeGroupId === parentId` | `[clickedComp.id]` | 不变（停留组内） | |
| 单击，子项，组不匹配 | **同 parentId 全部兄弟** | `null` | |
| 单击，顶层，`activeGroupId !== null` | `selected` | `null` | |

### 9.3 双击检测

`detectDoubleClick(prev, current, thresholdMs=400, positionThresholdPx=5)`：
- `prev===null` → false；不同 id → false；**负时间差 → false**；`delta > 400ms` → false
- 双方都带 x/y 时：`|dx| > 5 || |dy| > 5` → false

> 必要性：react-selecto 对 click 调 `preventDefault()`，原生 `dblclick` 被杀，必须时间戳检测。提取为纯函数供图层面板重命名等复用。

### 9.4 分组模型

- 字段 `parentId: string | null | undefined`（三态可表示）
- **分组是纯虚拟的** —— `project.components` 里没有 group 实体，state 里没有 group 记录。分组存在当且仅当 ≥1 个组件带该 `parentId`
- 组 id 格式 `` `group-${crypto.randomUUID()}` ``
- `groupSelected()`：要求 ≥2 选中；铸新 groupId 赋给全部选中。**覆盖已有 `parentId`** → 把跨组的组件全并入新的扁平组。结合"只能选组件不能选组"的事实，**嵌套分组不可达，模型是单层的**，无任何代码遍历父链
- `ungroupSelected()`：`parentId = null`，无论原本是否分组。**不清 `activeGroupId`** → 解组当前进入的组会留下悬空 `activeGroupId`（大纲组件找不到兄弟，渲染为空）

**组包围盒**：渲染期计算，从不存储（`ActiveGroupOutline`）：
```
minX/minY = min(position.x/y);  maxX/maxY = max(x+width / y+height)
left: minX-4, top: minY-4, width: maxX-minX+8, height: maxY-minY+8
border: '1.5px dashed rgb(59 130 246 / 0.7)', borderRadius: 4
```
四周各 4px 内边距，蓝色虚线，`pointer-events-none`，memo 化。

**删组时子项的命运**：无"删除分组"动作。图层面板右键组行会选中全部子项 → `delete` 命令走 `removeSelectedComponents`，组因无人引用而隐式消失。部分删除则剩余子项 `parentId` 保留，组以更少成员继续存在，**即使只剩 1 个子项也不自动解散**。`removeComponent` 不动其余组件的 `parentId`，也不清 `activeGroupId`，**无级联清理**。

**Esc 分层**：第一次 Esc 清 `activeGroupId`（保留选择），第二次 `clearSelection()`。文本双击强制 `activeGroupId = null`。项目加载/清空/信封替换时重置为 `null`，不持久化，不入历史。

---

## 10. 层级（Z-Order）

`zIndex` 是必填 `z.number().int()`。

### 10.1 置顶 / 置底

| 命令 | 数学 | 归一化 |
|---|---|---|
| `reorderToTop` | `maxZ = reduce(max, zIndex, 0)` → `target.zIndex = maxZ + 1` | 无，值单调上漂 |
| `reorderToBottom` | `minZ = reduce(min, zIndex, +Infinity)` → `target.zIndex = minZ - 1` | 无，可无界负增长 |

两者都扫描**全部**组件（含组内子项，无 `parentId` 过滤）。`reorderToTop` 的种子是 `0`，故全负 zIndex 时结果为 `1`。

### 10.2 上移/下移一层

无专门 store 动作，只作为图层命令的下标算术存在：
- `bring-forward`：`idx > 0` 时 `reorderLayerToIndex(id, idx-1)`
- `send-backward`：`0 <= idx < len-1` 时 `reorderLayerToIndex(id, idx+1)`
- 均限单选 + 顶层 + 未锁定

### 10.3 `reorderLayerToIndex` —— 唯一做归一化的操作

```
topLevel  = components.filter(!parentId).sort((a,b) => b.zIndex - a.zIndex)   // 0 = 最顶
clampedTo = clamp(toIndex, 0, len-1);  fromIdx === clampedTo → 短路
splice 移动
maxZ = reduce(max, 全部组件的 zIndex, 0)
topLevel.forEach((c, idx) => newZ[c.id] = maxZ - idx)
```
**归一化规则**：移动后顶层组件获得连续递减整数 `maxZ, maxZ-1, ...`，`maxZ` 取自**全部组件**（含组内子项）。只改写顶层，组内子项保留原 zIndex。

> 副作用：`maxZ` 含子项 → 高 zIndex 的子项会抬高整个顶层带；n 个顶层项时最低者为 `maxZ-n+1`，可能与子项碰撞或低于子项。

`reorderComponent(id, newZIndex)` 是裸逃生舱：显式设值，无归一化无钳制。

### 10.4 多选置顶的行为

键盘 `mod+]` 对每个选中 id **循环调用** `reorderToTop` → 每次取新的 `maxZ+1`，**多选置顶会反转选区内的相对顺序**。

---

## 11. 历史（Undo / Redo）与脏标记

### 11.1 容量与内容

**`HISTORY_LIMIT = 50`**，通过 `past.slice(-50)` 施加；`future` 无显式上限（仅由 `past` 界定）。

`HistoryEntry` 是 4 元组快照：
1. `components` —— **浅拷贝** `[...components]`
2. `canvas` —— 浅拷贝 `{...canvas}`
3. `blueprint?` —— 仅当真值时才展开
4. `globalVariables?` —— 同上（后两者可选以兼容旧快照）

**浅拷贝的正当性**：所有 store 更新都是不可变（展开），旧引用天然保有快照语义；刻意规避 `structuredClone` 以保性能。

**不追踪**：视口（scale/offset）、选择、`targets`、参考线、网格、snap、`interactionMode`、`uiVisible`、`screenMode`、剪贴板、`pasteCount`、`activeGroupId`、蓝图 Sheet 状态、项目元信息（name/description/status/id）。

### 11.2 `withHistory` 机制

```
pushHistory(set);                                        // 独立 set #1
set(state => ({ ...updater(state), isDirty: true }), false, actionName);   // 独立 set #2
```
两次分离的 `set` → devtools 两条独立记录。`isDirty: true` 在 updater 展开**之后**强制合并，updater 永远无法清脏。`pushHistory` 会**清空 `future`**。

**使用 `withHistory` 的 25 个动作**：addComponent、renameComponent、updateComponent、replaceComponentConfig、updateComponentsBatch、removeComponent、removeSelectedComponents、updateCanvas、updateBlueprint（非手势路径）、addGlobalVariable、updateGlobalVariable、removeGlobalVariable、reorderComponent、reorderLayerToIndex、reorderToTop、reorderToBottom、duplicateSelected、duplicateSelectedToPosition、nudgeSelected、adjustBorderWidth、setLocked、setHidden、pasteFromClipboard、groupSelected、ungroupSelected。四个对齐/分布动作经 `updateComponentsBatch` 间接入历史。

**明确排除**：全部选择动作、全部视口动作、全部参考线动作、网格/snap/smartGuides、UI（toggleUI/cycleScreenMode/setInteractionMode/蓝图 Sheet 开关）、`copySelectedToClipboard`、项目加载类、**`renameProject`（只置脏不入历史）**、`beginBlueprintGesture`、手势期间的 `updateBlueprint`（只置脏）。

### 11.3 蓝图手势批处理

- `beginBlueprintGesture`：幂等（active 时不重置 baseline），存 `{active:true, baseline: project.blueprint}`
- 手势期间 `updateBlueprint` 走 `'updateBlueprintGesture'` 分支：只更新 blueprint + 置脏，不入历史
- `endBlueprintGesture`：先清手势状态（避免提交时被误判为"手势中"）→ 引用相等 OR `JSON.stringify` 深比较 baseline vs current，无变化则不入历史；有变化则压**一条**历史，其 `blueprint` 取**手势 baseline**（撤销回到手势前），而 components/canvas/globalVariables 取当前值
- 节点配置面板写回也用手势 + **600ms 防抖**关闭，选择变化与卸载时同样关闭

### 11.4 防空历史的短路检查

`updateCanvas`（逐键比较）、`updateBlueprint`（引用 + 深比较）、`renameProject`、`updateGlobalVariable`、`removeGlobalVariable`、`setInteractionMode`、`reorderLayerToIndex`。

> `renameComponent` 名称相同时 updater 返回 `{}`，但 **`pushHistory` 已先执行**，仍会占一个历史槽；只有 trim 为空的前置检查才完全短路。同理 `reorderLayerToIndex` 的 `fromIdx===clampedTo` 短路也在 pushHistory 之后。

### 11.5 undo / redo

- `undo`：取 `past[last]`；恢复 components/canvas；`blueprint` 旧快照无则清为 undefined；`globalVariables` 旧快照无则为 `[]`（对齐 schema 默认）；**清空 `selectedComponentIds`**；当前快照 unshift 到 `future`；**置 `isDirty: true`**（即使撤销回到已保存状态）
- `redo`：镜像；取 `future[0]`；同样清选择；当前压 `past`（**此处无 `slice(-50)`，与 `pushHistory` 不对称**）；置脏

### 11.6 脏标记语义

含义："当前内容相对最近一次加载/保存响应发生变化"，只是布尔，无内容 diff，永不入历史。

- 置 `false`：初始态；`loadProject`/`clearProject`/`applyProjectEnvelope` 全量替换路径；save/publish 且"本地匹配提交 && 响应匹配提交"
- 置 `true`：每次 `withHistory`；`renameProject`；手势态 `updateBlueprint`；`undo`；`redo`；两条冲突保存的 rebase 路径
- 消费方：工具栏（未保存时禁发布）、导入对话框（覆盖警告文案）、`screen-host-session`

### 11.7 三路 rebase（保存冲突）

`applyProjectEnvelope` 6 分支决策表：
1. 非 save/publish 来源 → 全量替换
2. `currentProject===null || currentDraft===null` → 全量替换
3. `currentMatchesSubmission && responseMatchesSubmission` → 只更新 `{project, isDirty:false}`，**保留历史**
4. `currentMatchesSubmission && !responseMatchesSubmission` → 全量替换
5. `!currentMatchesSubmission && responseMatchesSubmission` → 保留本地项目，只打 `status` + `updatedAt`，置脏
6. 否则 → `rebaseLocalChanges(submitted, current, remote)` 三路合并（递归：base==local 取 remote，否则保 local）；解析失败降级全量替换

辅助：`isStructurallyEqual` 忽略值为 `undefined` 的键；`toComparableDraft` 用 `schemaVersion: 2`；`toInternalScreenProject` 仅在 id 相同时保留 `createdAt`/`thumbnail`。

---

## 12. 剪贴板

### 12.1 复制

- 存**深拷贝** `structuredClone(selected)`（防后续编辑源组件污染已粘贴内容）
- **同时重置 `pasteCount: 0`**，使下次粘贴偏移从 20 重启
- 不入历史，不置脏
- **仅内存 store 状态** —— 非系统剪贴板、非 localStorage。因此：无跨实例/跨标签共享，每个 store 实例独立剪贴板，不支持跨应用复制组件
- 键盘集成：有原生文本选区（`window.getSelection().toString().length > 0`）时提前返回，让浏览器原生复制生效

### 12.2 粘贴

| 项 | 行为 |
|---|---|
| **偏移** | **`(pasteCount + 1) * 20`**，同时作用于 x 和 y。第一次 +20/+20，第二次 +40/+40，第三次 +60/+60，累进且无上限；偏移是相对原始剪贴板坐标的绝对量（剪贴板条目从不被改写） |
| id 重生成 | 每个组件 `crypto.randomUUID()` |
| 名称 | 原样保留（粘贴**不**加后缀，与 duplicate 不同） |
| 二次深拷贝 | 粘贴时再 `structuredClone` 一次 |
| 插入位置 | 追加到 `components` 末尾；选择替换为新 id；`pasteCount++` |
| **嵌套分组** | `parentId` 由展开原样带过，**无重映射** → 粘贴原属 `group-X` 的组件，副本仍指向原 `group-X`，即加入既有分组而非形成新组。不铸新组 id，不做子孙遍历（分组虚拟，无实体可克隆） |
| `zIndex` | 原样带过 → 副本与原件共享 zIndex |

### 12.3 创建副本（duplicate）

- 按 `project.components` 文档顺序遍历（非选择顺序），Set 过滤
- 名称 `` `${c.name} 副本` ``
- **偏移固定 +20/+20，非累进** —— 对同一源重复 duplicate 都落在 +20；但选择会移到副本，故连续 duplicate 呈 +20 链式
- `parentId` / `zIndex` 保留（同粘贴的嵌套组注意点）

### 12.4 Alt 拖拽复制（`duplicateSelectedToPosition(x, y)`）

- 算选区包围盒左上角 `minX/minY` → `offsetX = x - minX`, `offsetY = y - minY`
- 整个选区平移使包围盒左上角精确落在 `(x, y)`，保留相对位置，无 +20 偏移
- 同样 id 重生成 + `副本` 后缀
- 调用点：`screen-canvas.tsx:1388`（单选）与 `:1709`（组），均传 `last.beforeTranslate[0/1]`

### 12.5 蓝图剪贴板（对比）

- **偏移 `pasteOffset = 20`**（x、y 同时）
- 传输走**系统剪贴板** JSON：`navigator.clipboard.writeText/readText`
- 载荷 `{kind:'nebula-blueprint-clipboard', nodes, edges}`，读写双向经 `BlueprintClipboardSchema` 校验
- **id 重映射**：节点 `node-${Date.now()}-${rand6}`，建 `idMap`；边 `edge-...` 并重映射 source/target；端点缺失于 map 的边被丢弃；`sourceHandle`/`targetHandle` 原样保留
- copy 只收集**两端都被选中**的边
- cut = copy 后删节点及所有相连边；剪贴板写失败则中止删除
- duplicate 走内存 `addPayload`，不经剪贴板往返，同样 +20/+20
- 粘贴后新节点 `selected: true`，原有节点全部取消选中
- 错误文案：`'复制到剪贴板失败，请检查浏览器权限'`、`'剪贴板内容不是有效的蓝图数据'`、`'读取剪贴板失败，请检查浏览器权限'`
- **static profile 守卫**：拒绝含 `requestApi` 全局节点、或 handle 越出白名单的载荷 → `'剪贴板内容包含当前 SDK 不支持的蓝图能力'`

---

## 13. 对齐与分布

### 13.1 画布侧（`editor-store.ts`）

| 动作 | 最小选中数 |
|---|---|
| `alignSelectedHorizontal('left'\|'center'\|'right')` | 2 |
| `alignSelectedVertical('top'\|'middle'\|'bottom')` | 2 |
| `distributeSelectedHorizontal()` | 3 |
| `distributeSelectedVertical()` | 3 |

四者全部委托 `updateComponentsBatch` → 恰好一条历史，全部 `Math.round` 取整。

**对齐参考 = 选区自身包围盒**：
```
minX = min(x);  maxRight = max(x + width);  centerX = (minX + maxRight) / 2
left → minX;  right → maxRight - width;  center → centerX - width/2
```

**分布数学**：按轴排序 → `gap = (maxRight - minX - totalWidth) / (n - 1)` → 游标推进（基于间隙均分）。

> 注意：对齐/分布**不跳过 locked 组件**。

### 13.2 蓝图侧（`blueprint/lib/align-distribute.ts`，纯函数）

`AlignMode = 'left'|'center-h'|'right'|'top'|'middle-v'|'bottom'`，参考同为选区包围盒；不取整（保留浮点）；输出顺序始终与输入一致；`default` 分支是 `never` 穷尽守卫会抛错。

**分布是基于中心的等距**：
- 守卫 `< 3` 个节点不动
- 按中心（`x + width/2`）升序排序副本
- `step = (lastCenter - firstCenter) / (len - 1)`
- 第 i 个：`targetCenter = firstCenter + step*i` → `newX = targetCenter - width/2`
- **首尾保持原中心**；中间节点按中心等距 → 宽度不等时**间隙不等**（代码明确注释）

`applyAlignResultToNodes`：未匹配节点按引用原样返回。

**蓝图对齐工具条**：`selectedCount >= 2` 才渲染，定位 `absolute bottom-4 left-4 z-10`；对齐按钮 `disabled = count < 2`，分布 `disabled = count < 3`（2 个节点只有两个锚点，`hasChange` 恒 false）。6 个对齐 + 2 个分布，`role="toolbar"` `aria-label="对齐与分布"`。所有点击先 `stopPropagation()` 防 ReactFlow 取消选择。提交时 `if (!result.hasChange) return` → 一条历史。

---

## 14. 图层面板

### 14.1 树构建（`buildLayerTree`）

- 全部组件按 `b.zIndex - a.zIndex` 降序排序
- 建 `parentId → children[]` 映射，按首次出现顺序记 `groupOrder`（组的位置由其最高 zIndex 子项决定）
- 先输出顶层（无 `parentId`）组件，跳过已分组者
- 再把**所有组追加到末尾**，标签 `` `组 ${idx+1}` ``（1 基），depth 0
  > 代码承认这是简化：理想情况组应插在其最高 zIndex 子项的位置，但为排序稳定而后置
- `handled: Set` 防重复输出

只有两级深度：depth 0（顶层组件 + 组行），depth 1（组内子项）。缩进 `paddingLeft: 12 + depth*16` → 12px / 28px；活动组行为 `10px`（补偿 2px 左边框）。

### 14.2 头部栏

- 标题 `` 图层 ({components.length}) ``
- `成组` 按钮：`disabled = selectedCount < 2`，tooltip `成组 (Ctrl+G)`
- `解组` 按钮：`disabled = !canUngroup`（项目存在 + 有选中 + 存在带 `parentId` 的选中项，O(1) Set 查找），tooltip `解组 (Ctrl+Shift+G)`
- `退出分组` 按钮：仅 `activeGroupId` 真值时渲染，`ChevronsUp` 图标，tooltip `退出分组 (Esc)`
- 活动组横幅：`正在编辑分组内部 — 按 Esc 退出`，蓝色条

### 14.3 内联重命名

- Enter 提交；Escape 置 `cancelledRef` 并 `onCancel`；Blur 提交（但 `cancelledRef` 为真时提前返回并复位，避免 Escape 引发的 blur 二次提交）
- `defaultValue` + `autoFocus` + `onFocus → e.target.select()` 全选
- `pointerDown`（防 dnd-kit 拖拽）/ `click` / `doubleClick` 全部 `stopPropagation`
- `aria-label="重命名组件"`，`data-testid="layer-rename-input"`
- **只能从右键菜单 `rename` 命令进入，没有双击行重命名**（行的 double-click 完全未处理）
- 提交时防御性二次检查（清 `renamingId` → trim → 空则退 → 重读实时 store → 目标缺失或名称未变则退），刻意与 store 侧检查重复以避免空历史
- 重命名期间整行的操作按钮簇隐藏

### 14.4 可见/锁定切换

**组件行**（悬停显形容器：`hidden || locked` 时 `opacity-100`，否则 `opacity-0 group-hover:opacity-100`）：
- Eye/EyeOff：`aria-label` `'显示'|'隐藏'` → `setHidden([id], !hidden)`
- Lock/Unlock：`aria-label` `'解锁'|'锁定'` → `setLocked([id], !locked)`
- 置顶 `ChevronsUp` / 置底 `ChevronsDown`：**始终可见**（虚拟化路径下不可拖拽时的兜底手段）
- 隐藏组件名称渲染为 `text-muted-foreground/40`

**组行**（`allHidden = children.every(hidden)`，`allLocked` 同理）：
- `显示全部/隐藏全部` → `setHidden(childIds, !allHidden)`
- `解锁全部/锁定全部` → `setLocked(childIds, !allLocked)`
- 均**始终可见**（非悬停门控），均 `stopPropagation`
- 组头额外显示子项数量与 `编辑中` 徽标（当前活动组）

### 14.5 多选

**组件行点击**（读实时 state）：
- `ctrlKey || metaKey` → 切换成员（在则移除，不在则追加）。**全仓无 shift+click 范围选择**
- 纯点击 + 顶层 → `setActiveGroupId(null)` 后 `selectComponent(id)`
- 纯点击 + 子项 + `activeGroupId === parentId` → 单选该子项
- 纯点击 + 子项 + 组不匹配 → 选中全部兄弟并退出活动组

**组行点击**：
- Ctrl/Cmd → 若全部子项已选则全移除，否则并集追加
- 纯点击 → `selectComponents(childIds)`，**不改 `activeGroupId`**

子项行在 `parentId === activeGroupId` 时显示 `组内` 徽标；非虚拟路径的顶层行硬编码 `inActiveGroup={false}`。

### 14.6 搜索/过滤：未实现

无搜索输入框、无过滤状态、无文本匹配、无类型过滤、无"仅显示选中/可见"开关。文件内 grep 只命中 `Array.prototype.filter`。头部只有成组/解组/退出组三个按钮。

### 14.7 右键菜单

**全面板共用单一菜单，非逐行菜单** —— 明确的性能决策：逐行菜单意味着每次渲染要对 N 行 × 12 个描述符求值，在 `flushSync` 选择帧内被放大，造成右键卡顿。

`ContextMenuTrigger asChild` 包裹整个滚动容器；`ContextMenuContent` 仅在 `menuTarget` 非空时渲染。空白处右键 → `setMenuTarget(null)` → 不挂载内容 → 不弹菜单。

右键选择规范化：右键未选中的组件时先 `selectComponent(id)`（行业惯例）；已选中则保留选择以支持批量操作。组行右键时若子项未全选则 `selectComponents(childIds)`。

`LayerCommandItems` memo 化，只在 Radix 打开时挂载。订阅 `project` 与**原始**（非 deferred）`selectedComponentIds` —— 菜单语义必须反映刚应用的选择。

**完整菜单项**（`layer-commands.ts:138-283`）：

| # | id | 标签 | 图标 | 启用条件 |
|---|---|---|---|---|
| 1 | `rename` | 重命名 | Pencil | 组件目标 + selection==1 |
| 2 | `copy` | 复制 | Copy | selection>0；`separatorBefore` |
| 3 | `duplicate` | 创建副本 | CopyPlus | selection>0 |
| 4 | `toggle-lock` | 解锁/锁定（动态） | Unlock/Lock | selection>0；`separatorBefore` |
| 5 | `toggle-hide` | 显示/隐藏 | Eye/EyeOff | selection>0 |
| 6 | `bring-to-front` | 置于顶层 | ArrowUpToLine | 组件目标 + 顶层 + `!hasLockedSelection`；`separatorBefore` |
| 7 | `bring-forward` | 上移一层 | ChevronUp | 组件目标 + 顶层 + selection==1 + 未锁 + `idx>0` |
| 8 | `send-backward` | 下移一层 | ChevronDown | 组件目标 + 顶层 + selection==1 + 未锁 + `idx<len-1` |
| 9 | `send-to-back` | 置于底层 | ArrowDownToLine | 组件目标 + 顶层 + `!hasLockedSelection` |
| 10 | `select-all` | 全选 | CheckCheck | 始终 |
| 11 | `clear-selection` | 取消选择 | X | 始终 |
| 12 | `align-left` | 左对齐 | AlignLeft | 组件目标 + selection≥2 + `!hasLockedSelection`；`separatorBefore` |
| 13 | `align-center-h` | 水平居中 | AlignCenter | 同上 |
| 14 | `align-right` | 右对齐 | AlignRight | 同上 |
| 15 | `align-top` | 顶对齐 | AlignStartVertical | 同上 |
| 16 | `align-middle-v` | 垂直居中 | AlignCenterVertical | 同上 |
| 17 | `align-bottom` | 底对齐 | AlignEndVertical | 同上 |
| 18 | `distribute-h` | 水平等距分布 | AlignHorizontalSpaceBetween | selection≥3 + `!hasLockedSelection` |
| 19 | `distribute-v` | 垂直等距分布 | AlignVerticalSpaceBetween | 同上 |
| 20 | `group` | 成组 | Group | selection≥2 + `!hasLockedSelection`；`separatorBefore` |
| 21 | `ungroup` | 解除成组 | Ungroup | selection 中存在 `parentId` |
| 22 | `lock` | 锁定 | Lock | selection>0 + 至少未锁 |
| 23 | `unlock` | 解锁 | Unlock | selection>0 + 至少已锁 |
| 24 | `hide` | 隐藏 | EyeOff | selection>0 + 至少可见 |
| 25 | `show` | 显示 | Eye | selection>0 + 至少隐藏 |
| 26 | `delete` | 删除选中 (destructive) | Trash2 | selection>0 |

---

## 15. 画布右键菜单（`components/canvas-context-menu.tsx`）

两种模式：`'component'` 和 `'canvas'`。`ContextMenuContent w-56`。`MenuItemContent` = 图标 + 文本 + `ShortcutBadge`。

### 15.1 组件模式 `ComponentMenuItems`

派生条件：`selectedCount` / `hasSelection` / `canAlign = count≥2` / `canDistribute = count≥2` / `canGroup = count≥2` / `allLocked = every(locked)` / `hasGrouped = some(parentId)`。

| 组 | 项 | 快捷键 | 禁用 |
|---|---|---|---|
| 剪贴板 | 复制 / 粘贴 / 创建副本 | mod+c / mod+v / mod+d | `!hasSelection` / `!clipboard` / `!hasSelection` |
| *(sep)* | | | |
| 删除 | 删除选中 (destructive) | Delete | `!hasSelection` |
| *(sep)* | | | |
| 状态 | 锁定/解锁（动态） / 隐藏 | mod+l / mod+h | 无 |
| *(sep)* | | | |
| 层级 | 置于顶层 / 置于底层 | mod+] / mod+[ | `allLocked` |
| *(sep)* | | | |
| 对齐 SubContent | 左/水平居中/右/顶/垂直居中/底 | mod+alt+l/c/r/t/m/b | `!canAlign \|\| allLocked` |
| 分布 SubContent | 水平分布 / 垂直分布 | mod+alt+h / mod+alt+v | `!canDistribute \|\| allLocked` |
| *(sep)* | | | |
| 成组 | 成组 / 解除成组 | mod+g / mod+shift+g | `!canGroup \|\| allLocked` / `!hasGrouped` |

层级动作对每个 id 循环 `reorderToTop` / `reorderToBottom`。锁切换走 `setLocked(selectedComponentIds, !allLocked)`。隐藏是**单向** `setHidden(..., true)`。

### 15.2 画布模式 `CanvasMenuItems`

| 项 | 快捷键 | 禁用 |
|---|---|---|
| 粘贴 | mod+v | `!clipboard` |
| *(sep)* | | |
| 全选 | mod+a | `!project` |
| *(sep)* | | |
| 放大 / 缩小 / 适应屏幕 | mod+= / mod+- / mod+0 | 无 |
| *(sep)* | | |
| 画布设置... | — | `!project` |

> 画布菜单的"全选"**不**过滤 locked/hidden，与 menubar 与 `mod+a` 快捷键不一致。

### 15.3 模式选择与命中测试

`handleContextMenu`: `compId = getComponentIdFromElement(e.target) ?? findComponentIdAtPoint(e.clientX, e.clientY, eventRoot)` —— 坐标命中回退，因为 Moveable 控制层可能拦截。命中 → 若未在选中则先 `selectComponent(id)`，`setMode('component')`；未命中 → `clearSelection()` + `setMode('canvas')`。

### 15.4 交互状态仲裁

`canOpenContextMenu()` 在 `interactionState` 给定时遵循 `CONTEXT_MENU_ALLOWED_STATES`（idle/hovering/marquee-selecting/context-menu-open），拒绝 dragging/resizing/rotating/panning/zooming/text-editing/creating。`handleOpenChange` 拒绝在非法状态打开，但**永不阻止关闭**，并向状态机镜像 `'open-context-menu'` / `'close-context-menu'`。

### 15.5 重定位兜底（re-position workaround）

`attachContextMenuRedistributor` 配 `flushSync`（`openRef=false; setOpen(false); setMenuKey(k+1); dispatchInteraction('close-context-menu')`）。根因（`:425-438`）：Radix Presence `duration-100` 退出动画 + DismissableLayer pointerdown 竞态；修法是等双 rAF 再重新派完整事件序列。

`<ContextMenu modal={false}>` —— `modal={false}` 是因为 `body { pointer-events: none }` 会破坏 Moveable pointerdown；代价是失去 trapFocus/scrollLock/aria-hide，保留 outside-click 与 Esc dismiss。Trigger 用 `cloneElement` 在子元素上组合 `onContextMenu`，非元素子节点被 `<div>` 包裹。

---

## 16. 工作台布局（`components/screen-editor-workbench.tsx`）

### 16.1 Provider 栈（外→内）

```
ScreenSdkPortalRootProvider (portalRoot)
└ ScreenEditorEnvironmentProvider {capabilityProfile, isActive, portalRoot, readonly, requestNavigate, runtimeProfile, setTheme, theme}
  └ RegistryProvider (registry={componentRegistry})
    └ ScreenEditorNotificationProvider
      └ <div ref={eventTargetRef}>
        └ ScreenEditorWorkbenchContent
```

内部包 `<TooltipProvider>`（`:649`）。

### 16.2 垂直布局

根 `relative flex h-full flex-col bg-background text-foreground`，`data-nebula-readonly={readonly ? '' : undefined}`。

| 顺序 | 元素 | 条件 |
|---|---|---|
| 1 | `<EditorToolbar>` | `showToolbar` |
| 2 | `<div className="flex min-h-0 flex-1 overflow-hidden">` | 始终 |
| 2a | `<EditorLeftPanel readonly>` | `showPanels` |
| 2b | `<CanvasContextMenu>` 包裹画布容器 | 始终 |
| 2c | `<EditorRightPanel>` | `showPanels` |
| 3 | `<CanvasStatusBar editorSession>` | `showPanels` |
| 4 | 加载罩 `absolute inset-0 z-40 bg-background/60` + Spinner | `hostState.phase==='loading' && hostState.retainedProject` |
| 5 | 变更阻塞罩 `absolute inset-0 z-30 cursor-wait bg-background/10`，`aria-label="项目操作进行中"` | `hostState.pendingMutations.length > 0` |

画布容器（`:691-734`）：
- `ref={canvasContainerRef}`，`relative flex-1 overflow-hidden bg-muted/40`
- 装饰背景 `radial-gradient(circle, var(--border) 1px, transparent 1px)` / `24px 24px`
- 子元素：`<CanvasRulers ref={rulersRef}>`；`<div className="absolute inset-0" style={{ top: 20, left: 20 }}>` 包裹 `<ScreenCanvas>`（20px 标尺槽）；`<CanvasGuides>`；`<TextEditorOverlay>`（编辑时）；`<CanvasFlashOverlay>`（闪烁时）

画布回退尺寸：`canvasWidth = canvasConfig?.width ?? 1920`, `canvasHeight = canvasConfig?.height ?? 1080`。

### 16.3 可调整面板

**左面板**（`editor-left-panel.tsx`）：
- `defaultWidth:240`, `minWidth:200`, `maxWidth:400`
- 存储键 `` `${preferenceNamespace}:left-panel-width` ``
- 方向 `direction:'right'`

**右面板**（`editor-right-panel.tsx`）：
- `defaultWidth:288`, `minWidth:240`, `maxWidth:480`
- 存储键 `` `${preferenceNamespace}:right-panel-width` ``
- 方向 `direction:'left'`

默认 namespace 常量 `DEFAULT_SCREEN_EDITOR_PREFERENCE_NAMESPACE = 'nebula:screen-sdk:v1'`，故默认 key `nebula:screen-sdk:v1:left-panel-width` / `:right-panel-width`。该常量来自 `lib/preferences-persist.ts`：负责每实例偏好持久化（`snapEnabled` / `guidesVisible` / `interactionMode`），namespace 隔离存储，并兼容旧 key `nebula:screen-editor:preferences` 迁移。

**`useResizablePanel`**：
- 初始 `Math.min(maxWidth, Math.max(minWidth, readStoredWidth(...)))`
- `readStoredWidth` 拒绝非有限/`<=0` 值，try/catch 包 localStorage
- `clamp` = `Math.min(maxWidth, Math.max(minWidth, Math.round(value)))`
- delta 数学：`direction==='right' ? start.width + delta : start.width - delta`
- 持久化**仅在 pointerup**（`persistWidth(widthRef.current)`）+ 双击重置；`passive: true` 监听器在 `dragStartRef?.ownerWindow ?? window`
- 返回 `{width, isDragging, handlePointerDown, handleDoubleClick}`

**`PanelResizeHandle`**：
- `role="separator"`、`aria-orientation="vertical"`，`w-1 cursor-col-resize touch-none`
- hover `bg-primary/40`，拖拽 `bg-primary/60`；拖拽时设 `body.style.cursor = 'col-resize'` 与 `userSelect:'none'`，清理时恢复
- 左面板：handle 在 Tabs 之后；右面板：handle 在内容之前

### 16.4 折叠行为

**左**（`editor-left-panel.tsx`）：本地 `collapsed` 状态（不持久化）。折叠导轨 `w-12 ... border-r` 含两个 `ToolbarButton`（`Package`/`Layers`），`expandTo(target)` 同时设 tab 并清折叠。展开头有收起按钮 `PanelLeftClose`。

Tabs（`:71-96`）：`TabsList h-8 flex-1`；`value="library"`（`Package`）/`value="layers"`（`Layers`）。只渲染 active tab。readonly 包装：library `pointer-events-none opacity-60`，layers `pointer-events-none opacity-80`。

**右**（`editor-right-panel.tsx`）：折叠导轨 `w-12 ... border-l` 单 `ToolbarButton`（`SlidersHorizontal`）。展开根 `style={{width, contain:'layout style paint'}}`。折叠按钮绝对定位 `absolute top-1.5 right-2 size-7` `PanelRightOpen`。

两面板均 `memo` 化（带性能说明注释）。

### 16.5 能力门控

```
canPublish      = host===undefined ? operations.publish!==undefined      : capabilities?.publish
canImport       = host===undefined ? true                                : capabilities?.import
canExport       = host===undefined ? operations.exportProject!==undefined: capabilities?.export
canUseSnapshots = host===undefined ? operations.snapshots!==undefined    : capabilities?.snapshots
isSaving        = host===undefined ? operations.isSaving===true          : pendingMutations.includes('save')
isPublishing    = host===undefined ? operations.isPublishing===true      : pendingMutations.includes('publish')
```

### 16.6 主机相位早返

- `phase==='waiting'` → `<div h-full w-full bg-background aria-label="等待项目配置" />`
- 初始 loading → 居中 `<Spinner size-6>`
- `phase==='error' | 'unsupported'` → 错误消息 + `重试` 按钮调 `operations.host?.controller.retry()`

### 16.7 键盘快捷键装配（`:586-598`）

```
onSave: readonly ? () => undefined : handleSave
onZoomIn/onZoomOut/onFitToScreen, onShowHelp: () => setShowHelp(true)
editorSession, isActive, readonly
focusRoot: portalRoot?.getRootNode() as Document | ShadowRoot | undefined
suspended: showEventBlueprint || blueprintSheetOpen || showComponentJsonEditor || hostMutationPending
```

### 16.8 命令式句柄（`:564-582`）

`fitToScreen()` 与 `focusComponent(componentId)`：找不到返回 false；找到则 `selectComponent(id)` 后找 `[data-component-id]` 元素 `scrollIntoView({block:'nearest', inline:'nearest'})`。

### 16.9 重要消息

`'项目包含当前 SDK 不支持的功能'`、`'请先结束当前编辑操作'`、`'重新加载失败，请重试'`、`'发布成功'`、`'请先保存修改后再发布'`、`已导出 ${file.fileName}`、`'导出能力不可用'`。

---

## 17. 事件蓝图（`src/blueprint/`）

### 17.1 图形库与节点/边

- **图库：`@xyflow/react` v12.11.2**（React 19.2.7）
- 节点类型 5 个：`component` / `global` / `delay` / `condition` / `comment`（蓝图数据模型只有 4 `kind`，`'global'` 是 `kind==='component' && globalType` 的派生）
- 边类型 1 个：`exec`（`getBezierPath` + `BaseEdge`）；`MarkerType.ArrowClosed`，`width:16 height:16 color:'#94a3b8'`（slate-400）
- 选中边：stroke `blue-500` w=2.5；`animated` → `strokeDasharray:'5 5'`；选中边中点删除按钮 `EdgeLabelRenderer` `aria-label="删除连线"` `data-testid="exec-edge-label"`
- 持久化 schema `EVENT_BLUEPRINT_VERSION = 2`；`GLOBAL_COMPONENT_ID = 'global'`；`BLUEPRINT_CLIPBOARD_KIND = 'nebula-blueprint-clipboard'`；旧 v1（trigger/condition/action/comment）仅用于迁移

### 17.2 节点目录

**共享外壳**（`base-node.tsx`）：
- `ANCHOR_ROW_HEIGHT = 24`；Handle `top = anchorOffset + idx*24 + 12`
- 节点盒 `min-w-[200px] max-w-[280px] rounded-xl`
- 颜色方案：`comment`=gray / `condition`=purple / `component`=emerald / `delay`=amber
- Handle 颜色：源 `bg-emerald-500` / 目标 `bg-sky-500` / else `bg-rose-500` / 中性 `bg-muted-foreground`
- 边框优先级：**悬空 > 错误 > 警告 > 循环 > 选中 > 虚线 > 默认**
  - 悬空/错误 `border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.16)]`
  - 警告 `border-yellow-500 shadow-[0_0_0_3px_rgba(234,179,8,0.16)]`
  - 循环 `border-dashed border-orange-500`
  - 选中 `border-blue-500` + 蓝色发光
- `locating` → `animate-pulse ring-2 ring-blue-400 ring-offset-2`
- 布局约定：**目标在左、源在右**（数据流左→右）

**`component` 节点**（`component-node.tsx`）：完全动态引脚。`showInputHandle=false`、`showOutputHandle=false`、`dynamicAnchors={sourceAnchors: events, targetAnchors: actions}`。源 handle id `evt:{eventId}`，目标 `act:{actionId}`。`static capability profile` 裁剪为 `click|hover` + `show|hide|toggleVisibility`。

**`global` 节点**（`global-node.tsx`）：

| globalType | 标签 | 源 handle | 目标 handle |
|---|---|---|---|
| `pageLoad` | 全局 · 页面加载 | `evt:pageLoad` | — |
| `navigate` | 全局 · 导航跳转 | — | `act:navigate` |
| `requestApi` | 全局 · 请求接口 | — | `act:requestApi` |
| `scrollTo` | 全局 · 滚动定位 | — | `act:scrollTo` |
| `interval` | 全局 · 定时触发 | `evt:interval` | — |

配置 schema（`GlobalNodeConfigSchema` = `discriminatedUnion('globalType', [navigate, requestApi, scrollTo, interval])`）：
- `navigate`: `{globalType:'navigate', url, target:'_blank'|'_self'}`，superRefine 强制 url 匹配 `NAVIGATE_URL_PROTOCOL_PATTERN = /^https?:\/\//i`（"仅允许 http/https 协议的链接"）
- `requestApi`: `{globalType:'requestApi', method, url, headers, body, secretHeaderKeys, timeoutMs: int 1..300000 默认 10000}`，url 同上协议
- `scrollTo`: `{globalType:'scrollTo', targetComponentId}`
- `interval`: `{globalType:'interval', intervalMs: int > 0}`，superRefine `<100` → "定时器间隔不得小于 100ms"；`>86400000` → "不得超过 86400000ms（24 小时）"
- `pageLoad` 无 config

`ComponentNodeSchema.superRefine`：`globalType` 存在 ⇒ `componentId` 必须为 `'global'`；`pageLoad` 不能有 config；其他 globalType 必须有 config；`config.globalType` 必须一致；普通组件节点不能有 config。

**`condition` 节点**（`condition-node.tsx`）：静态引脚 `in`（中性）+ `then`（`top:'40%'`, emerald） + `else`（`top:'70%'`, rose）。配置 `{type:'condition', expression}`；`expression: {source: {kind:'componentProp'|'componentData', componentId, key}, operator, value?}`；操作符 9 个 `eq/ne/gt/gte/lt/lte/contains/empty/notEmpty`；`empty`/`notEmpty` 不需要 value。

**`delay` 节点**（`delay-node.tsx`）：`in` + `out`（中性）。配置 `{delayMs}`，范围 0..60000（superRefine）。

**`comment` 节点**（`comment-node.tsx`）：**无引脚**。配置 `{text}`，默认 `''`，不参与执行/连接。

### 17.3 连线规则

全部在 `lib/pin-compatibility.ts`。

**Handle 分类**：
```
eventHandlePrefix  = 'evt:'
actionHandlePrefix = 'act:'
outputHandles = Set(['out','then','else'])
inputHandles  = Set(['in'])
logicNodeKinds = Set(['condition','delay'])

isOutputHandle(h) = h.startsWith('evt:') || outputHandles.has(h)
isInputHandle(h)  = h.startsWith('act:') || inputHandles.has(h)
```

**`isConnectionValid` 7 级拒绝**（按顺序）：

| 顺序 | 原因码 | 条件 |
|---|---|---|
| 1 | `source-node-not-found` | 源 id 不在 nodeIndex |
| 2 | `target-node-not-found` | 目标 id 不在 nodeIndex |
| 3 | `comment-node-disconnected` | 源或目标 `kind==='comment'` |
| 4 | `source-handle-is-input` | `!isOutputHandle(sourceHandle)` |
| 5 | `target-handle-is-output` | `!isInputHandle(targetHandle)` |
| 6 | `self-loop-logic` | `source === target && logicNodeKinds.has(source.kind)` |
| 7 | `duplicate-edge` | `hasDuplicateEdge(...)`（四元组全等） |

**自环策略**：仅对 condition/delay 节点拒绝。组件节点的 `evt:X → act:Y` 自环合法（`cycle.ts:57-64` 显式跳过）。

连线时不查环，环检测在编译期。

边 id 格式 `edge-${Date.now()}-${rand6}`，节点 `node-${Date.now()}-${rand6}`。缺 `sourceHandle`→`'out'`，缺 `targetHandle`→`'in'`。

### 17.4 锚点磁吸（`hooks/use-anchor-snap.ts`）

- 阈值 **`SNAP_THRESHOLD_PX = 20`**，欧氏距离
- 高亮类 `blueprint-anchor-snap-target`
- CSS：`.react-flow__handle.blueprint-anchor-snap-target { box-shadow: 0 0 0 2px rgb(59 130 246 / .9), 0 0 8px 2px rgb(59 130 246 / .5); background-color: rgb(96 165 250) !important; transition: box-shadow 150ms ease-out; }`（`prefers-reduced-motion: reduce` 下无过渡）
- `findNearestCompatibleHandle`：跳过缺 `data-nodeid`/`data-handleid`、跳过自身（`nodeId === sourceNodeId`）、跳非输入 handle、跳 `isConnectionValid` 失败的；保留 ≤20px 中**最近**
- `highlightHandle` 先清后加；`clearAllSnapHighlights` 批量清
- 状态机 `AnchorSnapState`：源 active 时记录 `{activeSourceNodeId, activeSourceHandle, snappedTargetNodeId, snappedTargetHandle}`；`updateSnapped` 命中未变则短路（mousemove 高频节流）
- `wrapConnectStart` 仅 `handleType==='source'` 时记录源；`wrapConnectEnd` 顺序：先重置 refs/state/高亮 → 若 `connectionState.toNode` 存在则委托原 handler（用户直接命中 handle）→ 否则若 snapped 则走 `onSnapConnect`（绕过搜索面板）→ 否则 fallback
- 根作用域 `getRoot()` 优先，缺省 `document`（多实例隔离）
- mousemove `{passive: true}` 容器监听

### 17.5 节点拖拽

React Flow 默认实现：
- `panOnDrag = isSpacePanning`（Space 按住→平移）
- `selectionOnDrag = !isSpacePanning`（普通左拖=框选）
- `selectionMode = 'Partial'`
- `zoomOnDoubleClick = false`（双击改开搜索面板，见 §17.11）

**`onNodeDrag` 是有意的 no-op**（避免每帧 setState 与历史膨胀），但**`onNodeDragStop` 走 `applyDragResult` 一次性应用吸附**：
1. 对齐吸附先尝试（`enableAlignSnap && w>0 && h>0`）
2. 对齐命中即返回（即使 grid 启用）
3. 否则网格吸附 `Math.round(x / gridSize) * gridSize`

未在中间帧渲染实时对齐参考线。

### 17.6 选择

- 多选修饰键 React Flow 默认 `Shift`（未覆盖 `multiSelectionKeyCode`）
- `selectNodesOnDrag: true`
- 全选：`handleSelectAll` 同时设 `selected: true` 于**所有节点+边**（绑 `mod+a` 与画布右键菜单）
- 反选：Esc 第 3 层
- 右键未选中的节点：唯一选择并清空边；右键未选中边：唯一选择并清空节点
- 选中持久化：蓝图→RF 同步时重应用 `selected`/`measured`

`hooks/use-blueprint-selection.ts` 独立存在但**未在 sheet 使用**。

### 17.7 编译器（`compiler/`）

**`MAX_COMPILE_DEPTH = 100`**（`types.ts:88`）

**输出** `CompileResult { rules: CompiledRule[]; diagnostics: BlueprintDiagnostic[] }`。
`CompiledRule { triggerNodeId, triggerEventId, triggerComponentId, steps: CompiledStep[], intervalMs? }`。
`CompiledStep = ActionStep | ConditionStep | DelayStep`。

**`ActionId` 联合**：`show | hide | toggleVisibility | refreshData | scrollTo | navigate | requestApi`。
**`ActionStepConfig`**：前 5 项为 `{actionId}`，`navigate`/`requestApi` 加 `config: GlobalNavigateConfig` / `GlobalRequestApiConfig`。

**索引**（`indexes.ts`）：`nodes: Map<id, NodeIndexEntry>`，`outgoingEdges: Map<src, edges[]>`，`incomingEdges: Map<dst, edges[]>`，`diagnostics` 收集重复 id 错误。

**诊断码**（`BlueprintDiagnosticCode`）：
`'cycle' | 'dangling-component' | 'empty-config' | 'invalid-delay' | 'duplicate-node-id' | 'duplicate-edge-id' | 'invalid-edge-handle'`
级别 `error | warning | info`（`info` 当前无发射点）。

| 码 | 级别 | 消息模板 | 发射点 |
|---|---|---|---|
| `duplicate-node-id` | error | `Duplicate node id: {id}` | `indexes.ts:31-36` |
| `duplicate-edge-id` | error | `Duplicate edge id: {id}` | `indexes.ts:45-50` |
| `cycle` | error | `Execution cycle detected: {a -> b -> ... -> a}` | `cycle.ts:42-47` |
| `dangling-component` | error | `Component {id} does not exist in the project.` | `compile.ts:54-59` |
| `dangling-component` | error | `Scroll target {id} does not exist in the project.` | `compile.ts:88-93` |
| `empty-config` | warning | `Navigate node has no URL.` | `compile.ts:65-70` |
| `empty-config` | warning | `Request API node has no URL.` | `compile.ts:75-80` |
| `invalid-delay` | error | `Interval {ms}ms is outside the valid range.` | `compile.ts:99-106` |
| `invalid-delay` | error | `Delay {ms}ms is outside the valid range.` | `compile.ts:120-127` |
| `invalid-edge-handle` | — | **类型中声明但代码不发射** | `types.ts:64` |

诊断顺序：`indexes.diagnostics` → `detectCycles` → `validateNodes`。

**环检测**（`cycle.ts`）：迭代-递归 DFS + 三色标记 `WHITE=0/GRAY=1/BLACK=2`。BLACK→返；GRAY→back edge=环，`cycleStart = pathStack.indexOf(nodeId)`，消息 `[...pathStack.slice(cycleStart), nodeId].join(' -> ')`；GRAY 推 pathStack 后递归 outgoingEdges、pop、BLACK。**例外**（`:56-64`）：源节点 `kind==='component'` 且 `edge.source===edge.target` 且 sourceHandle `evt:` 且 targetHandle `act:` 时跳过此边（合法组件自触发）。

**规则编译**（`compile.ts:130-167`）：对每个 `component` 节点，收集其 outgoing edges 中 `sourceHandle` 以 `evt:` 开头的不同 handle；每个 handle 发一条规则，triggerEventId = handle.slice(4)，triggerComponentId = entry.componentId ?? 'global'；`interval` 节点且 handle=`evt:interval` 时附 `intervalMs`。

**步骤遍历**（`compileStepsFromHandle`，`:169-221`）：`depth > MAX_COMPILE_DEPTH` 返回。每条 outgoing edge：
- `visited` key = `` `${edge.target}:${edge.targetHandle}` `` 去重
- `targetHandle` 以 `act:` 开头 → `buildActionStep`
- `targetHandle !== 'in'` → 跳过
- 目标 `condition` → `compileConditionStep`（递归 then/else，`depth+1`）
- 目标 `delay` → `buildDelayStep` 然后从其 `'out'` 继续（`depth+1`）

`buildActionStep`（`:247-288`）：5 个 component action 直接发；`navigate`/`requestApi` 需 `globalType` 一致才发；default → `null`（未知 action handle 静默丢弃，无诊断）。

`filter-by-component.ts`：无向 BFS 闭包。空 componentId 返回空集；构建对称邻接；种子为所有 `kind==='component'` 且 `componentId` 匹配的节点；BFS 闭包到整个连通分量。

### 17.8 运行时执行器（`runtime/executor.ts`）

**入口**：
- `executeRule(rule, event, deps) → RuleExecutionLog`（`truncated: false`）
- `triggerAndExecute(rules, event, deps) → RuleExecutionLog[]`（顺序 `for…of` 收集）
- `executeSteps`（顺序）→ action push 结果；condition 评估后递归 then/else；delay `await sleep(delayMs)`（`sleep` = `setTimeout` Promise）—— delay **不**贡献结果

**支持 action**（`executeActionStep`）：

| actionId | 行为 | 跳过条件 |
|---|---|---|
| `show` | `applyVisibility(id, true)` | target 无效 |
| `hide` | `applyVisibility(id, false)` | target 无效 |
| `toggleVisibility` | `applyVisibility(id, !getVisibility(id))` | target 无效 |
| `refreshData` | `await refreshDataSource(id)` | target 无效 |
| `scrollTo` | `scrollToComponent(id)` | target 无效 |
| `navigate` | `openUrl(config.url, config.target)` | `url===''` → 跳过 `'Navigate URL is empty.'` |
| `requestApi` | `await requestApi({method,url,headers,body,secretHeaderKeys,timeoutMs})` | `url===''` → 跳过 `'Request API URL is empty.'` |

`validateTargetComponent`：`componentId===''` → `'Target component is not configured.'`；`!hasComponent(id)` → `` `Target component ${id} does not exist.` ``

**结果**：
- success `{kind:'success', nodeId, actionId, durationMs}`，`durationMs = Math.round(performance.now() - start)`
- skipped `{kind:'skipped', nodeId, actionId, reason}`（无 duration）
- failure `{kind:'failure', nodeId, actionId, error, durationMs}`
- `requestApi` 非 ok → failure with `` `HTTP ${status}: ${bodyPreview.slice(0,200)}` ``
- 抛错 → failure with `error.message` / `String(error)`。**一个 action 失败不中断后续**

**条件评估**（`executor.ts:156-257`）：
- `resolveConditionSource`：`componentId = source.componentId || (event.kind==='componentEvent' ? event.componentId : undefined)`；空 → `undefined`；`componentProp` → `getComponentValue(id)?.[key]`；`componentData` → `resolvePath(getComponentData(id), path)` 走点号分割，非 record 即返 undefined
- `compareValue`：
  - `empty`/`notEmpty` → 判 undefined/null/''
  - `contains` → 字符串 `includes` 或数组 `some(item===expected)`
  - `eq`/`ne` → `looseEqual`（严格相等，NaN==NaN 数字比较，否数字强制转换）
  - `gt`/`gte`/`lt`/`lte` → `compareNumbers`（任一不可强转返 0）
  - `toNumber`：有限数通过；字符串 trim 后 Number 有限通过；布尔→1/0；否则 null
- **无 `eval` / `new Function`** —— 仅结构化表达式

**事件匹配**（`matcher.ts`）：`collectRules` 按 `matchesEvent` 过滤：pageLoad → `triggerEventId==='pageLoad'`；interval → `==='interval'`；componentEvent → `event.componentId.length>0 && rule.triggerComponentId===event.componentId && rule.triggerEventId===event.eventId`。
`TriggerEvent` = `{kind:'componentEvent', componentId, eventId, payload?} | {kind:'pageLoad'} | {kind:'interval'}`。

`RuntimeDeps` 契约：`hasComponent` / `getComponentValue` / `getComponentData` / `applyVisibility` / `getVisibility` / `refreshDataSource` / `scrollToComponent` / `openUrl` / `requestApi` / `logWarning`。
`RequestApiRuntimeParams` / `RequestApiRuntimeResult{ok, status, bodyPreview}`。

### 17.9 模板插值（`lib/template-interpolation.ts`）

**语法：`{{ path.to.field }}`** —— `TEMPLATE_PATTERN = /\{\{\s*([^}]*?)\s*\}\}/g`。Path 段必须匹配 `PATH_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/`（任何 JS 语法失败 → `undefined` → 空字符串）。

支持根（`TemplateContext`）：`{{trigger.value}}` / `{{trigger.data.field}}` / `{{event.componentId}}` / `{{event.error}}` / `{{globalVars.xxx}}`。

`valueToText`：null/undefined→`''`；string 原样；number/boolean→`String`；object/array→`JSON.stringify`（不可序列化→`''`）。

`interpolateActionConfig(config, context)`：`requestApi` 插值 `url`/`body`/header values（keys 保留，`interpolateHeaders`）；`navigate` 插值 `url`；`scrollTo`/`interval` 不动。

`interpolateApiDataSourceConfig(config, globalVars)`：插值 `url`、所有 `headers` values、仅 string 类型的 `params` values。

**未在 `executor.ts` 调用** —— 执行器直接消费 `config.url`/`body`/`headers`；插值导出供数据源与宿主用。

### 17.10 请求/接口脱敏（`lib/request-api-mask.ts`）

- **`SECRET_MASK = '***'`**
- `makeCaseInsensitiveSet` —— 全部**大小写不敏感**（lowercased）
- `maskHeaders(headers, secretHeaderKeys)`：匹配键→`'***'`，键名保留
- `maskUrlQuery(url, secretKeys)`：分离 `#hash`；需 `?`；每对 `&` 中若 key 匹配则 `key=***`；无 `=` 对不动；hash 重附；`secretKeys.length===0` 或无查询则早返
- `maskJsonBody(body, secretKeys)`：JSON 解析，递归遮罩（数组 map、对象走），再 stringify；**非 JSON 或解析失败 → 原样返回**；空 keys 或空 body no-op
- `maskRequestForLog({url, headers, body, secretHeaderKeys})`：三处共用同一 `secretHeaderKeys` 列表
- **未在 `executor.ts` / `use-blueprint-runtime-deps.ts` 调用** —— 日志预处理工具

### 17.11 节点配置面板（`panels/node-config-panel.tsx`）

`data-testid="node-config-panel"`、`data-node-kind`、`data-node-global-type`；头 `节点配置` + `Settings2` + kind 徽标 `data-testid="node-config-kind-badge"`。

`KIND_BADGE`：`component`→`组件节点`（primary）、`global`→`全局节点`（amber）、`condition`→`条件分支`（sky）、`delay`→`延时节点`（violet）、`comment`→`注释节点`（muted）。

| RF type / globalType | 字段 | testids |
|---|---|---|
| `component` | `目标组件` select（悬空显示 destructive 颜色 + 注入 `（悬空）{id}` 选项） | `config-component-id` |
| `global` + `pageLoad` | 无字段，文案 `页面加载触发器无需配置。` | — |
| `global` + `navigate` | `目标 URL（仅 http/https）` text（placeholder `https://example.com`）；`打开方式` select `新窗口`(_blank)/`当前窗口`(_self) | `config-navigate-url`, `config-navigate-target` |
| `global` + `requestApi` | `HTTP 方法` select GET/POST/PUT/PATCH/DELETE；`请求 URL（仅 http/https）` text；note `高级字段（headers / body / 脱敏键名 / 超时）请通过代码编辑器配置。` | `config-request-api-method`, `config-request-api-url` |
| `global` + `scrollTo` | `目标组件` select | `config-scroll-to-target` |
| `global` + `interval` | `触发间隔（毫秒，100 ~ 86400000）` number `min=100 max=86400000`；NaN 忽略；默认 `{globalType:'interval', intervalMs:1000}` | `config-interval-ms` |
| `delay` | `延时时长（毫秒，0 ~ 60000）` number `min=0 max=60000`；NaN 忽略；默认 `{delayMs:500}` | `config-delay-ms` |
| `condition` | `<ConditionBuilder>` | 见下 |
| `comment` | `注释文本` textarea `rows=3` placeholder `输入注释...`；默认 `{text:''}` | `config-comment-text` |

`NodeConfigChange` 联合：`component-id | global-config | delay-config | condition-config | comment-config`。

Sheet 写回用**蓝图手势** + **600ms 防抖**关闭；选择变化与卸载时同样关闭。

### 17.12 条件构造器（`panels/condition-builder.tsx`）

根 `data-testid="condition-builder"`，`data-condition-source-kind`、`data-condition-operator`。

字段：`字段来源` select `组件属性`(componentProp)/`组件数据`(componentData)（`condition-source-kind`）；`目标组件` select（`condition-component-id`）；`属性键` text placeholder `例如：value / props.label`（`condition-source-key`）**或** `数据路径` text placeholder `例如：list.0.value`（`condition-source-path`）；`比较运算符` select（`condition-operator`）；`比较值（自动识别 number / boolean / string）` text placeholder `输入文本、true/false 或数字`（`condition-value`），对 valueless 操作符隐藏。

`OPERATOR_OPTIONS` 与 label：`eq`→`等于 (=)`, `ne`→`不等于 (≠)`, `gt`→`大于 (>)`, `gte`→`大于等于 (≥)`, `lt`→`小于 (<)`, `lte`→`小于等于 (≤)`, `contains`→`包含`, `empty`→`为空`, `notEmpty`→`非空`。
`VALUELESS_OPERATORS = Set(['empty','notEmpty'])`；`needsValue(op)`。
值类型强制（`updateValue`）：`'true'`→`true`，`'false'`→`false`，`NUMERIC_RE = /^-?\d+(\.\d+)?$/` 非空 → `Number`，否则 string。切到 valueless **删** `value`；切回设 `''`。源 kind 切换重置 `componentId=''` + `key`/`path`。

### 17.13 执行日志面板（`panels/execution-log-panel.tsx`）

状态优先级：`isSimulating` → `triggerNotFound` → `refusalReason` → empty → list。
- 模拟中：`正在执行模拟...` + spinner，`data-testid="blueprint-execution-log-loading"`
- 触发器未找到：`未找到触发器节点`（amber），`blueprint-execution-log-trigger-not-found`
- 拒绝执行：`触发器存在错误级诊断，已拒绝执行：{refusalReason}`（destructive），`blueprint-execution-log-refused`
- 空：`尚未执行模拟`，`blueprint-execution-log-empty`
- 面板 `blueprint-execution-log-panel`；头 `执行日志` + `触发器：{triggerNodeId}`（`execution-log-trigger`），计数 `{n} 成功`/`{n} 跳过`/`{n} 失败`（>0 才显示），清除按钮 `aria-label="清空日志"`（`execution-log-clear`）
- `RESULT_CONFIG`：success→`成功`/emerald/`CircleCheck`/不可定位；skipped→`跳过`/muted/`SkipForward`/不可定位；failure→`失败`/destructive/`CircleX`/**可定位**
- 行：`data-testid="execution-log-item"`，`data-result-kind`，`data-node-id`；图标 + `{i+1}.` + 等宽 nodeId + 状态 chip（`execution-log-status-{i}`）；success 显示 `{ms}ms`；skipped 显示 reason（`execution-log-skip-reason-{i}`）；failure 显示 `{error} · {ms}ms`（`execution-log-error-{i}`） + hover `Crosshair`、click → `onLocateNode`
- `truncated` 行：`执行因深度超过上限被截断`（`execution-log-truncated`）—— 目前不可达（`truncated` 恒为 `false`）
- 列表 `max-h-40 overflow-y-auto`；仅显示 `executionLogs[0]`（最新）

### 17.14 问题面板（`panels/problems-panel.tsx`）

`SEVERITY_ORDER = ['error','warning','info']`；`SEVERITY_CONFIG` 错误/警告/信息（`CircleAlert`/`TriangleAlert`/`Info`）。
- 空：`无问题` + emerald `CircleCheck`，`data-testid="blueprint-problems-empty"`
- 面板 `blueprint-problems-panel`；头 `问题` + `{n} 错误`/`{n} 警告`/`{n} 信息`（`problem-count-{level}`）
- 单遍按级别桶（`:79-89`），按严重度顺序渲染。条目 `data-testid="problem-item"`、`data-severity`、色点、message、尾随 `nodeId`；仅在 `nodeId` 存在时 click → `onLocateNode`
- 列表 `max-h-40 overflow-y-auto`

### 17.15 搜索面板（`panels/search-panel.tsx`）

模糊搜索：**token-AND 子串**（非真模糊）。`filterOptions(options, query)`：lowercase，split `/\s+/`，每 token 必须是 `` `${label} ${description}`.toLowerCase() `` 的子串。

模式：`create`→`创建节点`、`connect`→`连接到新节点`。connect 模式额外按 `isConnectableTarget` 过滤。

分组（`groupMeta`）：`canvas-component`→`画布组件`（primary）、`global`→`全局节点`（amber）、`logic`→`逻辑节点`（sky）。

键盘（`handleKeyDown`）：Esc 关闭；Enter 插入 `filtered[activeIndex]`；ArrowDown `(i+1)%len`；ArrowUp 绕到 `len-1`。挂载自动 focus；query 变化重置 `activeIndex`；active 项 `scrollIntoView({block:'nearest'})`。

定位 `{left:x, top:y}` `w-80`，列表 `max-h-80`。空 `无匹配节点` + `FileQuestion`。footer `Enter 插入`。connect 模式空 query 提示 `选择目标节点后将自动完成连线`。

testid：`blueprint-search-panel`、`-close`、`-input`、`-list`、`-item`（+ `data-option-id`）。

### 17.16 节点选项（`panels/node-options.tsx`）

10 个静态节点（id / kind / subtype / globalType / 分组 / 标签 / 描述 / 图标）：

| id | kind | globalType | 分组 |
|---|---|---|---|
| `canvas-component` | component | — | canvas-component |
| `global.pageLoad` | component | pageLoad | global |
| `global.navigate` | component | navigate | global |
| `global.requestApi` | component | requestApi | global |
| `global.scrollTo` | component | scrollTo | global |
| `global.interval` | component | interval | global |
| `logic.condition` | condition | — | logic |
| `logic.delay` | delay | — | logic |
| `logic.comment` | comment | — | logic |

### 17.17 模板（`templates/`）

4 个内置模板生成器：navigate-default、request-api-default、scroll-to-default、interval-default。每个都是工厂函数返回初始 `EventBlueprint`。

模板画廊 `template-gallery.tsx` 展示并"应用"（替换或追加到当前 `blueprint`）。

### 17.18 预览/沙箱运行时

**`use-blueprint-preview-runtime`**：
- 用 `components` 编译；收集 `errorNodeIds`（错误诊断）；**过滤 `triggerNodeId` 有错误的规则**；`isEnabled = hostEnabled && compiledRules.length > 0`
- `runtimeSignature` = `JSON.stringify({blueprint, componentIds, enabled})` 驱动重置：可见性覆盖 + API 覆盖 + 世代计数
- `createGuardedRuntimeDeps`（`:179-217`）：每个副作用型 dep 门控 `isActive()`（enabled + 同世代）；禁用时 `requestApi` 返回 `{ok:false, status:0, bodyPreview:'Blueprint runtime is disabled.'}`
- enable 时发 `{kind:'pageLoad'}`；为每个 `interval` 规则 `setInterval(rule.intervalMs)`，清理
- `onComponentEvent(componentId, eventId, payload?)`；`onComponentClick(id)` → `eventId='click'`
- 错误日志 `console.warn('[blueprint-preview] execution failed: …')`
- 暴露 `{visibilityOverrides, apiDataOverrides}` 给 `BlueprintPreviewProvider`

**`use-blueprint-sandbox-runtime`** + **`use-blueprint-sandbox-highlight`**：交互调试模式下挂载，驱动单步/沙箱高亮（具体在源码中实现）。

**真实 runtime deps**（`use-blueprint-runtime-deps.ts`）：
- `DATA_REQUEST_TIMEOUT_MS = 10_000`（`refreshDataSource`）
- `applyVisibility` 仅写覆盖映射（不动 project 数据）
- `getVisibility` 回退到 `!component.status.hidden`
- `refreshDataSource`：每组件 `AbortController`、中断上一次、单调 `seq` 守 out-of-order、超时 `abort`、静默 catch、仅在仍是当前时清理
- `requestApi`：AbortController 在 Set 中跟踪，`setTimeout(abort, params.timeoutMs)`，`body` 对 GET 省略，委派 `dataRuntime.requestApi`
- `scrollToComponent`：`[data-preview-component-id="…"], [data-component-id="…"]` + `CSS.escape` 回退（`cssEscape`），`scrollIntoView({behavior:'smooth', block:'center', inline:'center'})`
- `logWarning` → `console.warn('[blueprint-runtime] …')`
- `cancelPendingRequests` 中止所有，卸载时也跑
- `openUrl`（`:171-184`）：`environment.openUrl` 覆盖；`_blank` → `window.open(url, '_blank', 'noopener,noreferrer')`；`_self` → 模块级 `navigateSelf = window.location.assign(url)`（可通过 `__setNavigateSelfForTest` 替换）
- 协议白名单**仅 schema 层**：URL 必须 `^https?://` 阻断 `javascript:` 等

**Context**：
- `BlueprintPreviewContextValue { visibilityOverrides: Map<string,boolean>, apiDataOverrides: Map<string,unknown> }`，默认 `null`
- `ComponentEventCallback = (componentId, eventId, payload?) => void`，默认 `null`，`BlueprintEventProvider` / `useComponentEvent()`

`getNodeLocateComponentId(node)`：非 component → undefined；`scrollTo` global → `targetComponentId ?? undefined`；`componentId==='global'` → undefined；else `componentId || undefined`。

---

## 18. 组件注册与扩展（`src/registry/`）

### 18.1 双并行注册表

**模块级（遗留）**（`registry.ts`）：`builtinModulesByType = new Map(BUILTIN_COMPONENT_MODULES.map(m => [m.definition.type, m]))`。无模块级可变 Map。Getter：`getDefinitionByType` / `getAllDefinitions` / `getDefinitionsByCategory`（按 `order ?? Number.MAX_SAFE_INTEGER` 排序）/ `getRenderer` / `getIcon` / `getSchema` / `getAllModules`。`createComponentInstance(type, x, y, zIndex, existing, options?)` + `searchComponentDefinitions(keyword)`。

**实例注册表**（`instance-registry.ts`）：不可变 per-editor 快照，**实例隔离**（Spec §8.4）。只读接口 `ScreenComponentInstanceRegistry { size, get, has, list }`。`InstanceRegistryImpl` 包装 `ReadonlyMap` + `Object.freeze(Array.from(entries.values()))`。`buildInstanceRegistry(registrations)`：**两阶段原子构建**（验证去重→构建，Fail Closed）。`cloneAndFreezeManifest` `structuredClone` + 递归深 `Object.freeze` + `WeakSet` 环检测。Facade linkage（`linkScreenComponentRegistryFacade` / `isPublicScreenComponentRegistryFacade` / `resolveScreenComponentRegistryForRuntime`）。

**搜索评分**（两条路径相同）：

| 分 | 条件 |
|---|---|
| 4 | `name.toLowerCase()===kw`（精确） |
| 3 | `name.startsWith(kw)`（前缀） |
| 2 | `name.includes(kw)` |
| 1 | `type.includes(kw)` 或任一 `keywords[i].includes(kw)` |

平局按 `(a.order ?? 0) - (b.order ?? 0)`。空 keyword → 注册顺序全部。

`createComponentInstance` 统一产出：
- `id: crypto.randomUUID()`
- `name: sameTypeCount>0 ? \`${def.name} ${sameTypeCount+1}\` : def.name`
- `style: {opacity:1, borderWidth:0, borderRadius:0, overflow:'hidden', ...def.defaultStyle}`
- `props: structuredClone(def.defaultProps)`
- `status: {locked:false, hidden:false}`
- `parentId: null`

### 18.2 内置组件清单

| type | name | category | order | icon (lucide) | defaultSize | defaultProps | defaultStyle | events | actions | schema | 渲染路径 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `text` | 文本 | text | 1 | Type | 200×60 | `{content:'请输入文本'}` | `{color:'#ffffff', fontSize:14}` | click,hover | show,hide,toggleVisibility | TEXT_SCHEMA | CE `nebula-screen-text-v1` |
| `bar-chart` | 柱状图 | chart | 1 | BarChart3 | 400×300 | `{title:'柱状图', data:[{A,120},{B,200},{C,150},{D,80},{E,170}]}` | (none) | click,hover,dataLoaded,dataError | show,hide,toggleVisibility,refreshData | BAR_CHART_SCHEMA | **React internalRenderer** |
| `rect` | 矩形 | decoration | 1 | Square | 200×120 | `{}` | `{backgroundColor:'#3b82f6', borderWidth:0, borderColor:'#1e40af', borderRadius:0}` | click,hover | show,hide,toggleVisibility | DEFAULT_SCHEMA | CE `nebula-screen-rect-v1` |
| `ellipse` | 椭圆 | decoration | 2 | Circle | 200×200 | `{}` | `{backgroundColor:'#10b981', borderWidth:0, borderColor:'#047857'}` | click,hover | show,hide,toggleVisibility | DEFAULT_SCHEMA | CE `nebula-screen-ellipse-v1` |
| `image` | 图片 | media | 1 | Image | 320×240 | `{src:'', alt:''}` | `{}` | click,hover | show,hide,toggleVisibility | DEFAULT_SCHEMA | CE `nebula-screen-image-v1` |
| `button` | 按钮 | text | 2 | MousePointerClick | 120×48 | `{text:'按钮'}` | `{backgroundColor:'#3b82f6', color:'#ffffff', fontSize:14, borderRadius:8, borderWidth:0, borderColor:'#1e40af'}` | click,hover | show,hide,toggleVisibility | BUTTON_SCHEMA | CE `nebula-screen-button-v1` |

**结论**：仅 `bar-chart` 走 React 内部渲染器（因需 dataSource/logic/interaction/apiRawDataOverride）；其余 5 个走 Custom Element 桥接。

### 18.3 渲染策略

**`getRendererFromRegistry` 双模式**：
- 元素构造器存在 → `createHostElementRenderer(tagName, manifest.events)`（带 `WeakMap` 缓存 `hostRendererCache`）
- 否则 `reg.internalRenderer`
- 未注册 → `undefined`

**`custom-element-renderer.tsx` 关键细节**：
- `CustomElementRenderer` 渲染 `<div ref={containerRef} data-custom-element-host={tagName}>` + Effect 1（生命周期）：`prevTagNameRef !== tagName` → `elementRef.remove()`；再 `document.createElement(tagName) + container.appendChild(el)`。**DOM 元素跨属性更新复用**
- Effect 2（model 赋值）：`el.model = buildDetachedModel(...)`（JS property，永不 HTML attribute）
- Effect 3（事件桥）：仅在 `onComponentEvent !== null`（preview）时挂载；监听 `COMPONENT_EVENT_TYPE = 'nebula-component-event'`
- `buildDetachedModel`：`dataCapability !== undefined` → model v2；else v1（`viewer`→`preview` 降级）；`structuredClone` 拆出 → 组件不能改 Store
- `sanitizeToJson` + `omitUndefinedObjectProperties` 守 `ScreenComponentJsonValue` 边界
- 事件校验失败 → `console.warn`；通过 → `onComponentEvent(componentId, result.eventId, result.payload)`（**用 React 闭包 componentId**，不信 `event.detail.componentId`）
- `resolveHostStyle` 特殊处理 rect/ellipse：把 fill/border 提到容器（CE 内部不渲染矩形背景）

**`component-container-style.ts`**：
- `composeComponentTransform(x,y,rotation,flipX,flipY)` 顺序 `translate → rotate → scaleX(-1) → scaleY(-1)`
- `resolveComponentContainerStyle(component)`：容器 `position:absolute`、`left:0, top:0`（用 transform 定位走 GPU）；**`isEllipse` 时把 `borderRadius/borderWidth/borderColor/borderStyle/backgroundColor` 全部强制 undefined**（否则容器会画矩形背景盖住椭圆透明角）

### 18.4 Registry 工厂（`registry-factory.ts`）

`createScreenComponentRegistry(options?)` 5 步管道：
1. `selectBuiltInRegistrations`（白名单 `builtInComponents`，undefined→全部 6、`[]`→0；保留 SDK 顺序）
2. `validateHostManifests` → `validateManifest`
3. `assertUniqueManifestIdentities`（内置 type/tagName 永远保留）
4. `resolveHostPlugin` 每 plugin → `await plugin.define()`，验证 `typeof constructor==='function'`，`structuredClone(manifest)`
5. `enqueueCustomElementCommit` → 模块级 `customElementCommitQueue` 串行化；失败 `.catch(()=>undefined)` 链式不永久阻塞

诊断码（6 个）：`INVALID_COMPONENT_MANIFEST` / `INVALID_BUILTIN_COMPONENT_TYPE` / `UNSUPPORTED_COMPONENT_API_VERSION` / `DUPLICATE_COMPONENT_TYPE` / `DUPLICATE_COMPONENT_TAG_NAME` / `COMPONENT_DEFINE_FAILED`。

### 18.5 Manifest 协议（`screen-component-sdk/src/contracts/manifest.ts`）

```
SCREEN_COMPONENT_API_VERSION = 'nebula.screen-component/v1'
SCREEN_COMPONENT_ICON_TOKENS = ['chart','text','media','shape','button','table','container','code']
SCREEN_COMPONENT_CATEGORIES  = ['chart','text','media','decoration','table','container']
BUILTIN_TYPE_PREFIX = 'nebula.'
EXTERNAL_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+\/v([1-9][0-9]*)$/
TAG_NAME_PATTERN      = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+-v([1-9][0-9]*)$/
```

`ScreenComponentManifest` 字段：apiVersion / type / implementationVersion（SemVer）/ tagName / name / category / icon? / description? / keywords? / order? / defaultSize / defaultProps / propsSchema / propertyPanel? / events?。

propsSchema 受限子集（PROPS_SCHEMA_ALLOWED_TYPES 与 ALLOWED_KEYWORDS），禁止 `$ref` / allOf / anyOf / oneOf / not / `$defs` / definitions / if / then / else / format / contentEncoding / contentMediaType / **default**。

propertyPanel 控件集：`PROPERTY_CONTROL_TYPES = ['text','textarea','color','switch','number','select']`。`pointer` 是 RFC 6901 相对 props 根；**无 render/customRender/ReactNode/HTML/callbacks**。

Plugin：`{ manifest, define(): CustomElementConstructor | Promise<...> }`；`define()` 必须幂等，**不得自调 `customElements.define()`**。

Events：`EVENT_ID_PATTERN = /^[a-z][A-Za-z0-9]*$/`，`COMPONENT_EVENT_TYPE = 'nebula-component-event'`，`MAX_EVENT_PAYLOAD_BYTES = 64*1024`，`EVENT_HANDLE_PREFIX = 'evt:'`。

校验码（14 个）：INVALID_COMPONENT_MANIFEST / UNSUPPORTED_COMPONENT_API_VERSION / INVALID_COMPONENT_TYPE / INVALID_COMPONENT_TAG_NAME / INVALID_IMPLEMENTATION_VERSION / INVALID_DEFAULT_SIZE / INVALID_DEFAULT_PROPS / INVALID_PROPS_SCHEMA / INVALID_PROPERTY_PANEL / INVALID_EVENT_DEFINITION / INVALID_JSON_VALUE / DUPLICATE_COMPONENT_TYPE / DUPLICATE_COMPONENT_TAG_NAME / COMPONENT_DEFINE_FAILED。

校验管道 5 步：1) `checkJsonProps(defaultProps)` + `checkJsonProps(propsSchema)` → 2) `validateManifestIdentity` → 3) `validatePropsSchema` → 4) `validatePropertyPanel` → 5) `validateEvents`。

---

## 19. 动态数据（`src/dynamic/`、`src/core/`、`runtime-profile.tsx`）

### 19.1 Capability Profiles（`runtime-profile.tsx`）

`ScreenEditorCapabilityProfile = 'dynamic' | 'static'`。

`ScreenEditorRuntimeProfile` 5 维：
```
blueprintCapabilities: { requestApi: boolean; refreshDataSource: boolean }
capabilityProfile:     'dynamic' | 'static'
componentRegistry:     { componentTypes: readonly string[] }
dataRuntime:           ScreenEditorDataRuntime
notifications:         { instanceScoped: true }
propertySchemas:       { supportsDynamicDataSources: boolean }
```

`createFallbackRuntimeProfile(profile)`：`dynamic = profile==='dynamic'`；`requestApi` / `refreshDataSource` / `supportsDynamicDataSources` 跟随 dynamic；`componentTypes: SCREEN_SDK_COMPONENT_TYPES`；`dataRuntime: unavailableDataRuntime(profile)`。

`unavailableDataRuntime`：
| 成员 | fallback 行为 |
|---|---|
| `previewApi` | throw |
| `requestApi` | throw |
| `refreshComponentData` | `Promise.resolve(undefined)` |
| `useApiDataSource` | `{status:'idle'}` |
| `useDatasetSource` | `{status:'idle'}` |
| `DatasetConfigForm` | `undefined` |

故 static profile 禁用：蓝图 `requestApi` 节点、蓝图 `refreshDataSource` action、属性 schema 动态数据源、5 个 data-runtime 成员。

### 19.2 Static Allowlist（`core/static-capability-profile.ts`）

```
SCREEN_SDK_COMPONENT_TYPES          = ['text','bar-chart','rect','ellipse','image','button']
SCREEN_SDK_BLUEPRINT_NODE_KINDS     = ['component','condition','delay','comment']
SCREEN_SDK_GLOBAL_COMPONENT_TYPES   = ['pageLoad','interval','navigate','scrollTo']
SCREEN_SDK_COMPONENT_EVENT_HANDLES  = ['evt:click','evt:hover']
SCREEN_SDK_COMPONENT_ACTION_HANDLES = ['act:show','act:hide','act:toggleVisibility']
LEGACY_SCREEN_SDK_TRIGGER_TYPES     = ['componentClick','componentHover','pageLoad','interval']
LEGACY_SCREEN_SDK_ACTION_TYPES      = ['setVisibility','navigate','scrollToComponent']
```

`getScreenSdkSourceHandles(node)` / `getScreenSdkTargetHandles(node)` 为不同节点类型返回 handle 集。

`SCREEN_SDK_COMPONENT_DEFINITIONS` 6 项；**仅 bar-chart 有 `defaultDataSource`** = `{type:'static', staticData:[{A,120},{B,200},...]}`。

### 19.3 数据源三套平行 schema

**(1) `DataSourceConfig`**（`screen.schema.ts:178-203`），`type` 受 `DataSourceTypeSchema = z.enum(['static','api','dataset'])` 限制：
- 公共字段：`dataPath?`（点号路径）/ `fieldMapping?`
- `static`: `staticData` + 保留 `apiConfig?`
- `api`: `apiConfig: ApiDataSourceConfigSchema` + 保留 `staticData?`；**`method: z.literal('GET')`（仅 GET）**
- `dataset`: `datasetId: string.min(1)` / `paramBindings?` / `overrideFieldMapping?` / `overrideLogic?` / `overrideRefresh?` + 保留静态/api 配置

`ApiDataSourceConfigSchema`：`url` / `method: 'GET'` / `headers?` / `params?` / `refreshInterval?`（秒）。
`ParamBindingSourceSchema` = `['component-prop','component-data','url-param','static','trigger']`。
`LogicConfigSchema`：`sortField` ∈ {dimension,value} / `sortDirection` ∈ {asc,desc} / `limit` 正整数。
`InteractionConfigSchema`：`tooltipOnHover: boolean`。
`RefreshStrategySchema`：`interval`（秒）∈ {second, minute, hour} / `stopOnHidden`。
`DatasetCacheStrategySchema`：`enabled` / `ttl`（秒）/`tags?`。
`DatasetMockGeneratorSchema` = `['static','faker-template','echo-params']`。
`ScaleModeSchema` = `['fit','full','width','height','none']`。

**(2) `StaticDataSourceConfig`**（V1/V2 文档，`contracts/document.ts:84-91`），`.strict()`：仅 `{type:'static', staticData, dataPath?, fieldMapping?}`。

**(3) `HostMetricDataSourceSchema`**（V3，`contracts/dynamic-document.ts:98-104`）：`{type:'host/xj-metric', metricId: int>0, binding?: HostMetricBinding}`。`binding: {categoryField?, valueFields?, labelField?, tableFields?}` —— **纯意图，无 URL/SQL/Token**。**api/sql/script 全部被 `.strict()` + 2 元 union 拒绝**。

V3 文档版本 `DYNAMIC_SCREEN_DOCUMENT_VERSION = 3`；组件状态 `z.enum(['active','hidden'])`（V2 是 `{locked, hidden}`）。V3 blueprint 新增 `act:refreshData` handle；`requestApi` 在 V3 节点 kind 中被拒绝。

### 19.4 Data Coordinator（`dynamic/data-coordinator.ts`）

**`DEFAULT_EXECUTION_TIMEOUT_MS = 15_000`**（对齐 XJ 后端执行上限）。

5 个保证：
1. **Dedupe** —— 同 dedupe key（默认 componentId）共享 in-flight Promise
2. **Cancel** —— 每次执行有 AbortController；外部 `options.signal` 用 `{once:true}` 链；同 key 新执行时旧的 abort
3. **Timeout** —— `setTimeout(() => controller.abort(), this.#timeoutMs)`，`finally` 中 `clearTimeout`
4. **Late-response guard** —— componentId 单调递增 `sequence`；`#publishLatest` 丢非最新 seq
5. **Partial failure** —— 一个失败不影响其他

错误状态：
- `abortState()` = `{status:'error', error:{message:'已取消', reason:'aborted'}}`
- 无 context → `{status:'error', error:{message:'数据执行上下文未打开', reason:'network'}}`
- 通用 → `{status:'error', error:{message: error.message ?? '数据执行失败', reason:'network'}}`
- disposed 调 open/sync → throw

状态机 `idle → loading → success | error`。`closeContext()` 中止所有然后 `adapter.closeContext`；`dispose()` 中止并清监听。

**无缓存层** —— 仅 in-flight 去重，结果不记忆化。

### 19.5 Data Adapter Port（`dynamic/data-adapter-port.ts`）

`ScreenDataContextSource = 'design' | 'preview' | 'published' | 'release-audit'`。
`ScreenDataExecutionContext`：contextId / projectId / source / envelopeReleaseId?（"published 上下文绑定 viewer envelope releaseId；撤回立即阻断"）。
`ScreenDataAdapterPort`：resourceList / openContext / syncContext / closeContext / execute。

显式边界（`:5-8`）：SDK/components 永不接触 Token/URL/SQL；后端从已验证的运行时上下文解析文档，**不信任客户端 mode/metricId**。

### 19.6 Data Runtime React 桥（`dynamic/data-runtime.tsx`）

- `IDLE_DATA_STATE = {status:'idle'}`
- `ScreenDynamicDataProvider({adapter, children})`：coordinator `useMemo`，**`adapter===undefined` 时 coordinator 为 null**（**render children 无 Provider 包装**）
- `useScreenDynamicData()` 在 runtime 为 null 时抛错；`useOptionalScreenDynamicData()` 返 null
- `useComponentDataState(componentId)` 订阅 coordinator，按 componentId 过滤，runtime null 时重置 idle

### 19.7 `use-chart-data.ts`

`useChartData(dataSource, logic, apiRawData?)` `useMemo`：
- `dataSource===undefined` → `{status:'empty'}`（调用方降级到 `props.data`）
- `type==='static'` → `parseChartData(staticData, dataSource, logic)`
- `apiRawData===undefined` → `{status:'empty'}`（**此 hook 永不发起请求**）
- `type==='dataset'` → **覆盖 `dataPath: undefined`**（后端已抽好）+ `fieldMapping: overrideFieldMapping ?? fieldMapping`
- else（api）→ `parseChartData(apiRawData, dataSource, logic)`

### 19.8 V3 动态文档校验（`contracts/dynamic-document.ts`，652 行）

- `getManifestDataCapability(manifest)`：仅 `apiVersion === SCREEN_COMPONENT_API_VERSION_V2` 的 manifest 可声明 `dataCapability`；v1 → `'none'`
- `V3_BLUEPRINT_TARGET_HANDLES` 增 `act:refreshData`
- `V3_BLUEPRINT_GLOBAL_SOURCE_HANDLES` = `evt:pageLoad, evt:interval, then, else, out`
- `V3_BLUEPRINT_ALLOWED_GLOBAL_TYPES` 排除 `requestApi`
- 数据能力约束：`!supportsScreenComponentDataSource(capability)` → `UNSUPPORTED_COMPONENT_CAPABILITY`；`host/xj-metric` with `capability !== 'host-metric'` → 同码
- `generateDynamicScreenDocumentJsonSchema()` —— draft-07 导出供 XJ 后端

`SCREEN_COMPONENT_DATA_CAPABILITIES = ['none','static','host-metric']`；`ScreenComponentDataState` 错误原因：`'http'|'network'|'parse'|'timeout'|'aborted'`（**注意 `'aborted'` 在 V3 存在，但 V1/V2 `ScreenEditorDataRequestState` 不含**）。

### 19.9 遗留 `props.data` 一次性迁移（`lib/data-source-migration.ts`）

- 契约：首次经数据层 UI 提交时，遗留 `props.data` 迁移为数据层静态数据，并从 props 中清除其"数据真值"身份
- 迁移与新建数据层配置**合并为一次 `updateComponent` 调用**（一条本地编辑历史）
- 未经过数据层 UI 的组件不受影响，`props.data` 原样保留

---

## 20. Web 应用集成（`apps/web/src/features/screen/`）

### 20.1 `use-api-data-source.ts`

**`API_REQUEST_TIMEOUT_MS = 10_000`**（与 coordinator 的 15s 区分）。

`ApiRequestErrorReason` = `'network' | 'http' | 'timeout' | 'parse'`；`ApiRequestState` = `idle | loading | {success,data} | {error}`。

`buildUrlWithParams(url, params)`：`new URL(url)` + `searchParams.set`（覆盖重复）；跳过 `undefined`/`null`；`serializeParamValue` 字符串原样，number/boolean/bigint `String()`，其余 `JSON.stringify(value) ?? ''`。

`useApiDataSource(apiConfig, options?)`：
- `apiConfig===undefined` → `{status:'idle'}` 返
- **全局变量插值**（`:120-122`）：`globalVars` 真值时 `interpolateApiDataSourceConfig(apiConfig, globalVars)`；preview 传，editor 不传（占位符保留可见）。调用方须保持 `globalVars` 引用稳定
- `[REDACTED]` header 剥离（`:145-150`）：值恰为 `'[REDACTED]'` 的键**移除**（"不用占位值伪造"）；空结果→`undefined`
- 恒 `method: 'GET'`（`:152`）
- `!response.ok` → `{reason:'http', message:\`请求失败（HTTP ${status}）\`, httpStatus}`
- JSON 解析失败 → `{reason:'parse', message:'响应不是合法 JSON，无法解析'}`
- 超时 → `{reason:'timeout', message:'请求超时，请检查网络或接口可用性'}`
- 其它 → `{reason:'network', message:'网络请求失败（可能是网络异常或跨域限制）'}`
- **轮询**（`:215-218`）：`refreshInterval>0` → `setInterval(executeRequest, refreshSeconds*1000)`；每 tick 中断前一次
- 清理：disposed 标志 + clearInterval + abort

### 20.2 `use-dataset-source.ts`

走**后端代理** `POST /api/dataset/:id/execute {params, useMock}`，永不直接访问外部 URL。

`resolveParamBinding(binding, context)`：
| source | 解析 |
|---|---|
| `component-prop` | 剥 `^props\.` 前缀，`getFieldByPath(componentProps, fieldPath)` |
| `component-data` | **undefined（未实现）** |
| `url-param` | 剥 `^url.`，`new URLSearchParams(window.location.search).get(name) ?? binding.defaultValue` |
| `static` | `binding.defaultValue` |
| `trigger` | **undefined（未实现）** |

`getFieldByPath`：点号路径，**仅对象属性，不支持数组下标**。

`useDatasetSource(options)`，`useMock = true`（编辑模式默认）；用 `requestIdRef` 守竞态（无 AbortController，API 客户端未暴露 signal）；轮询同 API 源。

### 20.3 `dataset-config-section.tsx`（`DatasetConfigForm`）

- `NO_DATASET_OPTION = '__none__'`（Radix Select 拒空串）
- `PARAM_SOURCE_OPTIONS` MVP 仅 3 个：`static` / `component-prop` / `url-param`（`component-data` + `trigger` 推迟）
- 行模型 `ParamBindingRow {id,name,source,path,defaultValue}`，`bindingRowSeq` 计数 → `binding-${n}`
- `bindingsToRows` JSON.stringify `defaultValue`；`rowsToBindings` 跳空名、JSON 失败回退原串
- draft 语义：`handleApply` 必选数据集、保留 `staticData`/`apiConfig` 以便切回；`handleTest` 调 `executeMutation({params:{useMock:true}})`，成功 → `成功（{ms}ms）`
- `handleManageClick` → `window.open('/dataset','_blank')`；`handleRefreshClick` → `refetch()`
- testid：`dataset-selector` / `dataset-param-bindings` / `dataset-test-panel` / `dataset-test-result` / `datasource-error`

### 20.4 预览渲染与 scale 模式

`components/screen-preview-canvas.tsx`：

**`fitScale(canvasW, canvasH, scaleMode)`** 纯函数（读 `window.innerWidth/innerHeight`）：
| scaleMode | 公式 |
|---|---|
| `'fit'` | `Math.min(vw/canvasW, vh/canvasH)` |
| `'full'` | `Math.max(vw/canvasW, vh/canvasH)` |
| `'width'` | `vw / canvasW` |
| `'height'` | `vh / canvasH` |
| `'none'` | `1` |
| default | 同 `fit` |

`isComponentVisible`：**`blueprint visibilityOverrides > component.status.hidden`**。

`PreviewCanvas` Provider 栈：
```
ScreenEditorRuntimeProfileProvider profile={DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE}
  RegistryProvider registry={registry}
    PreviewCanvasContent
```
`PreviewCanvasContent`：
- `useBlueprintPreviewRuntime(blueprint, components, {enabled: true})`
- 内栈：`BlueprintPreviewProvider` → `BlueprintEventProvider value={onComponentEvent}` → `CanvasInteractionProvider value={INTERACTIVE_CAPABILITIES}`
- 舞台 `.screen-preview-stage`：`width/height` 画布尺寸，`transform: scale(${scale})`、`transformOrigin: 'center center'`
- 组件：`.filter(isComponentVisible).sort((a,b) => a.zIndex - b.zIndex).map(...)`；`animationDelay: \`${Math.min(index,12)*90 + 120}ms\``（入场动画错位，index 上限 12）
- `data-preview-component-id={component.id}`；`onClick` → `onComponentClick(id)`；`onMouseEnter` → `onComponentEvent(id, 'hover')`

### 20.5 两条预览入口

| | `screen-preview.tsx` | `editor-preview-screen.tsx` |
|---|---|---|
| 路由 | `/screen-preview/$id` —— **匿名，无需鉴权** | `/screen-editor-preview/$id` —— **需鉴权** |
| 数据源 | `useScreenPreview(id)` → `GET /api/screen/:id/preview`（已发布快照） | `useScreenProject(id)` → `GET /api/screen/:id`（草稿） |
| 不存在文案 | `大屏项目不存在或未发布` | `大屏项目不存在` |

均经 4 级门：注册表加载 spinner → `组件注册表加载失败` → 项目加载 spinner → 不存在 → `<PreviewCanvas project registry />`。

### 20.6 大屏列表页（`screen-list-page.tsx`）

`GET /api/screen` 拉项目列表，每行展示 name / status / 缩略图 / updatedAt / 操作。

行级操作：
- **编辑**（进入 `/screen-editor/$id`）—— 始终可用
- **预览**（新窗口打开 `/screen-editor-preview/$id`）—— 已发布项目可用
- **公开预览**（新窗口打开 `/screen-preview/$id`）—— 始终可用
- **发布** —— 草稿状态可用
- **导入替换** / **导出 JSON** / **删除**（destructive + 确认）
- **复制为新项目**（POST `/api/screen` 副本）

筛选/搜索：按 name 关键字（前端 substring，无 fuzzy）；按 status 标签页（草稿/已发布/全部）。

### 20.7 Monaco JSON 编辑器（`component-json-monaco-editor*.tsx`）

- `@monaco-editor/react` lazy load
- 适配器 `component-json-completions.ts`：基于当前组件 manifest 的 propsSchema 派生 JSON Schema
- `monaco-json-schema-coordinator.ts` 注册 schema 给 Monaco LSP-style 校验
- 自动完成：属性键 + 枚举值；hover 文档；问题标记
- 顶部"应用"按钮 → `replaceComponentConfig({baseline, next})`（Zod 校验失败返 `conflict`/`unchanged`/`readonly` 不写）

### 20.8 组件注册表桥（`runtime/component-registry.ts` + `use-screen-component-registry.ts`）

`useScreenComponentRegistry` 在 Workbench mount 前调起：
- 1. 拉所有组件 SDK 端点（POST `/api/screen-component/host-components`）
- 2. 加载每个 host plugin 的 ESM bundle
- 3. 合并内置 + host → `createScreenComponentRegistry`
- 4. 返回 `ScreenComponentInstanceRegistry`

错误恢复：拉取失败 → 显示 `组件注册表加载失败` 错误页（不重试按钮）；用户刷新页面重试。

### 20.9 动态运行时 profile（`dynamic-runtime-profile.tsx`）

`DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE` 实参：
- `dataRuntime: createWebDataRuntime({ fetchImpl, httpClient, queryClient, ... })` —— 通过 `apps/web` 的 `fetch` 包装实例化
- `blueprintCapabilities.requestApi: true`
- `componentRegistry.componentTypes` 含 `bar-chart` 等 6 内置 + 任何 host 注册
- `propertySchemas.supportsDynamicDataSources: true`

---

## 21. 宿主控制（`src/host/` + `adapters/` + `lib/`）

### 21.1 主机状态机（`host/screen-host-controller.ts`）

`ScreenHostState` 状态机：
| phase | 含义 |
|---|---|
| `idle` | 初始 |
| `loading` | 加载中（保留前次 `retainedProject` 用于不闪烁） |
| `ready` | 加载完成 |
| `error` | 加载失败（`error` 字段） |
| `unsupported` | 项目含 SDK 不支持特性（`diagnostics` 字段） |
| `waiting` | 未配置 projectId（占位） |

`ScreenHostController` 暴露：
- `load({projectId, signal})` —— 拉项目 + 解析 envelope
- `reload({signal})` —— 重新拉同一项目
- `save(draft, signal)` —— 乐观保存；`expectedUpdatedAt` 校验
- `publish(signal)` —— 走 publish 端点，更新 envelope.releaseId
- `retry()` —— 退到 `idle` 后重 load

`retainedProject`：加载中保留旧项目以避免画布闪白。

### 21.2 Operation Coordinator（`host/operation-coordinator.ts`）

6 个 capability：`loadProject` / `saveProject` / `publishProject` / `navigate` / `preview` / `snapshots`。每个 capacity 实现把屏幕编辑器请求转成 host 调用；失败抛 `ScreenAdapterError`（带 `code`: UNAUTHORIZED/NOT_FOUND/CONFLICT/VALIDATION/UNAVAILABLE/UNKNOWN/ABORTED/FORBIDDEN）。

`pendingMutations` Set 跟踪 save/publish；UI 用 `pendingMutations.length>0` 决定 z-30 阻塞罩。

### 21.3 浏览器导出（`host/browser-export.ts`）

`exportProjectAsBrowserDownload(project)`：序列化 project 为 JSON，`Blob([...], {type:'application/json'})` + `URL.createObjectURL` + 隐藏 `<a download>` 触发下载 + `revokeObjectURL`。仅依赖 `window.URL`/`document.createElement`。

### 21.4 快照适配器（`adapters/local-snapshot-adapter.ts`）

`LocalSnapshotAdapter`：纯客户端快照，localStorage 存储。键格式 `nebula:screen-snapshots:${projectId}`。CRUD：`list` / `get` / `create` / `remove` / `restore`。每条快照 `{id, projectId, name, createdAt, data}`，`data` 是完整 project 副本。`restore` 后会 `loadProject(data)` 并**保留历史**（新增初始快照条目作为基线）。

### 21.5 主机控制端口（`host/screen-host-controller-port.ts` / `host/screen-host-controller.ts`）

`ScreenHostControllerPort` 抽象接口；NestJS 与本地适配器各自实现。

### 21.6 组件 JSON 配置（`lib/component-json-config.ts`）

`buildJsonConfigFromComponent(component)`：合并 defaultProps + props + style + position + status + 数据源 → JSON 树。`parseJsonConfigToComponentUpdates(json, baseComponent)`：Zod 校验，差异合并返 `{baseline, next}` 给 `replaceComponentConfig`。

### 21.7 Screen Host Session（`lib/screen-host-session.ts`）

`createScreenHostSession({host, hostState, onCapabilitiesChange})` 包装 controller + state，向 Workbench 暴露 `{state, operations, controller}`，含 `isDirty`/`canUndo`/`canRedo` 等派生。

### 21.8 Adapter 错误（`contracts/adapter.ts`）

`ScreenAdapterErrorCode` 8 个：`UNAUTHORIZED` / `FORBIDDEN` / `NOT_FOUND` / `CONFLICT` / `VALIDATION` / `UNAVAILABLE` / `ABORTED` / `UNKNOWN`。`nebula-screen-host-adapter.ts:79-104` 将 `BizCode` 映射到这些错误码（CONFLICT = `SCREEN_SAVE_CONFLICT`；UNAVAILABLE = `-1` / `408` / `429` / `>=500`；UNAUTHORIZED 包含 `AUTH_INVALID_REFRESH_TOKEN` 等）。

### 21.9 诊断（`contracts/diagnostics.ts`）

`ScreenSdkDiagnostic`：`{code, level, message, nodeId?, edgeId?}`。`inspectNebulaScreenSdkCompatibility(project)` 用 `parseScreenDocument` 校验当前 SDK 是否能处理项目，返 `{compatible:true} | {compatible:false, code, diagnostics}`。

### 21.10 导入控制端口（`host/screen-import-controller-port.ts`）

`ScreenImportControllerPort`：`prepareImport(file)`（委托 `controller.prepareImport`）/ `importProject(prepared)`（委托 `controller.importProject`）。宿主侧导入能力封装，与 §28.3 导入对话框、`§21.1` 主机状态机 `load` 协同；UI 触发导入后经此端口完成"准备 → 落库"。

---

## 22. 通知系统（`components/screen-editor-notifications.tsx`）

`ScreenEditorNotificationProvider` 基于 Radix Toast（`duration:5000` 默认；`variant: 'default' | 'destructive' | 'success'`）。5 类常用消息：

| kind | variant | 触发点 |
|---|---|---|
| 保存成功 | success | `handleSave` onSuccess |
| 保存失败 | destructive | onError |
| 发布成功 | success | onSuccess |
| 发布失败 | destructive | onError |
| 导入成功 / 覆盖 | default / destructive | 取决于 dirty |
| 导入失败 | destructive | 解析错误 |
| 导出成功 | success | `已导出 ${name}` |
| 焦点定位失败 | destructive | 命令式 `focusComponent` 未找到 |

toast 队列：每屏同时最多展示 5 条；超长消息 2 行截断。

---

## 23. 组件库面板（`components/component-library.tsx`）

### 23.1 搜索

- `Input type="search"`, `placeholder="搜索组件..."`, `aria-label="搜索组件"`, `className="h-7 pl-7 text-xs"`；`Search` 图标绝对定位
- **200ms 防抖**：`setTimeout(() => setDebouncedKeyword(keyword), 200)`
- `searchDefinitions(registry, debouncedKeyword)` —— `registry-queries.ts:121-151`。**相关性评分**：name 精确=4 / 前缀=3 / 包含=2 / type 包含或 keywords 包含=1；平局按 `order ?? 0` 升序；空 keyword 返全部（注册顺序）。**大小写不敏感**
- 空结果（`:155-161`）：`SearchX` + `未找到匹配「{kw}」的组件`

### 23.2 分类

- 列表派生 `listCategories(registry)`（`registry-queries.ts:96-107`，首次出现顺序去重）
- 单遍 O(N) 桶入 `filteredByCategory`；`visibleCategories = categories.filter(c => filteredByCategory.has(c))`（带显式 O(N) 说明注释）
- 标签/图标/排序：`categoryLabel(category)` / `categoryIcon(category)` / `categoryOrder(category)`（`registry/category-meta.ts:34-48`）：

| key | label | icon | order |
|---|---|---|---|
| `chart` | 图表 | BarChart3 | 1 |
| `text` | 文本 | Type | 2 |
| `media` | 媒体 | Image | 3 |
| `decoration` | 装饰 | Frame | 4 |
| `table` | 表格 | Table | 5 |
| `container` | 容器 | Box | 6 |

fallback：label 返 category 本身；icon 返 `Box`；order 返 `99`。每类为 `PanelSection`，可折叠，`defaultOpen` 可控，key `` `${resetKey}-${category}` ``

### 23.3 折叠全部 / 展开全部

仅在 `showCollapseButtons = isIdle && visibleCategories.length > 0`（`:138`, `:164-185`）显示：`折叠全部` / `展开全部`，均 `variant="ghost" size="sm" h-6 px-2 text-xs"`。机制：设 `defaultOpen` 后 `resetKey++` 强制 `PanelSection` 重挂载（注释 `:39-41`, 实现 `:87-95`）。

### 23.4 收藏（`registry/favorite-components.ts`）

- 存储键 `` `${namespace}:favorite-components` ``；事件 `` `${namespace}:favorite-components:updated` ``
- `FavoriteEntry = {type, favoritedAt}`；按 type 键存
- `toggleFavorite(type, now, namespace)` 添加或删除 + CustomEvent
- **无数量限制**（"收藏是用户主动行为，不限制数量"）
- 损坏 JSON 自动清理（`safeRead`，`:47-55`）

UI：`PanelSection title="收藏"` 非折叠；仅在 `showFavorites = isIdle && favorites.length > 0` 显示；`FavoriteComponentsList` 过滤掉 registry 中已不存在的类型。`window 'focus'` 与命名空间更新事件触发刷新。

### 23.5 最近使用（`registry/recent-components.ts`）

- 存储键 `` `${namespace}:recent-components` ``；事件 `` `${namespace}:recent-components:updated` ``
- **`DEFAULT_RECENT_LIMIT = 8`**（"Task 9：从 5 调整为 8"）；`MAX_ENTRIES = 20`
- `RecentComponentEntry = {type, count, lastUsedAt}`
- `recordComponentUsage(type, now, namespace)`：`count = prev ? prev.count+1 : 1`，更新 `lastUsedAt`，trim 至最新 20 条，发 CustomEvent
- `getRecentComponents(limit=8, namespace)` 排序 `lastUsedAt` 降序，slice

UI：`PanelSection title="最近使用"`；仅在 `showRecent = isIdle && recent.length > 0` 显示。**仅在组件成功 addComponent 后**才记录最近使用（`:413-414`）。

`isIdle = debouncedKeyword.trim() === ''` —— 搜索时收藏/最近/折叠按钮全部隐藏。

### 23.6 卡片渲染与拖拽源

`ComponentLibraryItem`（`:237-292`）：
- `draggable`、`onDragStart={(e) => onDragStart(e, def.type)}` —— 设 `'component-type'` + `effectAllowed='copy'`
- `title` 拼接 `name · description` 或 `拖拽「name」到画布`
- classes：`group flex cursor-grab items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 ... active:cursor-grabbing`
- 图标 `size-7 rounded bg-muted`，`group-hover:bg-primary/10`
- 名称 `truncate text-xs text-foreground`
- 收藏星：aria-label="收藏" / aria-pressed；`e.stopPropagation + preventDefault` 防 dnd 触发
- 徽标：`def.badge==='new'` → `NEW` (emerald)；`==='beta'` → `BETA` (amber)

### 23.7 `useCanvasDrop()` —— 画布 drop 目标

- `handleDrop`：读 `'component-type'`；坐标 `Math.round((clientX - rect.left) / canvasScale)`；`maxZ = reduce(max, c.zIndex, 0)`；`createComponentInstanceFromRegistry(registry, type, x, y, maxZ+1, project.components)`；成功 `addComponent + recordComponentUsage`
- `handleDragOver`：`preventDefault() + dropEffect='copy'`

`createComponentInstanceFromRegistry`（`registry-queries.ts:179-214`）：名称按类型自增；style 合并；`props: structuredClone(def.defaultProps)`；`status:{locked:false, hidden:false}`；`parentId:null`；`id: crypto.randomUUID()`。

### 23.8 列表/网格视图

**没有列表/网格切换**。所有 section 渲染为单列垂直列表：`<div className="flex flex-col gap-1">`（`:217`, `:327`, `:368`）。左面板 48px 折叠导轨是唯一替代展示。

---

## 24. 属性面板（`components/property-panel.tsx` + `property-schema/*`）

### 24.1 外壳（`property-panel.tsx:253-318`）

根 `flex h-full min-w-0 flex-1 flex-col bg-card text-foreground`。头 `flex h-10 items-center gap-2 border-b border-border px-3 text-sm font-medium`：
- 单选 → `selectedComponent.name`
- 多选 → `` `多选 (${selectedComponentIds.length})` ``
- 无 → `属性`

头右：`ToolbarButton` (`Braces size-3.5`, `className="mr-6 shrink-0"`, `tooltipSide="left"`, `aria-label`/`tooltip` = `readonly ? '查看组件 JSON' : '编辑组件 JSON'`)；仅当 `selectedComponent && onOpenComponentJsonEditor`。

Body：readonly → `pointer-events-none flex-1 overflow-y-auto opacity-80`；否则 `flex-1 overflow-y-auto`。

三分支（`:282-315`）：
1. **单选** → `<PropertySchemaRenderer schema component onUpdate>` + `Button variant="destructive" w-full` `删除组件`
2. **多选** → `<MultiSelectPanel selectedIds>`
3. **未选** → 提示块 + `PanelSection title="画布设置"` `<CanvasSettingsFields>` + `<GlobalVariablesPanel staticOnly={capabilityProfile==='static'}>`

### 24.2 选择延迟与 host props 校验

- `selectedComponentIds = useDeferredValue(rawSelectedComponentIds)`（`useDeferredValue` 理由：Moveable 控制框先渲染）
- `singleSelectedId` = 仅当恰好 1 选中
- Schema 查找：`getSchemaFromRegistry(registry, type)`（`useOptionalRegistry()`）；fallback 走遗留模块级
- **Host props 校验**（`:224-247`）：若 `registry.get(type).source==='host'`，`hostPropsSchema = reg.manifest.propsSchema`；任何含 `props` 的 update 走 `validateValueAgainstSchema(updates.props, hostPropsSchema, ['props'], diagnostics)`；**非法即提前返不写 Store 不入历史**（"Spec §7.3"）

### 24.3 `MultiSelectPanel`（`:139-181`）

- 文案 `` `已选中 ${selectedIds.length} 个组件` ``
- `PanelSection title="对齐"` `grid grid-cols-6 gap-1`，6 个图标按钮（ToolTip + `aria-label`）
- `ALIGN_COMMANDS`（`:63-70`）：左对齐/水平居中/右对齐/顶对齐/垂直居中/底对齐 → `alignSelectedHorizontal('left'|'center'|'right')` / `alignSelectedVertical('top'|'middle'|'bottom')`
- `Button variant="destructive" w-full` → `` `删除选中 (${selectedIds.length})` ``
- 自身 `TooltipProvider` 包裹

### 24.4 `CanvasSettingsFields`（`:79-129`，memo）

| 字段 | 控件 |
|---|---|
| 宽度 | `NumberInput` `min=1` `syncKey="canvas:width"` |
| 高度 | `NumberInput` `min=1` `syncKey="canvas:height"` |
| 背景 | `ColorInput` |
| 缩放 | `Select` 5 项（fit/full/width/height/none） |

### 24.5 Schema 驱动渲染（`property-schema/section-renderer.tsx`）

3 层：`PropertySchemaRenderer` → `PropertySectionRenderer` → 字段渲染器。`PropertySchemaRenderer` memo。

**Tabs 决策**（`:222-247`）：收集不同 `section.tab` 入 Set 保序；`useTabs = tabs.length >= 2`；< 2 节直接平铺；≥ 2 节用 `Tabs`，`TabsList h-8 w-full` 在 `border-b border-border p-1.5`，一个 `TabsContent` 对应一个 tab 含匹配 section。初始 `activeTab = tabs[0] ?? 'appearance'`。

**Tab id 与 label**（`property-schema/types.ts:26-34`）：
```
PropertyTabId = 'appearance' | 'data' | 'interaction' | 'events'
TAB_LABELS = { appearance: '外观', data: '数据', interaction: '交互', events: '事件' }
```

**Section 模式**（`types.ts:124-143`）：`fields` 模式包 `PanelSection`（传 `title/collapsible/defaultOpen/testId/contentClassName`）；`customRender` 模式**直接返回内容不包 PanelSection**。互斥。

**3 种字段**（`types.ts:105`）：`DeclarativeField` (`kind:'field'`) / `ManifestField` (`kind:'manifest-field'`) / `CustomField` (`kind:'custom'`)。

- `DeclarativeFieldRenderer`（`:36-79`）：遵守 `visibleWhen(component)` → 返 `null`；未知 control name → 红色 `未知控件: {name}`；值 `getByPath(component, field.path) ?? field.defaultValue`；onChange → `buildNestedUpdate` → `onUpdate`；注入 `syncKey={`${component.id}:${field.path}`}` + 展开 `controlProps`
- `ManifestFieldRenderer`（`:90-134`）：RFC 6901 指针相对 `component.props`；读 `getPropByPointer`，写 `updatePropByPointer` → `onUpdate({props: newProps})`；**`try/catch` 静默忽略非法指针/原型链污染**（`:125-127`）；`syncKey={`${component.id}:props${field.pointer}`}`；无 `visibleWhen` 无 `defaultValue`
- `CustomField`：`<Fragment key={idx}>{field.render(ctx)}</Fragment>`（`:163-165`）

`SectionRenderContext = { component, onUpdate }`（`types.ts:108-113`）。

### 24.6 字段控件类型（`property-schema/field-controls.tsx`）

`FIELD_CONTROLS` 注册表（`:132-139`），**正好 6 个**控件：
| key | 组件 | 备注 |
|---|---|---|
| `number` | `NumberField` | 转发 `min, max, step, shiftStep, precision` |
| `color` | `ColorField` | nullish → `''` |
| `text` | `TextField` | 单行 |
| `textarea` | `TextAreaField` | `<textarea rows={3}>` |
| `select` | `SelectField` | `options?: readonly {value,label}[]` |
| `switch` | `SwitchField` | `Boolean(value)` |

支撑 primitives（`components/panel-fields.tsx`）：`numberInputClass = 'h-7 px-2 py-1 text-sm'`；`TextInput`（label `w-14` + `useId`）；`ColorInput`（`<input type="color" h-7 w-7>` + 文本 `Input`）；`StyleFields`（遗留复合字段，给 bar-chart 视觉段用）。

`FieldControlProps<T>`（`types.ts:37-51`）：`value, onChange, label?, disabled?, syncKey?`。

### 24.7 Section 与属性路径（`property-schema/schemas.tsx`）

**`POSITION_SECTION`** `id=position` `title=位置与尺寸` `tab=appearance` `collapsible` `defaultOpen:true`（`:35-78`）：
| 标签 | 路径 | 控件 | controlProps | visibleWhen |
|---|---|---|---|---|
| X | `position.x` | number | `precision:2` | — |
| Y | `position.y` | number | `precision:2` | — |
| 宽 | `position.width` | number | `min:1, precision:2` | — |
| 高 | `position.height` | number | `min:1, precision:2` | — |
| 旋转 | `position.rotation` | number | — | `c.position.rotation != null && c.position.rotation !== 0` |

**`STYLE_SECTION`** `id=style` `title=样式` `tab=appearance` `collapsible`（`:81-126`）：
| 标签 | 路径 | 控件 | default | controlProps |
|---|---|---|---|---|
| 背景 | `style.backgroundColor` | color | `'#ffffff'` | — |
| 透明度 | `style.opacity` | number | `1` | `step:0.1, shiftStep:0.5, min:0, max:1` |
| 边框 | `style.borderWidth` | number | `0` | `min:0` |
| 边框色 | `style.borderColor` | color | `'#000000'` | — |
| 圆角 | `style.borderRadius` | number | `0` | `min:0` |

**`TEXT_PROPS_SECTION`** `id=text-props` `title=文本属性` `tab=appearance` `collapsible`（`:153-227`）：
| 标签 | 路径 | 控件 | default |
|---|---|---|---|
| 内容 | `props.content` | textarea | — |
| 字号 | `style.fontSize` | number | `14` (`min:1`) |
| 字色 | `style.color` | color | `'#ffffff'` |
| 字重 | `style.fontWeight` | select | `'normal'` |
| 行高 | `style.lineHeight` | number | `1.5` (`step:0.1, min:0.1`) |
| 对齐 | `style.textAlign` | select | `'left'` |
| 字间距 | `style.letterSpacing` | number | — (`step:0.1`) |
| 描边宽度 | `style.textStrokeWidth` | number | — (`min:0, step:0.5`) |
| 描边颜色 | `style.textStrokeColor` | color | — |

`FONT_WEIGHT_OPTIONS`：normal/300/400/500/600/bold/800/900（Radix Select 需字符串值）。`TEXT_ALIGN_OPTIONS`：left/center/right。

**`TRANSFORM_SECTION`** `id=transform` `title=变换` `tab=appearance` `collapsible`（`:235-256`）：水平翻转 / 垂直翻转（switch，default `false`）。旋转留在 POSITION_SECTION。

**`LAYER_STATUS_SECTION`** `id=layer-status` `title=层级状态` `tab=appearance` `collapsible` `defaultOpen:false` `testId:'layer-status-section'`（`:270-304`）：名称 / 层级（zIndex number `min:0, step:1`）/ 锁定 / 隐藏。

**`FILTER_SECTION`** `id=filter` `title=滤镜` `tab=appearance` `collapsible` `defaultOpen:false` `testId:'filter-section'`（`:329-386`）：色相（0-360 step 1）/ 饱和度（0-200）/ 亮度（0-200）/ 对比度（0-200）/ 模糊（0-20 step 0.1）/ 灰度（0-100）。

**`EVENTS_SECTION`** `id=quick-events` `title=事件` `tab=events` `customRender: ({component}) => <QuickEventEditor componentId={component.id}/>` `testId:'quick-events-section'`（`:312-318`）。

**`BUTTON_PROPS_SECTION`** `id=button-props` `title=按钮属性` `tab=appearance` `defaultOpen:true`（`:548-585`）：文字 / 字号 / 字色 / 字重。

**空 tab 占位**通过 `createEmptyTabPlaceholder(id, tab, hint, testId)`（`:402-418`）→ `customRender` 返居中提示文本。实例：`DEFAULT_DATA_EMPTY_SECTION` / `DEFAULT_INTERACTION_EMPTY_SECTION` / `TEXT_DATA_EMPTY_SECTION` / `BUTTON_DATA_EMPTY_SECTION`。

**组合 schema**：
- `DEFAULT_SCHEMA`（`:441-450`）：POSITION → STYLE → TRANSFORM → LAYER_STATUS → FILTER → data-empty → interaction-empty → EVENTS
- `TEXT_SCHEMA`（`:465-474`）：POSITION → STYLE → TEXT_PROPS → TRANSFORM → LAYER_STATUS → FILTER → text-data-empty → EVENTS
- `BUTTON_SCHEMA`（`:600-609`）：POSITION → BUTTON_PROPS → STYLE → TRANSFORM → LAYER_STATUS → FILTER → button-data-empty → EVENTS
- `BAR_CHART_SCHEMA`（`:487-540`）：appearance = POSITION / `bar-chart-visual` (customRender `BarChartVisualSection`) / TRANSFORM / LAYER_STATUS / FILTER；data = `bar-chart-data` (customRender `BarChartDataSourceSection` + `BarChartLogicSection`)；interaction = `bar-chart-interaction` (`BarChartInteractionSection`)；events = EVENTS_SECTION。注意 `:484` STYLE_SECTION 刻意省略（visual 段已含 StyleFields）

**Registry**：`PROPERTY_SCHEMAS: Record<string, PropertySchema> = {}` 起空（`:622`），由 `buildPropertySchemas(modules)` 填充（`:633-643`，先清后填），`registered-components.ts` 在所有注册完成后调用，循环依赖破除见 `:14-21`。`getSchemaForComponentType(type)` 返 `PROPERTY_SCHEMAS[type] ?? DEFAULT_SCHEMA`（`:649-651`）。

**Host 组件**（`property-schema/manifest-adapter.ts`）：
- `extractControlProps(field)`（`:43-57`）：`number` → `{min,max,step}`（仅 present 的，否则 undefined）；`select` → `{options}`；其他 → undefined
- `manifestToPropertySections`（`:82-93`）：manifest section 全部走 `tab:'appearance'`，`collapsible:true`，`defaultOpen: section.defaultOpen ?? true`
- `buildHostComponentSchema`（`:106-124`）顺序：POSITION → STYLE → **manifest sections** → TRANSFORM → LAYER_STATUS → FILTER → DEFAULT_DATA_EMPTY → DEFAULT_INTERACTION_EMPTY → EVENTS。Host 组件不能用 `customRender`/`render`/`ReactNode`/HTML（`types.ts:81-82`）

---

## 25. 全局变量面板（`components/global-variables-panel.tsx`）

3 种类型：
| type | 标签 | 摘要 | 徽标 |
|---|---|---|---|
| `static` | 静态 | `JSON.stringify(value)` 或 `—` | emerald |
| `api` | API | `apiConfig.url` | blue |
| `computed` | 表达式 | `expression` | purple |

**单 prop** `staticOnly?: boolean`（`staticOnly` 时强制 `type:'static'`，用于静态 profile）。

CRUD：
- **添加**（`Plus` 按钮）：弹 dialog，新条目
- **编辑**（每行 `Pencil`）：`editingId = id` 弹 dialog
- **删除**（`Trash2 text-destructive`）：`removeGlobalVariable(id)`
- **预览**（`Eye`）：实时跑通数据集 / API 调用看输出

`useVariablePreview`：`useApiDataSource(apiConfig)` 或 `useDatasetSource({datasetId, ...})`，仅当该变量类型为 api/dataset 时启用。

**所有变量的 `key` 走 `getFieldByPath(componentProps, 'globalVars.' + name)` 解析**；模板插值 `{{globalVars.xxx}}` 见 §17.9。

---

## 26. 工具栏（`components/editor-toolbar.tsx`）

布局 `flex h-12 items-center gap-2 border-b border-border bg-card px-3`，三段（左项目信息 / 中工具与撤销重做 / 右缩放与菜单与动作）。

`ZOOM_PRESETS = [50, 100, 200]`。

### 26.1 左段

**`ProjectName`**（`:41-90`）：`useScreenEditorStore(s => s.project?.name)` + `renameProject`。
- `name == null` → `<span className="text-sm text-muted-foreground">加载中...</span>`
- 显示 span：`max-w-56 cursor-text truncate`，`title={`${name}（双击重命名）`}`，`onDoubleClick` 进编辑态（draft = name）
- 编辑 input：`aria-label="项目名称"`，`h-7 w-48 ...`；**Enter** 提交、**Escape** 取消、**onBlur** 提交；挂载时 `useEffect` 全选

**`SaveStatusBadge`**（`:93-130`），优先级：
1. `isSaving` → `LoaderCircle` spinning + `保存中...`
2. `isDirty` → amber dot + `未保存更改` (`text-amber-600 dark:text-amber-400`)
3. `lastSavedAt` → green `Check` + `已保存 HH:mm`（零填充 `String(...).padStart(2,'0')`）
4. else → `null`

### 26.2 中段

- **`<ToolSelector editorSession>`** —— `components/tool-selector.tsx`：`role="group"` `aria-label="工具选择"`；映射 `TOOL_REGISTRY`；每 Button `aria-label={tool.name}` / `aria-pressed={isActive}` / `disabled={!tool.implemented}` / `size-7 p-0` / active `bg-accent text-accent-foreground` / disabled `opacity-40`；Tooltip `side="bottom"` 显 `{tool.name}` 或 `{tool.name}（未实现）`
- **Undo**：`tooltip="撤销"`, `shortcut=getShortcutKeys('undo')`, `disabled={!canUndo}` (`history.past.length>0`), `aria-label="撤销"`, `className="size-7"`, `Undo2 size-3.5`
- **Redo**：`tooltip="重做"`, `shortcut=getShortcutKeys('redo')`, `disabled={!canRedo}` (`history.future.length>0`), `aria-label="重做"`, `Redo2`

### 26.3 右段

**`ZoomControls`**（`:133-194`），容器 `flex items-center rounded-md border border-border bg-background p-0.5`：
- Minus：`tooltip="缩小"`, `shortcut=getShortcutKeys('zoomOut')`, `aria-label="缩小"`, `className="size-6"`, `Minus size-3.5`
- 百分比下拉 trigger：`aria-label="缩放比例"`, `h-6 w-14 ... text-center text-xs`, 文本 `{zoomPercent}%`。菜单 `align="center" min-w-24`：`50%` / `100%` / `200%`（current highlighted `bg-accent`）→ `setCanvasScale(z/100)`；加 `适应屏幕` (`Maximize size-3.5`) → `onFitToScreen`
- Plus：`tooltip="放大"`, `shortcut=getShortcutKeys('zoomIn')`, `aria-label="放大"`, `className="size-6"`, `Plus`

`<Separator orientation="vertical" className="mx-1 h-5" />`、`<ProjectMenubar ...>`、`<Separator>`、然后：
- **预览**（`Button variant="ghost" size="sm"`, `Eye`）—— 仅 `onPreview !== undefined`
- **保存**（`Button variant="outline" size="sm"`, `disabled={isSaving}`, `LoaderCircle animate-spin` when saving else `Save`）—— 仅 `onSave !== undefined`
- **发布**（`Button size="sm"`, `disabled={isPublishing}`, spinner/`Upload` icon, `bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700`）—— 仅 `onPublish !== undefined`

**`ToolbarButton`**：base `cursor-pointer text-muted-foreground hover:text-foreground`；active → `bg-accent text-accent-foreground hover:text-accent-foreground`；仅 `tooltip` 时渲染 Tooltip（默认 `tooltipSide='bottom'`）；`shortcut` 渲染为 `<span className="ml-1.5 text-muted-foreground">`。

---

## 27. 顶部菜单（`components/project-menubar.tsx`）

4 个 `DropdownMenu`，trigger `Button variant="ghost" size="sm" className="cursor-pointer px-2.5 py-1 text-sm"`，content `align="start" className="w-56"`。`MenuItemContent` (`:84-101`) = 图标 + 文本 + `ShortcutBadge`。

派生：`hasSelection = deferredSelectedIds.length>0`；`hasGuides = guides.vertical.length>0 || guides.horizontal.length>0`。`deferredSelectedIds = useDeferredValue(selectedComponentIds)`（带性能说明）。

### 27.1 文件 (File) `:166-221`

| 项 | 图标 | 快捷键徽章 | 禁用 | 渲染条件 |
|---|---|---|---|---|
| 保存项目 | Save | `mod+s` → Ctrl+S | `isSaving` | `onSave !== undefined` |
| 发布项目 | Upload | — | `isPublishing` | `onPublish !== undefined` |
| 预览项目 | Eye | — | never | `onPreview !== undefined` |
| *(sep)* | | | | 有 import 或 export |
| 导入 JSON... | FileUp | — | never | `onShowImport !== undefined` |
| 导出 JSON | FileDown | — | `!project` | `onExport !== undefined` |
| *(sep)* | | | | 有 snapshots |
| 快照管理... | History | — | `!project` | `onShowSnapshotManager !== undefined` |

### 27.2 编辑 (Edit) `:224-263`

| 项 | 图标 | 快捷键 | 禁用 |
|---|---|---|---|
| 撤销 | Undo2 | `mod+z` | `!canUndo` |
| 重做 | Redo2 | `mod+shift+z` | `!canRedo` |
| *(sep)* | | | |
| 复制 | Copy | `mod+c` | `!hasSelection` |
| 粘贴 | ClipboardPaste | `mod+v` | `!clipboard` |
| 创建副本 | CopyPlus | `mod+d` | `!hasSelection` |
| 全选 | BoxSelect | `mod+a` | `!project` |
| *(sep)* | | | |
| 删除选中 (destructive) | Trash2 | `delete,backspace` | `!hasSelection` |

`handleSelectAll`（`:152-161`）过滤 `!c.status.locked && !c.status.hidden` —— 与 `mod+a` 快捷键行为一致。

### 27.3 视图 (View) `:266-340`

| 项 | 类型 | 图标 | 快捷键 | 禁用 |
|---|---|---|---|---|
| 放大 | Item | ZoomIn | `mod+equal` | — |
| 缩小 | Item | ZoomOut | `mod+minus` | — |
| 适应屏幕 | Item | Maximize | `mod+0` | — |
| *(sep)* | | | | |
| 显示参考线 | **CheckboxItem** `checked={guides.visible}` | Ruler | `mod+semicolon` | — |
| 锁定参考线 | **CheckboxItem** `checked={guides.locked}` | `Lock`/`Unlock` | — | `!guides.visible` |
| 清除参考线 | Item | Eraser | — | `!guides.visible \|\| !hasGuides` |
| *(sep)* | | | | |
| 组件边框参考线 | **CheckboxItem** `checked={showBorderGuides}` | Square | `mod+k` | — |
| *(sep)* | | | | |
| 主题 (static label) | span | — | — | — |
| 亮色 | **RadioItem** `value="light"` | Sun | — | — |
| 暗色 | **RadioItem** `value="dark"` | Moon | — | — |
| *(sep)* | | | | |
| 画布设置... | Item | Settings | — | `!project` |

主题 radio group `value={theme}` / `onValueChange={(v) => setTheme(v as 'light'\|'dark')}` 来自 `useScreenEditorEnvironment()`（`:147`, `:320-332`）。

### 27.4 工具 (Tools) `:343-373`

| 项 | 图标 | 备注 | 禁用 | 渲染条件 |
|---|---|---|---|---|
| 事件蓝图 | Workflow | **`Beta`** 徽章 `bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400` | — | 始终 |
| `readonly ? '查看组件 JSON...' : '组件 JSON...'` | Braces | — | `deferredSelectedIds.length !== 1` | `onShowComponentJsonEditor !== undefined` |
| *(sep)* | | | | |
| 快捷键帮助 | Keyboard | `mod+slash` | — | 始终 |

**`ShortcutBadge`**（`components/shortcut-badge.tsx`）：`formatKeys(keys)` 映为 `<kbd className="inline-flex min-w-[1.25rem] ... font-mono text-[10px] font-medium">`，wrapper `ml-auto flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground`。

---

## 28. 对话框与弹层

### 28.1 快捷键帮助（`shortcuts-help-dialog.tsx`）

`DialogContent` 三段：
1. **命令**（按 category 分组 + 搜索过滤）
2. **工具**（同）
3. **说明**（alt+drag 复制、alt+wheel 反向缩放、临时抓手等不属快捷键的说明）

每个 category 行：键位列 + 描述列。键位用 `formatKeys` + `<kbd>` 渲染。`scrollable` 容器 max-h-96。搜索栏过滤 category 内匹配项。

### 28.2 快照管理（`snapshot-manager-dialog.tsx`）

`DialogContent`：
- **列表**（左侧）：每行 `name` + `createdAt` + 操作（恢复 / 删除 / 重命名）
- **创建**（顶部按钮）：输入名 → 存当前 store 全状态到 localStorage
- **恢复**：替换 store 全状态，**保留历史**（新增初始快照条目作为基线）
- **重命名**：inline edit（与图层面板相同模式）
- **删除**（destructive + 确认）

### 28.3 导入对话框（`import-dialog.tsx`）

- 文件选择（`<input type="file" accept="application/json">`）或粘贴 JSON
- **覆盖检查**：当前 `isDirty` 时显式警告 + 必须勾选"丢弃未保存更改"才启用导入按钮
- JSON 解析 → Zod 校验 → 预览组件数 / 画布尺寸 / 名称
- 导入：调 `importProject(file)`（host adapter 实现），成功后 `applyProjectEnvelope` 走 `'import'` source 全量替换

### 28.4 保存冲突对话框（`save-conflict-dialog.tsx`）

`ConflictResolution` 4 选项：
- **保留我的修改重新保存**（force 写）
- **放弃我的修改加载远端**（覆盖本地）
- **稍后处理**（关闭）
- **查看差异**（如支持，diff modal）

### 28.5 发布确认对话框（`publish-confirm-dialog.tsx`）

- 警告发布不可逆（envelope releaseId 绑定）
- 显示 release notes 输入（可选）
- 确认后调 `publish()`

### 28.6 组件 JSON 编辑对话框（`component-json-editor-dialog.tsx`）

`DialogContent max-w-3xl`：
- Monaco JSON 编辑器（左）
- Schema 校验提示（右栏）
- 顶部：组件名 + 类型 + readonly 模式提示
- 底部：取消 + 应用（`replaceComponentConfig`）

### 28.7 画布设置对话框（见 §6.10）

### 28.8 通知（见 §22）

---

## 29. 性能策略汇总

| 策略 | 实现 |
|---|---|
| 手势期间 store 更新节流 | `createRafThrottler`（`raf-throttle.ts`），同帧多次调只保留最新任务；DOM style 写入**不同步**节流（防 Moveable 控制框抖动） |
| 选区信息 React 渲染 | `useDeferredValue` 包 Moveable 控制框与选择信息（控制框先出） |
| 标尺只跟 scale 重渲染 | `React.memo` comparator `prev.scale === next.scale`；offset 变化走命令式 `syncScroll` |
| 维度指示器文本 | 绕过 React：用 `store.subscribe + el.textContent` 逐帧写 |
| Moveable 自身 | `flushSync` 同步 flush 选中（防 React 18 并发撕裂） |
| 性能分析专用组件 | `screen-canvas.tsx:362` 注释说明组拖拽刻意不节流（手势期间只有 style 写） |
| 图层 panel 单菜单 | 全面板共用单一菜单（避免 N 行 × 12 描述符在 `flushSync` 帧内被放大） |
| 图层 panel 虚拟化 | 超过阈值（> 50 项）启用虚拟化，**虚拟化路径下拖拽完全禁用**，退化为每行置顶/置底按钮 |
| 蓝图拖拽中间态 no-op | `onNodeDrag` 是有意 no-op；只在 `onNodeDragStop` 一次性 `applyDragResult` |
| Provider 树 memo | `RegistryProvider` 内部 `useMemo([registry])`；`ScreenEditorWorkbench` 顶层 `memo` 各种面板组件 |
| 拖拽热区性能 | 标尺 7px 命中区域（`width:7`）；移动监听在 `containerRef`，不订阅 store |
| 菜单按需挂载 | `LayerCommandItems`、`ShortcutsHelpDialog` 内容仅在 Radix 打开时挂载 |

---

## 30. 已知 bug / 文档化但未接线 / 设计不一致

| 项 | 位置 | 现象 |
|---|---|---|
| 参考线拖出量用错维度 | `canvas-guides.tsx:189-204` | 横向参考线纵向拖出与 `rect.width` 比而非 `rect.height` |
| `updateGuide` 重排序破坏身份 | `editor-store.ts:1262-1274` | 拖一条参考线过另一条时，下标变化导致重排序 |
| 多选置顶反转相对顺序 | 键盘 `mod+]` 循环 | 每次取新 `maxZ+1`，选区内相对顺序被反转 |
| 多选对齐/分布不跳过 locked | `editor-store.ts:1480-1506` | locked 组件仍参与对齐/分布 |
| 升序对齐吸附的解析策略 | `blueprint/lib/snap-utils.ts:134-183` | 最低坐标优先，与画布侧最近优先不一致 |
| 中键平移未实现 | `handlePanStart` 需 `e.button === 0` | 状态机文档化 `isPanGesture` 含"中键按下"但无调用点 |
| `Alt+滚轮` 不反向 | `screen-canvas.tsx:1118-1153` | Alt/Ctrl/Cmd 滚轮三者等价，文档却声明 Alt 是反向 |
| Shift 旋转对称破坏 | `onResize` vs `onRotate` | resize 每帧实时读 Shift/Alt；rotate 用手势开始时 Shift 捕获 |
| Shape 拖拽无正方形/中心约束 | `handleCreateShapeStart` | 不读 shift/alt |
| `renameComponent` 仍占历史槽 | `editor-store.ts:420-445` | 名称相同时 `pushHistory` 已先执行 |
| `reorderLayerToIndex` 同名短路也占历史 | `editor-store.ts:1048` | `fromIdx===clampedTo` 在 pushHistory 之后 |
| `redo` 压 past 不裁剪 | `editor-store.ts:1392-1395` | 与 `pushHistory` 不对称，无 `slice(-50)` |
| `SmartGuidesOverlay` 死代码 | `components/smart-guides-overlay.tsx` | 无人引用、无人调 `useAlignmentLinesStore().setLines` |
| `pureFindAlignmentLines` 死代码 | `lib/smart-guides.ts:68-151` | 仅 `smart-guides.test.ts` 引用 |
| `setDimension` 魔法字面量 3 | `smart-guides-overlay.tsx:45` | 硬编码 `distance < 3` 而非导入 `SMART_GUIDES_SNAP_THRESHOLD` |
| `smartGuidesEnabled` 无 UI | `editor-store.ts:114-118` | 默认 `true` 会话级，无菜单无状态栏无快捷键 |
| 画布菜单全选不过滤 | `canvas-context-menu.tsx:308` | 与 menubar / `mod+a` 行为不一致 |
| 标尺 0.75/1.5 缩放标签非整数 | `canvas-rulers.tsx:87` | 66/33 等无取整逻辑 |
| `ungroup` 不清 `activeGroupId` | `editor-store.ts:1589-1604` | 当前组解组后 `activeGroupId` 悬空 |
| `removeComponent` 无级联 | `editor-store.ts:806-817` | 不动其它组件 `parentId`、不清 `activeGroupId` |
| `custom-element-renderer` 事件 payload 不打日志 | `custom-element-renderer.tsx:311-329` | 校验失败 `console.warn` 不含 payload（"Spec §9.2.6"） |
| `setCanvasScale` 无边界 | `editor-store.ts:1008-1010` | 裸 set，无 clamp 无 offset 补偿 |
| `setGridSize` 无校验 | `editor-store.ts:1638-1640` | 文档承认"调用方负责边界校验" |
| 缩放工具 zoom in/out 硬编码 | `screen-editor-workbench.tsx:546-548` | `Math.min(5, ...)` / `Math.max(0.1, ...)` 未复用 `MIN/MAX_SCALE` |
| `interpolateActionConfig` 不在执行器使用 | `lib/template-interpolation.ts` | 仅导出供数据源与宿主用 |
| `maskRequestForLog` 不在执行器使用 | `lib/request-api-mask.ts` | 仅日志预处理工具 |
| `use-blueprint-selection` 导出但未使用 | `blueprint/hooks/` | sheet 用 RF 原生 |
| `alignment` 信息级诊断无发射点 | `compiler/types.ts:64` | `invalid-edge-handle` 在类型联合但代码不发射 |
| `truncated` 不可达 | `runtime/types.ts:15-34` | `RuleExecutionLog.truncated: false` 恒为 false |
| `dataset-source` `component-data` / `trigger` 未实现 | `use-dataset-source.ts:45-75` | 返 undefined |

---

## 31. 设计原则与不变式

| 原则 | 体现 |
|---|---|
| 状态机互斥 | 任何时刻最多一种"瞬时"状态；非法转换不抛错 |
| 单一数据源 | 快捷键、组件注册、属性 schema、组件事件/动作各自一份 |
| finalize/cancel 协议 | 所有瞬时交互有统一的完成/取消语义 |
| 不可变更新 | 所有 store 更新走 spread；历史用浅拷贝而无需 `structuredClone` |
| 撤销必有代价 | 至少一条历史；命名/层级等"无变化"动作仍可能占历史槽 |
| 蓝图手势批处理 | 拖拽中 dirty-only；gesture end 一次性提交 |
| 验证前置 | 任何 host 组件 props update 先 Zod 校验；非法不写不入历史 |
| 协议隔离 | dynamic/static profile 各自禁用清单；URL 白名单仅 schema 层 |
| 双协议不串 | 画布/蓝图独立快捷键注册（`bp-` 前缀），互不污染 |
| 工具切换清选择 | `setTool` 触发 `clearSelection` + 可能 `dispatchInteraction('cancel')` |
| 修饰键清理 | `window blur` 重置所有 modifier ref + 临时工具栈 + Space keyup 必达 |
| iframe 安全 | `ownerWindow ?? window`、`containerRef?.ownerDocument.defaultView` |
| iframe-safe 指针事件 | `mousemove` `{passive:true}`、window 监听器挂在 owner document |
| 多实例隔离 | Instance Registry 快照（`Object.freeze`）；`DEFAULT_BUILTIN_REGISTRY` 单例 |
| 内存剪贴板 | 不接系统剪贴板 → 无跨实例/跨标签共享（与蓝图剪贴板对比） |
| 三路 rebase | save 冲突时按 base/local/remote 递归合并，失败降级全量替换 |
| 角色分离 | 撤销 vs 取消：finalize 提交，取消绝不提交；cancel 触发 `clearTemporaryTools` |

---

## 33. 动态设计器/查看器交付物（packages/screen-dynamic-sdk）

A1 切片形态：把动态设计器/查看器作为 **Web Component（Custom Element）** 独立交付，宿主可在任意页面直接挂载 `<nebula-screen-designer>` / `<nebula-screen-viewer>`，无需 React 宿主。复用 `screen-editor-core` 的 `CustomElementRenderer`（`@nebula/screen-editor-core/experimental`，见 §33.7）与动态数据层（§19）。

### 33.1 设计器 Custom Element `<nebula-screen-designer>`（`element/nebula-screen-designer-element.ts`）

- 继承 `ScreenDynamicElementBase`（`element/base-element.ts`）；`mount` 调 `mountDesignerRuntime`（`runtime/designer-runtime.tsx`）
- 属性（property，非 attribute）：`document`（V3 动态文档，读写深拷贝）、`dataAdapter`（可选，设计态不强制）、`componentRegistry`（**挂载后冻结**）、`options` / `readonly` / `theme`
- 方法（基类 `element/base-element.ts:178-213`）：`whenReady()` / `getDocument()` / `reload()` / `save()`（深拷贝当前文档）/ `publish()`（深拷贝）/ `undo()`（readonly 时 no-op）/ `redo()`（readonly 时 no-op）/ `validate()`（返 `ScreenSdkDiagnostic[]`）
- 事件（`element/events.ts` + `contracts/events.ts` 的 `ScreenDynamicEventMap`）：`nebula-ready` / `nebula-error` / `nebula-dirty-change` / `nebula-save-success` `{revision}` / `nebula-publish-success` `{revision}`

### 33.2 查看器 Custom Element `<nebula-screen-viewer>`（`element/nebula-screen-viewer-element.ts`）

- `mount` 调 `mountViewerRuntime`（`runtime/viewer-runtime.tsx`）
- 属性：`document`、`dataAdapter`（**必填**，查看器执行数据）、`componentRegistry`（挂载后冻结）、`options.refreshIntervalSeconds`（定时刷新，0=不刷新）、`theme`
- 方法：`whenReady()` / `reload()` / `getDocument()`（viewer 的 `save`/`publish` 仅返当前文档深拷贝，无编辑语义）；`undo`/`redo` 为 no-op
- 事件：`nebula-ready` / `nebula-error` / `nebula-data-error`
- 不提供任何编辑命令 / 设计选框 / `requestApi`

### 33.3 设计器工作台（`components/designer-workbench.tsx`）

- 画布渲染与 viewer 同源（绝对定位 + fit 缩放，见 §20.4 `fitScale`）
- 支持选择、拖拽移动、右下角缩放手柄
- 设计态组件以 placeholder 渲染（`mode='design'`、无数据执行）
- 保存/发布语义由宿主决定；工作台只负责文档状态与校验

### 33.4 查看器工作台（`components/viewer-workbench.tsx`）

- 全屏画布 + fit 等比缩放
- 打开数据执行上下文（`ScreenDynamicDataProvider`），执行全部 host / xj-metric 组件
- 定时刷新（`refreshIntervalSeconds`）
- 组件渲染复用 `CustomElementRenderer`（`mode='viewer'`、model v2）
- 不提供任何编辑命令 / 设计选框 / `requestApi`

### 33.5 运行时与基础（`runtime/*` + `element/base-element.ts`）

- `mountDesignerRuntime(options)`（`runtime/designer-runtime.tsx:41`）：`save`/`publish` 返回当前文档并 dispatch `nebula-save-success`/`nebula-publish-success`；`validate` 用 V3 parser 的 registry-aware 校验；`undo`/`redo` 当前为 no-op（`:108-109`）
- `mountViewerRuntime(options)`（`runtime/viewer-runtime.tsx:22`）：`source='published'`；`validate` 返 `[]`；`undo`/`redo` no-op
- `ScreenDynamicElementBase`（`element/base-element.ts`）：`connectedCallback`/`disconnectedCallback` 生命周期、`whenReady` 仲裁、持有 `ScreenDynamicRuntime`
- `bundle-entry.ts`：打包入口类型导出；`auto-register.ts`：自动 define

### 33.6 契约切片组件（`contract-components/`）

- `xj-chart-bar.ts`（`xj.chart.bar/v1`，tag `xj-chart-bar-v1`）：验证组件 API v2 契约（`dataCapability=host-metric`）与 model v2 `dataState` 闭环；纯 DOM 绘制简单柱状图，无 ECharts 依赖。真实 XJ 柱状图在 A2 实现
- `xj-metric-card.ts`（`xj.metric-card/v1`，tag `xj-metric-card-v1`）：标题 + `dataState` 数字（success 显数据，loading/error 显状态）；无框架依赖（Vanilla Custom Element）

### 33.7 实验性导出面（关联 `screen-editor-core/src/experimental.ts`）

- 动态 SDK 经 `@nebula/screen-editor-core/experimental` 消费 `CustomElementRenderer` 与 `ScreenComponentInstanceRegistry`
- 该导出面为实验性边界，此前未点名；使用方应锁定版本

### 33.8 测试替身（`testing/fake-data-adapter.ts`）

- `createFakeScreenDataAdapter(options)`：实现 `ScreenDataAdapterPort` 的内存假数据适配，供动态 designer/viewer 单测

---

## 34. 编辑器 Web Component SDK（packages/screen-sdk）

把 `screen-editor-core` 编辑器本身打包为可嵌入的 **Web Component** `<nebula-screen-editor>`，作为独立交付通道（与 `apps/web` 宿主集成 §20 平行）。文档此前仅在范围行与 §16.3 面板宽度 namespace 顺带提及，未作为功能域盘点。

### 34.1 编辑器 Custom Element `<nebula-screen-editor>`（`element/nebula-screen-editor-element.ts`）

- `observedAttributes = ['project-id','readonly','theme']`；Shadow DOM（`mode:'open'`），`installScreenEditorStyles(shadowRoot, screenEditorStyles)`
- 内部 `#sdkRoot`（`data-nebulaSdkRoot`）包 `#mountRoot`（React 根，`data-nebulaReactRoot`）、`#portalRoot`（`data-nebulaPortalRoot`）、`#sizeWarning`（`<1024×640` 提示）、`#runtimeError`（role=alert + 重试按钮）
- property 访问器：`adapter`（set 触发 `#updateRuntime`）、`componentRegistry`（**挂载后冻结**，再 set 抛 `InvalidStateError`）、`options`（set 触发 `#restartRuntime`）、`projectId`（`project-id` attribute）、`readonly`、`theme`
- 方法（`element/runtime.ts` 的 `ScreenEditorRuntime`）：`whenReady()` / `reload({discardChanges?})` / `save()`（Promise<ScreenSdkProjectEnvelope>）/ `publish()` / `getDocument()` / `validate()` / `undo()` / `redo()`
- 事件：`ScreenSdkEventMap`（`NebulaScreenEditorEventMap`，见 `element/contracts.ts`）

### 34.2 元素运行时（`element/runtime.ts` + `runtime/static-runtime.tsx`）

- `ScreenEditorRuntime` 接口（`element/runtime.ts:35`）：`getDocument` / `publish` / `redo` / `reload` / `save` / `undo` / `validate` / `whenReady`
- `mountNebulaScreenEditorRuntime`（`runtime/static-runtime.tsx:29`）：静态运行时实现，委托内部 controller（`save`/`publish`/`undo`/`redo`/`validate`/`whenReady`）
- `createRuntimeMountLoader` / `loadRuntimeMount`（`element/runtime-loader.ts`）：运行时挂载加载器

### 34.3 主题与样式（`styles/theme.ts` + `styles/install-styles.ts`）

- `SCREEN_EDITOR_THEME_VARIABLES` + `applyScreenEditorThemeVariables(...)`：注入 CSS 变量（light/dark）
- `installScreenEditorStyles(root, cssText)`：向 ShadowRoot 安装样式

### 34.4 自动注册（`element/define.ts` + `auto-register.ts`）

- `NEBULA_SCREEN_EDITOR_TAG_NAME = 'nebula-screen-editor'`；`defineNebulaScreenEditor(...)`：在 `customElements` 注册
- `auto-register.ts`：包导入即自动 define

### 34.5 契约别名（`element/contracts.ts`）

- 重导出 `ScreenHostAdapter` / `ScreenProjectDraft` / `ScreenProjectEnvelope` / `ScreenSdkDiagnostic` / `ScreenSdkDocument` / `ScreenSnapshotSummary`，并定义 `ScreenComponentRegistry`

---

## 35. 组件扩展 SDK（packages/screen-component-sdk）

第三方/宿主开发"出现在设计器组件库中的自定义组件"的扩展 SDK。文档此前仅在 §18.5 覆盖 `contracts/manifest.ts`，整个扩展能力面未盘点。

### 35.1 组件 API 版本

- v1：`SCREEN_COMPONENT_API_VERSION = 'nebula.screen-component/v1'`（`contracts/manifest.ts:13`）
- v2：`SCREEN_COMPONENT_API_VERSION_V2 = 'nebula.screen-component/v2'`（`dynamic/data-capability.ts:15`，动态数据能力）

### 35.2 Manifest 契约（`contracts/manifest.ts`）

- `ScreenComponentManifest`：组件元数据；`SCREEN_COMPONENT_ICON_TOKENS` / `SCREEN_COMPONENT_CATEGORIES`（category 枚举，含 `chart` 等）；`BUILTIN_SCREEN_COMPONENT_TYPES`（`nebula.` 前缀内置）
- 校验见 §35.6

### 35.3 事件契约与桥（`contracts/event.ts` + `events/event-bridge.ts`）

- `ScreenComponentEventDefinition` / `ScreenComponentEventDetail`；`COMPONENT_EVENT_TYPE = 'nebula-component-event'`；`EVENT_ID_PATTERN = ^[a-z][A-Za-z0-9]*$`；`MAX_EVENT_PAYLOAD_BYTES = 64*1024`；`EVENT_HANDLE_PREFIX = 'evt:'`
- `validateComponentEvent(...)`（`events/event-bridge.ts:70`）：组件事件校验，返 `ComponentEventBridgeResult`（success/failure，`ComponentEventBridgeCode`）

### 35.4 属性面板契约（`contracts/property.ts`）

- `ScreenComponentPropertySection` / `ScreenComponentPropertyField`；`PROPERTY_CONTROL_TYPES`（控件类型枚举，见 §24.6）

### 35.5 其余契约与工具

- `contracts/model.ts`：`ScreenComponentElementModel` / `ScreenComponentElement`（Custom Element 模型）
- `contracts/json.ts`：`ScreenComponentJsonPrimitive` / `ScreenComponentJsonValue` / `ScreenComponentProps`（props JSON 类型）
- `contracts/diagnostic.ts`：`ScreenComponentValidationCode` / `ScreenComponentValidationDiagnostic` / `ScreenComponentValidationResult`（`createValidationDiagnostic` / `okResult` / `errorResult`）
- `contracts/plugin.ts`：`ScreenComponentPlugin`（组件插件契约，经 `defineScreenComponent` `define.ts` 注册）
- `props/json-pointer.ts`：`parseJsonPointer` / `getPropByPointer` / `updatePropByPointer` / `resetPropByPointer`（JSON Pointer 读写 props）
- `dynamic/data-capability.ts`：`ScreenComponentDataCapability = 'none'|'static'|'host-metric'`、`supportsScreenComponentDataSource`、`ScreenComponentDataState`、`ScreenComponentHostMetricIntent`
- `dynamic/model-v2.ts`：`ScreenComponentElementModelV2` / `ScreenDynamicComponentElement`（v2 元素模型）

### 35.6 校验层（`validation/*`）

- `validateManifest`（`manifest-validator.ts:27`）：Manifest 合法性
- `validatePropertyPanel`（`property-panel.ts:80`）：属性面板 schema
- `validatePropsSchema`（`props-schema.ts:577`）/ `validateValueAgainstSchema`（`:272`）：props schema 与值
- `checkJsonValue`（`json-boundary.ts:23`）/ `checkJsonProps`（`:154`）：JSON 边界
- `validateManifestIdentity`（`identity.ts:68`）+ `extractTypeMajorVersion` / `extractTagNameMajorVersion`：身份与版本
- `validateEvents`（`events.ts:16`）：事件定义
- 全部返 `ScreenComponentValidationResult`（`diagnostic.ts`）

### 35.7 测试工具（`testing.ts`）

- `createMinimalManifest` / `createMinimalPlugin` / `expectManifestOk` / `expectManifestInvalid`：组件 SDK 单测辅助

---

## 36. 重要文件索引

| 关注点 | 主文件 |
|---|---|
| 画布交互核心 | `components/screen-canvas.tsx` |
| Moveable 包装 | `components/moveable-container.tsx` |
| 状态机 | `hooks/use-interaction-state-machine.ts` |
| 工具状态机 | `hooks/use-tool-state-machine.ts` |
| 修饰键 | `hooks/use-modifier-keys.ts` |
| 快捷键绑定 | `hooks/use-keyboard-shortcuts.ts` |
| 快捷键注册 | `hooks/shortcuts-registry.ts` |
| Store | `stores/editor-store.ts` |
| 辅助 stores | `stores/auxiliary-stores.ts` |
| 图层 panel | `components/layer-panel.tsx` |
| 画布右键 | `components/canvas-context-menu.tsx` |
| 工作台布局 | `components/screen-editor-workbench.tsx` |
| 工具栏 | `components/editor-toolbar.tsx` |
| 顶部菜单 | `components/project-menubar.tsx` |
| 工具选择 | `components/tool-selector.tsx` |
| 状态栏 | `components/canvas-status-bar.tsx` |
| 画布设置 | `components/canvas-settings-dialog.tsx` |
| 标尺 | `components/canvas-rulers.tsx` |
| 参考线 | `components/canvas-guides.tsx` |
| 智能对齐 | `lib/smart-guides.ts` + `components/smart-guides-overlay.tsx`（未接线） |
| 缩放 | `lib/zoom-boundary.ts` + `lib/canvas-event-router.ts` |
| 形状几何 | `lib/shape-creation-geometry.ts` |
| finalize/cancel | `lib/finalize-cancel-protocol.ts` |
| rAF 节流 | `lib/raf-throttle.ts` |
| 图片文件 | `lib/image-file-adapter.ts` |
| 组件库 | `components/component-library.tsx` |
| 收藏 | `registry/favorite-components.ts` |
| 最近使用 | `registry/recent-components.ts` |
| 分类元数据 | `registry/category-meta.ts` |
| 组件注册 | `registry/registry.ts` + `registry/registry-factory.ts` + `registry/instance-registry.ts` |
| CE 渲染器 | `registry/custom-element-renderer.tsx` |
| 属性面板 | `components/property-panel.tsx` + `property-schema/schemas.tsx` |
| 全局变量 | `components/global-variables-panel.tsx` |
| 蓝图 Sheet | `blueprint/sheet/blueprint-sheet.tsx` |
| 蓝图节点 | `blueprint/nodes/*` |
| 蓝图边 | `blueprint/edges/exec-edge.tsx` |
| 蓝图编译器 | `blueprint/compiler/compile.ts` + `cycle.ts` + `indexes.ts` |
| 蓝图运行时 | `blueprint/runtime/executor.ts` + `use-blueprint-runtime-deps.ts` + `use-blueprint-preview-runtime.ts` |
| 蓝图模板插值 | `blueprint/lib/template-interpolation.ts` |
| 蓝图请求脱敏 | `blueprint/lib/request-api-mask.ts` |
| 蓝图搜索面板 | `blueprint/panels/search-panel.tsx` |
| 蓝图节点配置 | `blueprint/panels/node-config-panel.tsx` |
| 蓝图条件构造 | `blueprint/panels/condition-builder.tsx` |
| 蓝图执行日志 | `blueprint/panels/execution-log-panel.tsx` |
| 蓝图问题面板 | `blueprint/panels/problems-panel.tsx` |
| 蓝图快捷键 | `blueprint/hooks/use-blueprint-shortcuts.ts` |
| 蓝图剪贴板 | `blueprint/hooks/use-blueprint-clipboard.ts` |
| 蓝图锚点磁吸 | `blueprint/hooks/use-anchor-snap.ts` |
| 蓝图拖拽 | `blueprint/hooks/use-blueprint-drag.ts` |
| 宿主控制 | `host/screen-host-controller.ts` |
| 操作协调 | `host/operation-coordinator.ts` |
| 浏览器导出 | `host/browser-export.ts` |
| 快照 | `adapters/local-snapshot-adapter.ts` |
| Web API 数据 | `apps/web/src/features/screen/hooks/use-api-data-source.ts` |
| Web 数据集 | `apps/web/src/features/screen/hooks/use-dataset-source.ts` |
| Web 数据集表单 | `apps/web/src/features/screen/components/dataset-config-section.tsx` |
| Web 预览 | `apps/web/src/features/screen/components/screen-preview*.tsx` |
| Web 列表 | `apps/web/src/features/screen/components/screen-list-page.tsx` |
| Web JSON 编辑器 | `apps/web/src/features/screen/components/component-json-monaco-editor*.tsx` |
| Web 注册表桥 | `apps/web/src/features/screen/runtime/use-screen-component-registry.ts` |
| 动态设计器元素 | `packages/screen-dynamic-sdk/src/element/nebula-screen-designer-element.ts` |
| 动态查看器元素 | `packages/screen-dynamic-sdk/src/element/nebula-screen-viewer-element.ts` |
| 动态设计器工作台 | `packages/screen-dynamic-sdk/src/components/designer-workbench.tsx` |
| 动态查看器工作台 | `packages/screen-dynamic-sdk/src/components/viewer-workbench.tsx` |
| 动态运行时 | `packages/screen-dynamic-sdk/src/runtime/designer-runtime.tsx` + `viewer-runtime.tsx` |
| 编辑器 Web Component | `packages/screen-sdk/src/element/nebula-screen-editor-element.ts` |
| 编辑器元素运行时 | `packages/screen-sdk/src/runtime/static-runtime.tsx` |
| 组件扩展 SDK 契约 | `packages/screen-component-sdk/src/contracts/*` |
| 组件扩展 SDK 校验 | `packages/screen-component-sdk/src/validation/*` |
