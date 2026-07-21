# 大屏设计器 · 长线任务文档

> 目标：成为工业级大屏设计器（对标阿里 DataV / GoView / Light Chaser）。
> 本文档按阶段拆解任务并追踪进度，每阶段完成后更新状态与日期。
> 最近更新：2026-07-21

## 阶段总览

| 阶段 | 主题 | 状态 |
|---|---|---|
| Phase 1 | UI/UX 工业级重构（编辑器外壳 + 列表页） | ✅ 已完成（2026-07-21） |
| Phase 2 | 基座夯实（面板系统架构：图层右键菜单/属性 Schema 化/组件库陈列架构） | 🚧 进行中 |
| Phase 3 | 图表体系升级（ECharts 接入 + 多图表组件） | ⬜ 未开始（echarts 依赖已安装） |
| Phase 4 | 事件蓝图编辑器 UI 接线 | ⬜ 未开始 |
| Phase 5 | 组件生态扩展（表格/容器/装饰/指标卡） | ⬜ 未开始 |
| Phase 6 | 项目资产与体验（缩略图截图/模板/复制项目） | ⬜ 未开始 |
| Phase 7 | 工程质量（大文件拆分/E2E 补齐/性能） | ⬜ 未开始 |

> 2026-07-21 调整：用户决策"先夯实基座，再扩组件内容"，图表升级顺延为 Phase 3。
> Phase 2 设计依据：`docs/screen-designer-panels-architecture.md`。

---

## Phase 1 ✅ UI/UX 工业级重构（2026-07-21 完成）

纯界面重构，不动功能逻辑，跟随系统主题。

- [x] 统一视觉原语 `features/screen/components/ui-primitives/`（PanelSection / ToolbarButton / PanelResizeHandle / useResizablePanel）
- [x] 新增 shadcn `tabs` 组件
- [x] 顶部工具栏三段式（项目名内联重命名、保存状态徽标、撤销/重做按钮、缩放控件组）
- [x] 左侧面板：Tabs + 宽度可调 + 折叠图标轨 + 组件库搜索
- [x] 右侧属性面板：全分区 PanelSection 化 + 宽度可调可折叠 + 空选中引导
- [x] 画布点阵底纹、状态栏 Tooltip、图层行 hover 操作
- [x] 列表页：搜索 / 新建 Dialog（尺寸预设）/ 卡片升级 / 相对时间 / alert-dialog 删除
- [x] 验证：1372 测试通过、tsc/biome 零错误、Playwright 走查截图（`test-artifacts/ui-refresh/`）

## Phase 2 🚧 基座夯实（面板系统架构）

设计文档：`docs/screen-designer-panels-architecture.md`（方法论：注册表驱动 / Schema 驱动渲染 / 命令描述符 / 单向数据流不变）

- [ ] Slice A 图层右键菜单 + `renameComponent` + 行内重命名 + 命令描述符模块（`lib/layer-commands.ts`）
- [ ] Slice B 属性面板 Schema 架构：字段控件注册表 + Tabs（外观/数据/交互）+ Section 编排器 + 现有分区混合挂载（bar-chart 复杂表单走 custom 逃生舱）
- [ ] Slice C 组件库：图标注册收敛（registry/icons.ts）+ keywords/description 元数据 + 最近使用
- [ ] Slice D 属性类别扩充第一批：文本增强（字重/行高/对齐）+ 变换（翻转），验证 Schema 承载力
- [ ] 验证：全量测试 + biome + tsc + Playwright 走查

## Phase 3 ⬜ 图表体系升级（ECharts）

背景：当前仅手写 SVG 柱状图（viewBox 固定 400×300，无坐标轴/动画/图例），是工业级最大短板。

- [ ] 2.1 安装 `echarts`，建立 `useEcharts` 封装（SVG 渲染器，jsdom 可测；ResizeObserver 自适应）
- [ ] 2.2 柱状图迁移到 ECharts（保持现有数据层契约：dataSource/fieldMapping/logic/props.title/style，老项目数据无缝兼容）
- [ ] 2.3 新增折线图 line-chart（复用柱状图数据契约）
- [ ] 2.4 新增饼图 pie-chart（维度→系列名，数值→占比）
- [ ] 2.5 配置面板泛化：bar-chart-config-sections 抽象为 chart-config-sections，按类型注入视觉层差异项
- [ ] 2.6 组件库注册与图标、预览路由渲染支持
- [ ] 2.7 测试迁移与新增（echarts 在 jsdom 用 SVG renderer 断言 option 而非像素）
- [ ] 2.8 Playwright 走查截图验证

约束：不改数据层 schema（FieldMapping/DataSource/LogicConfig 已稳定），不改后端。

## Phase 4 ⬜ 事件蓝图编辑器 UI 接线

背景：编译器/运行时/节点/边/面板组件已就绪（`blueprint/`，@xyflow/react），但入口是 52 行占位 Sheet。

- [ ] 3.1 实现 `blueprint/sheet/`：BlueprintSheet 容器 + BlueprintCanvas（@xyflow/react 画布接线）
- [ ] 3.2 节点拖拽创建（search-panel 已有）、连线、删除、选中
- [ ] 3.3 与 editor-store 的 blueprint 字段持久化打通（schema 已支持）
- [ ] 3.4 预览页运行时联调（refreshDataSource 动作已支持）
- [ ] 3.5 code-editor-sheet 占位评估：保留或移除

## Phase 5 ⬜ 组件生态扩展

- [ ] 4.1 指标卡（数字翻牌器）组件
- [ ] 4.2 数据表格组件（CATEGORY_LABELS 中 table 分类目前为空）
- [ ] 4.3 容器/分组容器组件（container 分类目前为空）
- [ ] 4.4 装饰类：分割线、边框盒、时间器
- [ ] 4.5 素材库：内置装饰 SVG/图标资产

## Phase 6 ⬜ 项目资产与体验

- [ ] 5.1 缩略图截图生成（Prisma `thumbnail` 字段已预留，保存时 canvas 截图上传）
- [ ] 5.2 项目复制/重命名（列表页更多菜单已留位）
- [ ] 5.3 模板市场：内置 2-3 套行业模板（监控/运营/指挥）
- [ ] 5.4 大屏列表分页/排序

## Phase 7 ⬜ 工程质量

- [ ] 6.1 `screen-canvas.tsx`（1763 行）拆分：交互路由/创建/变换/提示分离
- [ ] 6.2 编辑器 E2E 覆盖补齐（面板拖拽、折叠、工具栏新入口）
- [ ] 6.3 性能：大组件数场景渲染 profiling、moveable 高频更新节流审查
- [ ] 6.4 依赖健康：`@xyflow/react` 已在 package.json 但曾未安装（Phase 1 已 pnpm install 修复）

---

## 执行约定

- 每阶段开工前先读本文档确认范围；完成后更新 checkbox 与状态，并写明验证结果
- 全程遵守根 AGENTS.md：Biome 格式、strict TS、测试先行修复
- 长任务优先拆给子代理并行（独立文件维度拆分），主线程负责接线与验证
