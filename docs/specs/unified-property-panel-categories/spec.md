# 统一右侧属性面板分类方案 Spec

> 状态：实施中（P0/P1/P2 分阶段交付，部分已完成，进度见 tasks.md / checklist.md）
> 最近更新：2026-07-27
> 定位：右侧属性面板统一为属性/数据/交互/事件四大类，吸收 Light Chaser 与 GoView 的分类优点

## Why

当前大屏设计器右侧属性面板的分类与组织方式存在以下问题：
1. `PropertyTabId` 已有 `appearance | data | interaction | events` 四值，但 bar-chart 仍以 `customRender` 平铺「数据/逻辑/视觉/交互」四层，与其他组件的 tab 切换体验不一致。
2. 缺少 Light Chaser 的「全局变量」「组件滤镜」「文本细化（字间距/行间距/描边）」等增强能力。
3. 事件蓝图（`ScreenProject.blueprint`）数据已落地，但右侧属性面板无组件视角的快速事件配置入口，用户必须打开 Sheet 才能编辑。
4. 缺少与 GoView「定制/动画/数据/事件」四大类对齐的统一心智模型。

需要结合 Light Chaser（React 生态、蓝图节点更丰富、全局变量、滤镜、文本细化）与 GoView（四大类简洁分类、过滤器）的优点，给出一个统一的右侧属性面板分类终极方案。

## What Changes

### 大类划分（与 GoView 对齐，4 个）
- **属性（appearance）**：位置尺寸 / 层级状态 / 样式 / 文本 / 图表配置 / 滤镜
- **数据（data）**：数据源 / 字段映射 / 数据转换 / 全局变量绑定
- **交互（interaction）**：悬停提示 / 选中高亮 / 联动触发
- **事件（events）**：快速事件配置（派生自 blueprint） + 打开事件蓝图入口

### Schema 扩展（吸收 Light Chaser 特色）
- **ComponentStyleSchema 扩展**：新增 `filter`（hue-rotate / saturate / brightness / contrast / blur / grayscale / opacity 滤镜链）、`letterSpacing`（字间距）、`textStroke`（描边：宽度+颜色）
- **ScreenProjectSchema 扩展**：新增 `globalVariables: GlobalVariableSchema[]`（项目级变量，可在数据源参数与蓝图模板插值中引用）
- **PropertyTabId 不变**：保持 `appearance | data | interaction | events` 四值，无需新增 tab

### 渲染器适配
- 现有 `section-renderer.tsx` 的 tab 容器策略扩展：当 schema 涉及 customRender 分区时，**也启用 Tabs 容器**（修复 bar-chart 平铺不一致问题）
- bar-chart 的「数据/逻辑/视觉/交互」四层 customRender 重组为：
  - 数据 → `data` tab
  - 逻辑 → `data` tab（合并到数据源下方作为子分区）
  - 视觉 → `appearance` tab（与位置/样式并列）
  - 交互 → `interaction` tab

### 事件 Tab 与蓝图数据共享（关键）
- 新增 `QuickEventEditor` 组件，渲染当前选中组件相关的事件规则（派生自 `ScreenProject.blueprint`）
- 复用现有 `blueprint/compiler/filter-by-component.ts` 过滤规则
- 写操作走 `editor-store` 的现有蓝图 API（`updateBlueprint` / `beginBlueprintGesture` / `endBlueprintGesture`），保证历史栈一致
- 提供「打开事件蓝图」按钮，调用 `editor-store.openBlueprintSheet()`，可选传入 `focusComponentId`

### 全局变量机制（Light Chaser 特色）
- 新增 `GlobalVariableSchema`：`{ id, name, type: 'static' | 'api' | 'computed', value, apiConfig?, expression? }`
- 数据源参数绑定支持 `{{globalVars.xxx}}` 模板插值（复用 `template-interpolation.ts`）
- 全局变量管理入口放在画布设置（未选中组件时的属性面板）

### 文本细化配置（Light Chaser 特色）
- 扩展 `STYLE_SECTION` 与 `TEXT_PROPS_SECTION`：新增字间距、行间距、描边宽度、描边颜色
- 复用现有 `field-controls.tsx` 的 number/color 控件

