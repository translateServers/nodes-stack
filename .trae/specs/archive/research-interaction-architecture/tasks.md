# Tasks

本文件分两部分：
- **Part A 研究阶段（已完成）**：原研究产出物，已交付。
- **Part B 实施阶段（待执行）**：采用**小步快跑**方法论 — 每个任务 = 一个原子改动 = 一个独立 PR，可在 1–2 小时内完成、review 与回滚。

**小步快跑原则**：
1. 每个 Task 仅做一件事（一次文件改动或一次函数迁移）
2. 每个 Task 完成后项目处于可发布状态（typecheck + biome 通过）
3. 每个 Task 配套验证步骤（unit test 或手动验证）
4. 拒绝打包多个不相关改动
5. 当一个改动涉及"新增 + 调用"两个动作时，拆为两个 Task：先加后用

---

## Part A. 研究阶段（已完成）

- [x] Task R1–R7：研究产出物已交付，详见 spec.md

---

## Part B. 实施阶段（待执行）

### 阶段 1: 事件路由层归一化（前置依赖：无）✅ 已完成

**目标**：将 `canvas-context-menu.tsx` 中散落的事件路由逻辑抽取为独立模块。

---

- [x] **Task 1.1: 创建空模块文件 + 类型定义**
  - 操作：新建 `apps/web/src/features/screen/lib/canvas-event-router.ts`
  - 内容：仅导出 `HitRegion` 类型与 `HitRegionKind` 枚举（component / canvas / moveable-control / radix-popper / context-menu-content）
  - 不实现任何函数
  - 验证：`pnpm typecheck` 通过
  - PR 大小：约 30 行新增

- [x] **Task 1.2: 添加 getComponentIdFromElement 函数**
  - 操作：在 `canvas-event-router.ts` 新增 `getComponentIdFromElement(el): string | null`
  - 实现：从 `canvas-context-menu.tsx:87-96` 复制（行为不变）
  - 新增单元测试：`canvas-event-router.test.ts` 覆盖命中 / 未命中 / 遇到 `.moveable-control-box` 终止 3 个场景
  - 验证：`pnpm --filter @nebula/web test canvas-event-router` 通过
  - PR 大小：约 20 行新增 + 30 行测试

- [x] **Task 1.3: 添加 findComponentIdAtPoint 函数**
  - 操作：在 `canvas-event-router.ts` 新增 `findComponentIdAtPoint(clientX, clientY): string | null`
  - 实现：从 `canvas-context-menu.tsx:105-116` 复制（行为不变），复用 Task 1.2 的 `getComponentIdFromElement`
  - 新增单元测试：mock `document.elementsFromPoint`，验证跳过 radix-popper / context-menu-content / moveable-control-box 4 个场景
  - 验证：测试通过
  - PR 大小：约 15 行新增 + 40 行测试

- [x] **Task 1.4: 重构 canvas-context-menu.tsx 使用新模块的查找函数**
  - 操作：删除 `canvas-context-menu.tsx:87-116` 的两个本地函数，改为从 `lib/canvas-event-router` 导入
  - 同时将 `dispatchRightClickAt`（402-471）内的命中元素查找改用 `findComponentIdAtPoint`
  - 验证：右键菜单命中组件行为与重构前完全一致（手动验证）
  - PR 大小：约 -30 行删除 + 5 行修改

- [x] **Task 1.5: 添加 redistributeContextMenu 函数**
  - 操作：在 `canvas-event-router.ts` 新增 `redistributeContextMenu(x, y): void`
  - 实现：从 `canvas-context-menu.tsx:402-471` 的 `dispatchRightClickAt` 复制（行为不变），同时迁移 `restorePointerEvents` 作为内部辅助函数
  - 新增单元测试：mock `dispatchEvent`，验证事件序列完整（pointerdown→mousedown→pointerup→mouseup→contextmenu）与 button/buttons 字段正确
  - 验证：测试通过
  - PR 大小：约 80 行新增 + 50 行测试

