# 事件蓝图重新设计 Spec

> 状态：已归档（2026-08-02）
> 最近更新：2026-08-02
>
> 本文保留重设计期间的历史术语和迁移方案。现行蓝图契约与运行时以
> [blueprint-runtime-architecture.md](../../architecture/blueprint-runtime-architecture.md)
> 和 shared schema 为准。

## Why

当前事件蓝图采用"抽象逻辑节点"模型（trigger / action / condition / comment 四类独立节点），存在以下根本性问题：

1. **节点冗余**：一个简单的"点击按钮 A → 显示组件 B"交互需要 2 个节点 + 1 条边，节点数量随交互复杂度线性膨胀，画布迅速拥挤
2. **组件与节点割裂**：trigger 节点引用 componentId，action 节点引用 targetComponentId，同一组件在画布上分散为多个节点引用，用户难以直觉地建立"组件 → 交互"映射
3. **锚点固定**：所有 trigger 节点只有 `out` 引脚，所有 action 节点只有 `in` + `out` 引脚，无法表达组件自身的事件多样性（点击/悬停/加载完成/数据错误）
4. **交互体验粗糙**：连线无磁吸吸附、节点配色仅 4 色且语义弱、无左侧节点面板、搜索面板是唯一创建入口

参考 light-chaser 的"组件即节点"哲学，结合 nebula 已有的工程化能力（Zod schema、编译器、诊断系统、历史栈、沙盒运行时），重新设计一套**有自己设计哲学**的事件蓝图系统。

## 设计哲学

### 核心理念：组件为中心，锚点即事件

> **一个组件 = 一个节点；组件的事件 = 节点的输出锚点；组件的动作 = 节点的输入锚点。**

这是 light-chaser 最核心的设计直觉，也是本次重设计的基础。但它有局限：一个组件只能有一个节点实例，无法表达"同一组件的多个独立交互链"。

### nebula 的设计哲学：组件节点 + 逻辑节点 + 多实例

在 light-chaser 的基础上，nebula 提出**三阶层节点模型**：

1. **组件节点（Component Node）**：每个组件在蓝图中有 0~N 个节点实例。每个实例的锚点从组件定义动态派生——事件列表生成输出锚点，动作列表生成输入锚点。同一组件的多个实例代表不同的交互链入口/出口。
2. **逻辑节点（Logic Node）**：condition（条件分支）、delay（延时）、parallel（并行执行）等纯逻辑单元，不绑定具体组件。
3. **注释节点（Comment Node）**：纯标注，不参与执行流。

### 三条设计原则

1. **动态锚点优先**：组件节点的锚点从组件注册表动态派生，新增组件类型自动支持事件/动作，无需手写节点配置。固定锚点（trigger 只有一个 out）被淘汰。
2. **工程化保障**：保留 Zod schema 判别联合、编译器诊断、引脚兼容性校验、历史栈手势合并、沙盒运行时——这些是 light-chaser 缺失的生产级能力。
3. **渐进式复杂度**：简单交互（点击→显示）只需 1 条边（组件 A 的 click 锚点 → 组件 B 的 show 锚点）；复杂交互可插入 condition/delay 逻辑节点。用户不为简单交互支付复杂度税。

## What Changes

### 1. 节点模型重构

#### 1.1 节点类型（3 + 1）

| 节点类型 | kind | 锚点模式 | 配色 | 说明 |
| --- | --- | --- | --- | --- |
| 组件节点 | `component` | 动态派生（事件→output，动作→input） | emerald（绿） | 每个组件实例一个节点 |
| 条件节点 | `condition` | in + then/else | purple（紫） | 结构化条件表达式 |
| 延时节点 | `delay` | in + out | amber（琥珀） | 延时执行，替代 interval 触发器的延时需求 |
| 注释节点 | `comment` | 无 | gray（灰） | 纯标注 |

> **淘汰**：trigger 节点、action 节点作为独立节点类型被移除。触发器变为组件节点的输出锚点，动作变为组件节点的输入锚点。

#### 1.2 组件节点锚点派生

组件节点的锚点从组件注册表动态生成：

```
ComponentRegistry.getDefinition(componentType) → {
  events: [{ id: 'click', name: '点击' }, { id: 'hover', name: '悬停' }, ...],
  actions: [{ id: 'show', name: '显示' }, { id: 'hide', name: '隐藏' }, ...],
}
```

- **输出锚点（source handles）**：每个 event 生成一个 source handle，id 格式 `evt:{eventId}`
- **输入锚点（target handles）**：每个 action 生成一个 target handle，id 格式 `act:{actionId}`
- 全局事件（pageLoad）和全局动作（navigate/scrollToComponent/requestApi）不绑定组件，通过**全局节点**处理（见 1.3）

