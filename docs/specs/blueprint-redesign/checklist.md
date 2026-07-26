# 事件蓝图重新设计 — 检查清单

> 状态：生效中
> 最近更新：2026-07-26
> 对应 Spec：[spec.md](./spec.md) | [tasks.md](./tasks.md)

## 设计哲学自检

- [x] **核心理念清晰**："组件为中心，锚点即事件" — 一个组件一个节点，事件=输出锚点，动作=输入锚点
- [x] **不是照搬 light-chaser**：保留了 nebula 的 Zod schema、编译器、诊断系统、历史栈、沙盒运行时等工程化能力
- [x] **有自己的设计哲学**：三阶层节点模型（组件节点 + 逻辑节点 + 注释节点）、动态锚点优先、渐进式复杂度
- [x] **简单交互无复杂度税**：点击→显示只需 1 条边（evt:click → act:show），无需创建独立 trigger/action 节点

## Schema 完整性

- [x] V2 schema 定义了 ComponentNode / ConditionNode / DelayNode / CommentNode 判别联合
- [x] ComponentNode 支持 globalType 子类型（pageLoad/navigate/requestApi/scrollTo）
- [x] 边 handle 格式语义化（evt:* / act:* / out / then / else / in）
- [x] EVENT_BLUEPRINT_VERSION 升级为 2
- [x] V1 schema 保留供迁移函数使用
- [x] 所有 V2 schema 有 Zod 单测覆盖

## 迁移兼容性

- [x] 提供 migrateBlueprintV1ToV2 迁移函数
- [x] trigger type → eventId 映射完整（6 种 trigger 全覆盖）
- [x] action type → actionId 映射完整（5 种 action 全覆盖）
- [x] pageLoad trigger 合并为单例全局节点
- [x] navigate/requestApi action 合并为单例全局节点
- [x] interval trigger 迁移为组件节点 + delay 组合
- [x] 无法推导的边保留并标记 warning
- [x] 项目加载时自动迁移，不保留 V1 原文

## 引脚兼容性

- [x] 支持语义化 handle 格式校验
- [x] evt→act / evt→in / out→act / out→in / then/else→act / then/else→in 兼容
- [x] act→* 禁止（动作锚点只能作为目标）
- [x] comment 节点不参与连线
- [x] 组件节点 evt→act 同节点自环允许
- [x] 逻辑节点自环禁止
- [x] 重复边检测
- [x] getCompatibleTargetPins 供磁吸高亮使用

## 编译器

- [x] 从组件节点输出锚点出发 DFS 展开执行计划
- [x] ActionStep 含 componentId + actionId
- [x] ConditionStep 按 then/else 分支独立展开
- [x] DelayStep 生成延时步骤
- [x] 环检测排除组件节点 evt→act 合法自环
- [x] 诊断：dangling 组件引用、空全局配置、delay 超范围
- [x] 深度截断防护（MAX_COMPILE_DEPTH）

## 运行时

- [x] collectRules 按 componentId + eventId 匹配
- [x] action 执行按 actionId 分发到 RuntimeDeps
- [x] condition 求值后递归执行 then/else 分支
- [x] delay 可取消（setTimeout + clearTimeout）
- [x] 预览运行时：mount 触发 pageLoad，组件 onClick/onHover 调用 onComponentEvent
- [x] 沙盒运行时：simulateEvent(componentId, eventId)，deps no-op
- [x] 链路高亮适配 V2 编译产物
- [x] error 诊断的规则拒绝执行

## 节点渲染

- [x] 组件节点：动态锚点派生（events→source, actions→target），emerald 配色
- [x] 全局节点：虚线边框 + Globe 图标，固定锚点，4 种子类型
- [x] 延时节点：amber 配色，显示 delayMs
- [x] 条件节点：purple 配色，then/else 双输出（保留 V1 设计）
- [x] 注释节点：gray 配色，无锚点（保留 V1 设计）
- [x] BaseNodeShell 支持 V2 配色方案和动态锚点

## 交互体验

- [x] 锚点磁吸：20px 范围自动吸附兼容目标锚点
- [x] 左侧节点面板：组件/逻辑/全局三分组，拖拽创建
- [x] 搜索面板保留为双击空白快捷创建入口
- [x] 右键菜单：保留三场景 + 组件节点「定位画布组件」+ 全局节点「配置」
- [x] 配置面板：按节点类型分发（全局节点/delay/condition/comment）
- [x] 节点配色语义化（emerald/purple/amber/gray）

## 模板

- [x] "点击跳转"：evt:click → 全局 navigate
- [x] "显隐切换"：evt:click → act:toggleVisibility
- [x] "页面加载刷新"：全局 pageLoad → act:refreshData
- [x] "延时执行"：evt:click → delay → act:show
- [x] 模板使用 V2 schema 构造并校验

## 组件集成

- [x] BlueprintEventContext Provider 注入（预览态）
- [x] 组件 onClick/onHover 调用 onComponentEvent
- [x] 编辑态不注入 Provider（事件回调为空）
- [x] 保留组件 interaction 字段的直接配置能力

## 质量门

- [x] `pnpm typecheck` 通过
- [x] `pnpm lint` 通过
- [x] `pnpm test` 全量通过（含迁移测试，2356 passed, 14 skipped）
- [x] `pnpm biome:check` 通过
- [x] V1→V2 迁移测试覆盖所有 trigger/action 类型
- [x] 无 any 类型绕过类型检查
- [x] 无 @ts-ignore / @ts-nocheck
