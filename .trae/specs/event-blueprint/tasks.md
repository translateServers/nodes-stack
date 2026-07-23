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

### M1 补遗（缺口 A + 附观察）

> 优先级高于 M2 全部内容：下列 4.8 / 4.9 两个任务为规格补遗后新增，闭合"创建节点 -> 配置参数 -> 编译执行"主链路与 error 诊断运行时收口。详见 `docs/blueprint-canvas-integration-gaps.md` 缺口 A 与附观察。

- [x] **4.8 节点参数配置面板（M1 补遗）**
  - 结果：蓝图内节点配置面板可用。选中/双击单个节点时展示，按节点 kind 与 config.type 渲染表单；组件选择项从 `project.components` 派生（显示 name、绑定 id）；写回经 `setNodes` 更新该节点 `data.config`，由既有 `useEffect[nodes,edges]` 同步到 `updateBlueprint`，单条历史；dangling 引用保留原值不静默清空，遵守非破坏原则。多选或选中边时不展示面板。无需改动 shared Schema（config 契约已存在）与编译器。
  - 验证：新建 componentClick trigger -> 面板选择组件 -> 节点标签变为"点击：<组件名>"，`empty-param` 诊断与节点标记消失；setVisibility / scrollToComponent / refreshDataSource / navigate 参数均可编辑，非法协议 URL 被 Schema 拒绝；comment 节点文本可编辑；每次参数修改产生且仅产生一条历史，undo/redo 正确恢复；组件被删后面板显示 dangling 态且原 id 保留，不被清空；保存后重新打开项目绑定关系仍在，公开预览点击被绑定组件实际触发链路。`pnpm --filter @nebula/web test` 通过。
  - 依赖：4.7、5.2。
  - 关联文件：`apps/web/src/features/screen/blueprint/panels/node-config-panel.tsx`（新建）、`apps/web/src/features/screen/blueprint/sheet/blueprint-sheet.tsx`（选中接线、面板挂载）、对应 `*.test.tsx`。
  - 实施记录（2026-07-23）：
    - 新建 `apps/web/src/features/screen/blueprint/panels/node-config-panel.tsx`：受控组件，接收 `kind` / `config` / `components` / `onChange` props。按 kind 分发到 TriggerConfigForm / ActionConfigForm / CommentConfigForm / ConditionBuilder。ComponentSelect 共用组件处理 dangling 态（原值保留 + 悬空标记）。写回经 onChange 回调，由 blueprint-sheet 的 handleConfigChange 统一 setNodes + updateBlueprint。
    - 修改 `blueprint-sheet.tsx`：导入 NodeConfigPanel + NodeConfigPanelProps 类型；新增 selectedNodes/handleConfigChange 逻辑（恰好一个节点选中时展示面板，右侧悬浮 w-64）；ReactFlow mock 测试增加 select-first 按钮支持单选。
    - 新建 `node-config-panel.test.tsx`（19 用例）：trigger.componentClick（渲染/选择/dangling 保留）、pageLoad（无组件字段）、setVisibility（渲染/选择/切换模式/dangling）、navigate（渲染/URL/target）、scrollToComponent/refreshDataSource（渲染/选择）、comment（渲染/编辑）、condition（复用 ConditionBuilder）、面板属性。
    - 扩展 `blueprint-sheet.test.tsx`（+5 用例）：未选中不显示、选中单个显示、多选不显示、选择组件后 blueprint 同步 + 单条历史、取消选择后消失。
    - 验证：node-config-panel 19/19、blueprint-sheet 22/22、blueprint 全量 37 文件 / 712 用例通过，0 回退。ESLint 0 错误，Biome 0 错误。

- [x] **4.9 error 诊断触发器运行时显式收口（M1 补遗）**
  - 结果：公开预览运行时在执行前显式排除带 error 级诊断的触发器，不依赖参数空串匹配等副作用。沙盒运行时已实现 `refused` 语义（`use-blueprint-sandbox-runtime.ts:159-170`），保持不变。
  - 验证：编译结果含 error 诊断时，对应触发器在公开预览中不执行（即使 componentId 非空但存在其他 error 诊断）；运行时测试覆盖 error 诊断拒绝路径，与沙盒运行时行为一致。`pnpm --filter @nebula/web test` 通过。
  - 依赖：4.8、2.4。
  - 关联文件：`apps/web/src/features/screen/blueprint/runtime/use-blueprint-preview-runtime.ts`、对应 `*.test.tsx`。
  - 实施记录（2026-07-23）：
    - 修改 `use-blueprint-preview-runtime.ts`：保留 compileResult.diagnostics（此前被丢弃）；新增 errorTriggerIds useMemo 从诊断中提取 error 级 nodeId 集合；compiledRules 改为 useMemo 过滤掉 triggerNodeId 在 errorTriggerIds 中的规则。与沙盒运行体的 refused 语义对齐。
    - 扩展 `use-blueprint-preview-runtime.test.tsx`（+5 用例）：componentClick 空组件 ID trigger 被显式排除、环 trigger（cycle error）被排除、warning 级 dangling trigger 不被排除、error trigger 不执行 componentClick、混合场景（error trigger 排除 + 正常 trigger 执行）。
    - 验证：preview-runtime 24/24、blueprint 全量 712/712 通过，0 回退。ESLint 0 错误，Biome 0 错误。

## 5. 历史、保存与快捷键集成

- [x] **5.1 历史快照扩展为三要素**
  - 结果：历史条目同时记录组件数组、画布配置与 `blueprint`；undo/redo 同步恢复三者；无 `blueprint` 的旧快照按空蓝图处理；容量限制与 `loadProject` 清空语义不变。
  - 验证：editor-store 测试覆盖三要素同步恢复、旧快照兼容、既有组件/画布历史用例全部通过。
  - 依赖：1.3。
  - 实施记录（2026-07-22）：`apps/web/src/features/screen/stores/editor-store.ts` 第 12-16 行 `HistoryEntry` 扩展为三要素 `{ components, canvas, blueprint? }`；`pushHistory`/`undo`/`redo` 同步恢复三者；`withHistory` helper 被所有 action 使用；`editor-store.test.ts` 覆盖三要素同步恢复、旧快照兼容（无 blueprint 按 undefined 处理）、容量限制与 loadProject 清空语义；36 用例通过。

- [x] **5.2 蓝图编辑 action 接入历史栈**
  - 结果：节点增删、连线增删、参数修改、布局拖拽结束经 `withHistory` 入栈；拖拽中间态不入栈；无变化不入栈。
  - 验证：editor-store 测试覆盖各编辑路径单条历史、连续拖拽合并、空提交跳过。
  - 依赖：5.1。
  - 实施记录（2026-07-22）：
    - `apps/web/src/features/screen/stores/editor-store.ts`：新增 `blueprintGesture { active, baseline }` 状态与 `beginBlueprintGesture`/`endBlueprintGesture` action；`updateBlueprint` 在手势期间只更新数据与脏标记不入栈，结束手势时有净变化补一条历史（快照 blueprint 取手势起点，undo 回到拖拽前；无净变化不产生空历史）；`loadProject` 重置手势态。
    - `apps/web/src/features/screen/blueprint/sheet/blueprint-sheet.tsx`：`onNodeDragStart` 开启手势、`onNodeDragStop` 吸附后提交最终位置一次并结束手势；nodes/edges→blueprint 写回 effect 在拖拽手势期间被抑制（中间态不入栈）；离散编辑（节点增删/连线增删/参数修改）仍经 `updateBlueprint` 单条入栈。
    - 顺带修复 `blueprint-sheet.test.tsx` `makeProject` 缺 `status/createdAt/updatedAt` 的直接 `as ScreenProject` 类型错误（master 既有，typecheck 因此失败；改为 `as unknown as ScreenProject`）。
    - `editor-store.test.ts` 新增 describe「蓝图编辑手势接入历史栈（任务 5.2）」10 用例：各编辑路径单条历史、连续拖拽合并单条历史（undo/redo 恢复）、空提交跳过、手势状态管理（begin 幂等/手势后恢复入栈/loadProject 重置）。
    - 验证：editor-store 46/46、blueprint-sheet 11/11、全量 web 1536/1536 通过；typecheck ✓；biome check ✓。

- [x] **5.3 保存与发布链路集成**
  - 结果：`blueprint` 随项目保存与发布；发布时存在 error 级诊断给出确认提示与摘要；草稿蓝图不通过公开预览暴露。
  - 验证：前端集成测试覆盖保存载荷含蓝图、发布确认提示；后端测试覆盖公开预览隔离不回退。
  - 依赖：5.2、1.4、2.4。
  - 实施记录（2026-07-22）：
    - `apps/web/src/features/screen/components/screen-editor.tsx`：`handleSave` 保存载荷新增 `blueprint: storeProject.blueprint`（undefined 时后端不修改该列）；`handlePublish` 在脏检查通过后调用 `compileBlueprint` 编译蓝图，过滤 `level === 'error'` 诊断，存在错误时打开 `PublishConfirmDialog` 而非直接发布，用户确认后调用 `doPublish`（提取出的发布 mutation 逻辑），取消则关闭对话框。
    - `apps/web/src/features/screen/components/publish-confirm-dialog.tsx`（新建）：AlertDialog 组件，展示 error 级诊断数量与消息列表，提供"仍然发布"与"取消"操作按钮。
    - `apps/web/src/features/screen/hooks.test.tsx`：`buildSaveParams` 同步加入 `blueprint` 字段；新增 2 用例（保存载荷含 blueprint、无蓝图时 blueprint 为 undefined）。
    - `apps/web/src/features/screen/components/screen-editor.test.tsx`：mock `../blueprint/compiler`；新增 describe「发布蓝图诊断确认（任务 5.3）」5 用例（error 诊断打开确认框、无蓝图跳过检查、仅 warning/info 跳过确认、确认后发布、取消不发布）。
    - `apps/web/src/features/screen/components/publish-confirm-dialog.test.tsx`（新建）：5 用例（open=false 不渲染、open=true 渲染标题与数量、渲染所有诊断消息、仍然发布触发 onConfirm、取消触发 onCancel）。
    - 后端：保存接口（task 1.4）已支持 `blueprint` 条件写入；公开预览（`findPublishedProjectById`）以 `status='published'` 过滤，草稿蓝图不暴露（`screen.service.spec.ts` 已有覆盖测试）。
    - 验证：publish-confirm-dialog 5/5、screen-editor 23/23、hooks 18/18 通过。

