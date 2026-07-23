# 事件蓝图与画布交互一致性缺口修复计划

> 状态：待执行
> 创建时间：2026-07-23
> 来源：产品视角交互一致性评审结论

## 背景

事件蓝图（`apps/web/src/features/screen/blueprint/`）是大屏设计器赋予画布组件行为的全屏弹层编辑器。评审结论：蓝图与画布的交互应遵循 **"相同语义必须相同键位，不同语义不强行映射，系统能力必须拉齐"** 的原则。

当前已做到的部分（**本计划不涉及改动**）：

- 撤销/重做 `Ctrl+Z / Ctrl+Shift+Z`：蓝图与画布共享同一 editor-store 历史栈（`blueprint/hooks/use-blueprint-shortcuts.ts:47`），拖拽经手势合并只产生一条历史
- 剪贴板 `Ctrl+C/X/V/D`：键位一致，且同样遵循"原生文本选区优先"（`blueprint/hooks/use-blueprint-clipboard.ts:230`）
- `Delete/Backspace` 删除、`Ctrl+A` 全选：React Flow 内置接管，语义一致
- 视口空间模型：滚轮以光标为中心缩放、`Space+拖拽` 平移，两边一致
- 缩放范围刻意不同（画布 0.1x–5x，蓝图 0.25x–2x）：媒介不同，属合理差异

评审发现的三个缺口均在"系统能力"层面，本文档逐项给出修复方案、执行步骤与验收标准。

## 缺口 1：全屏弹层内全局快捷键失效，且泄漏浏览器默认行为（P0，bug 级）

### 现状与问题

弹层打开时画布全局快捷键被整体挂起（`components/screen-editor.tsx:375`，`suspended: showEventBlueprint || showCodeEditor`），但蓝图快捷键层只重实现了 `Ctrl+Z` 与 `Esc` 分层（`blueprint/hooks/use-blueprint-shortcuts.ts`）。导致弹层内：

- `Ctrl+S` 不触发保存，且未 `preventDefault` → 弹出**浏览器"保存网页"对话框**
- `Ctrl+=` / `Ctrl+-` / `Ctrl+0` 不触发蓝图视口缩放 → 触发**浏览器页面缩放**
- 用户在画布上刚用过的键，进入蓝图后变成浏览器行为，心智模型断裂

### 修复方案

在蓝图快捷键层接管这三个全局语义，映射到蓝图自身的实现：

| 键位 | 弹层内行为 | 映射目标 |
|---|---|---|
| `mod+s` | 保存项目 | screen-editor 的 `handleSave`（经 props 传入） |
| `mod+=` / `mod+-` | 视口放大/缩小 | `useBlueprintViewport` 的 `zoomIn` / `zoomOut` |
| `mod+0` | 适应视图 | `useBlueprintViewport` 的 `fitView` |

与画布侧保持一致：保存与缩放在画布侧为 global 作用域（输入框内也生效），蓝图内同样不检查表单焦点。`mod+/`（帮助）在缺口 2 中一并处理。

### 执行步骤

1. `blueprint/sheet/blueprint-sheet.tsx`
   - `BlueprintSheetProps` 增加 `onSave: () => void`
   - `components/screen-editor.tsx:494` 处传入 `onSave={handleSave}`（`handleSave` 已在 screen-editor 内定义，见 `screen-editor.tsx:218`）
2. `blueprint/hooks/use-blueprint-shortcuts.ts`
   - options 增加 `onSave`、`onZoomIn`、`onZoomOut`、`onFitView` 回调
   - 在现有 capture 阶段 `handleKeyDown` 中、`Ctrl+Z` 分支之后追加：
     - `isCtrl && key==='s'` → `e.preventDefault(); onSave()`
     - `isCtrl && (key==='=' || key==='+')` → `e.preventDefault(); onZoomIn()`
     - `isCtrl && key==='-'` → `e.preventDefault(); onZoomOut()`
     - `isCtrl && key==='0'` → `e.preventDefault(); onFitView()`
   - 注意 `isCtrl = e.ctrlKey || e.metaKey` 兼容 Mac
3. `blueprint/sheet/blueprint-sheet.tsx` 调用处把 `viewport.zoomIn/zoomOut/fitView` 传入该 hook
4. 测试
   - `blueprint/hooks/use-blueprint-shortcuts.test.ts`：新增 4 组用例（含 `metaKey` 变体、preventDefault 断言）
   - `blueprint/sheet/blueprint-sheet.test.tsx`：断言 `onSave` prop 被接线到快捷键层

