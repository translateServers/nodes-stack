# Tasks

按优先级分阶段交付，P0 为四大类统一分类基础（必做），P1 为 Light Chaser 增强能力（推荐），P2 为可选项。

## P0：四大类统一分类基础

- [x] Task 1: 扩展 PropertyTabId 注释与 section-renderer tab 容器策略
  - [x] SubTask 1.1: 更新 `apps/web/src/features/screen/property-schema/types.ts` 中 `PropertyTabId` 的注释，明确每个 tab 的语义边界（属性/数据/交互/事件）
  - [x] SubTask 1.2: 修改 `apps/web/src/features/screen/property-schema/section-renderer.tsx` 的 tab 容器策略：当 schema 涉及 2+ tab 时**始终启用 Tabs 容器**（移除「无 customRender 分区」的判断），customRender 分区按其 `tab` 字段归入对应 tab
  - [x] SubTask 1.3: 补充 `section-renderer.test.tsx` 测试用例：含 customRender 分区的 schema 应正确启用 Tabs 容器
  - [x] SubTask 1.4: 运行 `pnpm --filter @nebula/web lint` 与 `pnpm --filter @nebula/web typecheck` 验证（注：bar-chart 集成测试因策略变更失败，由 Task 2 处理）

- [x] Task 2: 重组 bar-chart 属性面板 Schema 为 tab 分布
  - [x] SubTask 2.1: 在 `apps/web/src/features/screen/property-schema/schemas.tsx` 中重构 `BAR_CHART_SCHEMA`，将原单一 customRender 分区拆分为按 tab 分布的多个分区：
    - `data` tab：数据源 + 字段映射 + 数据转换（原数据层 + 逻辑层，仍用 customRender）
    - `appearance` tab：图表配置（视觉层，customRender）+ 复用 POSITION_SECTION / STYLE_SECTION / TRANSFORM_SECTION
    - `interaction` tab：悬停提示（原交互层，customRender 或声明式）
    - `events` tab：挂载 QuickEventEditor（Task 4 完成后）
  - [x] SubTask 2.2: 调整 `apps/web/src/features/screen/components/bar-chart-config-sections.tsx`，将四层 PanelSection 拆分为可独立渲染的子组件（如 `BarChartDataSourceSection`、`BarChartLogicSection`、`BarChartVisualSection`、`BarChartInteractionSection`），供 schema 的 customRender 调用
  - [x] SubTask 2.3: 验证 bar-chart 在属性面板的所有原有配置项仍可用（数据源切换、字段映射、API 测试、排序、标题、tooltip）
  - [x] SubTask 2.4: 运行 `pnpm --filter @nebula/web test -- --reporter=verbose bar-chart` 确保现有测试通过（bar-chart-config-sections 53 测试通过；bar-chart-component 卡住为预先存在的 echarts jsdom 问题，与本次修改无关）

- [x] Task 3: 为所有组件 Schema 补齐「层级状态」分区
  - [x] SubTask 3.1: 在 `schemas.tsx` 新增 `LAYER_STATUS_SECTION`（appearance tab）：组件名（text 控件）、zIndex（number 控件）、锁定（switch）、隐藏（switch），路径分别为 `name` / `zIndex` / `status.locked` / `status.hidden`
  - [x] SubTask 3.2: 将 `LAYER_STATUS_SECTION` 加入 `DEFAULT_SCHEMA`、`TEXT_SCHEMA`、`BAR_CHART_SCHEMA`
  - [x] SubTask 3.3: 验证锁定/隐藏状态与现有 editor-store 的 `setLocked` / `setHidden` API 数据一致（路径 `status.locked` / `status.hidden` 与 buildNestedUpdate 语义等价）

## P0：事件 Tab 派生视图

