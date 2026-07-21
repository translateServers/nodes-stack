# 大屏设计器 · 面板系统架构与方法论

> 定位：编辑器"基座"建设的总体架构。组件内容可以少，但面板系统必须能低成本地承载无限扩展。
> 本文档是 Phase 2（基座夯实）的设计依据，实施切片见 `docs/screen-designer-roadmap.md`。
> 最近更新：2026-07-21

## 1. 方法论总纲

四条核心原则，所有面板改造都必须遵守：

### 1.1 注册表驱动（Registry-Driven）
一切可扩展点都是**数据，不是代码分支**。新增能力 = 向注册表追加一条描述，面板 UI 零改动。
当前已有 `COMPONENT_DEFINITIONS`（组件注册表）是正确方向；本架构把同一思想推广到：属性分区、字段控件、图层操作、组件库条目。

**反模式**（现状中存在，需逐步消除）：
- `property-panel.tsx` 中 `type === 'bar-chart' ? <BarChartConfigSections/> : ...` 的硬编码分支
- 新组件接入需要改 5 个文件（registry / renderer / property-panel / layer-panel ICON_MAP / component-library ICON_MAP）——图标映射重复定义两处

### 1.2 Schema 驱动渲染
属性面板的内容由**属性 Schema**（声明式描述）渲染，而不是手写 JSX 堆叠。
简单字段（数字/颜色/开关/下拉）走声明式；复杂编辑器（数据源表单、KV 编辑器）保留自定义渲染器作为"逃生舱"。**声明式优先，自定义兜底**，两者在同一 Schema 序列中混排。

### 1.3 命令描述符（Command Descriptors）
对图层/画布的一切操作（重命名/锁定/显隐/置顶/成组/删除…）统一定义为命令对象：
`{ id, label, icon, shortcutId?, when(ctx): boolean, enabled(ctx): boolean, run(ctx) }`。
同一份命令表喂给：图层右键菜单、画布右键菜单、顶部菜单栏、快捷键系统。操作语义只写一次。

### 1.4 单向数据流不变
Zustand store 仍是唯一事实源。所有架构改造只改变"UI 如何生成"，不改变"数据如何流动"。任何面板不得持有业务状态的第二副本。

---

## 2. 组件库面板（Component Library）目标架构

### 2.1 元数据扩展（ComponentDefinition 增量字段）
```ts
interface ComponentDefinition {
  type: string; name: string; category: string; icon: string;
  keywords?: string[];        // 搜索别名（如 'zhexian' '趋势'）
  description?: string;       // hover tooltip 说明
  badge?: 'new' | 'beta';     // 角标
  order?: number;             // 分类内排序
  // 既有：defaultProps / defaultSize / defaultStyle
}
```
组件库搜索同时匹配 name / type / keywords。

### 2.2 UI 演进路线（按组件数量分档）
| 组件数 | 形态 | 说明 |
|---|---|---|
| < 20（当前） | 搜索 + 分类手风琴列表（已达成） | 单列条目，hover 显示 description tooltip |
| 20 ~ 50 | +「最近使用」置顶区 + 收藏钉选 | localStorage 记录，无需后端 |
| > 50 | 图标轨 + 分类浮层（DataV 式） | 左边缘窄轨按分类切换，点击弹出该分类网格 |

当前阶段落地第 1 档完善 + 第 2 档的「最近使用」（拖拽/点击创建时记录 type 与计数）。

### 2.3 拖拽反馈
创建时以组件缩略预览（简化色块 + 名称）作为 drag image（`dataTransfer.setDragImage`），替代浏览器默认残影。

---

## 3. 图层面板（Layer Panel）目标架构

### 3.1 右键菜单（本期落地）
复用 shadcn `ContextMenu`，命令描述符数组 `LAYER_COMMANDS`（定义在 `features/screen/lib/layer-commands.ts`）：