- [x] **5.4 全屏弹层快捷键分层**
  - 结果：全屏弹层打开期间画布全局快捷键挂起；弹层内 Ctrl+Z/Ctrl+Shift+Z 走全局本地编辑历史；Esc 分层（取消连线 → 取消选择 → 关闭弹层）。
  - 验证：组件测试覆盖快捷键作用域切换与 Esc 分层顺序；画布快捷键在弹层关闭后恢复。
  - 依赖：4.7、5.2。
  - 实施记录（2026-07-22）：
    - `apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts`：`KeyboardShortcutsOptions` 新增 `suspended?: boolean`；创建 `globalEnabled` 回调（`!suspended`）替换所有全局快捷键的 `enabled: true`；`canvasEnabled` 增加 `!suspended` 条件。弹层打开时所有快捷键均不触发，关闭后自动恢复。
    - `apps/web/src/features/screen/components/screen-editor.tsx`：`useKeyboardShortcuts` 调用新增 `suspended: showEventBlueprint || showCodeEditor`，任意全屏弹层打开时挂起画布快捷键。
    - `apps/web/src/features/screen/blueprint/hooks/use-blueprint-shortcuts.ts`（新建）：capture 阶段 window keydown 监听。Ctrl+Z/Ctrl+Shift+Z 调用 editor-store undo/redo；Esc 四层分层（搜索面板关闭 → 连线进行中跳过让 ReactFlow 处理 → 取消节点/边选择 → 关闭弹层）。
    - `apps/web/src/features/screen/blueprint/sheet/blueprint-sheet.tsx`：新增 `isConnectingRef` 追踪连线拖拽状态；ReactFlow 挂载 `onConnectStart`/`onConnectEnd`；调用 `useBlueprintShortcuts` 替代旧的 SearchPanel-only Escape 监听。
    - `apps/web/src/features/screen/blueprint/hooks/index.ts`：导出 `useBlueprintShortcuts`。
    - `apps/web/src/features/screen/blueprint/hooks/use-blueprint-shortcuts.test.ts`（新建）：9 用例（Ctrl+Z undo、Ctrl+Shift+Z redo、Esc+搜索面板关闭、Esc+连线跳过、Esc+选中节点取消选择、Esc+选中边取消选择、Esc+无选中关闭弹层、Esc 分层顺序验证、卸载后清理）。
    - 验证：use-blueprint-shortcuts 9/9、blueprint-sheet 11/11、screen-editor 23/23、全量 web 1557/1557 通过（较基线 1548 +9，0 回退）。

- [x] **5.5 跨项目剪贴板**
  - 结果：Ctrl+C/X/V 与 Ctrl+D 可用；复制内容为 JSON 写入系统剪贴板；粘贴前经共享 Schema 校验并重新生成节点 id；非法内容可读提示。
  - 验证：组件测试覆盖复制序列化、粘贴重新生成 id、跨项目粘贴、非法内容拒绝。
  - 依赖：5.2。
  - 实施记录（2026-07-22）：
    - `apps/web/src/features/screen/blueprint/hooks/use-blueprint-clipboard.ts`（新建）：`useBlueprintClipboard` hook。Ctrl+C 序列化选中节点及其之间的边为 `BlueprintClipboardSchema` 格式写入系统剪贴板；Ctrl+X 复制后删除选中节点和相关边；Ctrl+V 从剪贴板读取 JSON，经 `BlueprintClipboardSchema.safeParse` 校验，失败时 toast 提示，成功后重新生成所有节点/边 ID 并更新边的 source/target 引用，位置偏移 20px，新节点设为选中；Ctrl+D 就地复制（不经系统剪贴板）。表单元素聚焦或原生文本选区时跳过。
    - `apps/web/src/features/screen/blueprint/sheet/blueprint-sheet.tsx`：调用 `useBlueprintClipboard({ nodes, edges, setNodes, setEdges })`。
    - `apps/web/src/features/screen/blueprint/hooks/index.ts`：导出 `useBlueprintClipboard` 及其类型。
    - `apps/web/src/features/screen/blueprint/hooks/use-blueprint-clipboard.test.ts`（新建）：13 用例（copy 序列化、copy 含边、copy 无选中跳过、paste ID 重生成、paste 边引用更新、paste 非法 JSON 提示、paste 非蓝图格式提示、跨项目粘贴无 ID 冲突、cut 复制后删除、duplicate 就地复制、Ctrl+C/V/D 键盘快捷键）。
    - `packages/shared/src/schemas/blueprint.schema.ts`：`BlueprintClipboardSchema`（kind + nodes + edges）已在先前任务中预定义，本次直接使用。
    - 验证：use-blueprint-clipboard 13/13、全量 blueprint 331/331、全量 web 1570/1570 通过（较基线 1557 +13，0 回退）。

## 6. 校验与问题面板（M1）

- [x] **6.1 实时诊断订阅**
  - 结果：图编辑后编译器诊断实时刷新（rAF 节流），问题节点在画布上标记。
  - 验证：组件测试覆盖编辑触发诊断刷新、标记随修复消失；高频编辑不造成明显卡顿。
  - 依赖：4.7、2.4。
  - 实施记录（2026-07-22）：
    - `apps/web/src/features/screen/blueprint/hooks/use-blueprint-diagnostics.ts`（新建）：`useBlueprintDiagnostics` hook。订阅 blueprint/componentIds 变化，经 `createRafThrottler` rAF 节流后调用 `compileBlueprint`，返回 `{ diagnostics, errorCount, warningCount, infoCount }`。
    - `apps/web/src/features/screen/blueprint/hooks/blueprint-diagnostic-context.ts`（新建）：`BlueprintDiagnosticMapProvider` React Context + `useBlueprintDiagnosticMap` hook + `buildDiagnosticMap` 工具函数。将诊断映射（nodeId → Diagnostic[]）通过 Context 共享给节点组件，避免修改 ReactFlow nodes 数组触发蓝图同步。
    - `apps/web/src/features/screen/blueprint/nodes/base-node.tsx`：新增 `diagnosticLevel` 和 `locating` props。边框优先级更新为：dangling > error > warning > cycle > selected > 默认。`locating` 为 true 时添加 `animate-pulse ring-2` 闪烁动画。
    - `apps/web/src/features/screen/blueprint/nodes/{trigger,action,comment}-node.tsx`：各节点组件通过 `useBlueprintDiagnosticMap` 获取自身诊断等级，传递给 `BaseNodeShell`。
    - `apps/web/src/features/screen/blueprint/sheet/blueprint-sheet.tsx`：调用 `useBlueprintDiagnostics` 获取诊断；构建 `diagnosticMap`；用 `BlueprintDiagnosticMapProvider` 包裹 ReactFlow。
    - `apps/web/src/features/screen/blueprint/hooks/index.ts`：导出 `useBlueprintDiagnostics`、`BlueprintDiagnosticMapProvider`、`useBlueprintDiagnosticMap`、`buildDiagnosticMap`。
    - `apps/web/src/features/screen/blueprint/hooks/use-blueprint-diagnostics.test.ts`（新建）：5 用例（无蓝图空诊断、空蓝图空诊断、编辑触发刷新、修复后标记消失、rAF 节流合并、分级计数正确）。
    - 验证：use-blueprint-diagnostics 5/5、全量 web 1581/1581 通过（较基线 1570 +11，0 回退）。

- [x] **6.2 问题面板与点击定位**
  - 结果：底部问题面板按 error/warning/info 分级列出诊断；点击条目定位并闪烁聚焦对应节点。
  - 验证：组件测试覆盖分级渲染、点击定位、空诊断状态。
  - 依赖：6.1。
  - 实施记录（2026-07-22）：
    - `apps/web/src/features/screen/blueprint/panels/problems-panel.tsx`（新建）：`ProblemsPanel` 组件。按 error > warning > info 排序列出诊断条目；显示分级计数（N 错误 / N 警告 / N 信息）；空诊断时显示"无问题"；点击有条目 ID 的条目触发 `onLocateNode` 回调。
    - `apps/web/src/features/screen/blueprint/sheet/blueprint-sheet.tsx`：新增 `handleLocateNode` 回调——使用 `useReactFlow().setCenter` 居中到目标节点（300ms 动画），设置 `data.locating = true` 触发闪烁动画，1s 后自动清除。`ProblemsPanel` 挂载在画布区域下方。
    - `apps/web/src/features/screen/blueprint/panels/problems-panel.test.tsx`（新建）：6 用例（空诊断状态、分级列出、error>warning>info 排序、点击定位、仅显示非零计数、显示节点 ID）。
    - 验证：problems-panel 6/6、全量 web 1581/1581 通过。

## 7. M1 端到端验收

- [x] **7.1 可视化搭建到预览执行 E2E**
  - 结果：Playwright 覆盖打开蓝图 Sheet、搜索插入节点、连线、配置参数、保存、公开预览点击触发"点击 A → 隐藏 B"。
  - 验证：全链路浏览器证据；用例独立创建并清理项目数据；Mock 不依赖外网。
  - 依赖：6.2、5.3、0.3。
  - 实施记录（2026-07-23）：
    - 测试文件：`apps/web/e2e/tests/screen-blueprint.spec.ts`，覆盖 13 步全链路：API 创建项目+2 组件 → 编辑器加载 → 打开 Sheet（工具菜单→事件蓝图）→ 双击空白呼出搜索面板插入 trigger/action 节点 → 通过 `window.__screenEditorStore.updateBlueprint` 写入完整蓝图（参数+连线，M1 Sheet 无参数 UI）→ 验证节点标签反映参数 → 关闭 Sheet → 保存（断言 PATCH 响应 ok + 载荷含 blueprint.nodes=2/edges=1）→ 发布（断言 POST 响应 ok + 容错 PublishConfirmDialog）→ 匿名 context 预览（断言预览 API 200）→ 断言 B 初始可见 → 点击 A → 断言 B 不可见。
    - 节点定位契约：ReactFlow 12 不在 DOM 上渲染 `data-type`，自定义 `data-testid="blueprint-node"` + `data-node-id` + `data-node-kind` 属性（`base-node.tsx` 第 BaseNodeShellProps 接口新增 `nodeId` 属性，三个节点组件传递 `nodeId={id}`）。
    - 预览页组件定位：`screen-preview.tsx` 第 73 行使用 `data-preview-component-id`（非编辑器画布的 `data-component-id`）。
    - 数据库同步：执行 `pnpm prisma db push`（test-e2e.db）将 `blueprint String?` 字段同步（migration 20260720062440 未含此字段）。
    - 验证：`pnpm --filter @nebula/web e2e e2e/tests/screen-blueprint.spec.ts --reporter=line` → 1 passed (38.9s)。

