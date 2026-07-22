# 事件蓝图 Spec

## Why

阶段 0 稳定了可靠性基线，阶段 1 完成了单用户交互闭环，阶段 2 建立了"数据、逻辑、视觉、交互"四层配置契约并打通 bar-chart 数据源链路。当前交互层能力止步于组件级配置（[InteractionConfigSchema](../../../packages/shared/src/schemas/screen.schema.ts) 仅含 `tooltipOnHover`），而占位骨架 [event-blueprint-sheet.tsx](../../../apps/web/src/features/screen/components/event-blueprint-sheet.tsx) 承诺的"节点式事件流编排能力，支持组件间通信、状态联动与外部 API 触发"完全未实现，Sheet 内仅有"功能开发中"提示。

缺失事件蓝图导致两个直接后果：一是用户无法表达"点击图表跳转详情页""点击按钮切换面板显隐"等大屏最常见的交互诉求，配置项之间形成孤岛；二是交互层契约只有组件级一个位置，跨组件编排没有数据模型承载，后续角色工作区（阶段 4）与协作（阶段 5）将缺少交互语义基础。

本 Spec 是 `evolve-screen-design-platform` 总体规划下事件蓝图能力的独立实施规格，按工业级可视化蓝图编辑器标准建设：图结构存储 + 纯函数编译执行 + React Flow 节点画布。进入门禁为阶段 2 checklist、验证记录和关键回归全部有效；任一门禁失效时不得开始或继续。实施采用"契约先行 → 编译器 → 运行时 → 编辑器画布 → 历史与保存集成 → M1 验收 → 调试与联动（M2）→ 高级能力（M3）"的渐进策略，保留现有四层配置、编辑器 Store 结构与预览链路，不进行一次性重写。

## What Changes

- 在 `@nebula/shared` 建立版本化的蓝图图结构契约：`ScreenProjectSchema` 新增可选 `blueprint` 字段（`version` + `nodes[]` + `edges[]`），节点按 `trigger / condition / action / comment` 分类并以判别联合定义配置；全部可选以保持向后兼容。
- 实现蓝图编译器纯函数：图 → 诊断（环、悬空引用、空参数、孤立节点）+ 拓扑排序 → 线性可执行规则（`CompiledRule[]`）；诊断分级（错误/警告），UI 问题面板与运行时共用同一份编译结果。
- 实现蓝图运行时引擎：纯函数执行计划（规则匹配、深度上限截断）+ 薄执行器（动作派发）；仅公开预览与 Sheet 内模拟沙盒执行，编辑器画布不触发蓝图。
- 将 [event-blueprint-sheet.tsx](../../../apps/web/src/features/screen/components/event-blueprint-sheet.tsx) 占位骨架替换为基于 `@xyflow/react`（React Flow）的工业级节点编辑器：引脚磁吸连线、不兼容引脚置灰、松手空白弹搜索面板、多选框选、网格与对齐吸附、缩放平移、小地图（M2）、跨项目剪贴板。
- 本地编辑历史条目从"组件数组 + 画布配置"扩展为"组件数组 + 画布配置 + blueprint"快照；蓝图编辑经 `withHistory` 入栈，Sheet 内撤销/重做与编辑器全局同一历史栈。
- `UpdateScreenProjectSchema` 扩展 `blueprint` 字段，服务端保存使用同一共享 Schema 校验；公开预览运行时执行蓝图，敏感请求头脱敏语义沿用阶段 2 规则。
- M2 交付模拟调试（链路高亮动画 + 执行日志）、画布 ↔ 蓝图双向联动、模板库；M3 交付 condition 条件节点、`dataLoaded`/`dataError`/`hover`/`interval` 触发器、`requestApi` 动作与参数模板插值。
- 本 Spec 只定义规格、任务和验收标准；获得批准前不修改产品代码。

## Impact

- Affected specs:
  - `evolve-screen-design-platform`：交互层能力的独立细化实施；本规格不替代阶段 3 及以后的任何规划。
  - `layer-component-config`：阶段 2 的四层契约、数据源链路、历史语义与脱敏规则不回退；交互层位置说明按本规格修订（见 MODIFIED Requirements）。
  - `close-single-user-interactions`：阶段 1 的交互状态机与事件路由契约不回退；编辑器画布的选择/变换语义优先于蓝图触发。
  - `stabilize-screen-baseline`：阶段 0 的保存基线、发布与公开预览隔离语义不回退。
