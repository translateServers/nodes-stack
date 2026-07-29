# 大屏编辑器功能规格

> 状态：生效中
> 最近更新：2026-07-28
> 定位：已实现功能的现状描述（非设计方案）。供新人快速了解"已经有什么"，作为后续需求变更的基线

## 1. 功能概述

大屏编辑器是 Nebula 的核心 feature，提供类 Figma / GoView 的低代码可视化大屏设计能力。

### 1.1 核心能力

- **画布**：拖拽式布局，支持选择/移动/缩放/旋转/框选/创建
- **组件库**：6 种内置组件（文本/柱状图/矩形/椭圆/图片/按钮），可扩展
- **属性面板**：声明式 Schema 驱动，按组件类型动态渲染
- **图层管理**：z-index 排序、显隐、锁定、分组
- **历史栈**：撤销/重做，三重快照（components + canvas + blueprint）
- **事件蓝图**：节点编辑器编排交互逻辑
- **数据层**：静态数据 / API 数据源 + 字段映射 + 逻辑层
- **预览**：编辑器内预览 + 公开预览页

### 1.2 路由

| 路径 | 说明 | 鉴权 |
|---|---|---|
| `/screen` | 项目列表 | 是 |
| `/screen/$id` | 编辑器 | 是 |
| `/screen-preview/$id` | 公开预览 | 否 |
| `/screen-editor-preview/$id` | 编辑器内预览 | 否 |

### 1.3 持久化

`ScreenProject` 模型（表 `screen_projects`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `name` | string | 唯一名称 |
| `description` | string? | 描述 |
| `canvas` | text | 画布配置 JSON 字符串（默认 `"{}"`） |
| `components` | text | 组件数组 JSON 字符串（默认 `"[]"`） |
| `blueprint` | text? | 事件蓝图 JSON |
| `status` | string | `"draft"` / `"published"` |
| `thumbnail` | string? | 缩略图 |
| `createdAt` / `updatedAt` | datetime | 时间戳 |

## 2. 画布系统

### 2.1 渲染架构

- **react-moveable**：选择/拖拽/缩放/旋转控制框
- **react-selecto**：框选
- **@scena/react-ruler**：标尺
- GPU 合成层：`transform: translate3d() + scale()` 做视口变换
- 组件定位用 `transform: translate()`（Canvas Drag Optimization）

### 2.2 交互能力

| 能力 | 实现 |
|---|---|
| 选择 | 单击选中、Shift 多选、框选 |
| 移动 | 拖拽，支持 Smart Guides 智能对齐 |
| 缩放 | 8 个控制点，支持 Shift 等比、Alt 中心变换 |
| 旋转 | 顶部控制点，支持 Shift 角度吸附 |
| 框选 | Selecto 拖拽框选 |
| 创建 | 工具栏选择工具后点击/拖拽创建 |
| Alt+拖拽复制 | PS 风格，拖拽中显示克隆体，松开在克隆位置创建副本 |
| 分组 | 双击进入分组（Figma "Enter Frame" 语义） |

### 2.3 视口

- 缩放范围 [0.1, 5]
- Alt/Ctrl/Cmd+滚轮缩放（光标为锚点）
- 缩放工具点击（Alt 反向）
- Ctrl/Cmd+0 适应屏幕
- 空格临时抓手

### 2.4 性能优化

- `componentMap`（Map）替代 `Array.find`，O(N) → O(1)
- `visibleComponents` memo 化
- `selectedGeometryFingerprint` 几何指纹，仅在真正影响 rect 时触发 `updateRect()`
- rAF 节流高频回调
- `useDimensionStore` 独立 store 剥离高频更新
- 模块级常量避免 Moveable 内部重算

## 3. 工具系统

### 3.1 工具清单

| 工具 | ID | 快捷键 | 能力 |
|---|---|---|---|
| 选择 | `select` | V | canSelect/canDrag/canResize/canRotate |
| 抓手 | `hand` | H / Space（临时） | canPan |
| 文本 | `text` | T | canCreate |
| 矩形 | `rect` | R | canCreate |
| 椭圆 | `ellipse` | E | canCreate |
| 图片 | `image` | I | canCreate |
| 缩放 | `zoom` | Z | canZoom |

