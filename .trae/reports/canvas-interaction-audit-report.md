# 大屏设计器画布交互系统性检查与优化方案

## 检查范围

本次检查覆盖大屏设计器画布相关的所有单用户交互功能，包括：
- 快捷键操作（40+ 条注册快捷键）
- 工具按钮及交互元素（工具选择器、右键菜单、状态栏、项目菜单栏）
- 画布交互状态机与工具切换逻辑
- 选择、拖拽、缩放、旋转等核心交互
- 文本编辑、形状创建、图片创建、颜色采样等工具行为

---

## 问题清单（按严重程度分类）

### 高优先级问题（影响功能正确性）

#### H1. 右键菜单状态仲裁与交互状态机不同步
**位置**: `canvas-context-menu.tsx:359-367`
**问题**: `canOpenContextMenu` 硬编码允许的状态列表（idle/hovering/marquee-selecting/context-menu-open），与交互状态机的状态定义未建立同步机制。未来新增互斥状态时，两处可能不一致。
**修复建议**: 在 `use-interaction-state-machine.ts` 中导出 `CONTEXT_MENU_ALLOWED_STATES` 常量，右键菜单直接引用，确保单一数据源。
**状态**: 已完成。已导出 `CONTEXT_MENU_ALLOWED_STATES` 和 `SELECTO_ALLOWED_STATES` 常量，并替换 `canvas-context-menu.tsx` 和 `screen-canvas.tsx` 中所有硬编码状态判断（共10处）。

#### H2. 微移快捷键未检查组件锁定状态
**位置**: `use-keyboard-shortcuts.ts:317-388`
**问题**: 方向键微移（nudgeUp/Down/Left/Right 及 10px 版本）直接调用 `store.nudgeSelected()`，未在快捷键层检查选中组件是否被锁定。虽然 store 层 `nudgeSelected` 会过滤锁定组件，但用户按下方向键时无法感知操作被部分拒绝。
**修复建议**: 在快捷键回调中增加前置检查，若所有选中组件均被锁定则直接返回（可配合 toast 提示"选中组件已锁定"）。
**状态**: 已完成。已添加 `nudgeWithLockCheck` 函数，在 8 个微移快捷键回调中前置检查选中组件是否全部锁定。

#### H3. 项目菜单栏"全选"未过滤锁定/隐藏组件
**位置**: `project-menubar.tsx:148-153`
**问题**: `handleSelectAll` 直接选中所有组件，包括锁定和隐藏组件。与 `use-keyboard-shortcuts.ts` 中 `selectAll` 快捷键的行为不一致（后者过滤了锁定和隐藏）。
**修复建议**: 统一两处逻辑，均过滤 `!c.status.locked && !c.status.hidden`。
**状态**: 已完成。已修改 `project-menubar.tsx` 的 `handleSelectAll`，与快捷键 `selectAll` 行为一致，均过滤锁定和隐藏组件。

#### H4. Space 临时抓手 keyup 绑定未检查表单焦点
**位置**: `use-keyboard-shortcuts.ts:546-556`
**问题**: `popTemporaryTool('hand')` 的 keyup 绑定未检查 `isFormElementFocused()`。若用户在输入框中按下 Space 然后释放，临时抓手会被错误弹出。
**修复建议**: keyup 回调中增加 `if (isFormElementFocused()) return;` 前置检查。
**状态**: 已完成。已在 keyup 回调中增加 `isFormElementFocused()` 检查，防止在输入框中按下 Space 后释放时错误弹出临时工具。