- Affected code（实施阶段的预期影响面，本次不修改）:
  - `packages/shared/src/schemas/screen.schema.ts`：蓝图图结构契约、`ScreenProjectSchema` 与 `UpdateScreenProjectSchema` 扩展。
  - `apps/web/src/features/screen/blueprint/`：新模块（Sheet、节点、边、面板、编译器、引擎、运行时 Hook）。
  - `apps/web/src/features/screen/components/event-blueprint-sheet.tsx`：占位骨架被新模块替换。
  - `apps/web/src/features/screen/stores/editor-store.ts`：历史快照结构扩展与蓝图编辑 action。
  - `apps/web/src/features/screen/components/screen-preview.tsx`：预览运行时接入。
  - `apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts`：Sheet 打开期间快捷键分层。
  - `apps/nestjs-server/src/modules/screen/`：保存接口同源校验、公开预览数据沿用脱敏规则。
  - `apps/web/package.json`：新增依赖 `@xyflow/react`（见"可能新增的依赖"）。
  - `apps/web/e2e/tests/`：蓝图可视化搭建、预览执行、模拟调试与回归 E2E。

## ADDED Requirements

### Requirement: 蓝图图结构契约

系统 SHALL 在 `@nebula/shared` 定义版本化的蓝图图结构，并挂载为 `ScreenProjectSchema` 的可选 `blueprint` 字段，作为交互层的项目级位置。

#### Scenario: 图结构与版本字段

- **WHEN** 校验一个包含蓝图的项目
- **THEN** `blueprint` 包含 `version: 1`、`nodes[]`、`edges[]`
- **AND** 节点包含 `id`、`kind`、`position { x, y }`、`config`
- **AND** 边包含 `id`、`source`、`sourceHandle`、`target`、`targetHandle`，仅承载执行流
- **AND** 未来版本演进通过 `version` 字段迁移，不做静默改写

#### Scenario: 节点配置判别联合

- **WHEN** 校验各类节点
- **THEN** `trigger` 节点配置为 `componentClick { componentId }` 或 `pageLoad`（M3 扩展 `componentHover` / `dataLoaded` / `dataError` / `interval`）
- **AND** `action` 节点配置为 `setVisibility { targetComponentId, visible: show|hide|toggle }`、`navigate { url, target }`、`scrollToComponent { targetComponentId }`、`refreshDataSource { targetComponentId }`（M3 扩展 `requestApi`）
- **AND** `condition` 节点配置为字段比较表达式（M3 交付，契约可先行预留）
- **AND** `comment` 节点配置为纯文本，不参与编译执行
- **AND** 未知 `kind` 或未知动作类型被拒绝并给出可读错误

#### Scenario: 向后兼容

- **GIVEN** 一个无 `blueprint` 字段的既有项目
- **WHEN** 项目被加载、保存或公开预览
- **THEN** 共享 Schema 解析成功，行为与契约演进前一致
- **AND** 保存不会为未编辑蓝图的项目凭空写入 `blueprint` 字段

#### Scenario: navigate URL 协议白名单

- **WHEN** `navigate` 动作的 URL 协议不在 http/https 白名单内（如 `javascript:`）
- **THEN** 共享 Schema 拒绝该配置并给出可读错误
- **AND** 服务端保存接口同样拒绝，非法配置不写入数据库

#### Scenario: 服务端同源校验

- **WHEN** 服务端接收包含 `blueprint` 的保存请求
- **THEN** 服务端使用 `@nebula/shared` 同一 Schema 校验
- **AND** `UpdateScreenProjectSchema` 扩展 `blueprint` 可选字段，`expectedUpdatedAt` 保存基线语义不变

### Requirement: 蓝图编译器

系统 SHALL 提供纯函数编译器，将图结构编译为线性可执行规则集与结构化诊断，不发起 IO、不产生副作用。

#### Scenario: 拓扑编译

- **WHEN** 编译器接收合法图
- **THEN** 以 `trigger` 节点为入口、`pageLoad` 与组件事件分别聚合
- **AND** 每个触发器产出一条 `CompiledRule`，其动作按拓扑序展开
- **AND** `comment` 节点与未连接到任何触发器的子图被排除在执行规则外并产生提示级诊断

#### Scenario: 环检测

- **WHEN** 图中存在执行流环
- **THEN** 编译器返回错误级诊断并定位构成环的节点与边
- **AND** 含环触发器不产出执行规则，其余合法触发器不受影响

#### Scenario: 悬空组件引用

- **WHEN** 节点引用的 `componentId` 在项目组件列表中不存在
- **THEN** 编译器返回警告级 `dangling` 诊断并定位节点
- **AND** 对应动作在运行时被跳过
- **AND** 节点与规则不被静默删除，用户可显式修复或清理