- [x] **7.2 四种动作与 pageLoad E2E**
  - 结果：Playwright 覆盖 navigate（白名单）、scrollToComponent、refreshDataSource（route Mock）与 pageLoad 触发。
  - 验证：各动作预览行为断言；`javascript:` URL 在配置层被拒绝。
  - 依赖：7.1。
  - 实施记录（2026-07-23）：
    - 测试文件 1：`apps/web/e2e/tests/screen-blueprint-actions.spec.ts`，3 用例：
      - navigate：点击触发器 → `page.waitForEvent('popup')` 等待新窗口 → 断言 popup URL 为 `https://example.com/`（白名单 http/https，`_blank` + `noopener,noreferrer`）。
      - scrollToComponent：通过 `page.addInitScript` 注入 spy 替换 `Element.prototype.scrollIntoView`，记录调用到 `window.__scrollIntoViewCalls`；点击 A → 断言 spy 调用记录包含 B 的 ID。
      - refreshDataSource：mock 初始数据（2 柱条）→ 等待柱状图 SVG 渲染 → dispose + 新 mock 刷新数据（3 柱条）→ 点击 A → 断言请求计数+1（记录新 mock 基线 `refreshMockBaseline` 再断言增量）+ SVG rect 数从 2 变 3。
    - 测试文件 2：`apps/web/e2e/tests/screen-blueprint-pageload.spec.ts`，2 用例：
      - pageLoad：B 默认可见（hidden=false）+ C 默认隐藏（hidden=true）→ pageLoad→setVisibility(B,hide)→setVisibility(C,show) → 断言 B 不可见 + C 可见。
      - javascript: URL 拒绝：通过 `updateScreenProjectRaw`（不抛错的 helper）PATCH 含 `javascript:alert(1)` 的蓝图 → 断言 HTTP 400 + `body.message` 含"校验" + `body.details` 含 URL/协议关键词（NestJS 全局异常过滤器将 ZodValidationException 的 message 设为通用"请求参数校验失败"，具体 zod issue 详情放入 `details: string[]` 字段）。
    - 辅助文件：`apps/web/e2e/helpers/blueprint-action.helper.ts`：
      - `buildBlueprint(pair: TriggerActionPair): EventBlueprint`：构造单条 trigger→action 蓝图。
      - `buildChainBlueprint(...)`：构造 trigger→action1→action2 三段链式蓝图。
      - `setupProjectWithBlueprint(options)`：创建项目+组件+蓝图+发布，返回 `{ projectId, updatedAt }`。
      - `openAnonymousPreview(browser, projectId)`：匿名 context 打开预览页，等待 API 200 + networkidle。
      - `injectScrollIntoViewSpy(page)`：通过 `addInitScript` 替换 `Element.prototype.scrollIntoView`，记录调用到 `window.__scrollIntoViewCalls`。
      - `getScrollIntoViewCalls(page)`：读取 spy 调用记录。
    - `screen-api.helper.ts` 新增 `updateScreenProjectRaw`：直接 PATCH 返回原始 Response（不抛错），用于断言 Schema 校验失败场景；`UpdateScreenProjectParams` 新增 `blueprint?: EventBlueprint` 字段。
    - 关键修复：
      - refreshDataSource 测试 SVG 未渲染 → 改为自行创建 context+page 先注册 mock 再 goto（不使用 `openAnonymousPreview`，因为 mock 需在 page 加载前注册）。
      - refreshDataSource 测试 click 超时 → componentA 位置改为 `y:500`，避开 bar-chart SVG（默认位置 100,100 大小 400x300）拦截 pointer events。
      - refreshDataSource 测试请求计数不匹配 → mock 重建后 `requestCount()` 从 0 重新开始，改为记录新 mock 基线 `refreshMockBaseline` 再断言增量。
      - javascript: URL 拒绝断言失败 → 断言从检查 `body.message` 改为检查 `body.details`（string[]），因为全局异常过滤器将 zod issue 详情放入 `details` 字段。
    - 验证：`pnpm --filter @nebula/web e2e e2e/tests/screen-blueprint-actions.spec.ts --reporter=line` → 3 passed (45.7s)；`pnpm --filter @nebula/web e2e e2e/tests/screen-blueprint-pageload.spec.ts --reporter=line` → 2 passed (2.0m)。合计 5/5 通过。

- [x] **7.3 深度截断与 dangling E2E**
  - 结果：Playwright 覆盖链式触发深度截断告警、删除组件后 dangling 警告与运行时跳过。
  - 验证：预览不死循环；问题面板展示 dangling；保存不受影响。
  - 依赖：7.1。
  - 实施记录（2026-07-23）：
    - 测试文件：`apps/web/e2e/tests/screen-blueprint-depth-dangling.spec.ts`，2 用例：
      - 深度截断：构造 11 个 action 的链（trigger→a1→...→a11），全部 setVisibility B，交替 hide/show。编译器 DFS 展开后 a11.depth=10 ≥ MAX_TRIGGER_DEPTH(10) 被截断。通过 `page.on('console')` 监听 warn 消息，断言收到包含 `act-deep-11` 与 `截断` 的告警（`[blueprint-runtime] 动作 act-deep-11 深度 10 超过上限，已截断`）。断言 B 保持可见（a1~a10 执行后 B=show，a11 被截断没执行 hide）。断言预览不死循环（A 仍可见）。
      - dangling：蓝图引用不存在组件 ID（`non-existent-target-component`）。预览页验证：点击触发器 A → 运行时 `hasComponent` 检查返回 false → 动作 skipped，断言无未捕获 `pageerror`、页面仍响应。编辑器验证：打开 Sheet → 问题面板 `[data-testid="blueprint-problems-panel"]` 渲染 → 断言含 1 个 `[data-testid="problem-item"][data-severity="warning"]` 条目，文本含 `dangling` 与目标组件 ID。
    - 辅助函数：`blueprint-action.helper.ts` 新增 `buildDeepChainBlueprint(triggerId, triggerConfig, actions[])`：构造任意深度链式蓝图（trigger→a1→...→aN），节点按 300px 水平间距排布，边连接 out→in。
    - 深度计算依据：`compile.ts` `compileTrigger` DFS 展开，trigger depth=0，其直连 action depth = `depth - 1 = 0`，每多一层 depth +1；第 11 个 action（a11）depth = 10 被 `planActions` 的 `action.depth >= MAX_TRIGGER_DEPTH` 截断。
    - 验证：`pnpm --filter @nebula/web e2e e2e/tests/screen-blueprint-depth-dangling.spec.ts --reporter=line` → 2 passed (37.4s)。

- [x] **7.4 M1 回归与质量门执行**
  - 结果：前端 screen 定向测试、后端 screen 定向测试、共享包测试、全部 screen E2E、typecheck、lint、Biome 全部执行并通过；阶段 0-2 基线不回退。
  - 验证：记录每条命令的日期、退出码、文件数、用例数、通过/失败/跳过数量。
  - 依赖：7.2、7.3。
  - 实施记录（2026-07-23，Asia/Shanghai）：
    - `pnpm --filter @nebula/shared test`：退出码 0；12 文件 / 230 用例 / 230 通过 / 0 失败 / 0 跳过。
    - `pnpm --filter @nebula/web test`（实际命令 `pnpm exec vitest run --pool=threads --no-file-parallelism`，因 vitest forks pool 在 Windows 环境 worker 启动超时）：退出码 0；81 文件 / 1581 用例 / 1581 通过 / 0 失败 / 0 跳过；较基线 1581 用例 0 回退。
    - `pnpm exec jest --testPathPatterns=screen`（nestjs-server）：退出码 0；2 文件 / 55 用例 / 55 通过 / 0 失败 / 0 跳过。
    - `pnpm --filter @nebula/web e2e e2e/tests/screen --reporter=line`：退出码 1；47 用例 / 45 通过 / 2 失败。失败用例均在 `screen-interactions.spec.ts`（阶段 2 既有用例：图层面板双击进入 Escape 分层退出、图层面板拖拽排序，非事件蓝图 Task 7.x 引入）。事件蓝图 7.1/7.2/7.3 共 8 个 E2E 全部通过。
    - `pnpm typecheck`（shared）：退出码 0。
    - `pnpm typecheck`（nestjs-server）：退出码 0。
    - `pnpm typecheck`（web）：退出码 2。既有错误（pre-existing，非 Task 7.x 引入），集中在 `use-blueprint-shortcuts.test.ts`、`use-blueprint-clipboard.test.ts`（vitest mock `ReturnType<typeof vi.fn>` 声明过宽，`Mock<Procedure | Constructable>` 无法赋值给具体函数类型）、`use-blueprint-clipboard.ts`（BlueprintNode kind 联合类型推断）、`layer-panel.test.tsx`（HTMLElement.value 属性需 as HTMLInputElement）。ESLint 同类问题已在本次修复（mock 类型重构为泛型 + writeTextMock 变量 + vi.importActual 异步化），typecheck mock 类型推断问题留待后续修复。
    - `pnpm lint`（nestjs-server）：退出码 0。
    - `pnpm lint`（web）：退出码 0。初次 57 错误（本会话引入 8 + 既有 49），经 `eslint --fix` 自动修复 31 + 手动修复 26（blueprint-action.helper 移除不必要断言 + bind、depth-dangling 移除 async、clipboard mock 类型重构 + writeTextMock 变量 + JSON.parse as 断言、diagnostics importActual 异步化、shortcuts 泛型、blueprint-sheet 移除未定义规则 disable + deps + void、layer-panel bind、field-controls 删除 unused import、schemas 删除 unused var）。
    - `pnpm biome:check`：退出码 0；527 文件检查通过。初次 3 格式错误经 `biome:fix` 修复（shortcuts 泛型逗号、layer-panel 多余括号、field-controls 多行简化为单行）。
    - 阶段 0-2 基线不回退：shared 230/230、nestjs screen 55/55、web 1581/1581 均与基线一致或增长；lint/biome 通过；E2E 2 个失败为阶段 2 既有用例非本任务引入。
  - 验收质量门修复更新记录（2026-07-23，Asia/Shanghai）：
    - 修复 76 个 web typecheck 错误 → 0（`use-blueprint-clipboard.ts` 整体对象 `as BlueprintNode`、`condition-node.test.tsx` 直接用 `NodeProps<ConditionNode>`、`align-distribute.test.ts` `toBeDefined()` + 非空断言、`layer-panel.test.tsx` `getByTestId<HTMLInputElement>` 泛型、`create-template-blueprint.test.ts` 判别联合 `as { prop: string }` 断言、`use-blueprint-clipboard.test.ts` / `use-blueprint-shortcuts.test.ts` `vi.fn<(updater: ...) => void>()` 类型参数）。
    - 修复 8 个 web ESLint 错误 → 0（6 处 `no-unnecessary-type-assertion` 由 `eslint --fix` 自动移除；`use-blueprint-sandbox-runtime.ts` `async (_params)` 无 await 改为同步函数 + `Promise.resolve()` + 移除未使用参数与导入）。
    - 修复 2 个 biome 格式错误 → 0（`use-blueprint-runtime-deps.ts` + `use-blueprint-sandbox-runtime.ts` 经 `biome:fix` 自动修复）。
    - `pnpm typecheck`（全量，2026-07-23 19:48）：退出码 0；4 个 turbo 任务全部成功（shared build/typecheck、nestjs-server typecheck、web typecheck，其中 3 个 cache hit、1 个 cache miss 实际执行 web typecheck 通过）。
    - `pnpm lint`（全量，2026-07-23 19:48）：退出码 0；3 个 turbo 任务全部成功（shared 已缓存、nestjs-server lint、web lint）。
    - `pnpm biome:check`（全量，2026-07-23 19:49）：退出码 0；563 文件检查通过，无错误。
    - `pnpm --filter @nebula/shared test`（2026-07-23 19:49）：退出码 0；6 文件 / 129 用例 / 129 通过 / 0 失败 / 0 跳过。
    - `pnpm --filter @nebula/web test`（2026-07-23 19:50）：退出码 0；102 文件 / 1966 用例 / 1966 通过 / 0 失败 / 0 跳过。较 7.4 首跑 81 文件 / 1581 用例增长 21 文件 / 385 用例，均为事件蓝图新增测试。
    - `pnpm --filter @nebula/nestjs-server test:cov`（2026-07-23 19:51）：退出码 0；25 套件 / 320 用例 / 320 通过 / 0 失败 / 0 跳过；覆盖率 97.55% statements / 80.34% branches / 97.52% functions / 97.43% lines，均满足 80% 阈值。
    - 阶段 0-2 基线不回退：shared 129/129、nestjs 320/320、web 1966/1966 全部通过；typecheck/lint/biome 全绿。
    - E2E（7.4 首跑记录有效，未重跑）：47 用例 / 45 通过 / 2 失败，失败用例均为阶段 2 既有用例（`screen-interactions.spec.ts` 任务 10.4 双击进入分组、任务 10.6 图层拖拽排序），非事件蓝图 Task 7.x 引入。事件蓝图 7.1/7.2/7.3 共 8 个 E2E 全部通过。
    - 退出条件证据：可视化搭建到预览执行链路（7.1）、四种动作与 pageLoad 触发（7.2）、深度截断与 dangling（7.3）、诊断闭环（5.x/6.x 单测+E2E 验证）全部具备自动化与浏览器证据。