#### H5. 右键菜单重定位逻辑存在竞态条件
**位置**: `canvas-event-router.ts:256-315` 与 `canvas-context-menu.tsx:428-454`
**问题**: `attachContextMenuRedistributor` 依赖 `flushSync` + 双 `rAF` + `setTimeout(50)` 的复杂时序，在高负载或低性能设备上可能出现：
- 菜单闪烁（hideExistingContent 后未能及时重建）
- 事件重派发失败（Radix 未接收到重派事件）
- `isRedistributing` 标志在异常情况下未复位
**修复建议**: 
1. 增加 `isRedistributing` 的异常安全复位（如 `try/finally` 或超时兜底）
2. 考虑用 `requestIdleCallback` 替代 `setTimeout(50)` 减少主线程阻塞
3. 对 `flushSync` 的使用增加注释说明其必要性，避免未来被误删
**状态**: 已完成。已使用 `requestIdleCallback` 替代 `setTimeout(50)`，并添加 100ms 超时兜底，确保 `isRedistributing` 在极端繁忙场景下仍能复位。

### 中优先级问题（影响体验一致性）

#### M1. Escape 键在文本编辑态的双重效果
**位置**: `use-keyboard-shortcuts.ts:297-314`
**问题**: `clearSelectionEntry` 在 `text-editing` 状态下同时派发 `escape` 到交互状态机并操作 store 清空选中。由于 `canvasEnabled` 在 `isEditingText` 时为 false，此分支实际不会触发，但代码逻辑上存在隐患：若未来 `canvasEnabled` 逻辑变更，可能导致文本编辑中按 Escape 同时清空选中。
**修复建议**: 明确在回调开头判断 `if (isEditingText) return;`，使防御逻辑显式化。
**状态**: 已完成。已在 `clearSelectionEntry` 回调开头显式增加 `if (isEditingText) return` 防御。

#### M2. 工具切换快捷键未判断当前工具
**位置**: `use-keyboard-shortcuts.ts:481-522`
**问题**: 7 个工具切换快捷键（V/H/T/R/E/I/Z）在 `canvasEnabled` 时直接调用 `setTool`，未判断当前是否已处于该工具。重复按下同一快捷键会触发不必要的工具切换（虽然 `setTool` 内部会清空临时栈，但会触发 `clearSelection`）。
**修复建议**: 在回调中增加 `if (editorSession.activeTool === 'select') return;` 类判断，避免重复切换。
**状态**: 已完成。已在 7 个工具切换快捷键回调中增加当前工具判断，避免重复切换触发不必要的 `clearSelection`。

#### M3. 拖拽/缩放/旋转结束事件缺乏防御性检查
**位置**: `screen-canvas.tsx:1204-1232, 1300-1322, 1356-1372`
**问题**: `onDragEnd`/`onResizeEnd`/`onRotateEnd` 中直接读取 `e.datas.id` 和 `e.lastEvent`，若事件不完整（如被异常中断）可能导致崩溃。虽然 `if (!e.isDrag) return` 提供了部分保护，但 `e.isDrag` 为 true 时 `lastEvent` 仍可能为 undefined。
**修复建议**: 增加对 `e.datas` 和 `e.lastEvent` 的防御性检查，如 `if (!datas.id || !last) return;`。
**状态**: 已完成。已在 `onDragEnd`/`onResizeEnd`/`onRotateEnd`/`onDragGroupEnd`/`onResizeGroupEnd` 中增加防御性检查，包括 ids 存在性、updates 数量与期望不一致时的警告日志。

#### M4. 组操作批量更新未校验所有事件有效性
**位置**: `screen-canvas.tsx:1403-1429, 1455-1479`
**问题**: `onDragGroupEnd`/`onResizeGroupEnd` 中 `e.events.map(...)` 过滤 null 后直接调用 `updateComponentsBatch`，若部分组件更新失败（如组件在拖拽期间被删除），可能导致状态不一致。
**修复建议**: 在 `updateComponentsBatch` 调用前检查 `updates.length` 是否与 `e.events.length` 一致，若不一致可记录警告或采取补偿措施。
**状态**: 已完成。已在 `onDragGroupEnd`/`onResizeGroupEnd` 中增加 `updates.length` 与期望数量的一致性检查，不一致时输出警告日志，并仅在 `updates.length > 0` 时调用 `updateComponentsBatch`。