### 验收

- [ ] 打开蓝图弹层按 `Ctrl+S`：触发项目保存（出现保存成功 toast），**无浏览器保存对话框**
- [ ] 弹层内 `Ctrl+=` / `Ctrl+-`：蓝图视口缩放，顶栏缩放百分比同步变化；**浏览器页面不缩放**
- [ ] 弹层内 `Ctrl+0`：视口执行 fitView
- [ ] 搜索面板打开时上述快捷键仍然生效
- [ ] 关闭弹层后画布原有快捷键行为不受影响
- [ ] Mac 上 `Cmd` 变体行为一致（如无可验证环境，在代码审查中确认 `metaKey` 分支）
- [ ] `pnpm --filter @nebula/web test -- --reporter=verbose use-blueprint-shortcuts` 通过

## 缺口 2：蓝图快捷键无 registry、无帮助入口，可发现性断层（P2，随蓝图 M2）

### 现状与问题

画布侧快捷键有单一数据源（`hooks/shortcuts-registry.ts`）+ 帮助面板（`components/shortcuts-help-dialog.tsx`，`Ctrl+/` 打开），描述与绑定不会脱节。蓝图侧快捷键硬编码散落在三个 hook 中（`use-blueprint-shortcuts.ts`、`use-blueprint-clipboard.ts`、`use-blueprint-viewport.ts`），无 registry；且弹层打开时帮助面板也被挂起——**蓝图快捷键在产品内不可被发现**。

### 修复方案

将蓝图快捷键纳入既有 registry 体系，帮助面板按作用域分组展示：

1. `shortcuts-registry.ts` 的 `ShortcutScope` 扩展 `'blueprint'` 值，蓝图条目以 `scope: 'blueprint'` 登记
2. 需文档化的蓝图条目（与实现逐一对应）：
   - 编辑：`mod+z`、`mod+shift+z`、`delete,backspace`、`mod+a`、`mod+c`、`mod+x`、`mod+v`、`mod+d`
   - 视图：`mod+=`、`mod+-`、`mod+0`、`space`（按住平移）、滚轮缩放（鼠标类条目参考既有 `alt+wheel` 的写法）
   - 文件：`mod+s`
   - 导航：`escape`（描述注明四层语义：关搜索面板→取消连线→取消选择→关闭弹层）、双击空白添加节点
   - 帮助：`mod+/`
3. `shortcuts-help-dialog.tsx` 增加"事件蓝图"分组区块（仅渲染 `scope==='blueprint'` 条目）
4. 弹层内 `mod+/` 打开帮助：复用 screen-editor 的 `ShortcutsHelpDialog`，`BlueprintSheetProps` 增加 `onShowHelp: () => void`，由缺口 1 扩展后的 `use-blueprint-shortcuts` 触发
   - 实现时注意层叠：弹层为 `fixed inset-0 z-50`，shadcn Dialog 同为 z-50，需验证 Dialog portal 渲染在弹层之上，必要时调高 Dialog 的 z-index

### 执行步骤

1. `hooks/shortcuts-registry.ts`：`ShortcutScope` 加 `'blueprint'`；追加上述条目（`hidden: false`，复用现有 category）
2. `components/shortcuts-help-dialog.tsx`：分组逻辑按 scope 拆出蓝图区块（保持画布分组顺序不变）
3. 缺口 1 的 `use-blueprint-shortcuts` 扩展中追加 `mod+/` 分支 → `onShowHelp()`
4. `blueprint-sheet.tsx` 增加 `onShowHelp` prop 并接线；`screen-editor.tsx` 传入 `() => setShowHelp(true)`
5. 测试
   - `shortcuts-registry.test.ts`：蓝图条目完整性（id、preventDefault、browserConflict 字段符合既有约束）
   - `shortcuts-help-dialog.test.tsx`：蓝图分组渲染
   - `use-blueprint-shortcuts.test.ts`：`mod+/` 用例

### 验收

- [ ] 蓝图弹层内按 `Ctrl+/`：帮助面板打开且显示在弹层之上，包含"事件蓝图"分组
- [ ] 帮助面板中蓝图条目与实际绑定一致（对照缺口 1 实现逐项核对）
- [ ] 画布内帮助面板原有分组与顺序不变
- [ ] registry 测试通过，新增条目遵守既有防冲突字段约束（`browserConflict='overridable'` 必须搭配非 `'none'` 的 preventDefault）
- [ ] `pnpm --filter @nebula/web test` 全量通过