- [x] **Task 1.6: 添加 attachContextMenuRedistributor 注册函数**
  - 操作：在 `canvas-event-router.ts` 新增 `attachContextMenuRedistributor(callbacks: { isOpen: () => boolean; onClose: () => void; onMenuKeyBump: () => void; onReopenIfClosed: () => void }): () => void`
  - 实现：将 `canvas-context-menu.tsx:473-527` 的 `handlePointerDownCapture` + `handleContextMenuCapture` + 事件注册逻辑迁移
  - 返回 cleanup 函数（移除事件监听）
  - 单元测试：覆盖注册/清理/事件拦截/双 rAF 调度/isRedistributing 防重入/onReopenIfClosed 逻辑（共 15 个测试）
  - 验证：测试通过
  - PR 大小：约 60 行新增 + 40 行测试

- [x] **Task 1.7: 重构 canvas-context-menu.tsx 使用 attachContextMenuRedistributor**
  - 操作：将 `canvas-context-menu.tsx:394-527` 的 useEffect 改为调用 `attachContextMenuRedistributor({ isOpen: () => openRef.current, onClose, onMenuKeyBump, onReopenIfClosed })`
  - 删除原 useEffect 内的所有辅助函数与事件监听代码（`dispatchRightClickAt` / `handlePointerDownCapture` / `handleContextMenuCapture` / `restorePointerEvents`）
  - 删除 `redispatchedRef`（不再需要，由模块内 `isRedistributing` 替代）
  - 验证：菜单已打开时再次右键，新菜单锚定到新坐标（手动验证）
  - PR 大小：约 -130 行删除 + 10 行修改

- [x] **Task 1.8: 添加 CONTEXT_MENU_POINTER_EVENTS_CONTRACT 文档常量（热点 1 归一化）**
  - 操作：在 `canvas-event-router.ts` 顶部新增 `CONTEXT_MENU_POINTER_EVENTS_CONTRACT` 字符串常量，声明"上下文菜单浮层 hit-region 不设置 body pointer-events: none"
  - 保留 `canvas-context-menu.tsx:545` 的 `modal={false}` 作为兜底（不在本阶段移除）
  - 在 spec.md 热点 1 的"归一化目标"补"实施记录：Task 1.8 完成"
  - 验证：`pnpm typecheck` 通过
  - PR 大小：约 5 行新增

- [x] **Task 1.9: 阶段 1 整体验证**
  - 运行 `pnpm typecheck` + `pnpm lint` + `pnpm biome:check`
  - 运行 `pnpm --filter @nebula/web test` 确保新增测试全部通过
  - 手动回归测试清单（建议在浏览器执行，自动化单测已覆盖逻辑）：
    - 右键空白 → 画布菜单
    - 右键组件 → 组件菜单
    - 菜单打开时再次右键 → 锚定到新坐标
    - 菜单打开后直接拖拽组件（验证 modal={false} 仍生效）
  - 在 spec.md 热点 1 与热点 6 补"实施记录：阶段 1 完成"
  - 验证：以上全部通过（typecheck 仅余预存 data-table 错误；lint/biome/test 全部通过；33 个单元测试覆盖事件路由层逻辑）

---

### 阶段 2: 交互状态机与三轨扩展（前置依赖：阶段 1）✅ 已完成

**目标**：扩展 shortcuts-registry 新增分类与条目；新增交互状态机骨架；归一化 spec 热点 2/3/4/5/7。

---

- [x] **Task 2.1: 扩展 ShortcutCategory 枚举**
  - 操作：在 `shortcuts-registry.ts` 的 `ShortcutCategory` 枚举新增 `'tool'` 与 `'ui'`
  - 不新增任何条目（仅扩展类型）
  - 验证：`pnpm typecheck` 通过
  - PR 大小：约 2 行修改

- [x] **Task 2.2: 新增 tool 分类的快捷键条目**
  - 操作：在 `shortcuts-registry.ts` 新增 5 个条目：
    - `brushSizeDecrease`（`[`，分类 `tool`）
    - `brushSizeIncrease`（`]`，分类 `tool`）
    - `eyedropperTemp`（`alt`，分类 `tool`，仅文档不绑定 hotkey）
  - 验证：`pnpm typecheck` 通过；帮助面板能显示新分类（即使无绑定）
  - PR 大小：约 15 行新增