#### 1.3 全局节点

部分触发器和动作不绑定具体组件（pageLoad、navigate、requestApi），需要全局节点承载：

| 全局节点 | kind 子类型 | 输出锚点 | 输入锚点 | 说明 |
| --- | --- | --- | --- | --- |
| 页面加载 | `component` + `globalPageLoad` | `evt:pageLoad` | 无 | 项目级单例，页面加载时触发 |
| 导航动作 | `component` + `globalNavigate` | 无 | `act:navigate` | URL 跳转，无目标组件 |
| API 请求 | `component` + `globalRequestApi` | 无 | `act:requestApi` | HTTP 请求 |
| 滚动至 | `component` + `globalScrollTo` | 无 | `act:scrollTo` | 滚动至指定组件 |

全局节点在蓝图中以特殊样式（虚线边框 + globe 图标）区分，锚点固定不可扩展。

### 2. Schema 重写

#### 2.1 新的节点判别联合

```typescript
// 组件节点（含全局节点子类型）
ComponentNodeSchema = {
  id: string,
  position: { x, y },
  kind: 'component',
  componentId: string,        // 引用的组件 ID（全局节点为 'global' 常量）
  globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo',  // 全局节点子类型标识
  config?: {                  // 全局节点的配置（普通组件节点无 config，锚点从注册表派生）
    url?: string,             // navigate / requestApi
    method?: string,          // requestApi
    headers?: Record<string, string>,
    body?: string,
    targetComponentId?: string,  // scrollTo
    ...
  }
}

// 条件节点（保留现有设计）
ConditionNodeSchema = {
  id, position, kind: 'condition',
  config: { expression: ConditionExpression }
}

// 延时节点（新增）
DelayNodeSchema = {
  id, position, kind: 'delay',
  config: { delayMs: number }
}

// 注释节点（保留现有设计）
CommentNodeSchema = {
  id, position, kind: 'comment',
  config: { text: string }
}
```

#### 2.2 边 schema 调整

边的 `sourceHandle` / `targetHandle` 改为语义化格式：
- 组件事件输出：`evt:{eventId}`（如 `evt:click`、`evt:pageLoad`）
- 组件动作输入：`act:{actionId}`（如 `act:show`、`act:navigate`）
- 逻辑节点输出：`out` / `then` / `else`（保留现有约定）
- 逻辑节点输入：`in`（保留现有约定）

#### 2.3 版本迁移

`EventBlueprintSchema.version` 从 `1` 升级到 `2`，提供迁移函数：

```typescript
function migrateBlueprintV1ToV2(v1: V1EventBlueprint): V2EventBlueprint
```

迁移规则：
- V1 的 trigger 节点（componentClick/componentHover/dataLoaded/dataError）→ V2 组件节点（componentId 不变）
- V1 的 trigger 节点（pageLoad）→ V2 全局页面加载节点
- V1 的 trigger 节点（interval）→ V2 组件节点 + delay 节点组合（或保留为全局定时器节点）
- V1 的 action 节点（setVisibility/scrollToComponent/refreshDataSource）→ V2 组件节点（targetComponentId 变为 componentId）
- V1 的 action 节点（navigate/requestApi）→ V2 全局节点
- V1 的 condition/comment 节点 → V2 对应节点（结构不变）
- V1 的边 sourceHandle `out` → V2 `evt:click`（默认事件，迁移时取 trigger config.type 推导）
- V1 的边 targetHandle `in` → V2 `act:show`（默认动作，迁移时取 action config.type 推导）

### 3. 组件事件/动作注册表扩展

#### 3.1 ComponentDefinition 扩展

在现有组件注册表（`registry/`）中扩展 `ComponentDefinition`：

```typescript
interface ComponentDefinition {
  // ... 现有字段
  /** 组件支持的事件列表（蓝图锚点派生源） */
  events?: ComponentEventDefinition[];
  /** 组件支持的动作列表（蓝图锚点派生源） */
  actions?: ComponentActionDefinition[];
}

interface ComponentEventDefinition {
  id: string;          // 事件标识（如 'click', 'hover', 'dataLoaded'）
  name: string;        // 显示名（如 '点击', '悬停', '数据加载完成'）
}

interface ComponentActionDefinition {
  id: string;          // 动作标识（如 'show', 'hide', 'toggleVisibility', 'refreshData')
  name: string;        // 显示名（如 '显示', '隐藏', '切换显隐', '刷新数据'）
}
```

#### 3.2 默认事件/动作

所有可视化组件默认拥有：
- **事件**：`click`（点击）、`hover`（悬停）
- **动作**：`show`（显示）、`hide`（隐藏）、`toggleVisibility`（切换显隐）

