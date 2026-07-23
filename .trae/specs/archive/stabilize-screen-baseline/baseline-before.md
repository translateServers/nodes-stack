# Baseline Before — 阶段 0 实施前大屏测试清单

> 本文件为 `stabilize-screen-baseline` 阶段 0 任务 0.1 的基线取证记录，依据当前磁盘事实整理，不复制旧文档数字。
> 取证日期：2026-07-18
> 取证范围：`apps/nestjs-server/src/modules/screen/`、`apps/web/src/features/screen/`、`apps/web/e2e/`
> 统计口径：以 `it(` 出现次数为可枚举用例数；不计算 `describe(` 与 `test(`。每个文件均通过 Grep 工具确认。

## 1. 后端 screen 测试文件

后端测试目录：`apps/nestjs-server/src/modules/screen/`

| 序号 | 文件路径 | 可枚举用例数 |
| --- | --- | --- |
| 1 | `apps/nestjs-server/src/modules/screen/screen.controller.spec.ts` | 7 |
| 2 | `apps/nestjs-server/src/modules/screen/screen.service.spec.ts` | 14 |
| | **后端合计** | **21** |

### 1.1 `screen.controller.spec.ts`（7 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `createProject` | should call service.createProject with dto |
| 2 | `findAllProjects` | should call service.findAllProjects |
| 3 | `findProjectById` | should call service.findProjectById with id |
| 4 | `updateProject` | should call service.updateProject with id and dto |
| 5 | `publishProject` | should call service.publishProject with id |
| 6 | `removeProject` | should call service.removeProject with id |
| 7 | `previewProject` | should call service.findProjectById for preview |

### 1.2 `screen.service.spec.ts`（14 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `createProject` | should create a screen project with default canvas |
| 2 | `createProject` | should create with custom canvas config |
| 3 | `createProject` | should throw BusinessException when name already exists |
| 4 | `findAllProjects` | should return all projects |
| 5 | `findProjectById` | should return project when found |
| 6 | `findProjectById` | should throw BusinessException when not found |
| 7 | `updateProject` | should update project name |
| 8 | `updateProject` | should update canvas and components |
| 9 | `updateProject` | should throw BusinessException when updating to duplicate name |
| 10 | `updateProject` | should throw BusinessException when project not found |
| 11 | `publishProject` | should set status to published |
| 12 | `publishProject` | should throw BusinessException when project not found |
| 13 | `removeProject` | should delete project |
| 14 | `removeProject` | should throw BusinessException when project not found |

### 1.3 后端测试现状缺口（与 spec 对照）

- 未覆盖：公开预览独立查询、草稿/不存在项目公开预览失败、`expectedUpdatedAt` 基线匹配与冲突、原子条件写入、未认证受保护接口 401。
- `previewProject` 控制器测试当前断言调用的是普通 `findProjectById`，与 spec 1.3/10.1 要求的“专用公开查询”不符。
- `publishProject` 控制器/服务测试均未涉及请求体或 `expectedUpdatedAt`，与 spec 5.3/6.3/6.5 要求不符。

## 2. 前端 screen 测试文件

前端测试目录：`apps/web/src/features/screen/`

| 序号 | 文件路径 | 可枚举用例数 |
| --- | --- | --- |
| 1 | `apps/web/src/features/screen/components/number-input.test.tsx` | 22 |
| 2 | `apps/web/src/features/screen/hooks/shortcuts-registry.test.ts` | 21 |
| 3 | `apps/web/src/features/screen/hooks/use-interaction-state-machine.test.ts` | 39 |
| 4 | `apps/web/src/features/screen/hooks/use-keyboard-shortcuts.test.ts` | 9 |
| 5 | `apps/web/src/features/screen/lib/canvas-event-router.test.ts` | 59 |
| 6 | `apps/web/src/features/screen/lib/smart-guides.test.ts` | 30 |
| 7 | `apps/web/src/features/screen/registry/registry.test.ts` | 11 |
| 8 | `apps/web/src/features/screen/stores/editor-store.test.ts` | 9 |
| | **前端合计** | **200** |

