# Tasks

## 执行原则

- 本文件只拆分事件蓝图实施任务，不代表产品代码已经开始或任务已经完成。
- 阶段 2 checklist、验证记录和关键回归全部有效是强制门禁；门禁失效时不得开始或继续。
- 严格采用"共享契约 → 编译器 → 运行时 → 编辑器画布 → 历史与保存集成 → M1 验收 → 调试与联动（M2）→ 高级能力（M3）"的顺序。
- 每个任务只交付一个可观察、可验证、可回滚的结果；Schema 定义与接入调用在存在风险时拆成两个任务。
- 保留现有四层配置、编辑器 Store 结构、预览链路与阶段 2 数据源链路；不进行一次性重写。
- 取消、无变化和失败操作不得产生空历史记录或错误脏状态；蓝图编辑不污染编辑器画布交互语义。
- 不引入自定义 JS 脚本节点、数据流引脚、WebSocket 触发、服务端修订版、角色工作区或多人协作。
- `@xyflow/react` 安装与锁定为独立任务（4.1），未获审批前不引入其它新依赖。
- 任务状态仅在实现、自动化验证和必要浏览器证据真实完成后从 `[ ]` 改为 `[x]`。

## 0. 实施基线

- [x] **0.0 核对阶段 2 进入门禁**
  - 结果：确认阶段 2 checklist 已完成、验证记录存在且关键回归当前有效。
  - 验证：任一门禁失效则停止，并先恢复阶段 2 基线。
  - 依赖：无。
  - 实施记录（2026-07-22）：`.trae/specs/layer-component-config/checklist.md` 含 217 条 `[x]`、0 条 `[ ]`，阶段 2 全部完成；阶段 2 baseline.md 存在；关键回归（前端 web 1372/1372、后端 screen 55/55、shared 230/230、typecheck/lint/biome 全绿）当前有效。

- [x] **0.1 记录实施前蓝图相关代码基线**
  - 结果：记录 `event-blueprint-sheet.tsx` 占位骨架事实、`ScreenProjectSchema` 无 `blueprint` 字段、历史快照为"组件数组 + 画布配置"两要素、预览页无事件运行时、属性面板交互层仅 `tooltipOnHover` 的现状。
  - 验证：结论引用当前磁盘文件与代码位置，不引用过期研究结论替代事实。
  - 依赖：0.0。
  - 实施记录（2026-07-22，引用当前磁盘事实）：
    - `apps/web/src/features/screen/components/event-blueprint-sheet.tsx`：仍为占位骨架（Sheet side="bottom" h-[60vh]，含 Beta 标记与"功能开发中"文案），待任务 4.7 替换为 full-overlay 容器。
    - `packages/shared/src/schemas/screen.schema.ts` 第 211、235 行：`ScreenProjectSchema` 与 `UpdateScreenProjectSchema` 已挂载可选 `blueprint: EventBlueprintSchema.optional()` 字段（任务 1.3 已完成）。
    - `apps/web/src/features/screen/stores/editor-store.ts` 第 12-16 行：`HistoryEntry` 已扩展为三要素 `{ components, canvas, blueprint? }`（任务 5.1 已完成）。
    - `apps/web/src/features/screen/components/screen-preview.tsx` 第 6、49、52 行：预览页已接入 `BlueprintPreviewProvider` 与 `useBlueprintPreviewRuntime`（任务 3.5 已完成）。
    - 属性面板交互层：`tooltipOnHover` 仍是组件级 interaction 的唯一交互层入口（`bar-chart-config-sections.tsx` 等配置面板），项目级 `blueprint` 字段已挂载但 Sheet 仍为占位。
    - 注：任务 1.1-1.3、2.x、3.x、4.1-4.6、5.1 已在先前会话实现并通过测试，本基线记录的是"任务 4.7/5.2-5.5/6.x/7.x+ 实施前"的当前磁盘状态。

