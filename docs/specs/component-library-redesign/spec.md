# 组件库重设计 Spec

> 状态：生效中（全部任务已完成，见 tasks.md / checklist.md）
> 最近更新：2026-07-27
> 定位：组件库扩展到 50+ 组件的重设计方案——统一注册接口、Map 索引化、收藏机制、分类折叠

## Why

当前组件库以「扁平数组 + 单层 category 分区 + 拖拽创建 + 最近使用」为核心模型，仅适合 6 个组件的规模。当组件数量增长到 50+ 时，会同时暴露三类问题：

1. **UX**：单层分区滚动疲劳、搜索无相关度排序、无收藏/置顶、分类分区不可折叠
2. **性能**：`getDefinitionByType` 线性扫描、`RecentComponentsList` 嵌套 O(N×M)、无搜索 debounce、全量 DOM 渲染
3. **维护**：新增一个组件需同步修改 4 处文件（`COMPONENT_DEFINITIONS` / `RENDERERS` / `ICON_MAP` / `PROPERTY_SCHEMAS`），漂移风险高；`COMPONENT_DEFINITIONS` 单文件扁平数组会膨胀

需要在保留现有交互习惯（拖拽创建、最近使用）的前提下，让组件库具备平滑扩展到 50+ 组件的能力。

## What Changes

### 统一注册接口（消除 4 处同步）

- 新增 `registerComponent(module)` 单一注册 API，将「组件定义 + 渲染器 + 图标 + 属性 Schema」聚合为一个 module 对象
- `COMPONENT_DEFINITIONS` / `RENDERERS` / `ICON_MAP` / `PROPERTY_SCHEMAS` 改为从注册表派生，不再手动维护
- 现有 6 个组件（text / bar-chart / rect / ellipse / image / button）迁移到新接口

### 性能优化

- `getDefinitionByType` 从 O(N) 线性扫描改为 Map 索引查找
- `RecentComponentsList` 嵌套 O(N×M) 改为单次 Map 查找
- 组件库搜索输入加 200ms debounce
- 搜索结果按「名称完全匹配 > 名称前缀 > 名称包含 > 关键词包含」相关度排序

### UX 改进

- 分类分区启用 `PanelSection.collapsible`，默认展开，支持折叠/展开全部
- 新增「收藏」分区（与「最近使用」平级），基于 localStorage 持久化，支持手动 star/unstar
- 组件项右侧新增 star 按钮（hover 显示），点击切换收藏
- 搜索结果保留分类分组，但相关度优先排序

### Category 元数据集中化

- 合并 `CATEGORY_LABELS`（registry/index.ts）与 `ComponentCategory` 枚举（screen.schema.ts）为单一 `CATEGORY_META: Record<category, { label, icon, order, description? }>`
- 新增 category 图标与排序，用于分类导航
- 「最近使用」上限从 5 调整为可配置（默认 8）

## Impact

- **Affected specs**：`docs/specs/blueprint-redesign/`（事件/动作锚点派生依赖 `COMPONENT_DEFINITIONS`）、`docs/specs/unified-property-panel-categories/`（属性 Schema 注册表）
- **Affected code**：
  - `apps/web/src/features/screen/registry/` — 注册接口、索引、Category 元数据
  - `apps/web/src/features/screen/registry/components/*.tsx` — 6 个组件迁移到新接口
  - `apps/web/src/features/screen/registry/icons.ts` — 图标注册方式调整
  - `apps/web/src/features/screen/property-schema/schemas.tsx` — Schema 注册方式调整
  - `apps/web/src/features/screen/components/component-library.tsx` — 折叠分类、收藏、debounce、相关度排序
  - `apps/web/src/features/screen/registry/recent-components.ts` — 上限可配置
  - `packages/shared/src/schemas/screen.schema.ts` — `ComponentDefinition` 增 `tags?` 字段（可选）
- **Breaking changes**：无对外 API 破坏；内部注册方式从「4 处手动维护」改为「1 处 registerComponent 调用」，现有 6 个组件需迁移
- **不在本次范围**：
  - 虚拟列表（50 组件规模尚不必要，DOM 节点数可控）
  - 目录约定式自动注册（`import.meta.glob`）— 保留手动调用 `registerComponent` 以保持显式可控
  - 缩略图（thumbnail）渲染 — 留作未来扩展
  - 子分类（subcategory）— 单层 category + 折叠已够用
  - 跨设备同步收藏 — 纯 localStorage 满足当前需求

## ADDED Requirements

### Requirement: 统一组件注册接口

系统 SHALL 提供 `registerComponent(module: ComponentModule)` 单一注册 API，将组件定义、渲染器、图标、属性 Schema 聚合为一个 module 对象。注册后系统自动派生 `COMPONENT_DEFINITIONS` / `RENDERERS` / `ICON_MAP` / `PROPERTY_SCHEMAS` 四张表，不再要求开发者手动维护多处同步。

#### Scenario: 注册新组件

- **WHEN** 开发者调用 `registerComponent({ definition, renderer, schema, icon })`
- **THEN** 该组件的 `type` 出现在 `COMPONENT_DEFINITIONS` 中
- **AND** 该组件的 `renderer` 出现在 `RENDERERS` 中
- **AND** 该组件的 `icon` 出现在 `ICON_MAP` 中（若提供）
- **AND** 该组件的 `schema` 出现在 `PROPERTY_SCHEMAS` 中（若提供）

#### Scenario: 重复注册同名组件

- **WHEN** 开发者调用 `registerComponent` 注册已存在的 `type`
- **THEN** 系统 SHALL 在开发模式下抛出错误（`console.error` + throw），生产模式静默覆盖
- **AND** 错误信息包含重复的 `type` 值

#### Scenario: 现有 6 个组件迁移