#### Scenario: 空参数诊断

- **WHEN** 动作节点缺少必填参数（如 `setVisibility` 未选目标组件）
- **THEN** 编译器返回错误级诊断并定位到节点与字段
- **AND** 诊断信息面向用户可读，可用于 UI 定位

### Requirement: 蓝图运行时引擎

系统 SHALL 在公开预览与 Sheet 模拟沙盒中执行编译后的规则，编辑器画布不执行蓝图。

#### Scenario: 编辑器画布不触发蓝图

- **WHEN** 用户在编辑器画布中点击、悬停组件
- **THEN** 仅触发阶段 1 确立的选择/变换交互语义，蓝图动作不执行
- **AND** 事件路由层与交互状态机仲裁结果不被蓝图干扰

#### Scenario: 预览执行与深度截断

- **WHEN** 公开预览中发生组件点击或页面加载
- **THEN** 运行时匹配启用中的触发器并按拓扑序执行动作
- **AND** 动作链触发新事件时递归深度超过上限（10 层）即截断并记录告警，不会死循环
- **AND** 单条规则内动作按顺序执行，前一个动作失败不中断后续独立动作

#### Scenario: 动作语义

- **WHEN** 执行 `setVisibility`
- **THEN** 作用于预览运行时的可见性覆盖表，不改写项目数据，组件在编辑器中的 `hidden` 状态不受影响
- **WHEN** 执行 `refreshDataSource`
- **THEN** 复用阶段 2 的取消协议与竞态防护，中止进行中请求，无浮动 Promise
- **WHEN** 执行 `navigate` 或 `scrollToComponent`
- **THEN** 分别按白名单 URL 打开目标、平滑滚动至目标组件位置

#### Scenario: 页面卸载清理

- **WHEN** 预览页卸载或项目切换
- **THEN** 进行中的蓝图动作被中止，计时器与请求被清理
- **AND** 不存在未处理的 Promise rejection

### Requirement: 可视化节点编辑器

系统 SHALL 将事件蓝图建设为基于 React Flow 的全屏节点编辑器，采用全屏弹层容器（`full-overlay`，带顶栏）承载，与 [docs/screen-designer-panels-architecture.md](../../../docs/screen-designer-panels-architecture.md) §7.4 容器形态指南一致；项目菜单入口保持不变。

#### Scenario: 连线与引脚磁吸

- **WHEN** 用户从输出引脚拖出连线
- **THEN** 兼容的输入引脚高亮磁吸，不兼容引脚置灰
- **AND** 连线松手落在空白处时弹出模糊搜索节点面板，选中节点后自动完成连线
- **AND** 双击空白处同样呼出搜索面板，支持键盘上下选择与 Enter 插入

#### Scenario: 节点操控

- **WHEN** 用户编辑图
- **THEN** 支持点选、Shift 多选、框选、Ctrl+A 全选与多选整体拖拽
- **AND** 节点移动吸附 8px 网格，并提供节点间对齐吸附线
- **AND** 滚轮以光标为中心缩放（0.25x–2x），Space+拖拽平移
- **AND** 节点按分类着色：触发=琥珀、条件=蓝、动作=绿、注释=灰，并直接显示组件名称与类型图标而非裸 id

#### Scenario: 剪贴板

- **WHEN** 用户复制、剪切、粘贴节点
- **THEN** Ctrl+C/X/V 与 Ctrl+D 快速复制可用，粘贴时重新生成节点 id
- **AND** 复制内容为 JSON 写入系统剪贴板，支持跨项目粘贴，粘贴前经共享 Schema 校验
- **AND** 非法剪贴板内容给出可读提示，不产生脏节点

#### Scenario: 快捷键分层

- **WHEN** 蓝图全屏弹层打开
- **THEN** 画布全局快捷键被挂起，弹层内快捷键独立生效
- **AND** Esc 分层执行：取消进行中的连线 → 取消选择 → 关闭全屏弹层
- **AND** 弹层内撤销/重做与编辑器全局本地编辑历史同一栈

### Requirement: 蓝图编辑进入本地编辑历史

系统 SHALL 将蓝图编辑纳入本地编辑历史，撤销/重做语义与既有约定一致。

#### Scenario: 历史快照结构扩展

- **WHEN** 任一入历史的编辑操作发生
- **THEN** 历史条目同时记录组件数组、画布配置与 `blueprint` 快照
- **AND** 撤销/重做同步恢复三者，不出现蓝图与组件错配
- **AND** 历史容量限制与 `loadProject` 清空历史的语义不变