| 命令 | 命令来源 | 备注 |
|---|---|---|
| 重命名 | **新增 store action `renameComponent(id, name)`**（入历史栈） | 行内 inline input，Enter 提交/Esc 取消 |
| 复制 / 创建副本 | copySelectedToClipboard / duplicateSelected | 已有 |
| 锁定/解锁 · 显隐/显示 | setLocked / setHidden | 按当前态显示互斥文案 |
| 置顶 / 上移一层 / 下移一层 / 置底 | reorderToTop / reorderLayerToIndex 计算相邻位 / reorderToBottom | 上下移一层基于现有 reorderLayerToIndex |
| 成组 / 解组 | groupSelected / ungroupSelected | when: 选中≥2 / 选中含组 |
| 删除 | removeSelectedComponents | destructive |

- 右键未选中行 → 先选中该行再弹菜单（行业惯例）
- 多选时菜单批量生效；单命令的 `when/enabled` 依据选区上下文计算
- 分组行右键：锁定/显隐/删除整组（按子组件批量）

### 3.2 内联重命名（本期落地）
- store 新增 `renameComponent(id, name)`（withHistory，trim 后为空则忽略）
- 触发：右键菜单「重命名」或 F2（后续）；行内 input 自动 select 全文本

### 3.3 后续演进
图层搜索过滤、拖拽跨组移动（当前 dnd-kit 仅顶层排序）、类型筛选 chips。

---

## 4. 属性面板（Property Panel）目标架构 ★核心

### 4.1 现状问题
- 组件类型分支硬编码，新组件必须改面板代码
- bar-chart 配置 1069 行单文件，字段控件样式重复（label 宽度、栅格各自手写）
- 属性类别覆盖不足：无变换（旋转已部分支持）/阴影/滤镜/动画/事件，无法承载工业级需求

### 4.2 目标三层结构
```
属性面板
├── Tabs（外观 │ 数据 │ 交互 │ 事件*）       ← tab 按组件类型动态显隐
│     └── Section[]（PanelSection 折叠分区，注册表驱动）
│           └── Field[]（字段控件注册表渲染）
└── 无选中态 → 画布 Schema（同一套机制）
```
\* 事件 Tab 在 Phase 3 蓝图接线后启用，先留架构位置。

### 4.3 属性 Schema 类型设计（`features/screen/property-schema/`）
```ts
/** 字段控件统一契约：所有控件实现此接口后注册进 FIELD_CONTROLS */
interface FieldControlProps<T = unknown> {
  value: T;
  onChange: (v: T) => void;
  label?: string;
  disabled?: boolean;
}

/** 声明式字段：描述"取哪个路径、用什么控件、控件参数" */
interface DeclarativeField {
  kind: 'field';
  control: string;                       // FIELD_CONTROLS 注册名：'number'|'color'|'select'|'switch'|...
  label: string;
  path: string;                          // 组件上的取值路径，如 'style.fontSize'、'position.width'
  defaultValue?: unknown;                // 读取为空时的兜底
  controlProps?: Record<string, unknown>;// min/max/step/options 等透传给控件
  visibleWhen?: (component: ScreenComponent) => boolean;
}

/** 自定义分区：复杂编辑器逃生舱（数据源表单、KV 编辑器等） */
interface CustomSection {
  kind: 'custom';
  render: (ctx: SectionRenderContext) => ReactNode;
}

interface PropertySection {
  id: string;
  title: string;
  tab: 'appearance' | 'data' | 'interaction' | 'events';
  collapsible?: boolean;
  defaultOpen?: boolean;
  fields: Array<DeclarativeField | CustomSection>;
  testId?: string;
}

/** 每类组件一份 Schema；未注册的组件类型回退到通用 Schema（位置尺寸+样式） */
type PropertySchema = PropertySection[];
const PROPERTY_SCHEMAS: Record<string, PropertySchema>;
```

- `path` 读写由统一的 `getByPath/setByPath`（不可变更新）完成，写入走 `updateComponent`
- `FIELD_CONTROLS` 注册表吸纳现有 `NumberInput/ColorInput/TextInput` 并新增 `SwitchField/SelectField/SliderField/RadioField`，外观统一两栏栅格
- **迁移策略（混合模式）**：bar-chart 的数据/逻辑/视觉/交互四个复杂分区作为 `custom` 分区原样挂载进 Schema（renderer 内部复用现有代码），简单字段逐步声明化。面板壳与分区编排先 schema 化，字段逐个收敛，**不做大爆炸重写**