### 2.1 `components/number-input.test.tsx`（22 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `ArrowUp / ArrowDown 微调` | ArrowUp 默认步进 1 |
| 2 | `ArrowUp / ArrowDown 微调` | ArrowDown 默认步进 -1 |
| 3 | `ArrowUp / ArrowDown 微调` | Shift+ArrowUp 步进 10 |
| 4 | `ArrowUp / ArrowDown 微调` | Shift+ArrowDown 步进 -10 |
| 5 | `ArrowUp / ArrowDown 微调` | 自定义 step 与 shiftStep |
| 6 | `min / max 钳制` | ArrowUp 不超过 max |
| 7 | `min / max 钳制` | ArrowDown 不低于 min |
| 8 | `直接输入数值` | Enter 提交 draft 值 |
| 9 | `直接输入数值` | Blur 提交 draft 值 |
| 10 | `直接输入数值` | Esc 放弃编辑，不触发 onChange |
| 11 | `直接输入数值` | 无效输入（非数字）不提交 |
| 12 | `直接输入数值` | 空字符串不提交 |
| 13 | `直接输入数值` | 浮点数正常解析 |
| 14 | `直接输入数值` | 负数正常解析 |
| 15 | `直接输入数值` | 值未变化时不重复触发 onChange |
| 16 | `直接输入数值` | 直接输入时受 min/max 钳制 |
| 17 | `显示与渲染` | 未编辑时显示 value |
| 18 | `显示与渲染` | 有 label 时渲染 label |
| 19 | `显示与渲染` | 有 unit 时渲染 unit |
| 20 | `显示与渲染` | disabled 时 input 不可编辑 |
| 21 | `编辑中的 ArrowUp/Down` | 编辑态下 ArrowUp 基于 draft 解析值步进 |
| 22 | `编辑中的 ArrowUp/Down` | 编辑态下 draft 无效时 ArrowUp 回退到 value |

### 2.2 `hooks/shortcuts-registry.test.ts`（21 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `validateRegistry（防冲突校验）` | 对 browserConflict=overridable + preventDefault=none 报警告 |
| 2 | `validateRegistry（防冲突校验）` | 对 browserConflict=reserved 报警告 |
| 3 | `validateRegistry（防冲突校验）` | 对合规条目不报警告 |
| 4 | `validateRegistry（防冲突校验）` | 对空数组返回空警告 |
| 5 | `validateRegistry（防冲突校验）` | 同时报告多个违规条目 |
| 6 | `SHORTCUTS_REGISTRY 合规性（防冲突方法论）` | 所有条目都有 preventDefault 与 browserConflict 字段 |
| 7 | `SHORTCUTS_REGISTRY 合规性（防冲突方法论）` | 所有 browserConflict=overridable 条目都有 preventDefault !== none |
| 8 | `SHORTCUTS_REGISTRY 合规性（防冲突方法论）` | validateRegistry 对 SHORTCUTS_REGISTRY 返回空警告 |
| 9 | `SHORTCUTS_REGISTRY 合规性（防冲突方法论）` | zoomIn 有 mod+shift+equal 别名（兼容 Ctrl+Shift+=） |
| 10 | `SHORTCUTS_REGISTRY 合规性（防冲突方法论）` | 符号快捷键使用 code 名（react-hotkeys-hook 5.x 用 e.code 匹配） |
| 11 | `SHORTCUTS_REGISTRY 合规性（防冲突方法论）` | 包含 4 个 noop Alt+方向键条目且 hidden=true |
| 12 | `SHORTCUTS_REGISTRY 合规性（防冲突方法论）` | toggleUI 的 enableOnFormTags 为 false（保留 input Tab 焦点切换） |
| 13 | `formatKeys（code 名 → 可读字符映射）` | mod+equal → [Ctrl, =] |
| 14 | `formatKeys（code 名 → 可读字符映射）` | mod+minus → [Ctrl, -] |
| 15 | `formatKeys（code 名 → 可读字符映射）` | mod+semicolon → [Ctrl, ;] |
| 16 | `formatKeys（code 名 → 可读字符映射）` | mod+bracketleft → [Ctrl, [] |
| 17 | `formatKeys（code 名 → 可读字符映射）` | mod+bracketright → [Ctrl, ]] |
| 18 | `formatKeys（code 名 → 可读字符映射）` | mod+slash → [Ctrl, /] |
| 19 | `formatKeys（code 名 → 可读字符映射）` | bracketleft（单键）→ [[] |
| 20 | `formatKeys（code 名 → 可读字符映射）` | bracketright（单键）→ []] |
| 21 | `formatKeys（code 名 → 可读字符映射）` | 保留原有字面量快捷键不变（如 mod+s → [Ctrl, S]） |