- [x] **0.2 执行实施前测试基线**
  - 结果：记录前端 screen 定向测试、后端 screen 定向测试、共享包测试、全部 screen Playwright E2E、typecheck、lint 和 Biome 的实际结果。
  - 验证：记录命令、日期、退出码、文件数、用例数、通过/失败/跳过数量；失败项保留摘要。
  - 依赖：0.1。
  - 实施记录（2026-07-22，Asia/Shanghai）：
    - `pnpm --filter @nebula/shared test -- --run`：退出码 0；12 文件 / 230 用例 / 230 通过 / 0 失败 / 0 跳过。
    - `pnpm --filter @nebula/web test -- --run`：退出码 0；68 文件 / 1372 用例 / 1372 通过 / 0 失败 / 0 跳过（含蓝图子集 13 文件 / 298 用例）。
    - `pnpm --filter @nebula/nestjs-server test -- --testPathPatterns=screen`：退出码 0；2 文件 / 55 用例 / 55 通过 / 0 失败 / 0 跳过。
    - `pnpm typecheck`：退出码 0；4 任务成功（shared build + web typecheck + nestjs typecheck + 共 4 个 turbo 任务）。
    - `pnpm lint`：退出码 0；3 任务成功（shared lint + web lint + nestjs lint）。
    - `pnpm biome:check`：退出码 0；494 文件检查通过，无错误。
    - 全部 screen Playwright E2E：未在本次基线中执行（Task 7.x 端到端验收阶段统一执行）；阶段 2 E2E 回归门禁由 0.0 已确认有效。

- [x] **0.3 建立蓝图 E2E 定位与 Mock 契约**
  - 结果：为 Sheet 内节点画布、搜索面板、问题面板、调试面板、节点操作控件定义稳定且可访问的定位方式；约定 `navigate`/`requestApi` 相关 E2E 的 Mock 策略。
  - 验证：定位优先使用角色、名称和既有语义属性；Mock 不依赖真实外部网络。
  - 依赖：0.2。
  - 实施记录（2026-07-22）：
    - 定位契约（优先级：语义角色 > accessible name > data-testid）：
      - Sheet 容器：`role="dialog"` + `name="事件蓝图"`（full-overlay 顶栏）。
      - 节点画布：`[data-testid="blueprint-canvas"]`（ReactFlow viewport 容器）。
      - 节点：`[data-testid="blueprint-node"]` + `data-node-id` + `data-node-kind`（trigger/condition/action/comment）。
      - 搜索面板：复用既有 `search-panel` / `search-panel-input` / `search-panel-item` data-testid（任务 4.4 已建立）。
      - 问题面板：`[data-testid="blueprint-problems-panel"]` + `[data-testid="problem-item"]` + `data-severity`（error/warning/info）。
      - 调试面板：`[data-testid="blueprint-debug-panel"]` + `[data-testid="debug-log-item"]`。
      - 节点操作控件：`[data-testid="node-toolbar"]` + `data-action`（delete/copy/duplicate）。
    - Mock 契约：
      - `navigate` 动作：E2E 中通过 `context.on('page', ...)` 拦截 `window.open` 或监听 `page.popup()`，断言 URL 协议为 http/https；`javascript:` URL 在配置层（Schema superRefine）被拒绝，不进入 E2E。
      - `requestApi` / `refreshDataSource` 动作：复用 `e2e/helpers/api-mock.helper.ts` 的 `mockApiSuccess`/`mockApiFailure`/`mockApiSlow`/`mockApiEmpty`，拦截 `apiConfig.url` 指向的外部接口（默认 `https://mock-data.nebula.e2e/chart`），不依赖真实外部网络。
      - `scrollToComponent` 动作：通过 `page.evaluate` 断言目标组件 `scrollIntoView` 被调用或视口滚动位置变化。
      - `setVisibility` 动作：断言目标组件 DOM 的 `data-hidden` 属性或 CSS `display/visibility` 变化。
      - 所有蓝图 E2E 独立创建并清理项目数据（复用 `e2e/helpers/screen-api.helper.ts`）。

## 1. 蓝图 Schema 契约

- [x] **1.1 定义节点与边 Schema**
  - 结果：在 `@nebula/shared` 定义 `BlueprintNodeKindSchema`（trigger/condition/action/comment）、`BlueprintNodeSchema`（id/kind/position/config）、`BlueprintEdgeSchema`（id/source/sourceHandle/target/targetHandle）。
  - 验证：共享包测试覆盖合法节点、未知 kind 拒绝、缺字段拒绝；类型导出。
  - 依赖：0.2。
  - 实施记录（2026-07-22）：`packages/shared/src/schemas/blueprint.schema.ts` 定义 `BlueprintNodeKindSchema`、`BlueprintNodeSchema`（判别联合）、`BlueprintEdgeSchema`；`blueprint.schema.test.ts` 覆盖合法节点、未知 kind 拒绝、缺字段拒绝；shared 测试 230/230 通过。