### 4.4 属性类别路线图（基座承载力验证清单）
| 类别 | 内容 | 状态 |
|---|---|---|
| 位置尺寸 | X/Y/宽/高/旋转 | ✅ 已有（迁移进 Schema） |
| 外观样式 | 背景/透明度/边框/圆角 | ✅ 已有（迁移进 Schema） |
| 文本 | 内容/字号/字色 → 字重/行高/对齐/字间距 | 部分，需扩字段 |
| 变换 | 旋转/水平垂直翻转/缩放锚点 | ⬜ Schema 就绪后低成本添加 |
| 阴影与滤镜 | box-shadow/模糊/亮度 | ⬜ 同上 |
| 数据 | static/api/字段映射/请求测试 | ✅ 已有（custom 分区挂载） |
| 逻辑 | 排序/limit | ✅ 已有（同上） |
| 交互 | hover tooltip → 点击联动/下钻 | 部分 |
| 事件 | 蓝图挂载点 | ⬜ Phase 3 |

---

## 5. 图标与资产注册收敛

`ICON_MAP` 在 component-library.tsx 与 layer-panel.tsx 各存一份重复映射 → 收敛为 `registry/icons.ts` 单一映射（icon 名字符串 → lucide 组件），两个面板同源引用。组件类型 → 默认图标的回退逻辑（`KNOWN_TYPE_TO_ICON`）一并并入。

---

## 6. 快捷键系统架构

### 6.1 现状评估
`shortcuts-registry.ts`（751 行）已是优秀的**元数据层**：单一数据源、scope（global/canvas）、preventDefault 三级语义、浏览器冲突分类学（reserved/overridable/none）、别名键位、帮助面板同源渲染。两个结构性缺口：

1. **绑定层硬编码**：`use-keyboard-shortcuts.ts`（657 行）为每条快捷键手写 `useHotkeys` 调用。新增快捷键要改两处（注册表 + 绑定），注册表的"单一数据源"只完成了一半。
2. **上下文模型过简**：scope 只有 `global / canvas` 二值，无法表达"文本编辑中 / 弹层打开中 / 拓展工具前台"等真实上下文，目前靠 `interactionState !== 'text-editing'` 等散点布尔硬判。

### 6.2 目标三层架构
```
① 元数据层（已有，保留）：SHORTCUTS_REGISTRY —— id/keys/描述/分类/冲突语义
② 绑定层（改造）：回调注册表 + 统一绑定引擎
③ 上下文层（扩展）：快捷键上下文栈（Shortcut Context Stack）
```

**绑定层**：各模块通过 `useRegisterShortcutHandler(id, handler)` 自注册回调；绑定引擎遍历注册表统一挂 `useHotkeys`，enable 条件从上下文层查询。新增快捷键 = 注册表加一条 + 注册一个回调，引擎零改动。

**上下文层**：一个轻量上下文栈（editor-store 切片或独立小 store），栈顶决定各 scope 是否使能：

| 上下文 | 进入/退出 | 快捷键行为 |
|---|---|---|
| `editor`（栈底，默认） | 始终 | 全量生效 |
| `text-editing` | 文本浮层进出 | 画布快捷键挂起，仅 Esc/Enter 等白名单 |
| `modal` | Dialog/Sheet 开关 | canvas scope 挂起，文件级（mod+s）保留 |
| `extension:<id>` | 拓展工具前台/关闭 | 主编辑器挂起，工具自带键位集生效（如蓝图内 Del 删节点） |

现有 `interactionState === 'text-editing'` 判断迁移为上下文查询，行为不变。

### 6.3 远期：用户自定义键位（remap）
- 前提：注册表 id 永久稳定（视为公开 API），keys 字段允许被用户覆盖层（localStorage）替换
- 本期不做，但**禁止在代码中绕过注册表直写键位字符串**，为 remap 留路

---

## 7. 拓展工具（Extension）架构

### 7.1 定义与现状
拓展工具 = 依附编辑器、操作同一项目数据、拥有独立 UI 容器与快捷键上下文的**插件式能力**。首批两个实例：事件蓝图（引擎已就绪、UI 未接线）、代码编辑（占位）。