### 2.3 `hooks/use-interaction-state-machine.test.ts`（39 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `合法转换` | idle + pointer-enter → hovering |
| 2 | `合法转换` | hovering + pointer-leave → idle |
| 3 | `合法转换` | idle + pointer-down → marquee-selecting（无 payload） |
| 4 | `合法转换` | idle + pointer-down（isPanGesture=true）→ panning |
| 5 | `合法转换` | hovering + pointer-down → marquee-selecting |
| 6 | `合法转换` | hovering + pointer-down（isPanGesture=true）→ panning |
| 7 | `合法转换` | marquee-selecting + start-drag → dragging |
| 8 | `合法转换` | marquee-selecting + pointer-up → idle |
| 9 | `合法转换` | dragging + pointer-up → idle |
| 10 | `合法转换` | idle + start-resize → resizing |
| 11 | `合法转换` | resizing + pointer-up → idle |
| 12 | `合法转换` | idle + start-rotate → rotating |
| 13 | `合法转换` | rotating + pointer-up → idle |
| 14 | `合法转换` | idle + start-pan → panning |
| 15 | `合法转换` | panning + pointer-up → idle |
| 16 | `合法转换` | idle + start-zoom → zooming |
| 17 | `合法转换` | zooming + end-zoom → idle |
| 18 | `合法转换` | idle + double-click → text-editing |
| 19 | `合法转换` | hovering + double-click → text-editing |
| 20 | `合法转换` | text-editing + escape → idle |
| 21 | `合法转换` | text-editing + commit → idle |
| 22 | `合法转换` | idle + open-context-menu → context-menu-open |
| 23 | `合法转换` | context-menu-open + close-context-menu → idle |
| 24 | `合法转换` | context-menu-open + escape → idle |
| 25 | `合法转换` | marquee-selecting + open-context-menu → context-menu-open |
| 26 | `合法转换` | 完整流程：idle → hovering → marquee-selecting → dragging → idle |
| 27 | `合法转换` | 完整流程：idle → text-editing → idle（escape 退出） |
| 28 | `非法转换（保持当前状态）` | idle + pointer-up → idle（idle 状态无指针释放动作） |
| 29 | `非法转换（保持当前状态）` | idle + start-drag → idle（drag 必须先经过 marquee-selecting） |
| 30 | `非法转换（保持当前状态）` | dragging + double-click → dragging（拖拽中不能直接进入文本编辑） |
| 31 | `非法转换（保持当前状态）` | text-editing + pointer-down → text-editing（文本编辑态不响应画布指针） |
| 32 | `非法转换（保持当前状态）` | zooming + start-drag → zooming（缩放进行中不响应拖拽） |
| 33 | `非法转换（保持当前状态）` | resizing + end-zoom → resizing（resize 状态不响应 zoom 结束事件） |
| 34 | `非法转换（保持当前状态）` | panning + start-rotate → panning（平移中不响应旋转开始） |
| 35 | `非法转换（保持当前状态）` | context-menu-open + start-drag → context-menu-open（菜单打开时不开始拖拽） |
| 36 | `payload 处理` | pointer-down 在 idle 状态下传入 hitComponent=true 仍走 marquee-selecting |
| 37 | `payload 处理` | pointer-down 在 idle 状态下传入 isPanGesture=false 走 marquee-selecting |
| 38 | `payload 处理` | pointer-down 在 marquee-selecting 状态下忽略 payload（不走特殊分支） |
| 39 | `payload 处理` | pointer-down 在 dragging 状态下保持原状态（不响应） |

### 2.4 `hooks/use-keyboard-shortcuts.test.ts`（9 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `preventDefault 映射` | preventDefault='always' → preventDefault: true |
| 2 | `preventDefault 映射` | preventDefault='callback-only' → preventDefault: false |
| 3 | `preventDefault 映射` | preventDefault='none' → preventDefault: false |
| 4 | `enableOnFormTags 推断` | scope='global' 且未声明 enableOnFormTags → 默认 true |
| 5 | `enableOnFormTags 推断` | scope='canvas' 且未声明 enableOnFormTags → 默认 false |
| 6 | `enableOnFormTags 推断` | 显式声明 enableOnFormTags=true 时优先使用显式值 |
| 7 | `enableOnFormTags 推断` | 显式声明 enableOnFormTags=false 时优先使用显式值 |
| 8 | `enabled 传递` | 布尔值 enabled 正确传递 |
| 9 | `enabled 传递` | 函数 enabled 正确传递（用于 canvasEnabled 等动态判断） |

