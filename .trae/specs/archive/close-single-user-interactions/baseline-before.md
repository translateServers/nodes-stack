# 阶段 1 实施前交互代码基线

> 取证日期：2026-07-18
> 取证方式：直接读取磁盘文件，不引用过期研究结论

## 1. 交互状态机

**文件**：`apps/web/src/features/screen/hooks/use-interaction-state-machine.ts`

- 定义 10 个状态：`idle`、`hovering`、`marquee-selecting`、`dragging`、`resizing`、`rotating`、`panning`、`zooming`、`text-editing`、`context-menu-open`
- 定义 15 个事件：`pointer-enter`、`pointer-leave`、`pointer-down`、`start-drag`、`start-resize`、`start-rotate`、`start-pan`、`start-zoom`、`double-click`、`open-context-menu`、`pointer-up`、`end-zoom`、`close-context-menu`、`escape`、`commit`
- 提供 `transition` 纯函数和 `useInteractionStateMachine` hook
- hook 暴露 `state`、`isInteracting`、`isEditingText`、`isContextMenuOpen`、`dispatch`、`setState`
- **未接入画布**：文件第 212 行明确注释"暂未接入画布（仅提供 API）"
- 生产代码中无任何组件调用 `useInteractionStateMachine()`
- 缺少创建态、`cancel`、`blur`、`pointercancel`、`lostpointercapture` 事件
- `pointer-up` 总是回到 `idle`，不恢复 `hovering`

## 2. 工具状态机

**文件**：`apps/web/src/features/screen/hooks/use-tool-state-machine.ts`

- 定义 8 种工具：`select`、`hand`、`text`、`rect`、`ellipse`、`image`、`zoom`、`eyedropper`
- 提供 `currentTool`（主工具）、`activeTool`（栈顶或主工具）、`hasTemporaryTool`
- 临时工具栈使用 `useRef` 维护，避免高频 keydown 重渲染
- **包含 `isEditingText` 布尔状态**（第 57 行），与交互状态机的 `text-editing` 重复
- 文件第 8-9 行注释："工具切换的实际副作用...由调用方根据 activeTool 自行实现"
- 无窗口失焦恢复临时工具栈的逻辑

## 3. ScreenEditor 编排

**文件**：`apps/web/src/features/screen/components/screen-editor.tsx`

- 第 63 行创建 `toolStateMachine = useToolStateMachine()`
- **未创建 `useInteractionStateMachine()`**
- `toolStateMachine` 传给 `useKeyboardShortcuts` 和 `CanvasStatusBar`
- **`ScreenCanvas` 未接收 `toolStateMachine` 或 `activeTool`**（第 302 行附近 `<ScreenCanvas onDrop={...} onDragOver={...} />`）

## 4. ScreenCanvas 局部状态

**文件**：`apps/web/src/features/screen/components/screen-canvas.tsx`（约 922 行）

### 画布平移

- `isPanning`（useState，第 249 行）——仅表达平移进行中
- `panState`（useRef，第 246 行）——记录起点和原 offset
- 平移条件：`if (e.button !== 0 || !spaceRef.current) return;`（第 285 行）
- **`activeTool === 'hand'` 不会触发平移**，只有按住 Space 才能平移
- cursor 逻辑（第 490 行）：`isPanning ? 'grabbing' : spaceHeldUI ? 'grab' : altHeld ? 'copy' : undefined`

### 双击判定

- `lastClickRef`（useRef，第 245 行）——记录上次点击的组件 ID 和时间戳
- 用于框选结束后检测双击进入分组

### 修饰键

- `useModifierKeys()` 提供 `spaceRef`、`shiftRef`、`altRef`、`ctrlRef` 和对应 React state
- `spaceRef` 直接控制平移，不经过工具状态机

### Moveable

- 始终启用 `draggable`、`resizable`、`rotatable`，不按工具能力区分
- 拖拽、缩放、旋转回调直接操作 Store，不 dispatch 交互状态机

### Selecto

- 始终启用 `selectByClick` 和 `selectableTargets`
- 不按工具能力区分

## 5. 工具快捷键绑定