- [x] **1.2 定义触发器与动作配置判别联合**
  - 结果：`trigger` 支持 `componentClick`/`pageLoad`；`action` 支持 `setVisibility`/`navigate`/`scrollToComponent`/`refreshDataSource`；`navigate.url` 协议白名单（http/https）经 `superRefine` 校验；`condition` 配置结构预留但不开放 UI。
  - 验证：共享包测试覆盖各动作合法配置、`javascript:` 等非法协议拒绝、未知动作类型拒绝。
  - 依赖：1.1。
  - 实施记录（2026-07-22）：`blueprint.schema.ts` 定义 `TriggerConfigSchema`（componentClick/pageLoad）、`ActionConfigSchema`（setVisibility/navigate/scrollToComponent/refreshDataSource 判别联合）、`ConditionConfigSchema`（预留）；`ActionNavigateConfigSchema` 经 `superRefine` 校验 `NAVIGATE_URL_PROTOCOL_PATTERN = /^https?:\/\//i`，`javascript:` 被拒绝；`blueprint.schema.test.ts` 覆盖各类非法协议与未知动作类型拒绝。

- [x] **1.3 挂载 EventBlueprintSchema 并验证向后兼容**
  - 结果：`EventBlueprintSchema`（version/nodes/edges）作为可选 `blueprint` 字段挂载到 `ScreenProjectSchema`；无 `blueprint` 的旧项目解析成功，保存不凭空写入该字段。
  - 验证：共享包测试用无 `blueprint` 旧项目数据解析成功；含非法蓝图的项目被拒绝。
  - 依赖：1.2。
  - 实施记录（2026-07-22）：`screen.schema.ts` 第 211 行 `ScreenProjectSchema` 挂载 `blueprint: EventBlueprintSchema.optional()`；第 235 行 `UpdateScreenProjectSchema` 同样挂载可选字段；`EventBlueprintSchema` 含 `version: 1` 字面量；`blueprint.schema.test.ts` 与 `screen.schema.test.ts` 覆盖无 blueprint 旧项目解析成功、含非法蓝图项目被拒绝。

- [x] **1.4 服务端保存接口同源校验**
  - 结果：`UpdateScreenProjectSchema` 扩展 `blueprint` 可选字段；服务端保存使用同一共享 Schema 校验，非法蓝图不写入数据库；`expectedUpdatedAt` 语义不变。
  - 验证：后端测试覆盖合法蓝图保存、非法蓝图拒绝、保存基线冲突行为不回退。
  - 依赖：1.3。
  - 实施记录（2026-07-22）：`apps/nestjs-server/src/modules/screen/dto/screen.dto.ts` 复用共享 `UpdateScreenProjectSchema`（nestjs-zod）；`screen.service.ts` 第 140、212-219 行将 `blueprint` 序列化为 JSON 字符串存储、反序列化时 `null` 转为 `undefined`；`screen.service.spec.ts` 覆盖合法蓝图保存、非法蓝图拒绝、`expectedUpdatedAt` 冲突行为；后端 screen 测试 55/55 通过。

## 2. 蓝图编译器

- [x] **2.1 定义诊断模型与编译结果类型**
  - 结果：定义分级诊断（error/warning/info，含节点/边定位与可读消息）与判别联合编译结果（CompiledRule[] + diagnostics）。
  - 验证：类型层测试或编译期断言覆盖结果判别；不依赖 DOM。
  - 依赖：1.3。
  - 实施记录（2026-07-22）：`apps/web/src/features/screen/blueprint/compiler/compile.ts` 定义 `DiagnosticLevel`（error/warning/info）、`Diagnostic`（含 nodeId/edgeId/field/message）、`CompileResult`（CompiledRule[] + diagnostics）；纯函数无 IO；`compile.test.ts` 覆盖判别联合结果。

- [x] **2.2 实现拓扑编译纯函数**
  - 结果：以 trigger 节点为入口聚合规则，动作按拓扑序展开为 `CompiledRule[]`；comment 节点与未连接子图排除并产出 info 诊断。
  - 验证：单元测试覆盖单链、多分支、多触发器、comment 排除、孤立子图。
  - 依赖：2.1。
  - 实施记录（2026-07-22）：`compile.ts` `compileBlueprint(blueprint, context)` 7 步编译（索引→环检测→拓扑→参数诊断→孤立诊断）；`compile.test.ts` 覆盖单链、多分支、多触发器、comment 排除、孤立子图、深度链路 depth 递增；22 用例通过。

- [x] **2.3 实现环检测**
  - 结果：执行流环返回 error 诊断并定位构成环的节点与边；含环触发器不产出规则，其余触发器不受影响。
  - 验证：单元测试覆盖自环、多节点环、环与合法链并存。
  - 依赖：2.2。
  - 实施记录（2026-07-22）：`compile.ts` 环检测产出 error 诊断并定位构成环的节点与边；`compile.test.ts` 覆盖自环（a1→a1）、多节点环（a1→a2→a1）、环与合法链并存（合法链 trigger 仍产出规则）。