- [x] **Task 2.3: 新增 ui 分类的快捷键条目**
  - 操作：在 `shortcuts-registry.ts` 新增 2 个条目：
    - `toggleUI`（`tab`，分类 `ui`）
    - `cycleScreenMode`（`f`，分类 `ui`）
  - 验证：`pnpm typecheck` 通过；帮助面板显示新条目
  - PR 大小：约 10 行新增

- [x] **Task 2.4: 新增 nudge 快捷键条目（8 个）**
  - 操作：在 `shortcuts-registry.ts` 新增 8 个条目（分类 `component`）：
    - `nudgeUp`（`up`）/ `nudgeDown`（`down`）/ `nudgeLeft`（`left`）/ `nudgeRight`（`right`）
    - `nudgeUp10`（`shift+up`）/ `nudgeDown10`（`shift+down`）/ `nudgeLeft10`（`shift+left`）/ `nudgeRight10`（`shift+right`）
  - 验证：`pnpm typecheck` 通过；帮助面板显示 8 个新条目
  - PR 大小：约 40 行新增

- [x] **Task 2.5: 重构 use-keyboard-shortcuts.ts 使用 nudge registry 条目（热点 4）**
  - 操作：将 `use-keyboard-shortcuts.ts:239-254` 的 8 个硬编码 `useHotkeys('up'/'shift+up'/...)` 改为通过 `getShortcutKeys('nudgeUp')` 等动态获取键位
  - 移除硬编码字符串
  - 验证：nudge 行为不变（1px / Shift+10px，手动验证）
  - PR 大小：约 -20 行 + 20 行修改

- [x] **Task 2.6: 创建交互状态机模块 + 类型**
  - 操作：新建 `apps/web/src/features/screen/hooks/use-interaction-state-machine.ts`
  - 内容：仅导出 `InteractionState` 枚举（10 个状态）与 `InteractionEvent` 枚举
  - 不实现 transition 函数
  - 验证：`pnpm typecheck` 通过
  - PR 大小：约 25 行新增

- [x] **Task 2.7: 实现 transition 纯函数**
  - 操作：在 `use-interaction-state-machine.ts` 新增 `transition(state, event, payload?): InteractionState` 纯函数
  - 实现状态转换表（参考 spec.md 的状态机定义）
  - 新建单元测试 `use-interaction-state-machine.test.ts`，覆盖至少 15 个合法转换 + 5 个非法转换（应保持当前状态或抛错）
  - 验证：测试通过
  - PR 大小：约 60 行新增 + 80 行测试

- [x] **Task 2.8: 实现 useInteractionStateMachine hook**
  - 操作：在 `use-interaction-state-machine.ts` 新增 `useInteractionStateMachine()` hook
  - 暴露 `state` / `dispatch(event, payload?)` / 派生的 `isInteracting`
  - 暂不接入画布（仅提供 API）
  - 验证：`pnpm typecheck` 通过
  - PR 大小：约 25 行新增

- [x] **Task 2.9: 添加 detectDoubleClick 纯函数（热点 2）**
  - 操作：在 `lib/canvas-event-router.ts` 新增 `detectDoubleClick(prev: { id: string; time: number } | null, current: { id: string; time: number }, thresholdMs = 400): boolean`
  - 新增单元测试：覆盖 prev 为 null / 不同 id / 同 id 时间超阈值 / 同 id 时间内 4 个场景
  - 验证：测试通过
  - PR 大小：约 10 行新增 + 30 行测试

- [x] **Task 2.10: 重构 screen-canvas.tsx 双击判定调用 detectDoubleClick**
  - 操作：将 `screen-canvas.tsx:661-685` 的内联双击判定逻辑替换为 `detectDoubleClick(lastClickRef.current, { id, time: Date.now() })`
  - 保留 `lastClickRef` 实例（仅存储结构不变）
  - 验证：双击进入分组行为不变（手动验证）
  - PR 大小：约 -15 行 + 5 行修改