#### Scenario: 历史语义不膨胀

- **WHEN** 用户拖拽节点调整布局
- **THEN** 一次拖拽结束只产生一条历史记录，位移过程中的中间态不入栈
- **AND** 无实际变化的提交不产生空历史记录

### Requirement: 校验与问题面板

系统 SHALL 在 Sheet 内提供实时诊断与问题面板。

#### Scenario: 实时诊断与定位

- **WHEN** 图发生任何编辑
- **THEN** 编译器诊断实时刷新，问题节点在画布上以标记呈现
- **AND** 问题面板按错误/警告分级列出诊断，点击条目定位并闪烁聚焦对应节点

#### Scenario: 诊断与保存发布的关系

- **WHEN** 图存在错误级诊断
- **THEN** 不阻塞项目保存（非破坏原则）
- **AND** 发布操作给出明确确认提示，列出错误级诊断摘要
- **AND** 错误级诊断对应的触发器在预览运行时不执行

### Requirement: 模拟调试（M2）

系统 SHALL 提供 Sheet 内模拟触发与执行可视化调试。

#### Scenario: 模拟触发与链路高亮

- **WHEN** 用户在 Sheet 内对某个触发器节点执行模拟触发
- **THEN** 执行路径上的边呈现流动高亮动画，经过的节点依次亮起
- **AND** 调试在独立沙盒运行时执行，不污染预览与画布真实状态

#### Scenario: 执行日志

- **WHEN** 模拟触发完成
- **THEN** 日志面板按序展示每个动作的执行/跳过结果、跳过原因与耗时
- **AND** 失败动作红色标记并可点击定位到节点

### Requirement: 双向联动与模板（M2）

系统 SHALL 提供蓝图与画布之间的双向定位联动与新手模板。

#### Scenario: 双向联动

- **WHEN** 用户点击蓝图节点
- **THEN** 主画布闪烁高亮对应组件
- **WHEN** 用户在画布选中组件
- **THEN** 蓝图过滤展示"涉及此组件"的节点与链路
- **AND** 组件重命名时节点标签实时跟随

#### Scenario: 模板与空态引导

- **WHEN** 蓝图为空
- **THEN** 空态提供一键模板（如"点击图表 → 跳转详情页""点击按钮 → 显隐切换""页面加载 → 刷新全部数据源"）
- **AND** 模板插入的节点经共享 Schema 校验并作为一条本地编辑历史入栈

### Requirement: 高级触发与动作（M3）

系统 SHALL 在 M1/M2 稳定后扩展条件分支与高级触发器。

#### Scenario: condition 条件节点

- **WHEN** 链路中包含 condition 节点
- **THEN** 其 `then` / `else` 两个输出引脚按表达式求值结果分流执行
- **AND** 表达式构建器支持字段来源（触发组件静态属性/数据解析结果）与比较运算符，不产生自定义脚本

#### Scenario: 高级触发器

- **WHEN** 配置 `dataLoaded` / `dataError` / `componentHover` / `interval` 触发器
- **THEN** 分别在数据解析成功、解析失败、悬停、会话内定时间隔到达时触发
- **AND** `interval` 仅在预览会话内有效，页面卸载即清理，不做服务端调度

#### Scenario: requestApi 动作与脱敏

- **WHEN** 执行 `requestApi` 动作
- **THEN** 请求配置沿用阶段 2 的 API 数据源契约与取消协议
- **AND** 公开预览中敏感请求头按共享识别规则脱敏，缺失导致失败时动作进入失败态，不使用占位值伪造

### Requirement: 安全与公开预览

系统 SHALL 保证蓝图在公开预览链路中的安全边界与既有语义一致。

#### Scenario: 公开预览执行边界

- **WHEN** 已发布项目通过公开预览打开
- **THEN** 蓝图按编译结果执行，草稿项目的蓝图不对外暴露
- **AND** 公开预览数据范围不因蓝图引入新的明文敏感信息

#### Scenario: 编辑器与预览一致性

- **WHEN** 同一项目在编辑器模拟沙盒与公开预览中分别执行同一触发器
- **THEN** 动作语义、深度截断与错误降级行为一致

### Requirement: 性能与工程规范

系统 SHALL 满足工业级性能与项目工程规范。

#### Scenario: 大蓝图性能

- **WHEN** 蓝图包含 200 个以上节点
- **THEN** 仅渲染可视区域节点，交互帧率不低于 50fps
- **AND** 节点组件 memo 化，边重算经 rAF 节流

#### Scenario: 工程规范