数据源组件额外拥有：
- **事件**：`dataLoaded`（数据加载完成）、`dataError`（数据加载错误）
- **动作**：`refreshData`（刷新数据）

容器组件额外拥有：
- **动作**：`scrollTo`（滚动至该组件）

全局动作（不绑定组件）：
- `navigate`（页面跳转）
- `requestApi`（HTTP 请求）

### 4. 引脚兼容性重写

#### 4.1 新的兼容性规则

| 源锚点类型 | 目标锚点类型 | 兼容 |
| --- | --- | --- |
| 组件事件输出（evt:*） | 组件动作输入（act:*） | 是 |
| 组件事件输出（evt:*） | 逻辑节点输入（in） | 是 |
| 逻辑节点输出（out/then/else） | 组件动作输入（act:*） | 是 |
| 逻辑节点输出（out/then/else） | 逻辑节点输入（in） | 是 |
| 组件动作输入（act:*） | 任何 | 否（动作锚点只能作为目标） |
| 注释节点 | 任何 | 否 |

#### 4.2 自环检测

- 同一组件节点的 `evt:click` → `act:show` 允许（组件自身点击显示自身是合法交互）
- 但逻辑节点自环（condition.out → condition.in）不允许

### 5. 编译器重写

#### 5.1 编译流程

```
V2 EventBlueprint
  → buildIndexes（节点索引 + 组件引用映射）
  → validateNodes（dangling 组件引用、空配置）
  → detectCycles（DFS 三色，排除组件节点自环合法情况）
  → compileRules（从组件节点的输出锚点出发，DFS 展开执行计划）
    → 遇到 act:* 锚点 → 生成 ActionStep
    → 遇到逻辑节点 in → 递归编译逻辑节点
    → condition: 按 then/else 分支展开
    → delay: 生成 DelayStep
  → { rules: CompiledRule[], diagnostics: Diagnostic[] }
```

#### 5.2 执行计划结构

```typescript
interface CompiledRule {
  triggerNodeId: string;       // 组件节点 ID
  triggerEventId: string;      // 事件 ID（如 'click'）
  triggerComponentId: string;  // 组件 ID
  steps: CompiledStep[];       // 执行步骤（线性 + 嵌套）
}

type CompiledStep =
  | { kind: 'action'; nodeId: string; componentId: string; actionId: string; config?: Record<string, unknown> }
  | { kind: 'condition'; nodeId: string; expression: ConditionExpression; thenSteps: CompiledStep[]; elseSteps: CompiledStep[] }
  | { kind: 'delay'; nodeId: string; delayMs: number }
```

### 6. 运行时重写

#### 6.1 RuntimeDeps 扩展

```typescript
interface RuntimeDeps {
  // 组件操作
  hasComponent(componentId: string): boolean;
  getComponentValue(componentId: string): Record<string, unknown> | undefined;
  getComponentData(componentId: string): unknown;
  applyVisibility(componentId: string, visible: boolean): void;
  getVisibility(componentId: string): boolean;
  refreshDataSource(componentId: string): Promise<void>;
  scrollToComponent(componentId: string): void;

  // 全局动作
  openUrl(url: string, target: '_blank' | '_self'): void;
  requestApi(config: RequestApiConfig): Promise<ApiResponse>;

  // 事件触发（组件→蓝图）
  triggerEvent(componentId: string, eventId: string, payload?: unknown): void;

  // 工具
  logWarning(message: string): void;
}
```

#### 6.2 执行流程

```
组件事件触发 (componentId + eventId)
  → collectRules(rules, componentId, eventId)
  → executeRule(rule, deps)
    → 按 steps 顺序执行
    → action: 调用 deps 的对应方法
    → condition: 求值表达式，选择 then/else 分支递归执行
    → delay: setTimeout 延时后继续执行后续 steps
  → RuleExecutionLog[]
```

### 7. 节点渲染重写

#### 7.1 组件节点（ComponentNode）

```
┌─────────────────────────────────┐
│  [icon] 柱状图 - chart_1        │  ← 标题栏（emerald 配色）
├─────────────────────────────────┤
│  ○ 点击          显示 ●         │  ← 锚点行：左=事件输出，右=动作输入
│  ○ 悬停          隐藏 ●         │
│                  切换显隐 ●     │
│  ○ 数据加载完成  刷新数据 ●     │
│  ○ 数据加载错误                │
├─────────────────────────────────┤
│  [配置摘要: 无]                 │  ← 配置区（全局节点显示配置）
└─────────────────────────────────┘
```