### 2.5 `lib/canvas-event-router.test.ts`（59 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `getComponentIdFromElement` | 命中：起始元素即包含 data-component-id |
| 2 | `getComponentIdFromElement` | 命中：父元素包含 data-component-id |
| 3 | `getComponentIdFromElement` | 未命中：元素链中无 data-component-id |
| 4 | `getComponentIdFromElement` | 未命中：传入 null |
| 5 | `getComponentIdFromElement` | 终止：遇到 .moveable-control-box 时立即终止返回 null |
| 6 | `getComponentIdFromElement` | 终止：起点本身即为 moveable-control-box |
| 7 | `findComponentIdAtPoint` | 命中：返回第一个带 data-component-id 的元素 |
| 8 | `findComponentIdAtPoint` | 跳过：[data-slot="context-menu-content"] 元素 |
| 9 | `findComponentIdAtPoint` | 跳过：[data-radix-popper-content-wrapper] 元素 |
| 10 | `findComponentIdAtPoint` | 跳过：.moveable-control-box 元素（含其内部嵌套元素） |
| 11 | `findComponentIdAtPoint` | 未命中：鼠标下方无任何带 data-component-id 的元素 |
| 12 | `findComponentIdAtPoint` | 未命中：elementsFromPoint 返回空数组 |
| 13 | `redistributeContextMenu` | 派发完整事件序列：pointerdown → mousedown → pointerup → mouseup → contextmenu |
| 14 | `redistributeContextMenu` | 事件坐标：所有事件均使用传入的 x/y 作为 clientX/clientY |
| 15 | `redistributeContextMenu` | 事件 button：所有事件均为右键（button === 2） |
| 16 | `redistributeContextMenu` | 跳过覆盖层：从首个非跳过元素派发事件 |
| 17 | `redistributeContextMenu` | 兜底：所有元素都被跳过时派发到 document.body |
| 18 | `redistributeContextMenu` | 清除 body / html / #root 的 pointer-events 内联样式 |
| 19 | `attachContextMenuRedistributor` | 返回 cleanup 函数 |
| 20 | `attachContextMenuRedistributor` | 注册时在 document 上添加 contextmenu 与 pointerdown capture 监听器 |
| 21 | `attachContextMenuRedistributor` | cleanup 移除两个 capture 监听器 |
| 22 | `attachContextMenuRedistributor` | cleanup 后事件不再触发回调 |
| 23 | `attachContextMenuRedistributor` | pointerdown capture：非右键（button !== 2）不隐藏现有 Content |
| 24 | `attachContextMenuRedistributor` | pointerdown capture：菜单关闭时不隐藏现有 Content |
| 25 | `attachContextMenuRedistributor` | pointerdown capture：右键 + 菜单打开 → 隐藏现有 Content |
| 26 | `attachContextMenuRedistributor` | contextmenu capture：非右键不处理（不调用 onClose） |
| 27 | `attachContextMenuRedistributor` | contextmenu capture：菜单关闭时不处理 |
| 28 | `attachContextMenuRedistributor` | contextmenu capture：拦截事件（stopImmediatePropagation + preventDefault） |
| 29 | `attachContextMenuRedistributor` | contextmenu capture：调用 onClose 与 onMenuKeyBump |
| 30 | `attachContextMenuRedistributor` | contextmenu capture：通过双 rAF 调度 redistributeContextMenu |
| 31 | `attachContextMenuRedistributor` | isRedistributing 标志：阻止重派发期间的事件再次进入 |
| 32 | `attachContextMenuRedistributor` | 50ms 超时后：菜单仍关闭 → 调用 onReopenIfClosed |
| 33 | `attachContextMenuRedistributor` | 50ms 超时后：菜单已被重派发打开 → 不调用 onReopenIfClosed |
| 34 | `detectDoubleClick` | prev 为 null 时返回 false（无历史） |
| 35 | `detectDoubleClick` | 不同 id 时返回 false |
| 36 | `detectDoubleClick` | 同 id 时间间隔超过阈值时返回 false |
| 37 | `detectDoubleClick` | 同 id 时间间隔等于阈值时返回 true（边界） |
| 38 | `detectDoubleClick` | 同 id 时间间隔小于阈值时返回 true |
| 39 | `detectDoubleClick` | 使用默认阈值 400ms |
| 40 | `detectDoubleClick` | 自定义阈值生效 |
| 41 | `detectDoubleClick` | current.time 小于 prev.time 时返回 false（时间倒流，异常容错） |
| 42 | `zoomAtPoint` | 放大：factor=1.1 → scale 增加，offset 调整使光标点保持锚定 |
| 43 | `zoomAtPoint` | 缩小：factor=0.5 → scale 减小一半，offset 调整使光标点保持锚定 |
| 44 | `zoomAtPoint` | factor=1 → scale 与 offset 不变 |
| 45 | `zoomAtPoint` | 光标在原点时 offset = 0 |
| 46 | `zoomAtPoint` | newScale <= 0 时保持原值（边界容错） |
| 47 | `zoomAtPoint` | factor=0 时保持原值（边界容错） |
| 48 | `zoomAtPoint` | 验证锚点不变性：缩放前后光标点对应的画布坐标相同 |
| 49 | `handleSelectEnd` | 框选（isDragStart=false）：返回 selected，清空 lastClick，保持 activeGroupId |
| 50 | `handleSelectEnd` | Ctrl 多选（hasModifier=true）：返回 selected，清空 lastClick |
| 51 | `handleSelectEnd` | 单击顶层组件（首次点击）：返回 selected，更新 lastClick，无 activeGroupId 变化 |
| 52 | `handleSelectEnd` | 双击顶层组件：进入双击态，清空 lastClick，activeGroupId 设为 null |
| 53 | `handleSelectEnd` | 双击分组内组件：进入该分组，selection 仅包含被双击组件 |
| 54 | `handleSelectEnd` | 单击分组内组件（未进入任何分组）：选中整个分组，activeGroupId 设为 null |
| 55 | `handleSelectEnd` | 单击分组内组件（已进入该分组）：仅选中此组件，保持 activeGroupId |
| 56 | `handleSelectEnd` | 单击分组内组件（进入了别的分组）：选中整个新分组，退出旧分组 |
| 57 | `handleSelectEnd` | 单击顶层组件（当前在分组中）：退出分组，activeGroupId 设为 null |
| 58 | `handleSelectEnd` | 同组件间隔超阈值不触发双击（走单击逻辑） |
| 59 | `handleSelectEnd` | 不同组件不触发双击（走单击逻辑） |