现状反模式：入口硬编码在 ProjectMenubar"工具"菜单；`screen-editor.tsx` 里 `showEventBlueprint / showCodeEditor` 一对 useState + 一对 Sheet 组件写死。加第三个工具要改三处。

### 7.2 拓展工具注册描述
```ts
interface EditorExtension {
  id: string;                          // 'event-blueprint' | 'code-editor' | ...
  name: string;
  icon: LucideIcon;
  badge?: 'beta' | 'new';
  /** UI 容器形态 */
  container: 'bottom-sheet' | 'full-overlay' | 'dock-panel';
  /** 工具 UI 根组件（React.lazy 懒加载，不进首屏 bundle） */
  entry: LazyExoticComponent<ComponentType<ExtensionHostProps>>;
  /** 打开快捷键（注册进快捷键体系，可选） */
  shortcutId?: string;
  /** 前台时激活的快捷键上下文 */
  shortcutScope: `extension:${string}`;
  /** 菜单归属分组 */
  menuSection: 'tools';
}

interface ExtensionHostProps {
  /** 请求关闭自身 */
  requestClose: () => void;
}
```

### 7.3 五条核心契约
1. **宿主单状态**：screen-editor 只持有 `activeExtensionId: string | null`。打开/关闭 = 切换该值；"工具"菜单由 `EXTENSION_REGISTRY` 渲染。宿主统一提供容器外壳（标题栏/图标/Beta 角标/关闭按钮），entry 只管内容。
2. **数据契约**：拓展工具**只能经 editor-store 公开 actions 读写项目**，禁止直连 API、禁止绕过历史栈。蓝图写 `project.blueprint`（已并入历史三重快照），代码编辑经 zod 校验后整体写入——都与既有持久化/undo 语义一致。
3. **快捷键上下文切换**：工具前台时上下文栈压入 `extension:<id>`，主编辑器 canvas scope 挂起；工具内部键位（蓝图的节点删除/撤销）由工具自己按 §6 架构注册。
4. **懒加载**：entry 一律 `React.lazy` + Suspense 兜底（骨架屏）。蓝图（~1200 行 + @xyflow/react）与 Monaco 级重依赖不进首屏。
5. **无跨工具通信**：工具之间不直接通信，只经 store 的项目数据交汇（如代码编辑改 JSON → 蓝图读取的是同一份 blueprint 字段）。

### 7.4 容器形态指南
| 容器 | 适用 | 首批实例 |
|---|---|---|
| `bottom-sheet`（60vh） | 与画布对照操作的工具 | 代码编辑 |
| `full-overlay`（全屏弹层，带顶栏） | 需要大图景的编排工具 | 事件蓝图（节点编排需要空间，DataV 同为全屏） |
| `dock-panel`（嵌入左右面板） | 轻量辅助工具 | 预留 |

---

## 8. 实施切片（本期执行）

| 切片 | 内容 | 产出 |
|---|---|---|
| Slice A | 图层右键菜单 + renameComponent + 内联重命名 + 命令描述符模块 | 图层面板达到工业级交互 |
| Slice B | 属性面板 Schema 架构：FieldControls 注册表 + Tabs + Section 编排器 + 现有分区混合挂载 | 新组件接入属性面板零分支 |
| Slice C | 组件库：图标注册收敛 + keywords/description 元数据 + 最近使用 | 组件库可扩展陈列 |
| Slice D | 属性类别扩充第一批：文本增强（字重/行高/对齐）+ 变换（翻转） | 验证 Schema 承载力 |
| Slice E | 快捷键绑定层改造：回调注册表 + 统一绑定引擎 + 上下文栈（editor/text-editing/modal） | 新加快捷键改一处；为拓展工具上下文铺路 |
| Slice F | 拓展工具宿主：EXTENSION_REGISTRY + activeExtensionId 单状态 + 容器外壳；两个占位 Sheet 迁移进注册表 | 第三个工具接入只改注册表；Phase 4 蓝图接线的直接前置 |

每个切片独立完成、独立验证（单测 + biome + tsc + 必要时走查截图）。