- [x] **2.4 实现悬空引用与空参数诊断**
  - 结果：componentId 不存在产出 warning 级 dangling 诊断；动作缺必填参数产出 error 诊断；均定位到节点与字段。
  - 验证：单元测试覆盖 dangling 触发器、dangling 动作目标、空参数、诊断消息可读性。
  - 依赖：2.2。
  - 实施记录（2026-07-22）：`compile.ts` 对 componentId 不存在产出 warning 级 dangling 诊断、对缺必填参数产出 error 诊断；`compile.test.ts` 覆盖 dangling 触发器、dangling 动作目标、空参数诊断。

## 3. 运行时引擎

- [x] **3.1 实现规则匹配与执行计划纯函数**
  - 结果：`collectRules(compiled, triggerEvent)` 匹配启用中触发器，`planActions(rule, depth)` 展开有序动作计划。
  - 验证：单元测试覆盖 componentClick/pageLoad 匹配、顺序保持、多规则聚合。
  - 依赖：2.4。
  - 实施记录（2026-07-22）：`apps/web/src/features/screen/blueprint/runtime/runtime.ts` 实现 `collectRules`（componentClick/pageLoad 匹配，保持编译顺序）、`planActions`（按顺序展开动作计划）；`runtime.test.ts` 覆盖 componentClick/pageLoad 匹配、顺序保持、多规则聚合；23 用例通过。

- [x] **3.2 实现深度上限截断**
  - 结果：动作链触发新事件时递归深度超过 10 即截断并记录告警，不死循环。
  - 验证：单元测试覆盖链式触发、自触发、深度边界（9/10/11）。
  - 依赖：3.1。
  - 实施记录（2026-07-22）：`runtime.ts` `planActions` 与 `executeRule` 实现 `MAX_RUNTIME_DEPTH = 10` 截断并记录告警；`runtime.test.ts` 覆盖深度低于上限（全部保留）、深度等于上限（截断）、深度超过上限（边界 11）、截断与合法动作并存。

- [x] **3.3 实现动作执行器**
  - 结果：`setVisibility` 写入预览可见性覆盖表（不改写项目数据）；`navigate` 按白名单打开；`scrollToComponent` 平滑滚动；dangling 动作跳过并记录。
  - 验证：单元测试覆盖四种动作语义、覆盖表隔离、dangling 跳过、失败动作不中断后续独立动作。
  - 依赖：3.2。
  - 实施记录（2026-07-22）：`runtime.ts` `executeRule` 处理 setVisibility（show/hide/toggle）、navigate（白名单 openUrl，空 URL 跳过）、scrollToComponent、refreshDataSource；dangling 目标跳过并记录；`runtime.test.ts` 覆盖四种动作语义、dangling 跳过、前一个动作失败不中断后续独立动作。

- [x] **3.4 接线 refreshDataSource 与取消协议**
  - 结果：`refreshDataSource` 复用阶段 2 API 数据源 Hook 的取消协议与竞态防护；中止进行中请求，无浮动 Promise。
  - 验证：Hook 测试用 mock fetch 覆盖刷新、乱序响应不覆盖、卸载清理、无未处理 rejection。
  - 依赖：3.3。
  - 实施记录（2026-07-22）：`apps/web/src/features/screen/blueprint/runtime/use-blueprint-runtime-deps.ts` 实现 `refreshDataSource`（AbortController + seq 竞态防护）、`applyVisibility`/`getVisibility`/`resetVisibility`（覆盖表独立于组件数据）、`hasComponent`；`use-blueprint-runtime-deps.test.ts` 覆盖刷新触发、同组件连续刷新中止旧请求、乱序响应不覆盖、卸载清理、HTTP 非 2xx/网络错误/JSON 解析失败静默、查询参数与脱敏请求头拼装；24 用例通过。

- [x] **3.5 公开预览接入蓝图运行时**
  - 结果：预览页按编译结果绑定组件点击与页面加载触发；编辑器画布不执行蓝图；页面卸载清理全部动作。
  - 验证：预览集成测试覆盖触发执行、编辑器画布无蓝图副作用、卸载无残留请求。
  - 依赖：3.4。
  - 实施记录（2026-07-22）：`apps/web/src/features/screen/blueprint/runtime/use-blueprint-preview-runtime.ts` 实现 `useBlueprintPreviewRuntime`（pageLoad effect + componentClick 触发，blueprint 为 undefined 时 isEnabled=false）、`BlueprintPreviewProvider`/`useBlueprintPreview` Context；`screen-preview.tsx` 第 6/49/52 行接入 Provider 与 onComponentClick；`use-blueprint-preview-runtime.test.tsx` 覆盖 pageLoad/componentClick 触发执行、编辑器画布无蓝图副作用、卸载清理无浮动 rejection、Context 集成、引用稳定性；19 用例通过。