- [x] Task 4: 实现 QuickEventEditor 组件
  - [x] SubTask 4.1: 新建 `apps/web/src/features/screen/components/quick-event-editor.tsx`，接收 `componentId` prop
  - [x] SubTask 4.2: 复用 `apps/web/src/features/screen/blueprint/compiler/filter-by-component.ts` 的 `filterByComponent` 函数派生当前组件相关的规则列表（触发器作为源 + 动作作为目标两组）
  - [x] SubTask 4.3: 渲染两组列表（可折叠 PanelSection），每条规则显示触发器类型 + 动作链摘要，可展开查看完整动作链
  - [x] SubTask 4.4: 实现「+ 添加触发器」按钮，提供常见快速规则模板（点击→跳转、点击→显示/隐藏、点击→刷新数据），调用 `editor-store.updateBlueprint` 新增节点与边
  - [x] SubTask 4.5: 实现「删除规则」按钮，删除 trigger 节点及其下游所有节点和边（调用 `editor-store.updateBlueprint`）
  - [x] SubTask 4.6: 实现「打开事件蓝图」按钮，调用 `editor-store.openBlueprintSheet({ focusComponentId })`
  - [x] SubTask 4.7: 在 `editor-store.ts` 暴露 `openBlueprintSheet` API（如未存在），支持 `focusComponentId` 参数
  - [x] SubTask 4.8: 在 `BAR_CHART_SCHEMA` 与 `DEFAULT_SCHEMA` 的 `events` tab 挂载 `QuickEventEditor`（通过 customRender）
  - [x] SubTask 4.9: 编写 `quick-event-editor.test.tsx` 单元测试：派生视图正确性、添加/删除规则调用正确的 store API
  - [x] SubTask 4.10: 运行 `pnpm --filter @nebula/web lint` 与 `pnpm --filter @nebula/web test -- --reporter=verbose quick-event-editor` 验证

## P0：空状态与未选中视图

- [x] Task 5: 完善未选中组件时的画布设置与全局变量入口占位
  - [x] SubTask 5.1: 在 `apps/web/src/features/screen/components/property-panel.tsx` 的「未选中」分支新增「全局变量」分区占位（Task 9 完成后接入实际管理 UI）
  - [x] SubTask 5.2: 为各组件 schema 的空 tab（如 text 的 data/events）提供空状态提示文案（采用方案 A：在 schema 中为空 tab 添加 customRender 占位分区，新增 createEmptyTabPlaceholder helper）
  - [x] SubTask 5.3: 验证空 tab 仍显示 tab 头，但内容区显示空状态提示（新增 9 个测试用例，修复 5 个 Task 4 遗留失败）

## P1：组件滤镜（Light Chaser 特色）

- [x] Task 6: 实现 ComponentStyleSchema.filter 与渲染层适配
  - [x] SubTask 6.1: 在 `packages/shared/src/schemas/screen.schema.ts` 的 `ComponentStyleSchema` 新增 `filter` 字段：
    ```ts
    filter: z.object({
      hueRotate: z.number().min(0).max(360).default(0),
      saturate: z.number().min(0).max(200).default(100),
      brightness: z.number().min(0).max(200).default(100),
      contrast: z.number().min(0).max(200).default(100),
      blur: z.number().min(0).max(20).default(0),
      grayscale: z.number().min(0).max(100).default(0),
    }).optional()
    ```
  - [x] SubTask 6.2: 在 `apps/web/src/features/screen/components/screen-canvas.tsx` 渲染组件容器时，若 `style.filter` 存在且非默认值，转换为 CSS `filter` 字符串（如 `brightness(80%) saturate(150%)`）
  - [x] SubTask 6.3: 在 `schemas.tsx` 新增 `FILTER_SECTION`（appearance tab），6 个 number 控件，路径 `style.filter.hueRotate` 等
  - [x] SubTask 6.4: 将 `FILTER_SECTION` 加入 `DEFAULT_SCHEMA`、`TEXT_SCHEMA`、`BAR_CHART_SCHEMA`
  - [x] SubTask 6.5: 补充 `screen.schema.test.ts` 测试：filter 字段默认值与边界值校验
  - [x] SubTask 6.6: 运行 `pnpm --filter @nebula/shared test` 验证

## P1：文本细化配置（Light Chaser 特色）

- [ ] Task 7: 扩展 ComponentStyleSchema 文本字段与 TEXT_PROPS_SECTION
  - [ ] SubTask 7.1: 在 `ComponentStyleSchema` 新增 `letterSpacing: z.number().optional()`、`textStrokeWidth: z.number().min(0).optional()`、`textStrokeColor: z.string().optional()`
  - [ ] SubTask 7.2: 扩展 `TEXT_PROPS_SECTION` 新增 3 个字段：字间距（number，path `style.letterSpacing`）、描边宽度（number，path `style.textStrokeWidth`）、描边颜色（color，path `style.textStrokeColor`）
  - [ ] SubTask 7.3: 在 `text-component.tsx` 渲染层应用 `letter-spacing` 与 `-webkit-text-stroke` CSS 属性
  - [ ] SubTask 7.4: 补充 `text-component.test.tsx` 测试：含字间距与描边的渲染快照
  - [ ] SubTask 7.5: 运行 `pnpm --filter @nebula/web test -- --reporter=verbose text-component` 验证