### 2.6 `lib/smart-guides.test.ts`（30 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `findAlignmentLines / 基本场景` | 当 otherRects 为空时返回空数组 |
| 2 | `findAlignmentLines / 基本场景` | 当所有距离都超过阈值时返回空数组 |
| 3 | `findAlignmentLines / 基本场景` | 阈值参数生效：距离 4px 在默认阈值 5 下显示，在阈值 3 下不显示 |
| 4 | `findAlignmentLines / 水平对齐（y 坐标）` | moved.top 与 other.top 对齐（完全重合） |
| 5 | `findAlignmentLines / 水平对齐（y 坐标）` | moved.center 与 other.center（水平中线）对齐 |
| 6 | `findAlignmentLines / 水平对齐（y 坐标）` | moved.bottom 与 other.bottom 对齐 |
| 7 | `findAlignmentLines / 水平对齐（y 坐标）` | moved.top 与 other.bottom 对齐（moved 在 other 下方） |
| 8 | `findAlignmentLines / 垂直对齐（x 坐标）` | moved.left 与 other.left 对齐 |
| 9 | `findAlignmentLines / 垂直对齐（x 坐标）` | moved.center 与 other.center 对齐 |
| 10 | `findAlignmentLines / 垂直对齐（x 坐标）` | moved.right 与 other.right 对齐 |
| 11 | `findAlignmentLines / 垂直对齐（x 坐标）` | moved.left 与 other.right 对齐（moved 在 other 右侧） |
| 12 | `findAlignmentLines / 9 种对齐组合覆盖` | 完全重合时返回 6 条同边对齐线（3 水平 + 3 垂直，距离全为 0） |
| 13 | `findAlignmentLines / 9 种对齐组合覆盖` | 覆盖所有 9 种水平对齐组合（通过偏移使每种都出现） |
| 14 | `findAlignmentLines / 9 种对齐组合覆盖` | 覆盖所有 9 种垂直对齐组合 |
| 15 | `findAlignmentLines / 多参考组件` | 与多个参考组件都对齐时全部返回 |
| 16 | `findAlignmentLines / 多参考组件` | otherId 可选：当参考矩形未传 id 时 otherId 为 undefined |
| 17 | `findAlignmentLines / 阈值边界` | 距离恰好等于阈值时包含（≤ 判定） |
| 18 | `findAlignmentLines / 阈值边界` | 距离恰好超过阈值时不包含 |
| 19 | `findAlignmentLines / 阈值边界` | 使用默认阈值 DEFAULT_SMART_GUIDES_THRESHOLD（5） |
| 20 | `filterSnappableLines` | 仅返回 distance < SMART_GUIDES_SNAP_THRESHOLD (3) 的对齐线 |
| 21 | `filterSnappableLines` | 无对齐线时返回空数组 |
| 22 | `snapPosition` | 无对齐线时原值返回 |
| 23 | `snapPosition` | 所有对齐线距离 ≥ 3 时不吸附（原值返回） |
| 24 | `snapPosition` | 水平对齐 top-top（distance=2 < 3）：top 吸附到 other.top 位置 |
| 25 | `snapPosition` | 水平对齐 center-center（distance=1 < 3）：top 吸附使 moved 中线对齐 other 中线 |
| 26 | `snapPosition` | 水平对齐 bottom-bottom（distance=2 < 3）：top 吸附使 moved 底边对齐 other 底边 |
| 27 | `snapPosition` | 垂直对齐 left-left（distance=1 < 3）：left 吸附到 other.left |
| 28 | `snapPosition` | 垂直对齐 right-right（distance=2 < 3）：left 吸附使 moved 右边对齐 other 右边 |
| 29 | `snapPosition` | 同时有水平和垂直对齐线：两个轴各自独立吸附 |
| 30 | `snapPosition` | 多条同轴对齐线：选择距离最小的吸附 |