## 缺口 3：框选手势不一致（P1，配置级改动）

### 现状与问题

- 画布：空白处**裸左键拖拽**即框选（Selecto）
- 蓝图：React Flow 默认 `selectionKeyCode='Shift'` 且未开 `selectionOnDrag` → 需 **Shift+拖拽** 才能框选

蓝图视口配置中 `panOnDrag` 默认已为 `false`（仅 Space 按下时为 `true`，`use-blueprint-viewport.ts:105`），裸拖框选与平移无冲突，可直接对齐画布行为。

### 修复方案

ReactFlow 增加 `selectionOnDrag`，与 Space 平移互斥：

- Space 未按下：`selectionOnDrag=true`（裸拖框选）
- Space 按下：`selectionOnDrag=false` 且 `panOnDrag=true`（平移优先）
- 保留 `selectionKeyCode='Shift'` 默认值作为备选路径（Shift+拖拽仍可框选）

框选命中模式（部分相交 vs 完全包含，对应 React Flow `selectionMode`）以画布 Selecto 当前行为为准对齐，实现时先确认 Selecto 配置再定。

### 执行步骤

1. `blueprint/hooks/use-blueprint-viewport.ts`
   - `config` 增加 `selectionOnDrag: !isSpacePanning`
   - 确认 Selecto 命中模式后决定是否显式设置 `selectionMode`（`Partial` / `Full`）
   - 更新 hook 头部注释（视口能力清单）
2. `blueprint/sheet/blueprint-sheet.tsx`：确认 `viewport.config` 展开后生效（config 已整体展开，无需额外改动，仅需核对类型）
3. 测试
   - `use-blueprint-viewport.test.tsx`：`selectionOnDrag` 随 Space 状态切换的用例

### 验收

- [ ] 蓝图空白处裸左键拖出框选框，松手选中相交节点与边
- [ ] 从节点上起拖仍是移动节点，不触发框选
- [ ] `Shift+拖拽` 框选仍可用（备选路径保留）
- [ ] `Space+拖拽` 平移不受影响，Space 按下期间裸拖不触发框选
- [ ] `pnpm --filter @nebula/web test -- --reporter=verbose use-blueprint-viewport` 通过

## 排期建议

| 优先级 | 缺口 | 理由 |
|---|---|---|
| P0 | 缺口 1 | 浏览器默认行为泄漏属 bug 级，影响每一次保存/缩放操作 |
| P1 | 缺口 3 | 配置级改动，一行配置 + 测试，收益即时 |
| P2 | 缺口 2 | 依赖缺口 1 的 hook 扩展，建议随蓝图 M2 一起做 |

**范围外（另行评估）**：`CodeEditorSheet` 同样触发 `suspended`（`screen-editor.tsx:375`），其弹层内全局键行为是否对齐，需单独评审代码编辑器场景后决定，不纳入本计划。

## 关联文件清单

| 文件 | 涉及缺口 | 改动类型 |
|---|---|---|
| `apps/web/src/features/screen/blueprint/hooks/use-blueprint-shortcuts.ts` | 1、2 | 接管 mod+s / mod+= / mod+- / mod+0 / mod+/ |
| `apps/web/src/features/screen/blueprint/sheet/blueprint-sheet.tsx` | 1、2 | 新增 onSave / onShowHelp props 并接线 |
| `apps/web/src/features/screen/components/screen-editor.tsx` | 1、2 | 传入 handleSave / setShowHelp |
| `apps/web/src/features/screen/hooks/shortcuts-registry.ts` | 2 | scope 扩展 + 蓝图条目登记 |
| `apps/web/src/features/screen/components/shortcuts-help-dialog.tsx` | 2 | 蓝图分组渲染 |
| `apps/web/src/features/screen/blueprint/hooks/use-blueprint-viewport.ts` | 3 | config 增加 selectionOnDrag |
| 对应 `*.test.ts(x)` | 1、2、3 | 新增/更新用例 |

**不改动**：键位表本身（`Ctrl+C/V/D/Z` 等已一致）、React Flow 节点/边实现、编译器与运行时、editor-store 历史语义。