### 组件滤镜（Light Chaser 特色）
- 新增 `FILTER_SECTION`（appearance tab）：6 个 number 控件（hue-rotate 0-360 / saturate 0-200 / brightness 0-200 / contrast 0-200 / blur 0-20px / grayscale 0-100）
- 渲染层（screen-canvas.tsx）将 `style.filter` 转换为 CSS `filter` 属性

## Impact

- **Affected specs**：
  - `docs/specs/screen-editor/README.md`（§10 事件蓝图、§7 属性面板）
  - `docs/architecture/blueprint-runtime-architecture.md`（新增右侧面板派生视图说明）
  - `docs/architecture/screen-editor-architecture.md`（属性面板分类）
- **Affected code**：
  - `packages/shared/src/schemas/screen.schema.ts`（ComponentStyleSchema 扩展、ScreenProjectSchema.globalVariables）
  - `packages/shared/src/schemas/blueprint.schema.ts`（GlobalVariableSchema 新增）
  - `apps/web/src/features/screen/property-schema/types.ts`（PropertyTabId 注释更新）
  - `apps/web/src/features/screen/property-schema/schemas.tsx`（新增 FILTER_SECTION、扩展 STYLE/TEXT_PROPS_SECTION、bar-chart 重组）
  - `apps/web/src/features/screen/property-schema/section-renderer.tsx`（tab 容器策略修复）
  - `apps/web/src/features/screen/property-schema/field-controls.tsx`（可能新增 filter-chain 控件）
  - `apps/web/src/features/screen/components/property-panel.tsx`（画布设置新增全局变量入口）
  - `apps/web/src/features/screen/components/quick-event-editor.tsx`（新增）
  - `apps/web/src/features/screen/components/bar-chart-config-sections.tsx`（四层重组为 tab 内分区）
  - `apps/web/src/features/screen/components/screen-canvas.tsx`（filter 渲染）
  - `apps/web/src/features/screen/stores/editor-store.ts`（globalVariables 操作 API）

## ADDED Requirements

### Requirement: 四大类统一分类

系统 SHALL 在右侧属性面板顶部提供 4 个图标 Tab：属性（appearance）/ 数据（data）/ 交互（interaction）/ 事件（events），点击切换大类，大类内部用 `PanelSection` 折叠分区组织子配置。

#### Scenario: 单选文本组件
- **WHEN** 用户选中 text 组件
- **THEN** 属性面板显示 4 个 tab，默认激活「属性」tab，包含「位置尺寸 / 样式 / 文本 / 层级状态 / 滤镜」5 个可折叠分区
- **AND** 「数据」「事件」tab 显示空状态提示（text 组件无数据源与事件）

#### Scenario: 单选 bar-chart 组件
- **WHEN** 用户选中 bar-chart 组件
- **THEN** 「属性」tab 包含「位置尺寸 / 图表配置 / 样式 / 层级状态 / 滤镜」
- **AND** 「数据」tab 包含「数据源 / 字段映射 / 数据转换」
- **AND** 「交互」tab 包含「悬停提示」
- **AND** 「事件」tab 显示当前组件相关的蓝图规则列表

#### Scenario: 未选中组件
- **WHEN** 画布无选中
- **THEN** 属性面板显示画布设置（宽度/高度/背景/缩放模式）+ 全局变量管理入口

### Requirement: 事件 Tab 派生视图

系统 SHALL 在「事件」tab 渲染 `QuickEventEditor`，从 `ScreenProject.blueprint` 派生当前选中组件相关的事件规则列表，所有写操作通过 `editor-store` 的蓝图 API 走统一历史栈。

#### Scenario: 查看组件相关规则
- **WHEN** 用户选中 bar-chart_001 并切换到「事件」tab
- **THEN** 面板显示两组列表：
  - 「触发器（本组件作为源）」：列出所有 `config.componentId === bar-chart_001` 的 trigger 节点及其下游动作链
  - 「动作（本组件作为目标）」：列出所有 `config.targetComponentId === bar-chart_001` 的 action 节点及其上游触发器
- **AND** 每条规则可展开查看完整动作链