### 3.2 工具状态机

- `currentTool`：useState（触发 UI 重渲染）
- `temporaryToolStack`：useRef（临时切换，避免高频重渲染）
- `activeTool = temporaryTop ?? currentTool`：useMemo 派生
- 按住 Space 临时切抓手，松开恢复
- window blur 清空临时栈

### 3.3 交互状态机

11 状态 × 21 事件的转换表：

- 状态：idle / hovering / marquee-selecting / dragging / resizing / rotating / panning / zooming / text-editing / context-menu-open / creating
- `transition` 是纯函数，便于单测
- 非法转换保持原状态 + dev 环境 console.warn

## 4. 组件库

### 4.1 内置组件

| 类型 | 名称 | 类别 | 说明 |
|---|---|---|---|
| `text` | 文本 | text | 可配置内容/字号/字色/字重/行高/对齐 |
| `bar-chart` | 柱状图 | chart | 基于 SVG，支持数据源 + 字段映射 + 逻辑层 + tooltip |
| `rect` | 矩形 | decoration | 可配置背景/边框/圆角 |
| `ellipse` | 椭圆 | decoration | 可配置背景/边框（容器不应用 backgroundColor/border，避免衬底遮住透明四角） |
| `image` | 图片 | media | 支持 dataUrl 与 http(s) URL |
| `button` | 按钮 | text | 支持文字、样式与点击事件 |

### 4.2 组件四层配置

| 层 | 字段 | 职责 |
|---|---|---|
| 数据层 | `dataSource` | static / api |
| 逻辑层 | `logic` | sortField / sortDirection / limit |
| 视觉层 | `props` + `style` | 外观 |
| 交互层 | `interaction` | tooltipOnHover 等 |

### 4.3 组件定义结构

```ts
{
  type; name; category; icon; keywords; description;
  defaultProps; defaultSize; defaultStyle?;
}
```

## 5. 属性面板

### 5.1 架构

三层声明式：Schema → Section → Field，单向数据流。所有分区按 `tab` 字段归入四大类，涉及 2+ tab 时始终启用 Tabs 容器（customRender 分区按其 `tab` 字段归入对应 tab）。

### 5.2 Tab 分类（四大类）

| Tab | 说明 | 典型分区 |
|---|---|---|
| appearance（属性） | 位置/样式/文本/变换/层级/滤镜 | `POSITION_SECTION` / `STYLE_SECTION` / `TEXT_PROPS_SECTION` / `TRANSFORM_SECTION` / `LAYER_STATUS_SECTION` / `FILTER_SECTION` |
| data（数据） | 数据源/字段映射/逻辑层 | `BarChartDataSourceSection` + `BarChartLogicSection`（bar-chart）；其他组件 data tab 渲染空状态占位 |
| interaction（交互） | 交互行为 | `BarChartInteractionSection`（悬停提示）；其他组件 interaction tab 渲染空状态占位 |
| events（事件） | 事件规则派生视图 | `EVENTS_SECTION`（customRender 挂载 `<QuickEventEditor>`） |

`LAYER_STATUS_SECTION`：层级状态分区，承载组件命名（`name`）/ z-index 调整（`zIndex`）/ 锁定（`status.locked`）/ 隐藏（`status.hidden`），默认折叠以减少视觉噪声。写入路径与 `editor-store` 现有 `renameComponent` / `reorderComponent` / `setLocked` / `setHidden` API 对齐。

`FILTER_SECTION`：组件滤镜分区，6 个 CSS filter 参数：`hueRotate`（0-360）/ `saturate`（0-200）/ `brightness`（0-200）/ `contrast`（0-200）/ `blur`（0-20）/ `grayscale`（0-100），渲染层 `buildFilterString` 仅在字段非默认值时拼接对应 CSS filter 函数。

`TEXT_PROPS_SECTION` 已扩展文本细化配置：字间距 `letterSpacing`、描边宽度 `textStrokeWidth`、描边颜色 `textStrokeColor`。

