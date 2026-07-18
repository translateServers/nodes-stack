# Checklist

本 checklist 用于验证研究产出物的完整性与质量。每个检查点对应 spec.md 中的某个 Requirement 或 Scenario。

## spec.md 结构完整性

- [x] 包含 `## Why` 章节，1–2 句说明问题/机会
- [x] 包含 `## What Changes` 章节，列出全部产出物
- [x] 包含 `## Impact` 章节，列出受影响的 specs 与代码文件
- [x] 包含 `## ADDED Requirements` 章节
- [x] 包含 `## MODIFIED Requirements` 章节
- [x] 包含 `## REMOVED Requirements` 章节（即使为"无"也需声明）

## Requirement: 交互逻辑架构分层模型

- [x] 6 个正交层均有明确命名与职责描述：事件路由层 / 交互状态机 / 工具状态机 / 修饰键栈 / 直接操作反馈层 / 面板联动层
- [x] 包含事件路由层仲裁右键菜单与 Moveable 控件的 Scenario（命中 `.moveable-control-box` 跳过 + modal={false} 不破坏）
- [x] 包含事件路由层处理菜单已打开时再次右键的 Scenario（flushSync + 双 rAF 重派发）
- [x] 包含交互状态机隔离拖拽与文本编辑的 Scenario（isEditingText 与 nativeEventEnabled 独立）
- [x] 包含交互状态机从框选到拖拽转换的 Scenario（marquee-selecting → dragging）
- [x] 包含修饰键栈处理嵌套临时切换的 Scenario（Space + Alt 嵌套压栈/出栈）
- [x] 包含修饰键栈在 window blur 时兜底重置的 Scenario（防止 keyup 丢失导致 cursor 卡死）
- [x] 包含工具状态机切换主工具时清空临时栈的 Scenario（setTool 幂等清栈）
- [x] 包含工具状态机临时切换栈防止重复压栈的 Scenario（keydown repeat 幂等）
- [x] 包含直接操作反馈层智能对齐线显示阈值的 Scenario（5px 显示 + 3px 吸附）
- [x] 包含直接操作反馈层与属性面板实时同步的 Scenario（< 1 帧延迟）
- [x] 包含面板联动层选中状态同步的 Scenario（三处订阅同一 React commit）
- [x] 包含面板联动层双向写入的 Scenario（属性面板修改触发画布更新）
- [x] 层间依赖关系明确为"单向依赖，无环"（含 ASCII 依赖图）
- [x] 每层都标注与现有代码的对应关系（含 file:/// 链接 + 行号范围）

## Requirement: Photoshop 交互模式适配表

- [x] 表格至少 20 行（实际 20 行 + 8 行 N/A 项 = 28 行）
- [x] 每行包含 4 列：PS 交互模式 / Nebula 现状 / 目标状态 / 实现策略摘要
- [x] "Nebula 现状"列每行标注"已达标 / 部分实现 / 未实现 / 不适用"（用粗体前缀标记）
- [x] "实现策略摘要"列每行标注触及的文件路径或 hook/store 名称
- [x] 至少 1 项标注为"不适用"并说明理由（实际 8 项 N/A：3D / Camera Raw / 视频时间轴 / 动画面板 / 历史画笔 / CMYK 颜色 / 路径文字 / 通道混合）
- [x] 已达标的项（如 Shift 约束比例、Ctrl 多选、双击进入分组、Esc 分层退出）保持标注，不删除

## Requirement: 散落副作用归一化清单

- [x] 至少 7 项散落副作用热点（实际 8 项，超过要求）
- [x] 每项包含：当前实现的副作用位置（文件 + 行号范围，含 file:/// 链接）
- [x] 每项包含：归一化后的归属层（如：modal={false} → 事件路由层契约）
- [x] 每项包含：向后兼容性影响（是否需要保留旧路径作为兜底）
- [x] 至少覆盖：modal={false} 补丁（热点 1）、手动双击判定（热点 2）、wheel 缩放（热点 3）、nudge 散落绑定（热点 4）、Selecto onSelectEnd 副作用（热点 5）、flushSync 双 rAF（热点 6）、pushHistory 重复调用（热点 7）
- [x] 额外补充：Moveable onDrag/onResize/onRotate 直接 DOM style 操作（热点 8）

## Requirement: 演进路线与兼容性约束

- [x] 至少 3 个阶段（事件路由层 / 交互状态机 / 反馈层与面板联动）
- [x] 每阶段独立可交付，标注前置依赖
- [x] 标注可能新增的依赖（dnd-kit）并在 spec 中单独标记
- [x] 复述项目工程约束：TS strict / ESLint type-checked / Biome 格式 / shadcn 边界 / Promise 处理
- [x] 每个新增层定义单元测试钩子（6 行表格：事件路由层 / 交互状态机 / 工具状态机 / 修饰键栈 / 反馈层 / 面板联动层）

## Requirement: 研究方法论与参考依据

- [x] 说明使用了"代码考古"方法并引用了 Nebula 现有文件
- [x] 说明 PS 交互模式归纳基于公开行为而非猜测
- [x] 说明调用了 `ui-ux-pro-max` 至少 3 类检索（实际 5 类：design-system / ux×2 / stack react / domain web）
- [x] 不包含未经证实的事实声明

## Requirement: 工具状态机扩展契约（MODIFIED）

- [x] 明确声明保留现有 `activeTool` / `currentTool` / `hasTemporaryTool` / `setTool` / `pushTemporaryTool` / `popTemporaryTool` / `isEditingText` / `setEditingText` 全部对外 API
- [x] 内部增加"工具副作用注册表"概念描述（仅文档，不在本 spec 实施）
- [x] 不引入破坏性 API 变更

## Requirement: shortcuts-registry 扩展契约（MODIFIED）

- [x] 新增 `ShortcutCategory` 值：`tool` 与 `ui`
- [x] 现有 `ShortcutDefinition` 条目保持兼容声明
- [x] 给出新增条目示例（brushSizeDecrease/Increase、toggleUI、cycleScreenMode、eyedropperTemp）

## 文档质量

- [x] 所有代码引用使用 `file:///` 绝对路径链接格式（参见 [screen-canvas.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx) 示例）
- [x] 不使用 emoji 作为图标
- [x] 中文术语与英文原词并列出现时格式统一（如"工具状态机（Tool State Machine）"）
- [x] 表格列宽对齐，markdown 渲染无错位
- [x] 所有文件路径使用与项目实际一致的格式（c:/worker/nebula/...）