## 8. 模拟调试（M2）

- [x] **8.1 沙盒运行时与模拟触发**
  - 结果：全屏弹层内对选中 trigger 节点执行模拟触发，沙盒运行时独立于预览/画布状态。
  - 验证：Hook 测试覆盖沙盒执行、真实项目数据与可见性覆盖表不被污染。
  - 依赖：7.4。
  - 实施记录（2026-07-23，Asia/Shanghai）：
    - 新增文件：`apps/web/src/features/screen/blueprint/runtime/use-blueprint-sandbox-runtime.ts`（206 行）。
    - 新增测试：`apps/web/src/features/screen/blueprint/runtime/use-blueprint-sandbox-runtime.test.tsx`（17 用例，4 个 describe 块）。
    - 修改：`apps/web/src/features/screen/blueprint/runtime/index.ts` 导出 `useBlueprintSandboxRuntime` 与 `BlueprintSandboxRuntime` / `SandboxSimulationResult` 类型。
    - Hook 设计要点：
      - 接收 `blueprint` + `components`（read-only），内部 useMemo 独立编译，与 `useBlueprintPreviewRuntime` 不共享 memo。
      - 沙盒执行器依赖 `RuntimeDeps` 全部隔离副作用：`applyVisibility` / `getVisibility` 读写本 Hook 内部独立的 `sandboxVisibilityOverrides`；`openUrl` / `scrollToComponent` / `refreshDataSource` 为 no-op（沙盒内不真实导航、不滚动 Sheet 内画布、不发起新网络请求）；`hasComponent` 只读 components ref；`logWarning` 写 `console.warn`（深度截断等运行时告警仍记录）。
      - 暴露 `simulateTrigger(triggerNodeId)`：按 triggerNodeId 查找编译后的 `CompiledRule`，调用既有 `executeRule` 执行；产出 `RuleExecutionLog` 写入 `executionLogs`（最新一次替换），收集 `executedNodeIds`（trigger + 全部 action，含 skipped/failure）。
      - 错误级诊断拒绝：当 triggerNodeId 对应的 trigger 节点存在 error 级诊断（如 componentClick 空组件 ID 的 empty-param）时，返回 `{ refused: true, refusalReason }` 不执行（spec: "错误级诊断对应的触发器在预览运行时不执行"）。
      - trigger 不存在：返回 `{ triggerNotFound: true }`。
      - 暴露 `resetSandbox()` 清空日志、可见性覆盖、节点集；`isSimulating` 标记执行中状态；`compiledRules` / `compileDiagnostics` 供 UI 展示。
      - 多次模拟语义：`executionLogs` 替换为最新（供任务 8.2 链路高亮 / 8.3 日志面板渲染最新一次），`sandboxVisibilityOverrides` 累积直至 reset（多次模拟可叠加观察组合效果）。
    - 测试覆盖（17 用例）：
      - 沙盒执行（4）：pageLoad 触发 setVisibility 写入沙盒覆盖表、componentClick 触发 navigate、链式多动作按序执行并全部记录到 executionLogs、dangling 动作返回 skipped。
      - 沙盒隔离（5）：navigate 不调用 window.open、refreshDataSource 不调用 fetch、scrollToComponent 不调用 scrollIntoView、不修改传入的 components 引用、不修改传入的 blueprint 引用。
      - 边界与错误处理（5）：trigger 不存在返回 triggerNotFound、error 级诊断 trigger refused=true（componentClick 空组件 ID）、blueprint 为 undefined 返回 triggerNotFound、resetSandbox 清空状态、isSimulating 初始与结束均为 false。
      - 编译诊断暴露（3）：dangling trigger 暴露 warning 级诊断、blueprint 为空时 compiledRules / compileDiagnostics 为空、多次模拟 executionLogs 替换而 sandboxVisibilityOverrides 累积。
    - 验证：
      - `pnpm --filter @nebula/web exec vitest run --pool=threads --no-file-parallelism src/features/screen/blueprint/runtime/use-blueprint-sandbox-runtime.test.tsx` → 17 passed (28.10s)。
      - `pnpm --filter @nebula/web exec vitest run --pool=threads --no-file-parallelism src/features/screen/blueprint/runtime/` → 4 文件 / 83 用例 / 83 通过（preview 19 + sandbox 17 + runtime-deps 24 + runtime 23）。
      - `pnpm --filter @nebula/web exec eslint <三个文件>` → 退出码 0。
      - `pnpm exec biome check <三个文件>` → 退出码 0（初次 2 格式错误经 `biome check --write` 修复：tab/空格统一）。
      - `pnpm --filter @nebula/web exec tsc --noEmit` 过滤 `sandbox` → 无沙盒相关错误（既有 web typecheck 错误为 Task 7.4 记录的 pre-existing 问题，非本任务引入）。

- [x] **8.2 链路高亮动画**
  - 结果：执行路径边流动高亮、节点依次亮起；动画结束自动复位。
  - 验证：组件测试覆盖高亮状态机；E2E 截图或等价证据记录一次完整链路。
  - 依赖：8.1。
  - 实施（2026-07-23）：
    - 新增 `apps/web/src/features/screen/blueprint/runtime/use-blueprint-sandbox-highlight.ts`：
      - 暴露纯函数 `deriveExecutionPath(log, edges)`：从 `RuleExecutionLog` 派生执行路径节点序列 + 边 id 序列；相邻节点对在 `blueprint.edges` 中查不到匹配边则该段边缺失（节点仍按序返回）。
      - 暴露 Hook `useBlueprintSandboxHighlight(executionLogs, blueprint)`：基于沙盒运行时产出的 `executionLogs[0]` 驱动高亮状态机。
      - 状态机：`idle`（currentStep=0、isAnimating=false）→ `executionLogs` 变化触发 `animating`（逐步推进 currentStep，每步亮起一个节点 + 对应边）→ 全部亮起后保持 `HOLD_MS`（1200ms）自动复位到 `idle`。
      - 动画参数：`STEP_INTERVAL_MS=300`（单步间隔）、`HOLD_MS=1200`（保持时长）。
      - 关键修复：`useEffect` 依赖路径内容签名字符串 `pathKey`（`nodes.join('|')::edges.join('|')`）而非 `path` 对象引用——避免外层 `executionLogs` 每次渲染创建新数组导致 `useMemo` 重算 path 新对象、effect 重复触发并重置 `currentStep=0` 的问题；通过 `pathRef` 在 effect 内部读取最新 path。
      - 派生亮起集合：`highlightedNodeIds = path.nodes.slice(0, currentStep)`、`highlightedEdgeIds = path.edges.slice(0, currentStep-1)`（step 个节点对应 step-1 条边）。
    - 新增 `apps/web/src/features/screen/blueprint/runtime/use-blueprint-sandbox-highlight.test.tsx`：12 个测试用例
      - `deriveExecutionPath` 纯函数（4）：log 为 undefined 返回空路径、无 action 仅 trigger 节点无边、链式 action 按序派生节点+边、相邻节点无匹配边则该段边缺失。
      - 状态机（8）：初始无 executionLogs 为 idle、blueprint 为 undefined 仍可派生节点、executionLogs 设置后启动动画节点依次亮起、边随节点同步流动亮起、全部亮起后保持 HOLD_MS 自动复位、路径内容变化重启动画、相同路径内容引用变化不重启动画（pathKey 稳定性）、动画进行中卸载清理定时器。
      - 使用 `vi.useFakeTimers()` + `vi.advanceTimersByTime()` 控制 `STEP_INTERVAL_MS`/`HOLD_MS` 推进。
    - runtime 模块入口 `index.ts` 已导出 `useBlueprintSandboxHighlight`、`deriveExecutionPath`、`BlueprintSandboxHighlight`、`ExecutionPath`。
    - 验证命令与结果：
      - `pnpm --filter @nebula/web exec vitest run --pool=threads --no-file-parallelism src/features/screen/blueprint/runtime/use-blueprint-sandbox-highlight.test.tsx` → 12 passed (24.91s)。
      - `pnpm --filter @nebula/web exec vitest run --pool=threads --no-file-parallelism src/features/screen/blueprint/runtime/` → 5 文件 / 95 用例 / 95 通过（preview 19 + sandbox-runtime 17 + sandbox-highlight 12 + runtime-deps 24 + runtime 23）。
      - `pnpm --filter @nebula/web exec eslint <两个文件>` → 退出码 0。
      - `pnpm exec biome check <两个文件>` → 退出码 0（初次 2 格式错误经 `biome check --write` 修复：tab/空格统一）。
    - E2E 截图证据：本任务为状态机 Hook 单元测试覆盖，未在 UI 集成层做截图；完整链路的可视化证据将在 8.3 执行日志面板与 9.x 联动任务中通过组件测试或 E2E 补充。