未选中任何组件时右侧面板不渲染 Schema，改为渲染「画布设置」分区与「全局变量管理面板」（见 [§10.5](#105-全局变量)）。

### 5.3 字段控件

| 控件 | 说明 |
|---|---|
| number | PS 风格微调 + draft 提交（min/max/step/shiftStep/precision） |
| color | 取色器 + 文本输入 |
| text | 单行文本 |
| textarea | 多行文本 |
| select | Radix Select |
| switch | Radix Switch |

### 5.4 逃生舱

- `customField`：单字段自定义渲染
- `customRender`：整个 section 自定义渲染（bar-chart 各 tab 与 QuickEventEditor 均用）

## 6. 数据层

### 6.1 数据源类型

| 类型 | 配置 | 说明 |
|---|---|---|
| `static` | staticData + dataPath? + fieldMapping? | 静态 JSON 数据 |
| `api` | apiConfig + dataPath? + fieldMapping? | HTTP API（GET） |

### 6.2 解析管线（chart-data-parser.ts）

4 步纯函数管线：

1. `extractDataByPath` — 点分路径提取（支持数组索引）
2. `mapFieldsToChartData` — 字段映射 + 类型校验，未配置时自动推断
3. `applyLogicConfig` — 排序 + 条数限制
4. `parseChartData` — 统一入口，返回 `ParseResult` 判别联合

### 6.3 ParseResult

判别联合，可区分错误原因：

- `ParseSuccess`：{ status: 'success'; data: ChartData[] }
- `ParseEmpty`：{ status: 'empty' }
- `ParseError`：{ status: 'error'; reason: ParseErrorReason; message: string }

错误原因：not-an-array / path-not-found / path-not-array / missing-dimension-field / missing-value-field / invalid-value-type

> `path-not-array` 当前未实际发出，仅为类型层预留。

错误信息面向用户可读，不泄露原始数据全文。

### 6.4 API 数据源

- `useApiDataSource(apiConfig?)`：发起 GET 请求，三态 `idle/loading/success/error`
- 含取消协议（AbortController）
- 蓝图 `refreshDataSource` 动作完成后写入 `apiRawDataOverride`，优先于 useApiDataSource state

## 7. 图层管理

### 7.1 操作

- z-index 排序（置顶/置底/上移/下移）
- 显隐切换
- 锁定/解锁
- 分组/解组（Figma "Enter Frame" 语义）

### 7.2 快捷键

- 置顶：`Ctrl/Cmd+Shift+]`
- 置底：`Ctrl/Cmd+Shift+[`
- 成组：`Ctrl/Cmd+G`
- 解组：`Ctrl/Cmd+Shift+G`
- 锁定：`Ctrl/Cmd+L`
- 隐藏：`Ctrl/Cmd+Shift+H`

## 8. 历史栈

### 8.1 机制

- 三重快照：components + canvas + blueprint 共享同一时间线
- 容量上限 50
- `withHistory` 高阶函数自动推入快照、清空 future、置 isDirty
- 无变化不入栈（深比较 JSON.stringify）

### 8.2 蓝图手势模式

高频拖拽合并为一次历史：

- `beginBlueprintGesture`：记录 baseline，期间更新不入栈
- `endBlueprintGesture`：有净变化时补一条历史（快照取 baseline）

### 8.3 快捷键

- 撤销：`Ctrl/Cmd+Z`
- 重做：`Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y`

## 9. 快捷键系统

### 9.1 规模

约 70+ 条目，8 个 category：file / edit / view / component / align / help / tool / ui。

### 9.2 防冲突方法论

- `browserConflict='overridable'` 必须搭配 `preventDefault='always'` 或 `'callback-only'`
- `browserConflict='reserved'` 不应注册
- DEV 环境自动 `validateRegistry` 校验

### 9.3 作用域

| scope | 启用条件 |
|---|---|
| global | `!suspended`（弹层打开时挂起） |
| canvas | `!isEditingText && !suspended` |
| blueprint | 蓝图编辑器激活时 |

### 9.4 Escape 分层语义

1. 先 `dispatchInteraction('escape')` 恢复瞬时状态
2. 退出活动分组
3. 清空选中

## 10. 事件蓝图

详见 [blueprint-runtime-architecture.md](../../architecture/blueprint-runtime-architecture.md)。

### 10.1 节点类型

- 触发器（6 种）：componentClick / pageLoad / componentHover / dataLoaded / dataError / interval
- 动作（5 种）：setVisibility / navigate / scrollToComponent / refreshDataSource / requestApi
- 条件：then/else 分支
- 注释：不参与执行

### 10.2 编译执行

- 纯函数编译器：图 → 规则集 + 诊断
- 薄执行器 + 依赖注入（RuntimeDeps）
- error 级诊断触发器在预览运行时排除

### 10.3 调试

- 沙盒运行时：编辑器内模拟触发，注入 mock deps
- 沙盒高亮：高亮被触发的节点与连线
- 执行日志面板

### 10.4 QuickEventEditor 派生视图

`components/quick-event-editor.tsx` 在右侧属性面板 events tab 渲染，从 `ScreenProject.blueprint` 派生当前选中组件相关的事件规则，**无需打开蓝图抽屉即可快速查看与编辑**。

**派生规则**（纯函数，BFS 遍历）：

- **触发器（本组件作为源）**：`trigger.config.componentId === componentId` 的 componentClick / componentHover / dataLoaded / dataError 节点；沿 edges BFS 收集下游 action 链（穿过 condition 节点，仅收集 action）
- **动作（本组件作为目标）**：`action.config.targetComponentId === componentId` 的 setVisibility / scrollToComponent / refreshDataSource 节点；沿 edges 反向 BFS 找到上游 trigger 来源

**操作能力**：

- 「+ 添加触发器」下拉提供 3 个快速规则模板（点击本组件 → 跳转 URL / 显示隐藏目标组件 / 刷新目标组件数据），选择后构造 trigger + action + edge 三个节点/边一次性写入蓝图
- 每条规则右侧「删除」按钮走 `AlertDialog` 二次确认：trigger 删除会级联删除其所有下游节点和边；action 删除仅移除单个节点与直接相连边
- 顶部「打开事件蓝图」按钮调用 `editor-store.openBlueprintSheet({ focusComponentId: componentId })`，拉起全屏蓝图编辑器并自动进入过滤模式

**写操作**：所有增删通过 `editor-store.updateBlueprint(nextBlueprint)` 写入，进入统一历史栈（三重快照：components + canvas + blueprint），支持 `Ctrl/Cmd+Z` 撤销。

### 10.5 全局变量

`components/global-variables-panel.tsx` 在右侧属性面板「未选中组件」分支下渲染，与「画布设置」分区并列。

- 项目级共享命名变量，存储于 `ScreenProject.globalVariables`（`@nebula/shared` 的 `GlobalVariableSchema`）
- 三种类型：`static`（静态值）/ `api`（定时拉取）/ `computed`（表达式，预留）
- 在数据源参数与蓝图模板中通过 `{{globalVars.xxx}}` 插值引用，跨组件共享
- 编辑器 store 提供 `addGlobalVariable` / `updateGlobalVariable` / `removeGlobalVariable` 三个 action，均走历史栈

## 11. 预览

### 11.1 编辑器内预览

- 路由 `/screen-editor-preview/$id`
- 不触发 pageLoad 事件（仅编辑器画布的 eventsEnabled 控制 componentClick）

### 11.2 公开预览

- 路由 `/screen-preview/$id`（无鉴权）
- 完整接入运行时：mount 触发 pageLoad + componentClick 派发
- `apiDataOverrides` + `visibilityOverrides` 通过 Context 下发

## 12. 保存与发布

### 12.1 保存

- isDirty 标记本地脏状态
- 保存冲突检测（HTTP 409，`SCREEN_SAVE_CONFLICT`）

### 12.2 发布

- 状态流转：draft → published
- 公开预览仅可访问已发布项目

## 13. 已知限制

- 无 200+ 节点性能验证
- 浏览器级 E2E 测试覆盖有限（仅 pageLoad），模拟调试/双向联动/condition/requestApi 等场景待补充
- 术语未完全统一
- 数据源加载中时组件操作未覆盖 E2E

## 14. 关联文档

- [大屏设计器架构](../../architecture/screen-editor-architecture.md)
- [蓝图运行时架构](../../architecture/blueprint-runtime-architecture.md)
- [系统总览](../../architecture/system-overview.md)
- [编码规范](../../conventions/coding-standards.md)
- [开发指南](../../architecture/development-guide.md)