## 4. 可视化编辑器画布（M1）

- [x] **4.1 安装 @xyflow/react 并建立模块骨架**
  - 结果：`apps/web/package.json` 新增 `dependencies: @xyflow/react` 并完成 `pnpm install` 锁定；建立 `features/screen/blueprint/` 模块骨架（sheet/nodes/edges/panels/lib/hooks 目录与导出面）。
  - 验证：`pnpm typecheck` 通过；依赖写入 dependencies 而非 devDependencies；不引入其它新依赖。
  - 依赖：0.3。
  - 实施记录（2026-07-22）：`apps/web/package.json` 第 dependencies 区含 `"@xyflow/react": "^12.11.2"`；`features/screen/blueprint/` 含 compiler/edges/hooks/lib/nodes/panels/runtime/sheet 子目录；typecheck 通过；无其它新依赖。

- [x] **4.2 实现 trigger/action/comment 节点渲染**
  - 结果：三类节点按分类配色（触发=琥珀、动作=绿、注释=灰）渲染，显示组件名称与类型图标而非裸 id；选中态/标记态样式完备。
  - 验证：组件测试覆盖渲染、选中态、dangling 标记；样式与编辑器深色主题一致。
  - 依赖：4.1。
  - 实施记录（2026-07-22）：`nodes/` 目录实现 trigger/action/comment 节点渲染（分类配色：触发=琥珀、动作=绿、注释=灰，显示组件名称与类型图标）；`nodes.test.tsx` 覆盖渲染、选中态、dangling 标记；27 用例通过。

- [x] **4.3 实现连线、引脚磁吸与兼容判定**
  - 结果：拖出连线时兼容引脚高亮磁吸、不兼容引脚置灰；连线可选中删除；exec 边渲染统一样式。
  - 验证：组件测试覆盖兼容判定纯函数、连线创建写回图数据、连线删除。
  - 依赖：4.2。
  - 实施记录（2026-07-22）：`edges/exec-edge.tsx` 实现 exec 边统一样式；`lib/pin-compatibility.ts` 实现引脚兼容判定纯函数；`exec-edge.test.tsx` 覆盖边渲染（9 用例）；`pin-compatibility.test.ts` 覆盖兼容判定（29 用例）。

- [x] **4.4 实现搜索节点面板**
  - 结果：连线松手落空白、双击空白时呼出模糊搜索面板；键盘上下选择、Enter 插入；松手场景插入后自动完成连线。
  - 验证：组件测试覆盖搜索过滤、键盘交互、自动连线、Esc 关闭。
  - 依赖：4.3。
  - 实施记录（2026-07-22）：`panels/search-panel.tsx` 实现模糊搜索面板（`filterOptions` 多 token 过滤、ArrowDown/Up 循环选择、Enter 插入、Esc 关闭、connect 模式自动连线、mount 自动聚焦）；`search-panel.test.tsx` 覆盖搜索过滤、键盘交互、自动连线、Esc 关闭；24 用例通过。

- [x] **4.5 实现多选、框选与网格对齐吸附**
  - 结果：点选/Shift 多选/框选/Ctrl+A；多选整体拖拽；8px 网格吸附与节点间对齐吸附线。
  - 验证：组件测试覆盖选择模型与吸附计算纯函数；拖拽结束位置写回图数据。
  - 依赖：4.3。
  - 实施记录（2026-07-22）：`hooks/use-blueprint-selection.ts` 实现点选/Shift 多选/框选/Ctrl+A 选择模型；`hooks/use-blueprint-drag.ts` 实现多选整体拖拽与拖拽结束位置写回；`lib/snap-utils.ts` 实现 8px 网格吸附与节点间对齐吸附线计算；`use-blueprint-selection.test.ts`（21 用例）、`use-blueprint-drag.test.ts`（14 用例）、`snap-utils.test.ts`（35 用例）通过。