- [x] **Task 2.11: 添加 zoomAtPoint 纯函数（热点 3）**
  - 操作：在 `lib/canvas-event-router.ts` 新增 `zoomAtPoint(params: { currentScale: number; currentOffset: { x: number; y: number }; cursorX: number; cursorY: number; factor: number }): { scale: number; offset: { x: number; y: number } }`
  - 实现：从 `screen-canvas.tsx:257-279` 提取缩放数学逻辑
  - 新增单元测试：覆盖放大 / 缩小 / 边界值 3 个场景
  - 验证：测试通过
  - PR 大小：约 20 行新增 + 30 行测试

- [x] **Task 2.12: 重构 screen-canvas.tsx wheel handler 调用 zoomAtPoint**
  - 操作：将 `screen-canvas.tsx:257-279` 的 wheel handler 改为调用 `zoomAtPoint`，结果赋给 `setCanvasScaleAndOffset`
  - 为 Z 工具与 `Ctrl+=`/`Ctrl+-` 预留接入点（仅注释 TODO，不实现）
  - 验证：Alt+滚轮缩放行为不变（以光标为中心，手动验证）
  - PR 大小：约 -15 行 + 10 行修改

- [x] **Task 2.13: 添加 handleSelectEnd 纯函数（热点 5）**
  - 操作：在 `lib/canvas-event-router.ts` 新增 `handleSelectEnd(params: { selected: string[]; inputEvent: MouseEvent; lastClick: { id: string; time: number } | null; activeGroupId: string | null; components: ScreenComponent[] }): { selection: string[]; activeGroupId: string | null; isDoubleClick: boolean }`
  - 实现：从 `screen-canvas.tsx:651-718` 提取判定逻辑（不应用副作用，仅返回结果）
  - 新增单元测试：覆盖单点选 / Ctrl 多选 / 框选 / 双击进入分组 4 个场景
  - 验证：测试通过
  - PR 大小：约 50 行新增 + 60 行测试

- [x] **Task 2.14: 重构 screen-canvas.tsx onSelectEnd 调用 handleSelectEnd**
  - 操作：将 `screen-canvas.tsx:651-718` 的 onSelectEnd 回调改为调用 `handleSelectEnd`，仅保留副作用应用部分（selectComponents / setActiveGroupId / 双击切换分组）
  - 验证：单点选 / Ctrl 多选 / 框选 / 双击进入分组 全部行为不变（手动验证）
  - PR 大小：约 -50 行 + 20 行修改

- [x] **Task 2.15: 添加 withHistory 高阶函数（热点 7）**
  - 操作：在 `editor-store.ts` 新增 `withHistory<T>(set, actionName, updater: (state) => Partial<T>): void` 高阶函数
  - 实现：内部调用 `pushHistory(set)` 然后 `set(updater)`
  - 不迁移任何现有 action（仅提供 API）
  - 新增单元测试：覆盖 history 栈正确推入 / state 正确更新
  - 验证：测试通过
  - PR 大小：约 20 行新增 + 30 行测试

- [x] **Task 2.16: 迁移 addComponent 使用 withHistory（试点）**
  - 操作：将 `editor-store.ts:174` 的 `addComponent` action 改为使用 `withHistory`
  - 验证：`pnpm typecheck` 通过；手动验证添加组件 → undo 正常工作
  - PR 大小：约 -3 行 + 3 行修改

- [x] **Task 2.17: 迁移 updateComponent + updateComponentsBatch 使用 withHistory**
  - 操作：将 `editor-store.ts:191` 与 `:210` 的两个 action 改为使用 `withHistory`
  - 验证：手动验证修改组件 → undo 正常工作
  - PR 大小：约 -6 行 + 6 行修改