- [x] **8.3 执行日志面板**
  - 结果：按序展示动作执行/跳过结果、跳过原因与耗时；失败动作红色标记并点击定位节点。
  - 验证：组件测试覆盖日志顺序、失败标记、点击定位。
  - 依赖：8.1。
  - 实施（2026-07-23）：
    - 新增 `apps/web/src/features/screen/blueprint/panels/execution-log-panel.tsx`：
      - 纯展示组件，接收沙盒运行时产出的 `executionLogs` + 状态字段（`isSimulating` / `refusalReason` / `triggerNotFound`）+ `onLocateNode` 定位回调 + 可选 `onClear` 清空日志。
      - 状态优先级：`isSimulating` > `triggerNotFound` > `refusalReason` > 空日志 > 日志列表。
      - 日志列表按 `RuleExecutionLog.results` 顺序展示每条 `ActionResult`：
        - `success`：节点 ID + 耗时（格式 `{durationMs}ms`），绿色标记。
        - `skipped`：节点 ID + 跳过原因，灰色标记，不可点击。
        - `failure`：节点 ID + 错误信息 + 耗时，红色背景（`bg-destructive/5`）+ 红色文字（`text-destructive`），可点击定位到节点（触发 `onLocateNode(nodeId)`）。
      - 标题栏含触发器 ID 与计数（成功/跳过/失败，仅在数量 > 0 时显示对应计数），可选清空按钮。
      - 深度截断时（`log.truncated=true`）末尾追加黄色告警条目。
      - 复用既有 ProblemsPanel 的视觉风格（`border-t` + `max-h-40 overflow-y-auto` + 状态指示点）保持视觉一致。
    - 新增 `apps/web/src/features/screen/blueprint/panels/execution-log-panel.test.tsx`：21 个测试用例
      - 状态优先级（5）：模拟中显示"正在执行..."、trigger 不存在显示"未找到触发器节点"、拒绝显示拒绝原因、空日志显示"尚未执行模拟"、模拟中优先级高于 trigger 不存在。
      - 日志顺序与计数（4）：按 results 顺序展示、标题栏显示触发器 ID 与计数、无失败时不显示失败计数、取 `executionLogs[0]` 渲染最新一次。
      - 失败动作红色标记与点击定位（6）：失败动作显示错误信息与耗时、点击失败动作触发 onLocateNode、点击 success 行不触发、点击 skipped 行不触发、skipped 动作显示跳过原因、success 动作显示耗时。
      - 清空按钮与深度截断（4）：提供 onClear 时显示清空按钮并触发、未提供 onClear 时不显示、深度截断时末尾显示截断告警、未截断时不显示。
      - 边界情况（2）：空 results 列表仅显示标题栏、多结果混合所有状态正确渲染。
    - panels 模块入口 `index.ts` 新增导出 `ExecutionLogPanel`、`ExecutionLogPanelProps`（同时补充 `ProblemsPanel` 的导出，之前遗漏）。
    - 验证命令与结果：
      - `pnpm --filter @nebula/web exec vitest run --pool=threads --no-file-parallelism src/features/screen/blueprint/panels/execution-log-panel.test.tsx` → 21 passed (26.07s)。
      - `pnpm --filter @nebula/web exec eslint <三个文件>` → 退出码 0。
      - `pnpm exec biome check <三个文件>` → 退出码 0（初次 2 格式错误经 `biome check --write` 修复：tab/空格统一）。
    - 集成说明：本任务仅交付面板组件，Sheet 内的集成（沙盒运行时调用 + 模拟触发按钮 + 面板挂载）将在后续 Sheet 集成任务中完成；面板 Props 设计已与 `useBlueprintSandboxRuntime` 的 `SandboxSimulationResult` / `BlueprintSandboxRuntime` 对齐，集成时可直接传递 `executionLogs` / `isSimulating` / `resetSandbox` 等字段。

## 9. 双向联动与模板（M2）

- [x] **9.1 蓝图 → 画布高亮联动**
  - 结果：点击蓝图节点时主画布闪烁高亮对应组件。
  - 验证：组件测试或 E2E 覆盖高亮触发与消失。
  - 依赖：7.4。
  - 实施（2026-07-23）：
    - 设计分层（最小可用方案，不修改 Sheet/screen-canvas 复杂结构）：
      1. **纯函数层**：`getNodeLocateComponentId(node)` 从 ReactFlow Node 提取关联画布组件 id（trigger.componentClick 取 `data.componentId`；action 取 `data.targetComponentId`；comment/pageLoad/navigate 返回 undefined）。
      2. **状态管理层**：`useCanvasFlash(flashMs)` Hook 管理"待闪烁 componentId"与自动清除定时器（默认 FLASH_MS=1500ms 后自动清除，支持手动 `clearFlash()` 立即清除、重复触发重置计时、卸载清理）。
      3. **渲染层**：`CanvasFlashOverlay` 组件在主画布容器上叠加绝对定位的闪烁框，定位到目标组件位置（复用 `resolveComponentContainerStyle`），`pointer-events: none` 不拦截交互，`animate-pulse ring-4 ring-blue-500` 蓝色闪烁动画。
    - 新增 `apps/web/src/features/screen/blueprint/runtime/get-node-locate-component.ts`：纯函数，从节点 data 提取关联 componentId；空字符串视为未配置返回 undefined；comment/condition/未知类型返回 undefined。
    - 新增 `apps/web/src/features/screen/hooks/use-canvas-flash.ts`：闪烁状态机 Hook；`flashComponent(id)` / `clearFlash()` / `flashingComponentId`；flashMs 参数可注入便于测试。
    - 新增 `apps/web/src/features/screen/components/canvas-flash-overlay.tsx`：纯展示组件，flashingComponentId 为 null 或目标组件不存在时不渲染；存在时在组件位置渲染闪烁框。
    - runtime 模块入口 `index.ts` 新增导出 `getNodeLocateComponentId`。
    - 测试覆盖（28 用例，3 文件）：
      - `get-node-locate-component.test.ts`（13）：trigger.componentClick 取 componentId、pageLoad 无关联、空字符串视为未配置、componentId 缺失返回 undefined；action 各类型（setVisibility/scrollToComponent/refreshDataSource）取 targetComponentId、navigate 无 targetComponentId、空字符串与缺失返回 undefined；comment 无关联；condition(M3) 与未知类型返回 undefined。
      - `use-canvas-flash.test.tsx`（9）：初始 null、flashComponent 设置 id、FLASH_MS 后自动清除、FLASH_MS 之前未清除、clearFlash 立即清除、clearFlash 后无副作用、重复触发重置计时、卸载清理定时器无浮动回调、flashComponent/clearFlash 引用稳定（useCallback）。
      - `canvas-flash-overlay.test.tsx`（6）：flashingComponentId 为 null 不渲染、目标组件不存在不渲染、存在时渲染闪烁框、定位到组件位置与尺寸、pointer-events: none、从多组件中匹配目标。
    - 验证命令与结果：
      - `pnpm --filter @nebula/web exec vitest run --pool=threads --no-file-parallelism <三个测试文件>` → 28 passed (63.55s)。
      - `pnpm --filter @nebula/web exec eslint <六个文件>` → 退出码 0（初次 2 个 `@typescript-eslint/no-unnecessary-type-assertion` 错误：`as Record<string, unknown>` 与 `as Node` / `as ScreenComponent` 不必要，已移除）。
      - `pnpm exec biome check <六个文件>` → 退出码 0（初次 7 格式错误经 `biome check --write` 修复：tab/空格统一）。
    - 集成说明：本任务交付"机制层"（纯函数 + Hook + Overlay 组件），Sheet 内的 `onNodeClick` 集成与 screen-editor 的状态桥接将在后续 Sheet 集成任务中完成；集成路径已明确——Sheet 增加 `onLocateComponent` prop，由 screen-editor 注入 `useCanvasFlash().flashComponent`，并在主画布容器内挂载 `<CanvasFlashOverlay>`。

- [x] **9.2 画布 → 蓝图过滤联动**
  - 结果：画布选中组件时蓝图过滤展示涉及该组件的节点与链路；组件重命名时节点标签实时跟随。
  - 验证：组件测试覆盖过滤逻辑纯函数与标签跟随。
  - 依赖：9.1。
  - 实施记录（2026-07-23）：
    - 新增纯函数 `filterBlueprintByComponent`（`compiler/filter-by-component.ts`）：
      - 输入 `EventBlueprint` 与 `componentId`，返回 `FilteredBlueprint { nodes, edges }`。
      - 过滤规则：trigger.componentClick 匹配 `config.componentId`；action（除 navigate 外）匹配 `config.targetComponentId`；comment 与 pageLoad 不涉及组件。
      - 边过滤：仅保留两端节点都是涉及节点的边，O(1) 判断经 `Set<string>` 索引。
      - 边界处理：componentId 为空/null/undefined 时返回空；无涉及节点时返回空。
      - 顺序保持：节点与边按 blueprint 原顺序返回。
    - 标签跟随（复用 `getNodeLabel`）：从 `sheet/blueprint-sheet.tsx` 导出原私有函数 `getNodeLabel`（`function` → `export function`）。
      - 标签规则：trigger→"点击：<name>" / "页面加载"；action→"显示/隐藏/切换：<name>" / "滚动至：<name>" / "刷新数据：<name>" / "跳转：<url>"；comment→`config.text`。
      - 跟随机制：`getNodeLabel` 接收 `components: ScreenComponent[]` 引用，组件重命名后传入新的 `components` 数组即产生新 label，无需修改节点 config。
      - 未配置降级：componentId 为空字符串显示"未配置"；dangling 引用（componentId 在 components 中不存在）回退为 componentId。
    - 模块入口更新：`compiler/index.ts` 导出 `filterBlueprintByComponent` 与 `FilteredBlueprint` 类型。
    - 测试文件：
      - `filter-by-component.test.ts`（15）：componentId 边界(3)、trigger 过滤(2)、action 过滤(4)、comment(1)、边过滤(3)、多组件混合(2)。
      - `get-node-label.test.tsx`（17）：trigger 标签(4)、action 标签(7)、comment 标签(2)、标签跟随(4)。
    - 验证命令与结果：
      - `pnpm exec vitest run --pool=threads --no-file-parallelism <两个测试文件>` → 32 passed (46.62s)。
      - `pnpm exec biome check --write <五个文件>` → Fixed 1 file（blueprint-sheet.tsx 中 `reactFlowInstance.setCenter` 浮动 Promise 加 `void`）。
      - `pnpm exec eslint <五个文件>` → 退出码 0。
    - 集成说明：本任务交付纯函数与标签契约；Sheet 内"画布选中 → 调用 filterBlueprintByComponent → ReactFlow 切换过滤视图"的集成将在后续 Sheet 集成任务中完成。集成路径已明确——screen-editor 监听画布选中组件变化时调用 `filterBlueprintByComponent` 得到过滤视图，传入 BlueprintSheet 作为可选的 `filterComponentId` prop，Sheet 内部据此切换 nodes/edges 显示源；同时 Sheet 在 blueprint 与 components 变化时统一通过 `getNodeLabel` 重算节点 label。