**文件**：`apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts`

- 第 461 行：`useHotkeys('v', () => toolStateMachine.setTool('select'))`
- 第 464 行：`useHotkeys('h', () => toolStateMachine.setTool('hand'))`
- 第 467 行：`useHotkeys('t', () => toolStateMachine.setTool('text'))`
- 第 474 行：`useHotkeys('space', () => toolStateMachine.pushTemporaryTool('hand'))`（keydown）
- 第 479 行：`useHotkeys('space', () => toolStateMachine.popTemporaryTool('hand'))`（keyup）
- **未绑定**：`r`（矩形）、`e`（椭圆）、`i`（图片）、`z`（缩放）、吸管

## 6. 组件注册表

**文件**：`apps/web/src/features/screen/registry/index.ts`

- 仅注册 2 种组件：`text`（文本）和 `bar-chart`（柱状图）
- **未注册**：`rect`、`ellipse`、`image`
- `createComponentInstance` 工厂函数存在，但只支持已注册类型

**文件**：`apps/web/src/features/screen/registry/renderer.tsx`

- `RENDERERS` 仅映射 `text` → `TextComponent` 和 `bar-chart` → `BarChartComponent`
- 未知组件类型显示"未知组件: {type}"占位

## 7. 快捷键注册表

**文件**：`apps/web/src/features/screen/hooks/shortcuts-registry.ts`

- 包含工具快捷键和 Alt 临时吸管说明
- 注册表声称 `alt` 为"临时吸管（按住）"，但 `use-keyboard-shortcuts.ts` 未绑定 Alt 吸管行为
- Alt 实际用于拖拽复制和中心缩放，与吸管说明矛盾

## 8. 现有 Playwright E2E

**目录**：`apps/web/e2e/tests/`

- `screen-auth-preview.spec.ts`：认证路由与公开预览隔离（3 用例）
- `screen-save-publish.spec.ts`：保存发布与共享样式（2 用例）
- `screen-conflict.spec.ts`：保存冲突恢复（1 用例）
- **无画布交互 E2E**：无选择、拖拽、框选、双击、Alt 复制、图层排序、快捷键缩放等覆盖

## 9. 无行为工具汇总

| 工具 | 状态 | 事实 |
| --- | --- | --- |
| select | 有行为 | Selecto/Moveable 始终启用 |
| hand | 部分有行为 | 只有按住 Space 才能平移，`activeTool === 'hand'` 无效 |
| text | 无行为 | 只切换状态栏文字，无创建/编辑 |
| rect | 无行为 | 无快捷键、无创建逻辑、无组件定义 |
| ellipse | 无行为 | 无快捷键、无创建逻辑、无组件定义 |
| image | 无行为 | 无快捷键、无创建逻辑、无组件定义 |
| zoom | 无行为 | 无快捷键、无点击缩放，代码中有 `// TODO: Z 工具点击放大接入点` |
| eyedropper | 无行为 | 无快捷键、无采样逻辑，Alt 说明错误 |

## 10. 重复状态源汇总

| 语义 | 状态源 1 | 状态源 2 |
| --- | --- | --- |
| 文本编辑 | 工具状态机 `isEditingText` | 交互状态机 `state === 'text-editing'` |
| 正在平移 | `isPanning`（useState） | `spaceRef.current`（useModifierKeys） |
| Space 按住 | `useModifierKeys` `spaceRef` | `useHotkeys('space')` push/pop 工具栈 |

## 11. 无消费方开关

- `nativeEventEnabled`（editor-store）：Store 中保存和切换，状态栏显示，但画布渲染器和事件路由不读取

## 12. 实施前测试基线

> 取证日期：2026-07-18

### 前端 screen 单元与集成测试

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm --filter @nebula/web exec vitest run --reporter=verbose src/features/screen` |
| 退出码 | 0 |
| 测试文件 | 16 passed (16) |
| 测试用例 | 311 passed (311) |
| 前置操作 | 需先 `pnpm --filter @nebula/shared build` 重建 dist |

### TypeScript 类型检查

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm typecheck` |
| 退出码 | 0 |
| Turbo 任务 | 4 successful, 4 total |