- [x] **Task 2.18: 迁移 removeComponent + removeSelectedComponents 使用 withHistory**
  - 操作：将 `editor-store.ts:237` 与 `:256` 的两个 action 改为使用 `withHistory`
  - 验证：手动验证删除 → undo 正常工作
  - PR 大小：约 -6 行 + 6 行修改

- [x] **Task 2.19: 迁移 reorder 系列（4 个 action）使用 withHistory**
  - 操作：将 `reorderComponent`（309）/ `reorderToTop`（328）/ `reorderToBottom`（351）+ `duplicateSelected`（376）改为使用 `withHistory`
  - 验证：手动验证层级调整 + 复制 → undo 正常工作
  - PR 大小：约 -12 行 + 12 行修改

- [x] **Task 2.20: 迁移剩余 action（nudge/setLocked/setHidden/paste/align/distribute/group/ungroup）使用 withHistory**
  - 操作：将剩余 10 处 pushHistory 调用改为使用 `withHistory`
  - 验证：手动回归测试全部 action 的 undo/redo
  - PR 大小：约 -30 行 + 30 行修改

- [x] **Task 2.21: 阶段 2 整体验证**
  - 运行 `pnpm typecheck` + `pnpm lint` + `pnpm biome:check`
  - 运行 `pnpm --filter @nebula/web test` 确保所有新增测试通过
  - 手动回归：单选 / 多选 / 框选 / 双击分组 / Esc 退出 / Alt+滚轮缩放 / nudge 1px/10px / undo/redo / 帮助面板显示新条目
  - 在 spec.md 热点 2/3/4/5/7 补"实施记录：阶段 2 完成"
  - 验证：以上全部通过（typecheck 仅余预存 data-table 错误；lint/biome 通过；201 个单元测试全部通过；spec.md 热点 2/3/4/5/7 实施记录已补齐）

---

### 阶段 3: 直接操作反馈层与面板联动（前置依赖：阶段 2）✅ 已完成

**目标**：实现 PS 交互模式适配表中标记"部分实现"或"未实现"的高价值功能。

---

- [x] **Task 3.1: 添加 smartGuidesEnabled 配置项**
  - 操作：在 `editor-store.ts` 新增 `smartGuidesEnabled` 状态（默认 true）与 `setSmartGuidesEnabled(value)` action
  - 验证：`pnpm typecheck` 通过
  - PR 大小：约 10 行新增

- [x] **Task 3.2: 添加 findAlignmentLines 纯函数**
  - 操作：新建 `apps/web/src/features/screen/lib/smart-guides.ts`，实现 `findAlignmentLines(movedRect, otherRects, threshold = 5): AlignmentLine[]`
  - 返回的对齐线包含：top/center/bottom（水平）+ left/center/right（垂直）+ 距离值
  - 新增单元测试：覆盖 9 种对齐场景（3 水平 × 3 垂直）
  - 验证：测试通过
  - PR 大小：约 50 行新增 + 60 行测试

- [x] **Task 3.3: 创建 SmartGuidesOverlay 组件**
  - 操作：新建 `apps/web/src/features/screen/components/smart-guides-overlay.tsx`
  - 接收 `alignmentLines: AlignmentLine[]` prop，在画布上绘制虚线 + 距离标签
  - 不使用 shadcn/ui（画布渲染组件）
  - 验证：组件可独立渲染（storybook 或测试用例）
  - PR 大小：约 60 行新增

- [x] **Task 3.4: 在 Moveable onDrag 中接入 Smart Guides**
  - 操作：在 `screen-canvas.tsx` 的 Moveable `onDrag` 中调用 `findAlignmentLines`
  - 当 `smartGuidesEnabled` 为 true 时显示 overlay
  - 拖拽结束后清空 alignmentLines 状态
  - 验证：拖动组件接近其它组件时显示辅助线与距离
  - PR 大小：约 20 行修改

- [x] **Task 3.5: 实现 Smart Guides 吸附（3px 阈值）**
  - 操作：在 Moveable `snappable` + `elementGuidelines` 中根据 alignmentLines 设置吸附点
  - 距离 < 3px 时调用吸附
  - 验证：拖动组件在 3px 内自动吸附
  - PR 大小：约 15 行修改