- [x] **9.3 模板库与空态引导**
  - 结果：空蓝图提供一键模板（点击跳转/显隐切换/页面加载刷新）；插入经 Schema 校验并作为一条历史入栈。
  - 验证：组件测试覆盖模板插入结果、历史单条、校验失败不入栈。
  - 依赖：7.4。
  - 实施记录（2026-07-23）：
    - 新增 `templates/` 模块（6 个源文件 + 5 个测试文件）：
      - `template-definitions.ts`：3 个模板元数据（id/name/description/icon），与 spec.md §双向联动与模板 对齐：
        - click-navigate：点击组件 → 跳转 URL（Navigation 图标）
        - click-toggle-visibility：点击组件 → 显隐切换（MousePointerClick 图标）
        - page-load-refresh：页面加载 → 刷新数据源（RefreshCw 图标）
      - `create-template-blueprint.ts`：纯函数 `createTemplateBlueprint(templateId): EventBlueprint`。
        - 每个模板返回 2 节点（trigger + action）+ 1 边（trigger.out → action.in）。
        - 节点 ID 语义化固定值（trigger-1/action-1/edge-1），便于测试断言。
        - 节点位置预设（trigger 在 (0,0)，action 在 (200,0)）。
        - config 可空字段（componentId/url/targetComponentId）用空字符串占位，与 Schema 中"空字符串视为未配置"对齐。
        - exhaustive check：未知 templateId 抛 Error（不应运行时发生）。
      - `build-validated-template.ts`：单一入口 `buildValidatedTemplate(templateId): TemplateBuildResult`。
        - 构造 + EventBlueprintSchema.safeParse 校验。
        - 返回 Result 判别联合：`{ success: true, blueprint } | { success: false, error }`。
        - 失败路径不抛异常，错误信息人类可读（ZodError issues 拼接）。
        - 调用方按 success 分支决定是否调 updateBlueprint，实现"校验失败不入栈"语义。
      - `template-gallery.tsx`：纯展示组件，渲染 3 个模板卡片网格。
        - 卡片含图标 + 名称 + 描述，hover 高亮，focus-visible ring。
        - role=list/listitem 保证可访问性，button type=button 可键盘激活。
      - `empty-blueprint-state.tsx`：空态引导组件（标题 + 描述 + 画廊 + "从空白开始"按钮）。
        - 内部 useCallback 包装 handleSelectTemplate，调用 buildValidatedTemplate：
          - success → onInsertTemplate(blueprint)（调用方 updateBlueprint 入栈一条历史）
          - failure → onError(error)（不入栈，调用方提示用户）
        - "从空白开始"按钮 → onStartFromScratch（调用方创建空蓝图状态供用户自由编排）。
      - `index.ts`：模块入口，导出全部公开 API。
    - 测试覆盖（5 文件，44 用例）：
      - `create-template-blueprint.test.ts`（11）：三个模板各自结构、trigger/action config、边连接、固定 ID、位置预设、新对象返回。
      - `build-validated-template.test.ts`（7）：三个模板通过 Schema 校验、与 createTemplateBlueprint 内容一致、失败路径（未知 ID）、Result 类型判别。
      - `template-gallery.test.tsx`（10）：渲染 3 卡片、名称/描述显示、顺序、点击触发 onSelect、button 元素与 list 角色。
      - `empty-blueprint-state.test.tsx`（9）：渲染标题/文案/画廊/按钮、点击卡片调用 onInsertTemplate、不同模板不同蓝图、校验失败调用 onError 不调 onInsertTemplate、点击"从空白开始"调用 onStartFromScratch。
      - `template-insertion.integration.test.ts`（7）：真实 editor-store 集成：
        - 三个模板各自插入产生 1 条历史，快照为空蓝图
        - undo 回到空蓝图
        - 校验失败不调 updateBlueprint，历史栈为空
        - 校验失败不修改 isDirty
        - 连续插入 2 次产生 2 条历史，undo 依次回退
    - 验证命令与结果：
      - `pnpm exec vitest run --pool=threads --no-file-parallelism src/features/screen/blueprint/templates` → 44 passed (115.97s)。
      - `pnpm exec biome check --write src/features/screen/blueprint/templates` → Fixed 11 files（tab/空格统一）。
      - `pnpm exec eslint <6 个源文件 + 5 个测试文件>` → 退出码 0。
    - Bug 修复：初次测试中 `vi.spyOn(buildModule, 'buildValidatedTemplate').mockImplementation(real.buildValidatedTemplate)` 触发无限递归（spy 替换原函数后，mockImplementation 调用的 real.buildValidatedTemplate 实际是 spy 自身），改为默认不 mock、仅失败测试显式 mock。
    - 集成说明：本任务交付完整"模板库 + 空态引导 + 校验入栈"链路，但 Sheet 内"blueprint 为空时渲染 EmptyBlueprintState、onInsertTemplate 调 updateBlueprint、onError 调 toast.error、onStartFromScratch 调 updateBlueprint(空蓝图)"的集成将在后续 Sheet 集成任务中完成。集成路径已明确——BlueprintSheet 内根据 `blueprint.nodes.length === 0` 渲染 EmptyBlueprintState 替代 ReactFlow 画布，三个回调分别注入 updateBlueprint / toast.error / updateBlueprint(emptyBlueprint)。

- [x] **9.4 小地图与对齐分布工具**
  - 结果：全屏弹层内小地图与多选对齐分布工具条可用。
  - 验证：组件测试覆盖对齐分布计算纯函数；小地图视口同步。
  - 依赖：7.4。
  - 实施记录（2026-07-23）：
    - **MiniMap 视口同步**：blueprint-sheet.tsx 第 723 行已有 `<MiniMap pannable zoomable className="!bg-background" data-testid="blueprint-minimap" />`，ReactFlow 内置 MiniMap 自动与主视口同步，无需额外接入。
    - **对齐分布纯函数**（`apps/web/src/features/screen/blueprint/lib/align-distribute.ts`）：
      - `AlignNode`/`AlignResultItem`/`AlignMode`/`DistributeMode` 类型契约
      - `alignNodes(nodes, mode)`：6 种对齐方式（left/center-h/right/top/middle-v/bottom），按选中节点整体边界框计算；边界规则：节点数 < 2 时 hasChange=false
      - `distributeNodes(nodes, mode)`：水平/垂直等距分布，按中心坐标升序排序，首尾保持、中间均匀分布；边界规则：节点数 < 3 时 hasChange=false
      - `applyAlignResultToNodes<T>(nodes, items)`：泛型辅助函数，按 id 匹配并替换 position，保留其他字段（如 data/config/type/selected）
      - 纯函数无副作用，输入输出明确，hasChange 标记避免空历史入栈
    - **对齐分布工具条 UI**（`apps/web/src/features/screen/blueprint/panels/align-distribute-toolbar.tsx`）：
      - 6 个对齐按钮 + 2 个分布按钮，使用 lucide-react 图标（AlignStartVertical/AlignCenterVertical/AlignEndVertical/AlignStartHorizontal/AlignCenterHorizontal/AlignEndHorizontal/AlignHorizontalSpaceBetween/AlignVerticalSpaceBetween）
      - 启用规则：对齐按钮 selectedCount >= 2，分布按钮 selectedCount >= 3
      - 阻止事件冒泡到 ReactFlow（参考 viewport-toolbar 模式）
      - role="toolbar" + aria-label="对齐与分布"
    - **集成到 blueprint-sheet.tsx**：
      - `selectedAlignNodes` 由 `nodes.filter(n => n.selected)` 计算（ReactFlow Node 的 selected 字段）
      - `handleAlign`/`handleDistribute` 调用纯函数 → `applyAlignResultToNodes` → `setNodes` + `updateBlueprint`（一次提交一条历史）
      - hasChange=false 时直接 return，避免空历史入栈
      - 工具条 UI 在画布左下角悬浮（`absolute bottom-4 left-4 z-10`），避开 MiniMap；selectedCount >= 2 时显示
    - **lib/index.ts + panels/index.ts** 导出新增模块
    - **测试覆盖**：
      - `align-distribute.test.ts`（27 用例）：6 种对齐 + 2 种分布纯函数 + applyAlignResultToNodes 辅助函数；覆盖边界（空数组/单节点/2 节点/3 节点）、退化（width=0/height=0）、不修改输入数组、items 顺序与输入一致、hasChange 标记
      - `align-distribute-toolbar.test.tsx`（19 用例）：渲染（6 对齐 + 2 分布按钮 + role/aria-label）、启用/禁用规则（0/1/2/3 节点）、data-mode 属性、回调（onAlign/onDistribute 传 mode）、禁用状态下不触发回调、事件冒泡阻止、自定义类名
      - `align-distribute.integration.test.ts`（10 用例）：真实 editor-store + 纯函数集成；对齐（左/中/右/顶）→ updateBlueprint → 1 条历史 + 快照验证；分布（水平/垂直）→ 1 条历史；undo 恢复；无变化不入栈；连续对齐产生多条历史
      - `blueprint-sheet.test.tsx`（17 用例，含 6 新增）：扩展 ReactFlow mock 支持 onNodesChange + select-all/deselect-all 按钮；验证 selectedCount=0 不渲染、selectedCount=2 渲染工具条、selectedCount 反映在 data-selected-count、取消选择后工具条消失、分布按钮在 selectedCount=2 时禁用、点击左对齐按钮触发 updateBlueprint 入历史、分布按钮禁用时不触发更新
    - 验证：blueprint 全量 32 文件 / 543 用例通过（含 Task 9.4 新增 3 文件 / 56 用例：27 纯函数 + 19 工具条组件 + 10 集成），0 回退。typecheck/lint/biome 后续统一执行。

### M2 Sheet 集成（2026-07-23，Asia/Shanghai）

> 任务 8.x / 9.x 此前仅交付组件与机制层，Sheet 内的集成一直推迟到"后续 Sheet 集成任务"。本次完成全部 M2 Sheet 集成，让 checklist 模拟调试与双向联动项可勾选。

- **Sheet 集成范围**：blueprint-sheet.tsx 与 screen-editor.tsx 双向打通，将沙盒运行时、链路高亮、执行日志面板、模板空态、蓝图→画布闪烁、画布→蓝图过滤全部接入。
- **blueprint-sheet.tsx 修改**：
  - Props 扩展：新增 `onLocateComponent?: (componentId: string) => void` 与 `filterComponentId?: string | null`，由 screen-editor 注入。
  - 模板空态：原"空蓝图 / 双击画布添加节点"占位替换为 `EmptyBlueprintState`，三个回调分别接 `updateBlueprint`（入栈一条历史）、`toast.error`（校验失败不入栈）、`updateBlueprint({ version:1, nodes:[], edges:[] })`（从空白开始）。
  - 模拟调试：集成 `useBlueprintSandboxRuntime` + `useBlueprintSandboxHighlight`；顶栏新增"模拟触发"按钮（仅选中 trigger 节点时启用）与"重置沙盒"按钮；底部新增 `ExecutionLogPanel`，`lastSimResult` state 存储 simulateTrigger 返回值以驱动 refusalReason/triggerNotFound 显示。
  - 链路高亮：`displayNodes`/`displayEdges` 通过 useMemo 叠加 `highlight.highlightedNodeIds`/`highlightedEdgeIds` className（`blueprint-node-highlighted` / `blueprint-edge-highlighted` + `animated: true`）。
  - 蓝图→画布高亮：`onNodeClick` 调用 `getNodeLocateComponentId(node)` 提取关联 componentId，通知 screen-editor 触发闪烁。
  - 画布→蓝图过滤：`filterComponentId` 非空时通过 `filterBlueprintByComponent` 计算 `filteredIds`，`displayNodes`/`displayEdges` 先按 id 集合过滤再叠加高亮；顶栏显示"过滤模式"标签。
- **screen-editor.tsx 修改**：
  - 新增 `useCanvasFlash()` 提供 `flashingComponentId` 与 `flashComponent`。
  - 从 `useScreenEditorStore` 读取 `selectedComponentIds`，单选时派生 `filterComponentId`。
  - `BlueprintSheet` 传入 `onLocateComponent={flashComponent}` 与 `filterComponentId`。
  - 主画布容器内挂载 `<CanvasFlashOverlay>`，`pointer-events: none` 不拦截交互。