- 锚点按事件/动作分组：左侧输出事件锚点，右侧输入动作锚点
- 每个锚点显示中文名（来自组件定义）
- 锚点悬停高亮，连线时磁吸吸附（20px 范围）
- 节点宽度自适应锚点最长名称

#### 7.2 全局节点

- 虚线边框 + globe 图标
- 固定锚点（pageLoad 输出 / navigate 输入 / requestApi 输入 / scrollTo 输入）
- 配置区显示 URL、method 等配置

#### 7.3 逻辑节点

- condition：紫色，in + then/else 双输出（保留现有设计）
- delay：琥珀色，in + out，显示延时毫秒数
- comment：灰色，无锚点（保留现有设计）

### 8. 交互体验优化

#### 8.1 锚点磁吸

连线拖拽时，鼠标 20px 范围内的兼容目标锚点自动高亮并吸附。实现方式：
- React Flow 的 `onConnectStart` / `onConnectEnd` 配合自定义 DOM 查询
- 拖拽中通过 `getCompatibleTargetPins` 实时计算兼容锚点列表
- 兼容锚点添加 `ring-2 ring-blue-400` 高亮样式

#### 8.2 左侧节点面板

新增 `BlueprintNodePanel`（替代/增强现有搜索面板）：
- **组件分类**：按组件类型分组（图表/文本/容器/媒体），展示当前项目中的所有组件实例
- **逻辑节点**：condition / delay / comment
- **全局节点**：pageLoad / navigate / requestApi / scrollTo
- 拖拽到画布创建节点（双击空白呼出的搜索面板保留作为快捷创建入口）
- 搜索框过滤

#### 8.3 节点配色语义化

| 节点类型 | 配色 | 语义 |
| --- | --- | --- |
| 组件节点 | emerald（绿） | 数据载体 |
| 全局节点 | emerald 虚线 | 特殊组件 |
| 条件节点 | purple（紫） | 逻辑分支 |
| 延时节点 | amber（琥珀） | 时间控制 |
| 注释节点 | gray（灰） | 标注 |

#### 8.4 右键菜单增强

保留现有三场景右键菜单（node/edge/pane），新增：
- 组件节点右键：「定位到画布组件」「选择组件实例」（当同一组件有多个节点时）
- 全局节点右键：「配置」（打开配置面板）
- 锚点右键：「断开所有连线」

### 9. 左侧面板设计

```
┌─────────────────────────┐
│ 🔍 搜索节点...           │
├─────────────────────────┤
│ ▼ 组件                   │
│   📊 柱状图 - chart_1    │  ← 拖拽创建组件节点
│   📈 折线图 - chart_2    │
│   📝 文本 - text_1       │
│ ▼ 逻辑节点               │
│   🔀 条件判断             │
│   ⏱ 延时                 │
│   💬 注释                 │
│ ▼ 全局                   │
│   🌐 页面加载             │
│   🔗 页面跳转             │
│   📡 API 请求             │
│   📍 滚动至组件           │
└─────────────────────────┘
```

### 10. 数据流总览

```
组件注册表 (ComponentRegistry)
  → events[] / actions[]
  → 组件节点锚点动态派生
  → 用户连线（引脚兼容性校验）
  → EventBlueprint v2 (Zod schema)
  → 编译器（图 → CompiledRule[]）
  → 运行时（事件触发 → 执行计划）
  → RuntimeDeps（副作用注入）
```

## 非目标

- 不引入 PixiJS 渲染（React Flow SVG 渲染在当前节点量级下性能足够）
- 不引入 eval 执行用户 JS（保留结构化条件表达式，安全优先）
- 不改变蓝图与组件/画布/全局变量的共享历史栈设计
- 不改变蓝图的 Sheet 弹层形态

## 兼容性

- 提供 V1→V2 自动迁移函数，打开旧项目时自动迁移
- 迁移后保存为 V2 格式，不保留 V1 原文（版本号升级不可逆）
- 迁移失败的边（无法推导事件/动作 ID）保留为边但标记 diagnostic warning

## 风险

1. **组件注册表扩展工作量**：需要为所有现有组件类型补充 events/actions 定义
   - 缓解：提供默认事件/动作（click/hover/show/hide/toggleVisibility），数据源组件 mixin 补充 dataLoaded/dataError/refreshData
2. **V1→V2 迁移的边语义推导**：V1 边的 sourceHandle 是 `out`，需根据源节点的 trigger config.type 反推 eventId
   - 缓解：建立 trigger type → eventId 映射表（componentClick→click, componentHover→hover, dataLoaded→dataLoaded, ...）
3. **多实例组件节点的画布定位**：同一组件的多个节点在画布上可能重叠
   - 缓解：创建时自动偏移（每个新节点偏移 40px），用户可手动调整