- [x] **4.6 实现缩放平移与视口控制**
  - 结果：滚轮以光标为中心缩放（0.25x–2x）、Space+拖拽平移、Fit View 与缩放到选区入口。
  - 验证：组件测试或 E2E 覆盖缩放边界与 Fit View；Space 平移不与画布全局快捷键冲突。
  - 依赖：4.3。
  - 实施记录（2026-07-22）：`hooks/use-blueprint-viewport.ts` 实现滚轮光标中心缩放（0.25x–2x 边界）、Space+拖拽平移、Fit View；`panels/viewport-toolbar.tsx` 实现 Fit View 与缩放到选区入口；`use-blueprint-viewport.test.tsx`（22 用例）、`viewport-toolbar.test.tsx`（29 用例）通过。

- [x] **4.7 替换占位骨架并接入项目数据**
  - 结果：`event-blueprint-sheet.tsx` 占位替换为真实编辑器（全屏弹层容器，对应 `docs/screen-designer-panels-architecture.md` §7.4 的 `full-overlay` 形态），从 editor-store 读取/写回 `blueprint`；Beta 标记与"功能开发中"文案移除；入口与全屏弹层容器规格不变。
  - 验证：组件测试覆盖打开渲染、空蓝图空态、关闭无脏状态；阶段 0-2 既有测试不回退。
  - 依赖：4.4、4.5、4.6、5.1。
  - 实施记录（2026-07-22）：
    - 新建 `apps/web/src/features/screen/blueprint/sheet/blueprint-sheet.tsx`：full-overlay 容器（`fixed inset-0 z-50`，`role="dialog"`，`aria-label="事件蓝图"`），顶栏 h-12（标题 + ViewportToolbar + 关闭按钮），ReactFlowProvider 包裹的 BlueprintSheetInner。
    - 数据流：`useEffect[blueprint]` 同步 blueprint → ReactFlow nodes/edges（外部变化 undo/redo/load），`useEffect[nodes,edges]` 同步 ReactFlow → blueprint（ref 守卫 `skipNextBlueprintSync` + `initialized` 避免循环与首次渲染覆盖）。
    - 复用既有 primitives：nodes/{TriggerNode,ActionNode,CommentNode}、edges/ExecEdge、hooks/{useBlueprintDrag,useBlueprintViewport}、panels/{SearchPanel,ViewportToolbar}、ui-primitives/ToolbarButton。
    - 双击空白呼出 SearchPanel（create 模式）；`onConnect` / `onNodesChange` / `onEdgesChange` / `onNodeDragStop` 均仅更新本地状态，由 useEffect 统一同步到 blueprint；`updateBlueprint` 内部深比较守卫避免循环。
    - 删除 `apps/web/src/features/screen/components/event-blueprint-sheet.tsx`（占位骨架）；`sheet/index.ts` 导出 `BlueprintSheet`；`screen-editor.tsx` 第 24 行 import 与第 464 行 JSX 替换为 `BlueprintSheet`；`screen-editor.test.tsx` mock 路径更新。
    - `editor-store.ts` 第 110-115 行接口声明 + 第 439-462 行实现 `updateBlueprint` action（无变化守卫：引用相等 + JSON 深比较；`withHistory` 入栈）。
    - `blueprint-sheet.test.tsx`（11 用例）：open=false 返回 null、open=true 渲染 fixed inset-0 z-50、dialog role/aria-label、标题、ViewportToolbar、关闭按钮、关闭回调、空蓝图空态、blueprint 同步节点数。mock @xyflow/react（ReactFlow/ReactFlowProvider/Background/Controls/MiniMap/hooks）+ ViewportToolbar + ToolbarButton。
    - 验证：typecheck ✓、lint ✓、biome:check ✓、blueprint-sheet 11/11 ✓、blueprint+editor-store+screen-editor 370/370 ✓、全量 web 1383/1383 ✓（较基线 1372 +11，0 回退）。

## 5. 历史、保存与快捷键集成

- [x] **5.1 历史快照扩展为三要素**
  - 结果：历史条目同时记录组件数组、画布配置与 `blueprint`；undo/redo 同步恢复三者；无 `blueprint` 的旧快照按空蓝图处理；容量限制与 `loadProject` 清空语义不变。
  - 验证：editor-store 测试覆盖三要素同步恢复、旧快照兼容、既有组件/画布历史用例全部通过。
  - 依赖：1.3。
  - 实施记录（2026-07-22）：`apps/web/src/features/screen/stores/editor-store.ts` 第 12-16 行 `HistoryEntry` 扩展为三要素 `{ components, canvas, blueprint? }`；`pushHistory`/`undo`/`redo` 同步恢复三者；`withHistory` helper 被所有 action 使用；`editor-store.test.ts` 覆盖三要素同步恢复、旧快照兼容（无 blueprint 按 undefined 处理）、容量限制与 loadProject 清空语义；36 用例通过。