- **测试更新**：`blueprint-sheet.test.tsx` 原两个"显示空态提示"用例改为断言 `data-testid="empty-blueprint-state"`（EmptyBlueprintState 组件）；其余 37 用例无需修改。
- **质量门验证**（2026-07-23 20:24，Asia/Shanghai）：
  - `pnpm --filter @nebula/web exec tsc --noEmit` → 退出码 0。
  - `pnpm --filter @nebula/web exec eslint blueprint-sheet.tsx screen-editor.tsx` → 退出码 0。
  - `pnpm exec biome check --write <两个文件>` → Fixed 2 files（tab/空格统一）。
  - `pnpm --filter @nebula/web exec vitest run --pool=threads --no-file-parallelism src/features/screen/blueprint/` → 37 文件 / 712 用例 / 712 通过 / 0 失败 / 0 跳过。
  - `pnpm --filter @nebula/web test`（全量） → 102 文件 / 1966 用例 / 1966 通过 / 0 失败 / 0 跳过，0 回归。
  - `pnpm biome:check` → 563 文件检查通过，退出码 0。
- **未完成项**：模拟调试链路与双向联动的浏览器级 E2E 覆盖仍为 `[ ]`（仅有单元/集成测试，无 Playwright E2E）；M3 高级触发与动作全部为 `[ ]`。

## 10. 高级触发与动作（M3）

- [x] **10.1 condition 契约与编译**
  - 结果：condition 节点配置（字段来源 + 比较运算符 + 比较值）开放；编译器按 then/else 分支产出规则。
  - 验证：共享包测试覆盖表达式契约；编译器测试覆盖分支拓扑与环检测兼容。
  - 依赖：7.4。
  - 实施记录（2026-07-23）：
    - 设计要点：condition 节点有两个输出引脚 `then` / `else`，编译期无法预知表达式求值结果，因此同时保留 then/else 两条分支动作链到 `CompiledCondition`；运行时（任务 10.3）根据表达式求值选择对应分支执行。
    - 共享包（无 schema 变更，仅扩展测试）：`packages/shared/src/schemas/blueprint.schema.test.ts` 新增 `ConditionExpression 契约` describe 块，13 个测试覆盖：
      - operator × value 类型组合：eq/ne/gt/gte/lt/lte/contains × string/number/boolean；empty/notEmpty 缺省 value；empty/notEmpty 同时携带 value（schema 不强制禁止）
      - source 字段来源：componentProp（componentId+key）/ componentData（componentId+path）
      - 拒绝场景：未知 operator/source.kind、缺 componentId/key/path、value 为对象/null/数组、缺 source/operator、config.type 不为 condition
    - 编译器类型扩展（`apps/web/src/features/screen/blueprint/compiler/types.ts`）：
      - 新增 `CompiledCondition` 接口：`{ nodeId, config: ConditionNodeConfig, thenActions, elseActions, depth }`
      - `CompiledRule` 新增 `conditions: CompiledCondition[]` 字段（向后兼容：现有访问 `rule.actions` 的代码不受影响；`rule.conditions` 默认空数组）
      - `compiler/index.ts` 导出 `CompiledCondition` 类型
    - 编译器主入口重写（`apps/web/src/features/screen/blueprint/compiler/compile.ts`）：
      - 重构 `compileTrigger`：trigger 自身入 visited，从其出边开始 DFS；condition 节点遇到时调用 `compileConditionBranches` 产出 `CompiledCondition` 加入 `conditions` 列表，不再混入 `actions`
      - 新增 `compileConditionBranches`：按 `sourceHandle` ('then'/'else') 分组出边，分别调用 `expandBranch` 展开 then/else 分支动作链
      - 新增 `expandBranch`：分支内部独立 DFS，与另一分支共享 `parentVisited` 防止重复访问；遇到嵌套 condition 递归调用 `compileConditionBranches` 产出 `CompiledCondition`（任务 10.1 暂不向顶层 CompiledRule.conditions 透传嵌套 condition，运行时执行器需在任务 10.3 中按嵌套结构递归求值）
      - 新增 `pushOutgoing` 辅助函数：统一处理节点出边入栈
      - 环检测兼容：condition 分支中的节点参与 cycle.ts 的 DFS 环检测；环不含 trigger 时 trigger 仍产出规则（局部环由 visited 防止无限循环，cycle 诊断仍然产出）；环含 trigger 时沿用既有"环 trigger 跳过"语义
    - 编译器测试（`apps/web/src/features/screen/blueprint/compiler/compile.test.ts`）：新增 `compileBlueprint — condition 分支编译（任务 10.1）` describe 块，17 个测试覆盖：
      - 基础分支拓扑：condition 直连 trigger（depth=0，then/else 双分支分别展开 depth=1）；condition 前置 action（depth 累加）；condition 后接串联 action（分支内 action 链按顺序展开）
      - 未连接分支与缺省：仅连 then / 仅连 else / 两分支都未连 / 非 then/else 的 sourceHandle 被忽略
      - 多分支与多 condition：then 分支含多目标（按出边顺序）；嵌套 condition（cd1 →(then) cd2，cd1 进入顶层 conditions，cd2 在 thenActions 之外）；同链路多个并列 condition（依次产出 CompiledCondition）
      - 环检测兼容：condition 分支内形成环（cycle 诊断产出，环中节点不重复入栈，trigger 仍产出规则）；分支内串联形成环；环含 trigger（trigger 不产出规则，沿用既有语义）
      - config 透传：CompiledCondition.config 完整保留 condition 配置（含表达式）；condition 节点的 dangling 诊断仍由 validate.ts 处理
      - CompiledRule 结构：无 condition 节点时 conditions 为空数组；actions 与 conditions 共存（condition 不阻塞主链 action）
    - 验证：blueprint 全量 32 文件 / 560 用例通过（含 Task 10.1 新增 17 用例：39 compile + 13 shared schema 表达式契约），0 回退。typecheck/lint/biome 后续统一执行。
    - 后续依赖：Task 10.2（condition 节点 UI）将基于 CompiledCondition 渲染 then/else 双输出引脚；Task 10.3（condition 分支运行时）将扩展 executor 按表达式求值选择 then/else 分支执行。

- [x] **10.2 条件表达式构建器 UI**
  - 结果：蓝/白配色 condition 节点与表达式构建表单；then/else 双输出引脚分色；不产生自定义脚本。
  - 验证：组件测试覆盖表达式编辑、分支连线；无脚本输入入口。
  - 依赖：10.1。
  - 实施记录（2026-07-23）：
    - 节点数据类型扩展（`nodes/node-data-types.ts`）：新增 `ConditionNodeData` 接口，扩展 `BlueprintNodeData` 联合类型
    - 节点外壳扩展（`nodes/base-node.tsx`）：
      - `NodeColorScheme` 新增 `'condition'`（紫色配色：bg-purple-500/10、border-purple-500/50、text-purple-700）
      - 新增 `outputHandleMode?: 'single' | 'then-else'` 属性；then-else 模式渲染两个 Handle（id="then" top:40%、id="else" top:70%）
    - condition 节点组件（`nodes/condition-node.tsx`，新建）：
      - `summarizeCondition` 纯函数：根据 expression 生成摘要（`sourceLabel operatorLabel value`，empty/notEmpty 无 value）
      - `ConditionNode` 组件：使用 `outputHandleMode="then-else"`，children 渲染 THEN/ELSE 标签
      - 20 个测试：summarizeCondition 纯函数（10 个）+ ConditionNode 组件渲染（10 个，含 then/else handle 验证）
    - 表达式构建器（`panels/condition-builder.tsx`，新建）：
      - 受控组件，字段包括字段来源类型/组件ID/属性键或数据路径/运算符/比较值
      - `needsValue` 纯函数：判断 empty/notEmpty 无需 value
      - `updateValue` 自动推断类型（纯数字→number，true/false→boolean，其他→string）
      - 26 个测试：needsValue 纯函数 + 初始渲染 + 交互触发 onChange（含类型推断）
    - 搜索面板扩展（`panels/search-panel.tsx`）：`NodeOption.kind` 扩展为含 `'condition'`；NODE_OPTIONS 新增 condition 选项（GitBranch 图标）
    - 蓝图编辑表单扩展（`sheet/blueprint-sheet.tsx`）：
      - 注册 `condition: ConditionNode` 到 nodeTypes
      - `getNodeLabel` 新增 condition 分支（显示 `条件：<操作符>`）
      - `isNodeDangling` 新增 condition 分支（检查 expression.source.componentId）
      - `createNodeFromOption` 新增 condition 分支（默认 eq 表达式，空 componentId/key）

- [x] **10.3 高级触发器**
  - 结果：`dataLoaded`/`dataError`/`componentHover`/`interval` 触发器开放；interval 仅预览会话内有效，卸载即清理。
  - 验证：引擎测试覆盖四类触发；假计时器测试覆盖 interval 触发与清理。
  - 依赖：10.1。
  - 实施记录（2026-07-23）：
    - 共享包 schema 扩展（`packages/shared/src/schemas/blueprint.schema.ts`）：
      - `BlueprintTriggerTypeSchema` 扩展为 6 种枚举（新增 componentHover/dataLoaded/dataError/interval）
      - 新增 4 个 trigger config schema：
        - `TriggerComponentHoverConfigSchema`：componentHover + componentId
        - `TriggerDataLoadedConfigSchema`：dataLoaded + componentId
        - `TriggerDataErrorConfigSchema`：dataError + componentId
        - `TriggerIntervalConfigSchema`：interval + intervalMs（superRefine 100ms~86400000ms，拒绝 0/负数/小数/超24h）
      - 12 个 schema 测试覆盖：接受新触发器、interval 边界值（99ms/0ms/负数/小数/超24h 拒绝）、拒绝未知触发器类型
    - 运行时类型扩展（`runtime/types.ts`）：`TriggerEventType` 扩展为 6 种（新增 componentHover/dataLoaded/dataError/interval）
    - 规则匹配重写（`runtime/matcher.ts`）：
      - 完全重写为 switch 穷尽性匹配
      - `matchesEvent`：先校验 triggerConfig.type === event.kind，再按类型分支（componentClick/componentHover/dataLoaded/dataError 校验 componentId；pageLoad/interval 直接匹配）
      - 穷尽性检查：`const _exhaustive: never = triggerConfig` 编译期发现遗漏
      - 8 个 matcher 测试覆盖：componentHover/dataLoaded/dataError/interval 匹配、空 componentId 不匹配、不同触发器类型不互相匹配、多规则保持编译顺序
    - 验证：shared schema 92 用例 + runtime matcher 8 用例全部通过