#### M5. 双击检测未考虑鼠标轨迹
**位置**: `canvas-event-router.ts:345-354`
**问题**: `detectDoubleClick` 仅基于时间阈值（400ms）和组件 ID 判定双击，未考虑鼠标位置偏移。用户可能在 400ms 内点击同一组件的不同位置，被误判为双击。
**修复建议**: 增加位置偏移阈值（如 5px），在 `ClickRecord` 中记录坐标，判定双击时同时校验位置偏移。
**状态**: 已完成。已在 `ClickRecord` 中增加可选 `x`/`y` 坐标，`detectDoubleClick` 增加 5px 位置偏移阈值，`handleSelectEnd` 接收并传递 `clientX`/`clientY`。

#### M6. 吸管工具未处理状态转换
**位置**: `screen-canvas.tsx:752-755`
**问题**: `handlePanStart` 中 `activeTool === 'eyedropper'` 时直接调用 `handleEyedropperClick`，未派发 `start-sample` 到交互状态机，与缩放工具（派发 `start-zoom`/`end-zoom`）的行为不一致。
**修复建议**: 在 `handleEyedropperClick` 开头派发 `start-sample`，采样完成后派发 `end-sample`。
**状态**: 已完成。已在 `handleEyedropperClick` 中增加 `start-sample`/`end-sample` 派发，与缩放工具行为一致。

### 低优先级问题（优化空间）

#### L1. 拖拽/缩放过程未做节流
**位置**: `screen-canvas.tsx:1186-1203, 1258-1298`
**问题**: `onDrag`/`onResize` 中频繁调用 `updateAlignmentLines` 和 `setDimension`，未做节流处理，在低端设备上可能造成性能瓶颈。
**修复建议**: 对 `updateAlignmentLines` 和 `setDimension` 的调用使用 `requestAnimationFrame` 节流，或按时间间隔（如 16ms）节流。
**状态**: 已完成。新增 `lib/raf-throttle.ts`（`createRafThrottler`，schedule/flush/cancel/pending 契约），`onDrag`/`onResize`/`onRotate` 同步提取事件值后将副作用（对齐线计算、尺寸提示更新、DOM style 写入）合并到下一帧执行，同帧多次事件仅生效最后一次。手势结束处理器按读取来源分别处理：`onDragEnd` 用 `cancel()`（最终值取自 `e.lastEvent`），`onResizeEnd`/`onRotateEnd` 用 `flush()`（最终值从 DOM style 读取，需先落地最后一帧）；组件卸载时自动 cancel。组拖拽/组缩放不做节流（过程中无 store 更新，仅 style 写入，开销极低）。新增 8 个节流器单元测试。

#### L2. Smart Guides 计算未检查启用状态
**位置**: `screen-canvas.tsx:972-984`
**问题**: `smartGuidesReferenceRects` 的 memo 计算未检查 `smartGuidesEnabled`，当功能禁用时仍执行不必要的 filter/map 计算。
**修复建议**: 在 memo 开头增加 `if (!smartGuidesEnabled) return [];`。
**状态**: 已完成。已在 memo 开头增加 `smartGuidesEnabled` 前置检查，并将 `smartGuidesEnabled` 加入依赖数组。

#### L3. 交互状态机非法转换诊断信息可能过于频繁
**位置**: `use-interaction-state-machine.ts:266-271`
**问题**: 开发环境下每次非法转换都输出 `console.warn`，在复杂交互中可能产生大量噪声。
**修复建议**: 增加节流或去重机制，如相同 (state, event) 组合在一定时间内只警告一次。
**状态**: 已完成。已实现 1000ms 时间窗口去重（`warnIllegalTransition` + `ILLEGAL_TRANSITION_WARN_WINDOW_MS`），相同 (state, event) 组合窗口内仅警告一次；导出 `resetIllegalTransitionWarnCache` 供测试使用。新增 3 个去重行为单元测试（窗口内去重、组合独立、窗口过期后再次警告）。