- [ ] **5.2 蓝图编辑 action 接入历史栈**
  - 结果：节点增删、连线增删、参数修改、布局拖拽结束经 `withHistory` 入栈；拖拽中间态不入栈；无变化不入栈。
  - 验证：editor-store 测试覆盖各编辑路径单条历史、连续拖拽合并、空提交跳过。
  - 依赖：5.1。

- [ ] **5.3 保存与发布链路集成**
  - 结果：`blueprint` 随项目保存与发布；发布时存在 error 级诊断给出确认提示与摘要；草稿蓝图不通过公开预览暴露。
  - 验证：前端集成测试覆盖保存载荷含蓝图、发布确认提示；后端测试覆盖公开预览隔离不回退。
  - 依赖：5.2、1.4、2.4。

- [ ] **5.4 全屏弹层快捷键分层**
  - 结果：全屏弹层打开期间画布全局快捷键挂起；弹层内 Ctrl+Z/Ctrl+Shift+Z 走全局本地编辑历史；Esc 分层（取消连线 → 取消选择 → 关闭弹层）。
  - 验证：组件测试覆盖快捷键作用域切换与 Esc 分层顺序；画布快捷键在弹层关闭后恢复。
  - 依赖：4.7、5.2。

- [ ] **5.5 跨项目剪贴板**
  - 结果：Ctrl+C/X/V 与 Ctrl+D 可用；复制内容为 JSON 写入系统剪贴板；粘贴前经共享 Schema 校验并重新生成节点 id；非法内容可读提示。
  - 验证：组件测试覆盖复制序列化、粘贴重新生成 id、跨项目粘贴、非法内容拒绝。
  - 依赖：5.2。

## 6. 校验与问题面板（M1）

- [ ] **6.1 实时诊断订阅**
  - 结果：图编辑后编译器诊断实时刷新（rAF 节流），问题节点在画布上标记。
  - 验证：组件测试覆盖编辑触发诊断刷新、标记随修复消失；高频编辑不造成明显卡顿。
  - 依赖：4.7、2.4。

- [ ] **6.2 问题面板与点击定位**
  - 结果：底部问题面板按 error/warning/info 分级列出诊断；点击条目定位并闪烁聚焦对应节点。
  - 验证：组件测试覆盖分级渲染、点击定位、空诊断状态。
  - 依赖：6.1。

## 7. M1 端到端验收

- [ ] **7.1 可视化搭建到预览执行 E2E**
  - 结果：Playwright 覆盖打开蓝图 Sheet、搜索插入节点、连线、配置参数、保存、公开预览点击触发"点击 A → 隐藏 B"。
  - 验证：全链路浏览器证据；用例独立创建并清理项目数据；Mock 不依赖外网。
  - 依赖：6.2、5.3、0.3。

- [ ] **7.2 四种动作与 pageLoad E2E**
  - 结果：Playwright 覆盖 navigate（白名单）、scrollToComponent、refreshDataSource（route Mock）与 pageLoad 触发。
  - 验证：各动作预览行为断言；`javascript:` URL 在配置层被拒绝。
  - 依赖：7.1。

- [ ] **7.3 深度截断与 dangling E2E**
  - 结果：Playwright 覆盖链式触发深度截断告警、删除组件后 dangling 警告与运行时跳过。
  - 验证：预览不死循环；问题面板展示 dangling；保存不受影响。
  - 依赖：7.1。

- [ ] **7.4 M1 回归与质量门执行**
  - 结果：前端 screen 定向测试、后端 screen 定向测试、共享包测试、全部 screen E2E、typecheck、lint、Biome 全部执行并通过；阶段 0-2 基线不回退。
  - 验证：记录每条命令的日期、退出码、文件数、用例数、通过/失败/跳过数量。
  - 依赖：7.2、7.3。

## 8. 模拟调试（M2）

- [ ] **8.1 沙盒运行时与模拟触发**
  - 结果：全屏弹层内对选中 trigger 节点执行模拟触发，沙盒运行时独立于预览/画布状态。
  - 验证：Hook 测试覆盖沙盒执行、真实项目数据与可见性覆盖表不被污染。
  - 依赖：7.4。

- [ ] **8.2 链路高亮动画**
  - 结果：执行路径边流动高亮、节点依次亮起；动画结束自动复位。
  - 验证：组件测试覆盖高亮状态机；E2E 截图或等价证据记录一次完整链路。
  - 依赖：8.1。