### 2.7 `registry/registry.test.ts`（11 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `COMPONENT_DEFINITIONS` | should contain text and bar-chart definitions |
| 2 | `getDefinitionByType` | should return definition for known type |
| 3 | `getDefinitionByType` | should return undefined for unknown type |
| 4 | `createComponentInstance` | should create a text component instance |
| 5 | `createComponentInstance` | should create a bar-chart component instance |
| 6 | `createComponentInstance` | should deep clone defaultProps so instances do not share references |
| 7 | `createComponentInstance` | should auto-increment name for duplicate types |
| 8 | `createComponentInstance` | should return null for unknown type |
| 9 | `getDefinitionsByCategory` | should return definitions for a category |
| 10 | `getDefinitionsByCategory` | should return empty array for category with no components |
| 11 | `CATEGORY_LABELS` | should have labels for all categories |

### 2.8 `stores/editor-store.test.ts`（9 个用例）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `withHistory` | 调用顺序：先调用 set(fn) 推入历史，再调用 set(updater, false, actionName) 应用更新 |
| 2 | `withHistory` | actionName 透传：传入的 actionName 出现在第二次 set 调用中 |
| 3 | `pushHistory 内部 updater 行为` | 当 project 为 null 时返回空对象（不写入 history） |
| 4 | `pushHistory 内部 updater 行为` | 当 project 存在时推入 components 快照到 past 并清空 future |
| 5 | `pushHistory 内部 updater 行为` | 保留历史栈中已存在的快照（追加而非覆盖） |
| 6 | `pushHistory 内部 updater 行为` | 超过 HISTORY_LIMIT (50) 时丢弃最旧的快照（FIFO） |
| 7 | `集成：模拟 store 行为，验证最终 state 正确` | 通过模拟 set 实现 state 合并，验证 history.past 推入旧快照且 state 已更新 |
| 8 | `集成：模拟 store 行为，验证最终 state 正确` | 连续调用两次：每次都把当前快照推入 past，且 state 累积更新 |
| 9 | `集成：模拟 store 行为，验证最终 state 正确` | 当 project 为 null 时调用：set 仍被调用 2 次，但 pushHistory 不修改 history |

### 2.9 前端测试现状缺口（与 spec 对照）

- 未覆盖：共享组件容器样式解析（spec 3.1/3.2）、NumberInput 外部值更新与同字段外部变化使旧草稿失效（spec 4.1）、属性面板切换选中对象重置输入上下文（spec 4.4）、画布变换后属性面板同步（spec 4.5）、保存/发布 API 携带 `expectedUpdatedAt`（spec 7.1/7.2）、保存/发布回写新基线（spec 7.3/7.4）、本地脏状态判断（spec 8.1）、发布边界（spec 8.3/8.4）、公开预览缓存失效（spec 8.5）、冲突识别与冲突 UI（spec 9.x）。
- `editor-store.test.ts` 仅覆盖 `withHistory` 历史栈写入语义，未涉及服务端保存基线、本地脏状态或冲突恢复路径。

## 3. 现有 screen E2E 文件

E2E 目录：`apps/web/e2e/tests/`

| 序号 | 文件路径 | 是否 screen 相关 |
| --- | --- | --- |
| 1 | `apps/web/e2e/tests/auth.spec.ts` | 否 |
| 2 | `apps/web/e2e/tests/roles-crud.spec.ts` | 否 |
| 3 | `apps/web/e2e/tests/users-crud.spec.ts` | 否 |
| | **screen E2E 合计** | **0 个文件 / 0 个用例** |

### 3.1 E2E 现状缺口（与 spec 对照）

- 无任何 screen 相关 E2E 文件，spec 10.6（认证与预览 E2E）、10.7（保存后发布 E2E）、10.8（双客户端保存冲突 E2E）均为新增需求。
- E2E 目录中存在的辅助文件（`pages/`、`helpers/`、`fixtures/`、`global-setup.ts`、`global-teardown.ts`、`playwright.config.ts`）可被后续新增 screen E2E 复用，但当前不构成 screen 测试基线。
- `playwright.config.ts` 中出现的 `screen` 字符串仅为 `screenshot: 'only-on-failure'` 配置，与 screen 业务无关。

## 4. 汇总

| 维度 | 文件数 | 可枚举用例数 |
| --- | --- | --- |
| 后端 screen 测试 | 2 | 21 |
| 前端 screen 测试 | 8 | 200 |
| screen E2E | 0 | 0 |
| **合计** | **10** | **221** |