#### L4. 工具选择器禁用态判断不准确
**位置**: `tool-selector.tsx:37`
**问题**: `isDisabled = !tool.implemented` 仅判断实现状态，未考虑工具能力（如 `canSelect`/`canDrag` 等）。未来若有工具部分能力禁用，按钮状态可能不准确。
**修复建议**: 当前所有工具均已实现，此问题暂不紧急。未来扩展时可考虑基于 `capabilities` 综合判断。
**状态**: 不实施（现状核查）。当前 8 个工具全部 `implemented: true`，按钮禁用态与实际行为一致，无用户可感知问题；且"部分能力禁用"属于未来扩展场景，当前实现满足需求。保留为架构层面的注意事项，待工具能力分化时一并处理。

#### L5. 快捷键帮助面板未展示鼠标/滚轮快捷键
**位置**: `shortcuts-help-dialog.tsx`
**问题**: `altDragCopy`（Alt+拖拽复制）和 `zoomReverse`（Alt+滚轮）在注册表中标记为 `hidden: true`，帮助面板不显示。用户无法发现这些有用的快捷操作。
**修复建议**: 考虑将这两个条目从 `hidden` 移除，或单独创建一个"鼠标操作"分组展示。
**状态**: 已完成（现状核查，原问题描述过时）。核查发现 `altDragCopy`/`zoomReverse` 当前均未标记 `hidden`，已展示在帮助面板"工具"分组；`formatKeys` 的 `CODE_TO_DISPLAY` 已将 `drag`/`wheel` 映射为"拖拽"/"滚轮"，`shortcuts-help-dialog.test.tsx` 已有 2 个专项测试验证展示与实际行为一致。仅有的 `hidden` 条目为 4 个 noopAlt* 浏览器导航拦截项，属正确隐藏。

---

## 优化方案与实施建议

### 第一阶段：高优先级修复（已完成）

1. **统一状态仲裁数据源** — 已完成
   - 在 `use-interaction-state-machine.ts` 中导出 `CONTEXT_MENU_ALLOWED_STATES` 和 `SELECTO_ALLOWED_STATES` 常量
   - `canvas-context-menu.tsx` 和 `screen-canvas.tsx` 中的 Selecto 仲裁均引用这些常量

2. **修复微移快捷键的锁定检查** — 已完成
   - 在 `use-keyboard-shortcuts.ts` 的 nudge 回调中增加锁定组件前置检查

3. **统一全选逻辑** — 已完成
   - 修改 `project-menubar.tsx` 的 `handleSelectAll`，过滤锁定和隐藏组件

4. **修复 Space 临时抓手 keyup 焦点检查** — 已完成
   - 在 `use-keyboard-shortcuts.ts` 的 keyup 回调中增加 `isFormElementFocused()` 检查

5. **增强右键菜单重定位稳定性** — 已完成
   - 在 `canvas-event-router.ts` 中增加 `isRedistributing` 的异常安全复位
   - 使用 `requestIdleCallback` 替代 `setTimeout`

### 第二阶段：中优先级优化（已完成）

6. **显式化文本编辑态的 Escape 防御** — 已完成
   - 在 `use-keyboard-shortcuts.ts` 的 `clearSelectionEntry` 回调开头增加 `if (isEditingText) return;`

7. **避免重复工具切换** — 已完成
   - 在工具切换快捷键回调中增加当前工具判断

8. **增加事件防御性检查** — 已完成
   - 在 `onDragEnd`/`onResizeEnd`/`onRotateEnd` 中增加 `datas` 和 `lastEvent` 的完整性检查

9. **增强双击检测精度** — 已完成
   - 在 `ClickRecord` 中增加坐标记录，`detectDoubleClick` 增加位置偏移阈值