## P1：全局变量机制（Light Chaser 特色）

- [x] Task 8: 实现 GlobalVariableSchema 与 editor-store API
  - [x] SubTask 8.1: 在 `packages/shared/src/schemas/blueprint.schema.ts` 或新建 `global-variable.schema.ts` 定义 `GlobalVariableSchema`：（实际位于 global-variable.schema.ts）
  - [x] SubTask 8.2: 在 `ScreenProjectSchema` 新增 `globalVariables: z.array(GlobalVariableSchema).default([])`
  - [x] SubTask 8.3: 在 `apps/web/src/features/screen/stores/editor-store.ts` 新增 `addGlobalVariable` / `updateGlobalVariable` / `removeGlobalVariable` API，走统一历史栈（修复 update/remove 空操作不入栈 bug）
  - [x] SubTask 8.4: 扩展 `apps/web/src/features/screen/blueprint/lib/template-interpolation.ts` 支持 `{{globalVars.xxx}}` 插值（从运行时上下文读取）
  - [x] SubTask 8.5: 在数据源 API 配置的 URL / params / headers 字段支持插值（预览模式下生效，编辑模式保留占位符）
  - [x] SubTask 8.6: 补充 `template-interpolation.test.ts`、`global-variable.schema.test.ts`、`editor-store.test.ts`、`use-api-data-source.test.ts` 测试（共 33 个新测试）
  - [x] SubTask 8.7: 运行 `pnpm --filter @nebula/shared test` 与 `pnpm --filter @nebula/web typecheck` 验证（shared 170 tests、web editor-store 63 tests、template-interpolation 53 tests、use-api-data-source 19 tests 全部通过）

- [x] Task 9: 实现全局变量管理 UI（画布设置入口）
  - [x] SubTask 9.1: 新建 `apps/web/src/features/screen/components/global-variables-panel.tsx`，渲染全局变量列表（名称/类型/值）+ 添加/编辑/删除按钮
  - [x] SubTask 9.2: 在 `property-panel.tsx` 的「未选中」分支接入 `GlobalVariablesPanel`（替换 Task 5.1 的占位）
  - [x] SubTask 9.3: 编辑表单根据类型动态显示字段（static 显示 value 输入框，api 显示 url/method/refreshInterval，computed 显示 expression 编辑器）
  - [x] SubTask 9.4: 编写 `global-variables-panel.test.tsx` 单元测试：CRUD 操作调用正确的 store API（17 个测试用例）
  - [x] SubTask 9.5: 运行 `pnpm --filter @nebula/web test -- --reporter=verbose global-variables-panel` 验证（17/17 passed；property-panel 18/18 passed）

## P2：文档与质量门

- [ ] Task 10: 更新文档与运行根目录质量门
  - [ ] SubTask 10.1: 更新 `docs/architecture/screen-editor-architecture.md` 的属性面板章节，说明四大类分类与 tab 容器策略
  - [ ] SubTask 10.2: 更新 `docs/specs/screen-editor/README.md` §7 属性面板与 §10 事件蓝图，说明 QuickEventEditor 派生视图
  - [ ] SubTask 10.3: 在 `docs/architecture/blueprint-runtime-architecture.md` 新增章节「右侧面板派生视图」，说明与蓝图的数据共享机制
  - [ ] SubTask 10.4: 运行根目录 `pnpm lint` 确保全项目（含 @nebula/web、@nebula/shared、@nebula/nestjs-server）零错误
  - [ ] SubTask 10.5: 运行根目录 `pnpm typecheck` 与 `pnpm test` 确保无回归

# Task Dependencies

- Task 2 依赖 Task 1（tab 容器策略修复后才能正确验证 bar-chart 重组）
- Task 4 可与 Task 2 并行（QuickEventEditor 与 bar-chart 重组无强依赖，但接入 schema 需 Task 2 完成）
- Task 5 依赖 Task 4（全局变量入口占位需 QuickEventEditor 的占位逻辑一致）
- Task 6、7、8 互相独立，可并行
- Task 9 依赖 Task 8（UI 依赖 store API）
- Task 10 必须最后执行（文档与质量门汇总）