- [ ] **8.3 执行日志面板**
  - 结果：按序展示动作执行/跳过结果、跳过原因与耗时；失败动作红色标记并点击定位节点。
  - 验证：组件测试覆盖日志顺序、失败标记、点击定位。
  - 依赖：8.1。

## 9. 双向联动与模板（M2）

- [ ] **9.1 蓝图 → 画布高亮联动**
  - 结果：点击蓝图节点时主画布闪烁高亮对应组件。
  - 验证：组件测试或 E2E 覆盖高亮触发与消失。
  - 依赖：7.4。

- [ ] **9.2 画布 → 蓝图过滤联动**
  - 结果：画布选中组件时蓝图过滤展示涉及该组件的节点与链路；组件重命名时节点标签实时跟随。
  - 验证：组件测试覆盖过滤逻辑纯函数与标签跟随。
  - 依赖：9.1。

- [ ] **9.3 模板库与空态引导**
  - 结果：空蓝图提供一键模板（点击跳转/显隐切换/页面加载刷新）；插入经 Schema 校验并作为一条历史入栈。
  - 验证：组件测试覆盖模板插入结果、历史单条、校验失败不入栈。
  - 依赖：7.4。

- [ ] **9.4 小地图与对齐分布工具**
  - 结果：全屏弹层内小地图与多选对齐分布工具条可用。
  - 验证：组件测试覆盖对齐分布计算纯函数；小地图视口同步。
  - 依赖：7.4。

## 10. 高级触发与动作（M3）

- [ ] **10.1 condition 契约与编译**
  - 结果：condition 节点配置（字段来源 + 比较运算符 + 比较值）开放；编译器按 then/else 分支产出规则。
  - 验证：共享包测试覆盖表达式契约；编译器测试覆盖分支拓扑与环检测兼容。
  - 依赖：7.4。

- [ ] **10.2 条件表达式构建器 UI**
  - 结果：蓝/白配色 condition 节点与表达式构建表单；then/else 双输出引脚分色；不产生自定义脚本。
  - 验证：组件测试覆盖表达式编辑、分支连线；无脚本输入入口。
  - 依赖：10.1。

- [ ] **10.3 高级触发器**
  - 结果：`dataLoaded`/`dataError`/`componentHover`/`interval` 触发器开放；interval 仅预览会话内有效，卸载即清理。
  - 验证：引擎测试覆盖四类触发；假计时器测试覆盖 interval 触发与清理。
  - 依赖：10.1。

- [ ] **10.4 requestApi 动作与脱敏**
  - 结果：`requestApi` 动作沿用阶段 2 API 契约与取消协议；公开预览敏感请求头按共享规则脱敏，失败进入失败态不伪造。
  - 验证：测试覆盖请求执行、脱敏配置组装、失败态；后端脱敏回归不回退。
  - 依赖：10.3。

- [ ] **10.5 动作参数模板插值**
  - 结果：动作参数支持引用触发组件数据字段的表达式插值（只读求值，无脚本）。
  - 验证：纯函数测试覆盖插值求值、字段缺失降级、无代码执行路径。
  - 依赖：10.4。

## 11. 最终验收

- [ ] **11.1 大蓝图性能验证**
  - 结果：200+ 节点蓝图仅渲染可视区域，交互帧率不低于 50fps；节点 memo 与边重算 rAF 节流生效。
  - 验证：性能测试或等价测量证据记录。
  - 依赖：9.4。

- [ ] **11.2 M2/M3 端到端 E2E**
  - 结果：Playwright 覆盖模拟调试链路、双向联动、模板插入、condition 分支、高级触发器与 requestApi（route Mock）。
  - 验证：全部用例独立创建并清理数据；不依赖真实外网。
  - 依赖：10.5、8.3、9.3。

- [ ] **11.3 全量回归与质量门执行**
  - 结果：前端 screen 定向测试、后端 screen 定向测试、共享包测试、全部 screen E2E、typecheck、lint、Biome 全部执行并通过；阶段 0-2 基线不回退。
  - 验证：记录每条命令的日期、退出码、文件数、用例数、通过/失败/跳过数量；不得只运行新增用例代替全量回归。
  - 依赖：11.1、11.2。

- [ ] **11.4 完成 checklist 与总规划回写**
  - 结果：逐项依据代码和测试证据勾选 checklist；在总规划中仅标注事件蓝图能力完成，不替代阶段 3 及以后规划。
  - 验证：退出条件（可视化搭建链路、预览执行、模拟调试、诊断闭环）有明确证据；不得用模块存在或旧测试数字替代当前证据。
  - 依赖：11.3。