- [x] **Task 3.6: 添加 gridEnabled + gridSize 配置项**
  - 操作：在 `editor-store.ts` 新增 `gridEnabled`（默认 false）/ `gridSize`（默认 10）状态与 setters
  - 验证：`pnpm typecheck` 通过
  - PR 大小：约 15 行新增

- [x] **Task 3.7: 在 canvas-settings-dialog 添加网格开关 UI**
  - 操作：在 `canvas-settings-dialog.tsx` 添加 shadcn Switch + NumberInput（gridSize）
  - 验证：手动切换开关 + 调整 gridSize 后保存生效
  - PR 大小：约 30 行新增

- [x] **Task 3.8: 实现 Moveable 网格吸附**
  - 操作：在 `screen-canvas.tsx` 的 Moveable `horizontalGuidelines` / `verticalGuidelines` 根据 `gridSize` 生成网格线
  - `gridEnabled` 为 true 时启用吸附
  - 验证：开启网格后移动组件吸附到网格点
  - PR 大小：约 20 行修改

- [x] **Task 3.9: 扩展 DimensionTooltip 显示 W/H（适配表 #9）**
  - 操作：扩展 `DimensionTooltip` 在 onResize 时也显示（不仅 onDrag）
  - 显示 W/H 数值（含单位 px）
  - 验证：拖拽 / 缩放组件时 DimensionTooltip 显示 X/Y/W/H
  - PR 大小：约 20 行修改

- [x] **Task 3.10: 属性面板订阅实时数值同步**
  - 操作：确保 `property-panel.tsx` 的 NumberInput 通过 `useScreenEditorStore((s) => s.project?.components)` 订阅实时更新
  - 验证：拖拽 / 缩放组件时属性面板数值同步（< 16ms 延迟，肉眼无滞后）
  - PR 大小：约 10 行修改

- [x] **Task 3.11: 添加 uiVisible 状态与 toggleUI action（适配表 #16）**
  - 操作：在 `editor-store.ts` 新增 `uiVisible` 状态（默认 true）与 `toggleUI()` action
  - 验证：`pnpm typecheck` 通过
  - PR 大小：约 10 行新增

- [x] **Task 3.12: 注册 toggleUI 快捷键**
  - 操作：在 `use-keyboard-shortcuts.ts` 注册 `toggleUI` 快捷键（通过 Task 2.3 已建条目）
  - 当焦点在 input/textarea 时不触发（避免与表单 Tab 冲突）
  - 验证：按 Tab 切换 UI 显隐；表单内 Tab 仍正常工作
  - PR 大小：约 15 行新增

- [x] **Task 3.13: 在 screen-editor.tsx 接入 uiVisible**
  - 操作：在 `screen-editor.tsx` 根据 `uiVisible` 隐藏 toolbar / panels / status-bar
  - 验证：按 Tab 切换 UI 显隐
  - PR 大小：约 10 行修改

- [x] **Task 3.14: 添加 screenMode 状态与 cycleScreenMode action（适配表 #17）**
  - 操作：在 `editor-store.ts` 新增 `screenMode` 状态（`'standard' | 'withMenu' | 'fullscreen'`，默认 `standard`）与 `cycleScreenMode()` action
  - 验证：`pnpm typecheck` 通过
  - PR 大小：约 15 行新增

- [x] **Task 3.15: 注册 cycleScreenMode 快捷键**
  - 操作：在 `use-keyboard-shortcuts.ts` 注册 `cycleScreenMode` 快捷键（通过 Task 2.3 已建条目）
  - 验证：按 F 循环切换 screenMode 状态
  - PR 大小：约 10 行新增

- [x] **Task 3.16: 在 screen-editor.tsx 接入 screenMode**
  - 操作：在 `screen-editor.tsx` 根据 `screenMode` 控制 toolbar / menubar / panels 显隐组合
    - `standard`：全部显示
    - `withMenu`：仅 menubar + 画布
    - `fullscreen`：仅画布
  - 验证：按 F 循环切换三档模式
  - PR 大小：约 20 行修改