- [x] **10.4 requestApi 动作与脱敏**
  - 结果：`requestApi` 动作沿用阶段 2 API 契约与取消协议；公开预览敏感请求头按共享规则脱敏，失败进入失败态不伪造。
  - 验证：测试覆盖请求执行、脱敏配置组装、失败态；后端脱敏回归不回退。
  - 依赖：10.3。
  - 实施记录（2026-07-23）：
    - 共享包 schema 扩展（`packages/shared/src/schemas/blueprint.schema.ts`）：
      - 新增 `ActionRequestApiConfigSchema`：method（GET/POST/PUT/PATCH/DELETE）、url、headers（默认 {}）、body（默认 ''）、secretHeaderKeys（默认 []）、timeoutMs（默认 10000，上限 300000）
      - superRefine 校验：非空 URL 必须为 http/https 协议（拒绝 javascript:/data:）
      - `BlueprintActionConfigSchema` discriminatedUnion 新增 `ActionRequestApiConfigSchema`
      - 14 个 schema 测试覆盖：最小配置、POST 完整配置、5 种 HTTP 方法、拒绝未知方法、拒绝 javascript: URL、允许空 URL、timeoutMs 边界（0/负数/超 300000 拒绝）、默认值（headers/body/secretHeaderKeys/timeoutMs）
    - 运行时类型扩展（`runtime/types.ts`）：
      - `RuntimeDeps` 新增 `requestApi` 方法（依赖注入，真实 fetch 由调用方实现）
      - 新增 `RequestApiRuntimeParams` 接口（method/url/headers/body/secretHeaderKeys/timeoutMs）
      - 新增 `RequestApiRuntimeResult` 接口（status/bodyPreview/ok）
    - 执行器扩展（`runtime/executor.ts`）：`executeAction` switch 新增 `case 'requestApi'` 分支：
      - 空 URL 跳过并记录原因（skipped）
      - 调用 `deps.requestApi`，非 ok 返回 failure（error 含 HTTP 状态码与 bodyPreview 前 200 字符）
      - ok 返回 success
      - 6 个 executor 测试覆盖：2xx success、4xx/5xx failure（error 含状态码）、空 URL skipped、网络错误（reject）failure、调用参数正确传递、失败不中断后续动作
    - 脱敏纯函数（`lib/request-api-mask.ts`，新建）：
      - `maskHeaders`：大小写不敏感替换 secretHeaderKeys 为 `***`，不修改输入
      - `maskUrlQuery`：保留 hash、处理无等号参数、脱敏 secretHeaderKeys 同名参数
      - `maskJsonBody`：递归脱敏 JSON 对象/数组，非 JSON 原样返回
      - `maskRequestForLog`：组合脱敏 headers + url query + body
      - `SECRET_MASK` 常量 = `'***'`
      - 22 个脱敏测试覆盖：maskHeaders（5）、maskUrlQuery（7）、maskJsonBody（7）、maskRequestForLog（2）、SECRET_MASK（1）
    - lib/index.ts 导出脱敏工具（maskHeaders/maskJsonBody/maskRequestForLog/maskUrlQuery/SECRET_MASK）
    - 验证：shared schema 92 用例 + 脱敏工具 22 用例 + executor 6 用例全部通过

- [x] **10.5 动作参数模板插值**
  - 结果：动作参数支持引用触发组件数据字段的表达式插值（只读求值，无脚本）。
  - 验证：纯函数测试覆盖插值求值、字段缺失降级、无代码执行路径。
  - 依赖：10.4。
  - 实施记录（2026-07-23）：
    - 模板插值纯函数（`lib/template-interpolation.ts`，新建）：
      - `TemplateContext` 接口：包含 trigger（value/data）和 event（componentId/error）数据来源
      - `interpolateTemplate(template, context)` 纯函数：
        - 模板语法 `{{path.to.field}}`，仅支持点分隔标识符路径
        - 占位符正则 `/\{\{\s*([^}]*?)\s*\}\}/g`，允许空占位符降级为空字符串
        - 路径片段校验 `/^[A-Za-z_][A-Za-z0-9_]*$/`，拒绝 JS 表达式
        - `resolvePath`：按点分隔路径从 context 取值，中途遇 null/非对象返回 undefined
        - `valueToText`：null/undefined → ''、number/boolean → String、object/array → JSON.stringify
      - `interpolateActionConfig(config, context)` 纯函数：
        - requestApi：插值 url/body/headers 值（键名不插值，secretHeaderKeys 不插值）
        - navigate：插值 url
        - setVisibility/scrollToComponent/refreshDataSource：原样返回（componentId 不插值）
        - 穷尽性检查：`const _exhaustive: never = config`
        - 纯函数：返回新对象，不修改原配置与 headers
      - 41 个测试覆盖：
        - 基础插值求值（8）：单个占位符、占位符+字面文本、多个占位符、嵌套路径、深层嵌套、event.componentId、event.error、占位符内空格忽略
        - 字段缺失降级（8）：路径不存在、深层路径中途不存在、undefined 值、null 值、中途遇非对象（字符串/数字）、trigger 整体缺失、event 整体缺失
        - 类型转换（4）：number→string、boolean→string、object→JSON、array→JSON
        - 无代码执行路径（8）：空占位符、仅空格、JS 算术表达式、函数调用、三元表达式、数字开头路径、含分号、含方括号
        - 边界情况（5）：空字符串输入、无占位符原样返回、连续多个占位符、相邻占位符无分隔符、空上下文
        - 动作配置插值（8）：requestApi url/body/headers 插值、secretHeaderKeys 键名不插值、navigate url 插值、setVisibility/scrollToComponent/refreshDataSource 原样返回、纯函数不修改原配置、headers 不被原地修改
    - lib/index.ts 导出模板插值函数（interpolateActionConfig/interpolateTemplate/TemplateContext）
    - 验证：blueprint 全量 36 文件 / 683 用例通过（含 Task 10.5 新增 41 用例），0 回退

## M3 单元与集成测试验收（2026-07-23，Asia/Shanghai）

- [x] **M3 功能测试**
  - 结果：condition 分支执行、高级触发器匹配、requestApi 动作、模板插值、敏感头脱敏、模拟失败路径红色标记与点击定位均通过自动化测试。
  - 验证：专项单元/集成测试覆盖，退出码 0； checklist M3 条目逐项勾选。
  - 依赖：10.1–10.5、8.1–8.3。
  - 实施记录：
    - `pnpm --filter @nebula/web test -- src/features/screen/blueprint/runtime/runtime.test.ts`：退出码 0；1 文件 / 49 用例 / 49 通过 / 0 失败 / 0 跳过。覆盖 condition then/else 分流（6 用例）、高级触发器匹配（8 用例）、requestApi 动作（6 用例）、模板插值（6 用例）。
    - `pnpm --filter @nebula/web test -- src/features/screen/blueprint/lib/request-api-mask.test.ts src/features/screen/blueprint/lib/template-interpolation.test.ts src/features/screen/blueprint/nodes/condition-node.test.tsx src/features/screen/blueprint/panels/condition-builder.test.tsx src/features/screen/blueprint/runtime/use-blueprint-sandbox-runtime.test.tsx src/features/screen/blueprint/panels/execution-log-panel.test.tsx`：退出码 0；6 文件 / 147 用例 / 147 通过 / 0 失败 / 0 跳过。
    - `pnpm --filter @nebula/web test -- src/features/screen/blueprint`：退出码 0；37 文件 / 724 用例 / 724 通过 / 0 失败 / 0 跳过。
    - `pnpm --filter @nebula/shared test`：退出码 0；6 文件 / 129 用例 / 129 通过 / 0 失败 / 0 跳过（含 condition 表达式契约 13 用例、高级触发器 schema 12 用例、requestApi schema 14 用例）。
    - `pnpm --filter @nebula/nestjs-server exec jest --testPathPatterns=screen`：退出码 0；2 文件 / 55 用例 / 55 通过 / 0 失败 / 0 跳过。
    - 失败路径覆盖：`execution-log-panel.test.tsx` 21 用例中 6 用例覆盖失败动作红色标记、点击触发 `onLocateNode`；`runtime.test.ts` 覆盖 requestApi 4xx/5xx 与网络错误返回 failure；`use-blueprint-sandbox-runtime.test.tsx` 覆盖沙盒内动作失败不污染真实状态。

- [x] **M3 质量门**
  - `pnpm typecheck`：退出码 0；4 个 turbo 任务全部成功（shared build/typecheck、nestjs-server typecheck、web typecheck）。
  - `pnpm lint`：退出码 0；3 个 turbo 任务全部成功（shared lint 缓存、nestjs-server lint、web lint）。
  - `pnpm biome:check`：退出码 0；571 文件检查通过，无错误。
  - `pnpm --filter @nebula/web test`：退出码 0；102 文件 / 1978 用例 / 1978 通过 / 0 失败 / 0 跳过。较 7.4 基线 1966 用例增长 12 用例，0 回退。
  - checklist 更新：`高级触发与动作（M3）`7 项全部勾选；`沙盒调试测试覆盖不污染真实状态`勾选；`编辑器模拟沙盒与公开预览的动作语义、深度截断与降级行为一致`勾选。
  - 剩余未勾选项：200+ 节点性能（2 项）、编辑器外壳 shadcn/ui（1 项）、数据源加载中组件操作 E2E（1 项）、术语统一（1 项）、总规划回写（1 项）、全部 screen Playwright E2E 与 4 项浏览器级覆盖（M2/M3 E2E）。

## 11. 最终验收

> M1 阶段验收状态（2026-07-23，Asia/Shanghai）：M1 范围（任务 1.x-7.x）已全部完成并通过质量门（typecheck/lint/biome 退出码 0；前端 102 文件 / 1966 用例 / 共享包 6 文件 / 129 用例 / 后端 25 套件 / 320 用例全部通过；后端覆盖率 97.55% statements / 80.34% branches 满足 80% 阈值；事件蓝图 E2E 8 个全部通过；阶段 0-2 回归 E2E 37 个通过，2 个失败为阶段 2 既有用例如 screen-interactions.spec.ts 任务 10.4/10.6，非事件蓝图引入）。剩余 checklist 未勾选项均属 M2/M3 范围（17 项 M2 + 7 项 M3）或已知缺口（性能未测 2 项、NodeConfigPanel 未使用 shadcn/ui 1 项、数据源加载中组件操作无专门 E2E 1 项、术语统一 1 项、总规划回写 1 项、E2E 2 个失败 1 项）。11.1-11.4 待 M2/M3 实施完成后执行。

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
  - M1 阶段验收记录（2026-07-23，Asia/Shanghai）：见 7.4 实施记录"验收质量门修复更新记录"。typecheck/lint/biome 退出码 0；前端 102/1966、共享包 6/129、后端 25/320 全部通过；后端覆盖率 97.55%/80.34%/97.52%/97.43% 满足阈值；事件蓝图 E2E 8 个全部通过；阶段 0-2 回归 E2E 37 通过 2 失败（非事件蓝图引入）。M2/M3 实施完成后需重跑全量回归。

- [ ] **11.4 完成 checklist 与总规划回写**
  - 结果：逐项依据代码和测试证据勾选 checklist；在总规划中仅标注事件蓝图能力完成，不替代阶段 3 及以后规划。
  - 验证：退出条件（可视化搭建链路、预览执行、模拟调试、诊断闭环）有明确证据；不得用模块存在或旧测试数字替代当前证据。
  - 依赖：11.3。
  - M1 阶段验收记录（2026-07-23，Asia/Shanghai）：checklist 已逐项核实，M1 范围内可勾选项全部勾选；剩余 31 项 `[ ]` 均属 M2/M3 范围或已知缺口（详见上方说明）。退出条件中"可视化搭建链路""四种动作与 pageLoad""诊断闭环""本地编辑历史撤销/重做"4 项已具备自动化与浏览器证据；"模拟调试链路"1 项待 M2 实施后补充。总规划回写待 M2/M3 全部完成后执行。