10. **统一吸管工具状态转换** — 已完成
    - 在 `handleEyedropperClick` 中增加 `start-sample`/`end-sample` 派发

### 第三阶段：低优先级优化（已完成）

11. **性能优化：拖拽/缩放节流** — 已完成
    - 新增 `lib/raf-throttle.ts`，`onDrag`/`onResize`/`onRotate` 副作用合并到每帧一次
    - 手势结束处理器按最终值来源分别使用 `cancel()` / `flush()`，保证状态一致性

12. **Smart Guides 计算优化** — 已完成
    - 已在 `smartGuidesReferenceRects` memo 中增加 `smartGuidesEnabled` 前置检查

13. **诊断信息优化** — 已完成
    - 非法转换 `console.warn` 已实现 1000ms 时间窗口去重

14. **帮助面板完善** — 已完成（现状核查）
    - `altDragCopy`/`zoomReverse` 已在帮助面板"工具"分组展示，测试已覆盖
    - 工具选择器禁用态（L4）经核查无实际问题，保留为架构注意事项

---

## 架构层面的长期建议

### A1. 建立交互状态机的显式状态事件映射文档
当前交互状态机的转换规则分散在 `TRANSITION_TABLE` 和特殊分支中，建议维护一份显式的状态-事件映射文档（或 TypeScript 类型），便于审查和测试。

### A2. 考虑将 Moveable/Selecto 事件处理抽象为独立 Hook
`screen-canvas.tsx` 已超过 1600 行，Moveable 和 Selecto 的事件处理逻辑占比较大。建议将 Moveable 事件处理提取为 `useMoveableHandlers`，Selecto 事件处理提取为 `useSelectoHandlers`，使主组件更专注于布局。

### A3. 建立交互一致性测试套件
当前已有 1097 个单元测试，建议增加针对以下场景的集成测试：
- 工具切换时的状态一致性（已部分覆盖）
- 右键菜单与拖拽的互斥
- 文本编辑与快捷键的互斥
- 多组件同时拖拽/缩放的边界条件

### A4. 考虑引入交互操作的可视化反馈
对于复杂操作（如 Alt+拖拽复制、Space 临时抓手），建议在画布上增加临时的视觉提示（如光标旁的小图标），帮助用户发现这些高效操作。

---

## 验证结果

- **单元测试**: 47 个测试文件，1097 个测试全部通过（新增 11 个：raf-throttle 8 个 + 非法转换去重 3 个）
- **Biome 检查**: 418 个文件全部通过
- **ESLint 检查（screen 特性）**: 通过
- **TypeScript 类型检查**: 通过（除 `http.test.ts` 中 3 个既存错误与本次修改无关）

---

## 总结

大屏设计器画布交互的整体架构设计良好，具备：
- 完善的快捷键注册表与防冲突机制
- 清晰的工具状态机与交互状态机分离
- 全面的状态恢复语义（escape/cancel/window-blur）
- 良好的测试覆盖（1097 单元测试）

本次优化已完成全部 15 项问题的处理：
- **5 项高优先级**：状态仲裁统一、锁定检查、全选一致性、焦点防护、右键菜单竞态修复
- **5 项中优先级**：Escape 防御显式化、重复工具切换防护、事件防御性检查、双击精度、吸管状态转换
- **5 项低优先级**：rAF 拖拽节流、Smart Guides 启用检查、诊断信息去重已实施；帮助面板鼠标快捷键经核查已展示；工具选择器禁用态经核查无实际问题（保留为架构注意事项）

优化覆盖"提升操作流畅性"（rAF 节流、冗余计算消除）、"增强用户体验"（操作反馈一致性、帮助面板可发现性）、"确保功能完整性"（防御性检查、竞态修复）、"保持交互逻辑一致性"（单一数据源、状态机行为对齐）四项目标。剩余架构层面长期建议（A1-A4）供后续迭代参考。