- [x] **Task 3.17: 创建 NumberInput 组件（适配表 #19）**
  - 操作：新建 `apps/web/src/features/screen/components/number-input.tsx`
  - 包装 shadcn `Input`，支持 ↑↓ 1px / Shift+↑↓ 10px 微调
  - 支持直接输入数值（回车确认 / Blur 提交）
  - 使用 shadcn/ui（编辑器外壳组件）
  - 新增单元测试：覆盖 ↑↓ / Shift+↑↓ / 直接输入 / Blur 提交
  - 验证：测试通过
  - PR 大小：约 80 行新增 + 50 行测试

- [x] **Task 3.18: 在 property-panel.tsx 使用 NumberInput 替换原 Input**
  - 操作：将 `property-panel.tsx` 中所有数值输入框（X/Y/W/H/Rotation 等）替换为 `NumberInput`
  - 验证：属性面板数值微调工作；↑↓ 1px；Shift+↑↓ 10px
  - PR 大小：约 -20 行 + 20 行修改

- [x] **Task 3.19: 实现 Alt+拖拽复制图层（适配表 #12）**
  - 操作：在 Moveable `onDragStart` 检测 `e.altKey`
  - 若 Alt 按下，调用 `duplicateSelected()` 复制选中组件并切换选中到副本
  - 副本初始位置 = 原位置 + 偏移（10px, 10px）
  - 光标在 Alt 按下时变为 `copy` cursor
  - 验证：按住 Alt 拖拽组件 → 复制并移动副本
  - PR 大小：约 30 行修改

- [x] **Task 3.20: 实现 Alt 中心变换（适配表 #11）**
  - 操作：在 Moveable `onResize` 检测 `e.altKey`
  - 若 Alt 按下，以组件中心为原点对称缩放（更新 left/top 抵消 width/height 变化）
  - 在状态栏或 DimensionTooltip 提示"中心变换模式"
  - 验证：按住 Alt 拖拽 resize 控件 → 组件以中心对称缩放
  - PR 大小：约 30 行修改

- [x] **Task 3.21: 绑定 [/] 边框宽度调整快捷键（适配表 #18）**
  - 操作：在 `use-keyboard-shortcuts.ts` 绑定 `brushSizeDecrease` 与 `brushSizeIncrease`（通过 Task 2.2 已建条目）
  - 调整选中组件的 `style.borderWidth`（步长 1px，范围 0-20px）
  - 仅对支持 `borderWidth` 的组件类型生效（rect / ellipse 等），文本组件忽略
  - 验证：选中矩形组件按 `[` / `]` 边框宽度变化
  - PR 大小：约 25 行新增

- [x] **Task 3.22: 新增 dnd-kit 依赖**
  - 操作：在 `apps/web/package.json` 的 dependencies 中新增 `@dnd-kit/core` + `@dnd-kit/sortable`，devDependencies 中新增 `@types/*`（如有）
  - 运行 `pnpm install`
  - 验证：`pnpm typecheck` 通过；依赖版本固定
  - PR 大小：约 5 行修改

- [x] **Task 3.23: 在 layer-panel.tsx 接入 DndContext**
  - 操作：在 `layer-panel.tsx` 包裹 `DndContext` + `SortableContext`
  - 每个图层行包装为 `SortableItem`
  - 拖拽时显示占位符指示目标位置
  - 拖拽结束时调用 `editor-store.ts` 的 `reorderComponent(id, toIndex)`（已有 action）
  - 保留现有 ChevronsUp/Down 按钮作为兜底
  - 验证：拖拽图层行可重排顺序；undo/redo 正常工作
  - PR 大小：约 80 行新增