### ESLint

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm lint` |
| 退出码 | 1 |
| 失败任务 | `@nebula/nestjs-server:lint` |
| 失败文件 | `screen.service.spec.ts` |
| 错误数 | 5 errors (全部为 `@typescript-eslint/no-unsafe-assignment`) |
| 行号 | 556, 589, 618, 649, 675 |
| 性质 | 预存问题，阶段 0 验收时已记录 |

### Biome

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm biome:check` |
| 退出码 | 0 |
| 检查文件数 | 375 |
| 修复 | No fixes applied |

### Playwright screen E2E

| 项 | 值 |
| --- | --- |
| 命令 | `$env:CI=''; pnpm --filter @nebula/web e2e -- --grep "screen" --reporter=list` |
| 退出码 | 0（重跑后） |
| 浏览器 | chromium |
| 用例数 | 6 passed (6) |
| 首次运行 | 4 passed, 2 failed（并行 worker 时序 flaky） |
| 重跑结果 | 6 passed (6) |
| 失败用例 | `screen-save-publish` + `screen-conflict`（重跑后均通过） |

## 13. 交互 E2E 稳定定位契约

> 本节定义阶段 1 新增 E2E 的定位策略，优先使用既有语义属性。

### 已有稳定定位

| 目标 | 定位方式 | 来源 |
| --- | --- | --- |
| 组件容器 | `[data-component-id]` | screen-canvas.tsx |
| 保存按钮 | `getByRole('button', { name: '保存' })` | screen-editor.tsx |
| 发布按钮 | `getByRole('button', { name: '发布' })` | screen-editor.tsx |
| 冲突对话框 | `getByRole('alertdialog')` | save-conflict-dialog.tsx |
| 对话框按钮 | `getByRole('button', { name: '继续编辑' })` 等 | save-conflict-dialog.tsx |
| 状态栏开关 | `getByRole('switch', { name: /.../ })` | canvas-status-bar.tsx |
| 缩放显示 | `getByRole('button', { name: '缩放' })` | canvas-status-bar.tsx |
| 图层操作 | `getByRole('button', { name: '隐藏' })` 等 | layer-panel.tsx |
| 项目名称 | `getByText(projectName)` | screen-editor.tsx |

### 阶段 1 需新增的定位

| 目标 | 定位策略 | 添加时机 |
| --- | --- | --- |
| 画布表面 | `data-testid="canvas-surface"` | 任务 2.3（activeTool 接入） |
| 工具按钮 | `getByRole('button', { name: toolName })` + `aria-pressed` | 任务 1.5（工具入口） |
| 画布缩放值 | 读取 `aria-label="缩放"` 元素的文本 | 已有，无需修改 |
| 文本编辑器 | `data-testid="text-editor"` | 任务 5.2（文字工具创建） |
| 创建预览 | `data-testid="creation-preview"` | 任务 6.3（矩形创建） |
| 活动工具名称 | `data-testid="active-tool-name"` | 任务 1.2（状态栏接入） |
| 活动颜色（吸管） | `data-testid="active-color"` | 任务 9.4（吸管反馈） |

### Moveable/Selecto 交互策略

- **选择组件**：点击 `[data-component-id]` 元素，不直接操作 Selecto 内部 DOM
- **拖拽组件**：在 `[data-component-id]` 元素上执行 `mouse.down()` → `mouse.move()` → `mouse.up()`，不操作 Moveable 控制框
- **缩放/旋转手柄**：使用 Moveable 渲染的 `data-rotate-control` 或等价属性；若无稳定属性，在 ScreenCanvas 中为手柄容器添加 `data-testid`
- **框选**：在画布表面空白处 `mouse.down()` → `mouse.move()` → `mouse.up()`，不操作 Selecto 内部选区矩形

### 禁止的定位方式

- 不依赖 Moveable/Selecto 的内部 CSS 类名（如 `.moveable-control-box`）
- 不依赖 Tailwind 工具类（如 `.overflow-hidden.bg-black`）
- 不依赖组件渲染顺序或 `nth-child`
- 不在测试中硬编码组件 ID