- **WHEN** 迁移完成后
- **THEN** `text / bar-chart / rect / ellipse / image / button` 6 个组件全部通过 `registerComponent` 注册
- **AND** `COMPONENT_DEFINITIONS` / `RENDERERS` / `ICON_MAP` / `PROPERTY_SCHEMAS` 的内容与迁移前一致
- **AND** 现有测试（registry.test.ts / icons.test.ts / schemas.test.ts / button-component.test.tsx 等）全部通过

### Requirement: Map 索引查找

系统 SHALL 使用 `Map<string, ComponentDefinition>` 索引替代 `Array.find` 线性扫描，用于 `getDefinitionByType` 与 `RecentComponentsList` 的查找路径。

#### Scenario: 按类型查找组件定义

- **WHEN** 调用 `getDefinitionByType('button')`
- **THEN** 返回 `button` 组件的 `ComponentDefinition`
- **AND** 查找时间复杂度为 O(1)

#### Scenario: 最近使用列表渲染

- **WHEN** `RecentComponentsList` 渲染 20 条最近使用记录
- **THEN** 每条记录通过 Map 索引查找对应定义
- **AND** 总查找复杂度为 O(N)（N 为最近使用记录数），不再有 O(N×M) 嵌套

### Requirement: 分类可折叠

系统 SHALL 启用分类分区的折叠能力，用户可点击分区标题折叠/展开单个分类。

#### Scenario: 折叠单个分类

- **WHEN** 用户点击「图表」分类分区标题
- **THEN** 该分区内容收起，仅保留标题与折叠箭头
- **AND** 折叠状态在当前会话内保持（不持久化到 localStorage）

#### Scenario: 默认展开

- **WHEN** 组件库首次挂载
- **THEN** 所有分类分区默认展开

### Requirement: 收藏机制

系统 SHALL 提供组件收藏能力，用户可对组件 star/unstar，收藏的组件出现在「收藏」分区（位于「最近使用」之上）。

#### Scenario: 收藏组件

- **WHEN** 用户点击组件项右侧的 star 按钮
- **THEN** 该组件 `type` 写入 localStorage（key: `nebula:favorite-components`）
- **AND** 「收藏」分区出现该组件
- **AND** star 按钮变为高亮态

#### Scenario: 取消收藏

- **WHEN** 用户再次点击已收藏组件的 star 按钮
- **THEN** 该组件从 localStorage 移除
- **AND** 「收藏」分区不再显示该组件
- **AND** star 按钮恢复非高亮态

#### Scenario: 收藏分区位置

- **WHEN** 组件库渲染且无搜索关键词
- **THEN** 「收藏」分区位于搜索框下方、最近使用分区之上
- **AND** 仅当收藏列表非空时显示

#### Scenario: 搜索时隐藏收藏分区

- **WHEN** 用户输入搜索关键词
- **THEN** 「收藏」分区与「最近使用」分区都隐藏
- **AND** 仅显示搜索结果分类分区

### Requirement: 搜索 debounce 与相关度排序

系统 SHALL 对搜索输入加 200ms debounce，并按相关度对结果排序。

#### Scenario: 搜索 debounce

- **WHEN** 用户连续输入「bu」「but」「butt」「butto」四个字符
- **THEN** 仅在最后一次输入后 200ms 触发一次 `searchComponentDefinitions`
- **AND** 中间状态不触发搜索

#### Scenario: 相关度排序

- **WHEN** 用户搜索「按钮」
- **THEN** 名称完全匹配「按钮」的组件排在最前
- **AND** 名称前缀匹配「按钮...」的组件次之
- **AND** 名称包含「...按钮...」的组件再次之
- **AND** 仅 keywords 匹配的组件排在最后

### Requirement: Category 元数据集中化

系统 SHALL 将 category 的 label / icon / order / description 集中到单一 `CATEGORY_META: Record<category, CategoryMeta>` 中，作为分类信息的唯一数据源。

#### Scenario: Category 元数据完整性

- **WHEN** 系统 renders 分类分区
- **THEN** 每个 category 的标签、图标、排序均来自 `CATEGORY_META`
- **AND** 不存在 `CATEGORY_LABELS` 与枚举的双源问题

#### Scenario: 新增 category

- **WHEN** 开发者需要新增 `form` 分类
- **THEN** 仅需在 `CATEGORY_META` 中添加一项 `{ form: { label: '表单', icon: 'FormInput', order: 5 } }`
- **AND** 无需修改其他文件

### Requirement: 最近使用上限可配置

系统 SHALL 将「最近使用」展示上限从硬编码的 5 改为可配置，默认值调整为 8。

#### Scenario: 默认上限

- **WHEN** 组件库首次挂载
- **THEN** 「最近使用」分区最多展示 8 条记录

#### Scenario: 自定义上限

- **WHEN** 调用 `getRecentComponents(10)`
- **THEN** 返回最多 10 条记录

## MODIFIED Requirements

### Requirement: 组件库面板布局

**原需求**：搜索框 + 平铺分类分区（不可折叠）+ 最近使用（5 条）。

**修改后**：搜索框（debounce 200ms）+ 收藏分区（仅当非空且无搜索关键词时显示）+ 最近使用分区（默认 8 条，仅当无搜索关键词时显示）+ 分类分区（可折叠，默认展开）+ 搜索结果分区（仅当有搜索关键词时显示，按相关度排序）。

## REMOVED Requirements

### Requirement: CATEGORY_LABELS 扁平 Record

**Reason**：被 `CATEGORY_META` 取代，集中化后无需维护独立的标签 Record。
**Migration**：所有引用 `CATEGORY_LABELS[category]` 的位置改为 `CATEGORY_META[category]?.label ?? category`。