## 5. 取证方法

- 文件枚举：通过 `Glob` 工具按 `**/screen/**/*.spec.ts`、`**/screen/**/*.test.{ts,tsx}`、`apps/web/e2e/**/*.{ts,tsx}` 模式匹配。
- 用例计数：对每个测试文件运行 `Grep` 工具，匹配模式 `^\s*it\(`，取计数结果。
- screen E2E 判定：在 `apps/web/e2e/` 目录下递归搜索 `screen`（大小写不敏感），仅 `playwright.config.ts` 的 `screenshot` 字段命中，确认无 screen 业务 E2E。
- 未运行测试：本任务仅记录清单，不执行测试，实际通过/失败/跳过结果由任务 0.2 记录。

## 6. 测试执行结果（任务 0.2 记录）

> 取证日期：2026-07-18
> 执行环境：Windows，pnpm workspace 根目录 `c:\worker\nebula`
> 已完成任务影响：1.1（后端公开查询服务契约）、3.1（前端样式解析函数，无测试）、4.1（前端 NumberInput 外部值更新测试，含预期失败）、5.1（共享保存冲突业务码）
> 未运行 E2E（按任务要求留给后续验收）。
> 未修复任何失败（4.1 引入的失败为预期，留给 4.2 修复）。

### 6.1 `pnpm --filter @nebula/shared test`

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm --filter @nebula/shared test` |
| 退出码 | 0 |
| 测试文件数 | 9 passed (9) |
| 通过 | 108 |
| 失败 | 0 |
| 跳过 | 0 |
| 总用例 | 108 |
| 持续时间 | 623ms |
| 运行器 | vitest 4.1.9 |

测试文件清单（全部通过）：

| 文件 | 用例数 |
| --- | --- |
| `src/utils/datetime.test.ts` | 5 |
| `src/errors/index.test.ts` | 12 |
| `src/schemas/menu.schema.test.ts` | 13 |
| `src/schemas/user.schema.test.ts` | 13 |
| `src/schemas/role.schema.test.ts` | 12 |
| `src/schemas/dict.schema.test.ts` | 22 |
| `src/schemas/auth.schema.test.ts` | 17 |
| `src/schemas/paginated.schema.test.ts` | 8 |
| `src/schemas/datetime.schema.test.ts` | 6 |

### 6.2 `pnpm --filter @nebula/nestjs-server test -- --testPathPattern=screen`

任务给定命令在当前工具链下无法直接执行：

- 直接执行 `pnpm --filter @nebula/nestjs-server test -- --testPathPattern=screen` 退出码 1，输出 `ERROR  Unknown option: 'testPathPattern' Did you mean 'test-pattern'?`。原因是 pnpm 自身存在同名 `--test-pattern` 选项，会先于 `--` 把 `--testPathPattern` 当作 pnpm 选项拦截。
- 在 `apps/nestjs-server` 目录直接执行 `pnpm test -- --testPathPattern=screen` 同样被 pnpm 拦截（同上错误）。
- 进一步发现 Jest 30 已将 `--testPathPattern` 替换为 `--testPathPatterns`，即使绕过 pnpm 拦截也需要更换选项名。

为获取后端 screen 测试基线数据，等价执行命令如下：

| 项 | 值 |
| --- | --- |
| 实际执行命令 | 在 `apps/nestjs-server` 目录执行 `pnpm exec jest --testPathPatterns=screen` |
| 退出码 | 0 |
| 测试套件 | 2 passed, 2 total |
| 通过 | 24 |
| 失败 | 0 |
| 跳过 | 0 |
| 总用例 | 24 |
| 持续时间 | 2.065s |
| 运行器 | jest 30 + ts-jest |

匹配的测试文件：

| 文件 | 状态 |
| --- | --- |
| `src/modules/screen/screen.service.spec.ts` | PASS |
| `src/modules/screen/screen.controller.spec.ts` | PASS |

与 0.1 基线差异：基线记录后端 21 用例（service 14 + controller 7），当前 24 用例（service 17 + controller 7）。多出的 3 个 service 用例来自任务 1.1 新增的「已发布项目公开查询服务契约」相关测试；任务 1.2/1.3/1.4 尚未完成，控制器公开预览入口仍调用普通详情方法。

### 6.3 `pnpm --filter @nebula/web test -- --reporter=verbose src/features/screen`

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm --filter @nebula/web test -- --reporter=verbose src/features/screen` |
| 退出码 | 1 |
| 测试文件数 | 1 failed \| 7 passed (8) |
| 通过 | 201 |
| 失败 | 1 |
| 跳过 | 1 |
| 总用例 | 203 |
| 持续时间 | 2.63s |
| 运行器 | vitest 4.1.9（jsdom） |