- **WHEN** 实施任一任务
- **THEN** 遵守 TypeScript strict、ESLint `recommendedTypeChecked`、Biome 格式规范
- **AND** 异步路径无浮动 Promise，编辑器外壳组件使用 shadcn/ui，节点画布渲染组件不强制引入 shadcn/ui

### Requirement: 阶段 0/1/2 行为不回退

系统 SHALL 在引入蓝图能力时保持阶段 0、1、2 全部已验收行为。

#### Scenario: 基线不回退

- **WHEN** 实施蓝图任一里程碑
- **THEN** 认证、公开预览发布状态隔离、保存基线冲突恢复、四层配置契约、数据源链路、定时刷新、脱敏、工具行为与交互状态机仲裁继续通过既有测试
- **AND** 数据源加载中的组件仍可正常选择、移动、缩放和删除

## MODIFIED Requirements

### Requirement: 交互层位置说明

阶段 2 契约中"交互层配置只存在于 `interaction` 字段"的表述 SHALL 修订为：组件级交互配置存在于 `interaction` 字段，项目级交互编排（事件蓝图）存在于 `blueprint` 字段；两者均为交互层的合法位置，边界清晰、互不替代。

#### Scenario: 两个位置互不替代

- **WHEN** 查阅或校验交互层配置
- **THEN** 组件自身的悬停提示等行为仍只写入组件 `interaction` 字段
- **AND** 跨组件触发与动作编排只写入项目级 `blueprint` 字段
- **AND** 修改任一位置不影响另一位置的配置值

### Requirement: 本地编辑历史条目结构再扩展

本地编辑历史条目 SHALL 从"组件数组 + 画布配置"扩展为"组件数组 + 画布配置 + blueprint"快照，撤销/重做语义保持既有约定。

#### Scenario: 既有历史行为不回退

- **WHEN** 历史条目结构扩展后
- **THEN** 组件与画布的既有撤销/重做行为与扩展前一致
- **AND** 未包含 `blueprint` 的历史快照在撤销/重做时按空蓝图处理，不产生异常

### Requirement: 事件蓝图占位骨架

[event-blueprint-sheet.tsx](../../../apps/web/src/features/screen/components/event-blueprint-sheet.tsx) 的"功能开发中"占位状态 SHALL 被真实节点编辑器替换，Beta 标记与占位文案在 M1 验收时移除。

#### Scenario: 入口不变

- **WHEN** M1 完成
- **THEN** 项目菜单·工具 → "事件蓝图"入口打开真实编辑器
- **AND** 占位骨架与"功能开发中"文案不再出现

## REMOVED Requirements

无。本规格不移除任何既有功能；占位骨架属于 MODIFIED 范围而非功能删除。

## Out of Scope

- 自定义 JS 脚本节点与任意代码执行。
- 数据流引脚连线（数据仅通过动作参数内的字段引用表达式传递，M3）。
- WebSocket 等实时触发源与多客户端事件广播。
- 服务端修订版（revision）、项目分支、实时多人协作、权限差异（阶段 3-5 范畴）。
- AI 生成规则与智能推荐。
- 云端模板库与跨项目蓝图文件导入导出（跨项目剪贴板粘贴在 M2 范围内）。
- `interval` 触发器的服务端调度（仅预览会话内有效）。

## 可能新增的依赖

- **`@xyflow/react`**（React Flow）：节点图编辑画布，React 生态事实标准，内置缩放平移、框选、引脚连线，类型完备。在 `apps/web/package.json` 的 `dependencies` 中声明，安装与锁定作为独立任务执行并在 tasks.md 中列出。
- 其它能力尽量复用现有 `zustand`、`radix-ui`、`shadcn/ui`、`react-hotkeys-hook`，不新增。

## 单元测试钩子

| 层 | 可测试单元 | 测试形式 |
|---|---|---|
| 契约 | `EventBlueprintSchema` / 节点判别联合 / URL 白名单 | 共享包 Vitest |
| 编译器 | 拓扑编译 / 环检测 / dangling / 空参数诊断 | Vitest 纯函数测试 |
| 引擎 | 规则匹配 / 深度截断 / 动作计划展开 | Vitest 纯函数测试 |
| 执行器 | setVisibility 覆盖表 / refreshDataSource 取消 / navigate 白名单 | Vitest + mock fetch |
| 历史 | 快照三要素同步恢复 / 拖拽合并单条历史 | editor-store 测试 |
| 编辑器 | 搜索面板过滤 / 剪贴板重新生成 id / 引脚兼容判定 | 组件测试 |
| 调试 | 沙盒执行 / 日志输出 / 不污染真实状态 | Hook 测试 |