#### Scenario: 添加快速规则
- **WHEN** 用户点击「+ 添加触发器」，选择「点击本组件 → 跳转 URL」
- **THEN** 系统调用 `editor-store.updateBlueprint` 新增 1 个 trigger(componentClick) 节点 + 1 个 action(navigate) 节点 + 1 条 edge
- **AND** 历史栈记录一条三重快照（components + canvas + blueprint）

#### Scenario: 打开事件蓝图
- **WHEN** 用户点击「打开事件蓝图」按钮
- **THEN** 系统调用 `editor-store.openBlueprintSheet({ focusComponentId: 当前组件id })`
- **AND** 蓝图 Sheet 打开后自动过滤到该组件相关节点

### Requirement: 全局变量

系统 SHALL 在 `ScreenProjectSchema` 新增 `globalVariables: GlobalVariableSchema[]` 字段，支持静态值、API 拉取、计算表达式三种类型，可在数据源参数与蓝图模板插值中通过 `{{globalVars.xxx}}` 引用。

#### Scenario: 创建全局变量
- **WHEN** 用户在画布设置中点击「+ 添加全局变量」，填写名称 `apiBaseUrl`、类型 `static`、值 `https://api.example.com`
- **THEN** `ScreenProject.globalVariables` 新增一条记录
- **AND** 在任意数据源 API 配置的 URL 字段中输入 `{{globalVars.apiBaseUrl}}/data` 时，预览渲染时会被插值替换

#### Scenario: API 类型全局变量
- **WHEN** 用户创建类型为 `api` 的全局变量，配置拉取 URL 与刷新间隔
- **THEN** 预览模式下系统按刷新间隔拉取，最新值缓存在运行时上下文供插值使用

### Requirement: 组件滤镜

系统 SHALL 在 `ComponentStyleSchema` 新增 `filter` 字段，支持 6 种 CSS 滤镜参数，在「属性」tab 的「滤镜」分区配置，渲染时转换为 CSS `filter` 属性。

#### Scenario: 应用滤镜
- **WHEN** 用户为 bar-chart 组件配置 `filter: { brightness: 80, saturate: 150 }`
- **THEN** 画布渲染时该组件的容器 div 应用 `filter: brightness(80%) saturate(150%)`
- **AND** 预览模式与发布模式均生效

### Requirement: 文本细化配置

系统 SHALL 扩展 `ComponentStyleSchema` 新增 `letterSpacing`、`textStrokeWidth`、`textStrokeColor` 字段，在「属性」tab 的「文本」分区提供配置控件。

#### Scenario: 配置字间距与描边
- **WHEN** 用户为 text 组件配置 `letterSpacing: 2`、`textStrokeWidth: 1`、`textStrokeColor: '#000000'`
- **THEN** 渲染时应用 `letter-spacing: 2px` 与 `-webkit-text-stroke: 1px #000000`

## MODIFIED Requirements

### Requirement: bar-chart 属性面板组织方式

原 bar-chart 通过 `customRender` 平铺「数据/逻辑/视觉/交互」四层 PanelSection，现重组为按 tab 分布：
- 「数据」tab：数据源 + 字段映射 + 数据转换（原数据层 + 逻辑层）
- 「属性」tab：图表配置 + 位置尺寸 + 样式 + 滤镜（原视觉层 + 通用分区）
- 「交互」tab：悬停提示（原交互层）
- 「事件」tab：QuickEventEditor（新增）

**Migration**：bar-chart 的 `BAR_CHART_SCHEMA` 不再使用单一 customRender 分区，改为按 tab 分布的多个分区（含 customRender 与声明式字段混合）。

### Requirement: section-renderer tab 容器策略

原策略「涉及 2+ tab 且无 customRender 分区时启用 Tabs」改为「涉及 2+ tab 时始终启用 Tabs」，customRender 分区按其 `tab` 字段归入对应 tab。

## REMOVED Requirements

### Requirement: bar-chart 四层平铺架构

**Reason**：与统一四大类分类不一致，用户在 bar-chart 与其他组件间切换时心智模型不连续。
**Migration**：四层内容按 tab 重组，不丢失任何配置项，仅改变组织方式。