各测试文件结果：

| 文件 | 用例数 | 结果 |
| --- | --- | --- |
| `src/features/screen/registry/registry.test.ts` | 11 | 全部通过 |
| `src/features/screen/hooks/shortcuts-registry.test.ts` | 21 | 全部通过 |
| `src/features/screen/lib/smart-guides.test.ts` | 30 | 全部通过 |
| `src/features/screen/hooks/use-interaction-state-machine.test.ts` | 39 | 全部通过 |
| `src/features/screen/stores/editor-store.test.ts` | 9 | 全部通过 |
| `src/features/screen/hooks/use-keyboard-shortcuts.test.ts` | 9 | 全部通过 |
| `src/features/screen/lib/canvas-event-router.test.ts` | 59 | 全部通过 |
| `src/features/screen/components/number-input.test.tsx` | 25 | 23 passed / 1 failed / 1 skipped |

与 0.1 基线差异：基线记录前端 200 用例，当前 203 用例（201 通过 + 1 失败 + 1 跳过）。多出的 3 个用例均位于 `number-input.test.tsx`（由 22 → 25），来自任务 4.1 新增的 NumberInput 外部值更新测试。

#### 6.3.1 失败用例（任务 4.1 引入的预期失败，留给 4.2 修复）

- 文件：`src/features/screen/components/number-input.test.tsx`
- describe 块：`NumberInput > 外部 value 变更同步`
- 用例标题：`编辑 draft 时外部 value 变化，按"外部值优先"显示新值`
- 位置：`src/features/screen/components/number-input.test.tsx:240:27`
- 错误类型：`AssertionError`
- 错误摘要：`expected '15' to be '30' // Object.is equality`
- 期望值：`'30'`（外部新值）
- 实际值：`'15'`（旧 draft）
- 根因（测试代码注释）：当前实现为 `draft ?? String(value)`，编辑中保留旧 draft `'15'`，未识别外部 value 变化使旧 draft 失效；测试已在 4.1 阶段以预期失败形式固化，留给 4.2 修复。

原始失败输出（保留）：

```
FAIL  src/features/screen/components/number-input.test.tsx > NumberInput > 外部 value 变更同步 > 编辑 draft 时外部 value 变化，按"外部值优先"显示新值
AssertionError: expected '15' to be '30' // Object.is equality

Expected: "30"
Received: "15"

 ❯ src/features/screen/components/number-input.test.tsx:240:27
    238|       // 期望：外部新值优先，旧 draft 失效
    239|       // 当前实现：draft ?? String(value) → 仍显示 '15'，测试预期失败（任务 4.2 修复）
    240|       expect(input.value).toBe('30');
       |                           ^
    241|     });
    242|
```

#### 6.3.2 跳过用例（任务 4.1 标记，等待 4.2 启用）

- 文件：`src/features/screen/components/number-input.test.tsx:243`
- 用例标题：`切换 syncKey（选中对象/字段）后旧 draft 被清除`
- 形式：`it.skip(...)`，由任务 4.1 主动标记为跳过，等待 4.2 实现后再启用。

### 6.4 汇总与说明

| 维度 | 文件数 | 通过 | 失败 | 跳过 | 总用例 | 退出码 |
| --- | --- | --- | --- | --- | --- | --- |
| shared 全量 | 9 | 108 | 0 | 0 | 108 | 0 |
| 后端 screen | 2 | 24 | 0 | 0 | 24 | 0 |
| 前端 screen | 8 | 201 | 1 | 1 | 203 | 1 |

说明：

- 唯一的失败用例来自任务 4.1 主动引入的预期失败，不在本任务修复范围内，按计划留给 4.2 修复。
- 唯一的跳过用例同样由任务 4.1 主动标记，等待 4.2 启用。
- 后端 screen 用例数较 0.1 基线（21）增加 3 个，差异来自任务 1.1 新增的服务契约测试。
- 前端 screen 用例数较 0.1 基线（200）增加 3 个，差异来自任务 4.1 新增的 NumberInput 测试。
- 任务 3.1 仅新增样式解析函数、未配套测试（3.2 未完成），因此前端 screen 测试不包含样式解析相关用例。
- 任务 5.1 的保存冲突业务码测试位于 `packages/shared/src/errors/index.test.ts`，已包含在 6.1 的 shared 全量结果中（12 个用例通过），未单独拆分。
- E2E 未运行，按任务要求留给后续验收。
- 任务 0.1 基线中前端 number-input.test.tsx 计 22 用例，与 vitest 报告的 25 tests 差异为 3（22 + 3 新增 = 25），与 0.1 取证口径一致。