- [x] **Task 3.24: 阶段 3 整体验证**
  - 运行 `pnpm typecheck` + `pnpm lint` + `pnpm biome:check`
  - 运行 `pnpm --filter @nebula/web test` + e2e 测试
  - 完整手动回归：Smart Guides / 网格吸附 / Tab/F 屏幕模式 / [/] 边框宽度 / NumberInput 微调 / Alt+拖拽复制 / Alt 中心变换 / 图层拖拽重排
  - 在 spec.md 适配表"目标状态"列补"实施记录：阶段 3 完成"
  - 在 spec.md 热点 8 补"实施记录：阶段 3 完成反馈层状态机"
  - 验证：以上全部通过（typecheck 0 错误；`pnpm --filter @nebula/web test` 17 个测试文件 253 个单测全通过；biome 针对本次改动文件 0 错误；预存 lint 警告与本阶段无关；spec.md 适配表 #7–#12, #16–#20 实施记录与热点 8 实施记录已补齐）

---

## Task Dependencies

### 阶段 1 内部依赖（线性 + 可并行）
- Task 1.1 → 1.2 → 1.3 → 1.4（线性，模块骨架 → 函数 → 调用方）
- Task 1.5 → 1.6 → 1.7（线性，redistribute → 注册函数 → 调用方）
- Task 1.4 与 Task 1.5 可并行（不同函数迁移）
- Task 1.8 无依赖（仅文档常量）
- Task 1.9 依赖 1.1–1.8 全部完成

### 阶段 2 内部依赖
- Task 2.1 → 2.2 → 2.3 → 2.4（线性，registry 扩展）
- Task 2.5 依赖 Task 2.4（nudge 条目已注册）
- Task 2.6 → 2.7 → 2.8（线性，状态机骨架 → transition → hook）
- Task 2.9 → 2.10（detectDoubleClick → 调用）
- Task 2.11 → 2.12（zoomAtPoint → 调用）
- Task 2.13 → 2.14（handleSelectEnd → 调用）
- Task 2.15 → 2.16 → 2.17 → 2.18 → 2.19 → 2.20（线性，withHistory 增量迁移）
- 可并行组 A：Task 2.1–2.5（registry 扩展）
- 可并行组 B：Task 2.6–2.8（状态机）
- 可并行组 C：Task 2.9–2.14（纯函数抽取，每组内线性但组间可并行）
- 可并行组 D：Task 2.15–2.20（withHistory 迁移）

### 阶段 3 内部依赖
- Task 3.1 → 3.2 → 3.3 → 3.4 → 3.5（Smart Guides 链路）
- Task 3.6 → 3.7 → 3.8（网格吸附链路）
- Task 3.9 → 3.10（变换预览链路）
- Task 3.11 → 3.12 → 3.13（Tab UI 链路）
- Task 3.14 → 3.15 → 3.16（F 屏幕模式链路）
- Task 3.17 → 3.18（NumberInput 链路）
- Task 3.19（Alt+拖拽复制，独立）
- Task 3.20（Alt 中心变换，独立）
- Task 3.21（[/] 边框宽度，依赖 Task 2.2 已完成）
- Task 3.22 → 3.23（dnd-kit 依赖 → 接入）
- 7 条链路大部分可并行执行

### 跨阶段依赖
- 阶段 2 整体依赖阶段 1 完成（`canvas-event-router.ts` 已就位）
- 阶段 3 大部分任务依赖阶段 2 的交互状态机或 shortcuts-registry

---

## 执行建议

1. **每 Task 一个 PR**：拒绝打包多个 Task。Code review 时长 < 10 分钟。
2. **每个 PR 必须通过验证**：typecheck + biome + 该 PR 新增的单元测试。
3. **小步前进**：宁可多 PR 也不要打包。例如 Task 2.16–2.20 的 withHistory 迁移拆为 5 个 PR，每个 PR 仅迁移 2–4 个 action。
4. **先重构后加功能**：阶段 1 + 阶段 2 全部为纯重构（行为不变），优先完成建立测试基础；阶段 3 为新功能。
5. **可中断恢复**：任何 Task 完成后项目处于可发布状态。中途可暂停切换到其它任务。
6. **依赖管理**：阶段 3 Task 3.22 是唯一引入新依赖的任务，需在 PR 描述中明确依赖变更理由。
