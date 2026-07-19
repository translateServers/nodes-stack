# 阶段 2 实施基线（任务 0.0-0.3）

> 记录日期：2026-07-19
>
> **重要说明**：阶段 2 的 1.x（Schema 契约）、2.x（数据解析器）、8.x（画布历史栈）已先行落地，
> 本基线是在这些任务**之后**补做的，记录的是"当前时点"状态，而非阶段 2 实施前的原始状态。
> 凡涉及 1.x/2.x/8.x 已改变的事实，均按当前磁盘代码如实记录并注明。

## 0.0 核对阶段 1 进入门禁

**结论：阶段 1 已验收，进入门禁有效，允许阶段 2 继续。**

证据：

| 检查项 | 结果 | 证据位置 |
| --- | --- | --- |
| checklist 全部勾选 | 是。全部实施条目为 `[x]`；仅"吸管工具"一节与 11.5 吸管 E2E 为 `[~]`（2026-07-19 决策移出阶段 1 范围，保留作历史记录） | `.trae/specs/close-single-user-interactions/checklist.md` |
| 验证记录存在 | 是。checklist.md 顶部引用块含 2026-07-19 重新验收记录：biome 全部通过；typecheck 仅剩基线 `http.test.ts` 3 个预存错误；前端 screen 单测 31 文件 875 用例通过；screen Playwright E2E 27 用例通过（2 个椭圆/创建后选中测试过期） | 同上，第 5-8 行 |
| 阶段 1 实施基线可追溯 | 是。阶段 1 目录内存有 `baseline-before.md`（含测试基线数字与 §13 交互 E2E 稳定定位契约） | `.trae/specs/close-single-user-interactions/baseline-before.md` |
| 关键回归当前有效性 | 已按当前时点重跑，见本文 §0.2：前端 779 用例、后端 43 用例全部通过；E2E 的 2 个过期失败与验收记录一致，另有 3 个失败项已记录摘要待主线甄别 | 本文 §0.2 |

## 0.1 数据链路代码基线（当前时点）

> 以下结论均引用当前磁盘文件与代码位置。因 1.x/2.x/8.x 已落地，与"阶段 2 实施前"的差异逐条注明。

### 1. bar-chart renderer 仍 `props.data` 直塞

- 文件：`apps/web/src/features/screen/registry/components/bar-chart-component.tsx`
  - 第 12 行：`const data = (props.data as DataItem[]) ?? [];` —— 渲染数据直接取自 `props.data`。
  - 第 15-21 行：仅有的空态：`data.length === 0` 时展示"暂无数据"。
  - 手写 SVG 实现（第 28-73 行），无第三方图表库。
- 渲染入口：`apps/web/src/features/screen/registry/renderer.tsx` 第 42 行
  `<Renderer props={component.props} style={component.style} />` —— renderer 只接收
  `props` 与 `style` 两个字段，组件的 `dataSource` / `logic` / `interaction` 不进入渲染链路。

### 2. `dataSource` 字段未被前端消费

- 1.x 已落地：`packages/shared/src/schemas/screen.schema.ts` 第 150-152 行，
  `ScreenComponentSchema` 已挂载 `dataSource` / `logic` / `interaction` 可选字段
  （另有 `DataSourceConfigSchema` 第 84-96 行、`LogicConfigSchema` 第 103-108 行、
  `InteractionConfigSchema` 第 112-115 行、`isSensitiveHeaderKey` 第 139-141 行）。
- 但前端渲染链路无人消费：在 `apps/web/src/features/screen` 全目录（排除测试）检索
  `dataSource`，仅命中 `lib/chart-data-parser.ts` 自身的参数定义；renderer、editor-store、
  property-panel、screen-preview 均无引用。

### 3. `updateCanvas` 已入历史栈（8.x 已完成的现状）

- 文件：`apps/web/src/features/screen/stores/editor-store.ts`
  - 第 366-384 行 `updateCanvas`：先按字段对比，无实际变化直接 return（第 371-374 行，
    不入栈不置脏）；有变化经 `withHistory(set, 'updateCanvas', ...)` 入栈（第 375 行）。
  - 第 215-231 行 `pushHistory`：历史条目同时快照 `components` 与 `canvas`
    （8.1 已完成的组件 + 画布双快照结构），`HISTORY_LIMIT` 容量限制不变。
  - 第 251-258 行 `withHistory`：入栈 + 应用更新 + 置 `isDirty=true` 的统一封装。

### 4. 属性面板 `props.data` JSON textarea 现状

- 文件：`apps/web/src/features/screen/components/property-panel.tsx` 第 243-259 行。
- "数据"行为裸 `textarea`：`value={JSON.stringify(props.data ?? [], null, 2)}`，
  `onChange` 内 `JSON.parse` 成功后直写 `props.data`；非法 JSON 在 `catch` 中静默忽略
  （第 254-256 行注释 "ignore invalid JSON during editing"），无 Schema 校验、无错误反馈。
- 该 textarea 即 4.2 任务要替代的对象。

### 5. 数据解析器已存在但未被渲染链路消费（2.x 已完成的现状）

- 文件：`apps/web/src/features/screen/lib/chart-data-parser.ts`
  - 已导出 `parseChartData`（统一入口，第 238-291 行）、`extractDataByPath`（第 102 行）、
    `mapFieldsToChartData`（第 142 行）、`applyLogicConfig`（第 201 行），及
    `ParseResult = ParseSuccess | ParseEmpty | ParseError` 判别联合（第 33-50 行）。
  - 消费方仅为其自身测试 `chart-data-parser.test.ts`；渲染链路（renderer / preview /
    store / panel）均未 import。

### 6. 无加载 / 错误 / 空三态机制

- `apps/web/src/features/screen/registry` 全目录无 `loading` / `error` 状态代码。
- 渲染链路无任何数据请求：`apps/web/src/features/screen` 内（排除测试）唯一的请求相关
  调用是 `screen-editor.tsx` 第 251 行 `refetch()`（项目级 react-query 重取，与组件
  数据源无关）；无 `fetch(` / `axios` 用于组件数据加载。
- 现状只有 renderer 内"暂无数据"单一空态（见第 1 条），无加载态、无结构化错误态。

## 0.2 测试基线

> 执行日期均为 2026-07-19，工作目录 `c:\worker\nebula`（Windows + PowerShell）。
>
> 环境偏差说明：
> - pnpm 在 PowerShell 下无法通过 `--` 把参数转发给脚本（pnpm 自身报 Unknown option），
>   前后端定向测试改用等效的 `pnpm --filter <pkg> exec <runner> ...` 形式。
> - Jest 30 已将 `--testPathPattern` 更名为 `--testPathPatterns`，旧参数直接报错退出。

### 1. 前端 screen 定向测试

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm --filter @nebula/web exec vitest run src/features/screen` |
| 日期 | 2026-07-19 |
| 退出码 | 0 |
| 文件数 | 33 passed (33) |
| 用例数 | 779 passed (779)，失败 0，跳过 0 |
| 耗时 | 42.24s |

### 2. 后端 screen 定向测试

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm --filter @nebula/nestjs-server exec jest --testPathPatterns=screen` |
| 日期 | 2026-07-19 |
| 退出码 | 0 |
| 套件数 | 2 passed (2) |
| 用例数 | 43 passed (43)，失败 0，跳过 0 |
| 耗时 | 9.5s |

### 3. typecheck

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm typecheck` |
| 日期 | 2026-07-19 |
| 退出码 | 2（turbo 汇总失败） |
| 结果 | `@nebula/shared` / `@nebula/nestjs-server` / eslint-config 等通过；`@nebula/web` 失败 |
| 失败摘要（3 个，均为 pre-existing） | `apps/web/src/api/core/http.test.ts(201,9)` `Cannot find name 'fail'`；`(286,20)` `Property 'mockResolvedValue' does not exist on type 'MockInstance'`；`(399,9)` `Cannot find name 'fail'`。与阶段 2 无关，阶段 1 验收记录中即为基线预存错误 |

### 4. lint

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm lint` |
| 日期 | 2026-07-19 |
| 退出码 | 1（turbo 汇总失败） |
| 结果 | `@nebula/web` 通过；`@nebula/nestjs-server` 7 errors / 0 warnings |
| 失败摘要 | `src/common/interceptors/transform.interceptor.spec.ts:5` `@typescript-eslint/no-unused-vars`（'Observable'）×1；`src/modules/file/file.controller.spec.ts:78` `@typescript-eslint/unbound-method` ×1；`src/modules/file/file.service.spec.ts:107/111/137/155/156` `@typescript-eslint/no-unsafe-member-access` / `no-unsafe-assignment` ×5。均为 pre-existing，与 screen 及阶段 2 无关 |

### 5. Biome

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm biome:check` |
| 日期 | 2026-07-19 |
| 退出码 | 1 |
| 结果 | Checked 418 files，Found 2 errors |
| 失败摘要 | `apps/web/src/features/screen/lib/chart-data-parser.ts` 与 `chart-data-parser.test.ts` 存在 formatter 可自动修复的格式差异（2.x 落地时遗留，非规则冲突） |

### 6. screen Playwright E2E（可选项，已执行）

| 项 | 首次全量 | `--last-failed` 重跑 |
| --- | --- | --- |
| 命令 | `pnpm exec playwright test --config=e2e/playwright.config.ts screen-`（cwd `apps/web`，dev server 由 playwright.config.ts `webServer` 自动拉起，启动顺利） | 同左加 `--last-failed` |
| 日期 | 2026-07-19 | 2026-07-19 |
| 退出码 | 1 | 1 |
| 用例数 | 共 29：24 passed / 5 failed / 0 skipped | 5 中 1 passed / 4 failed |
| 耗时 | 45.8s | 20.8s |

失败项摘要（重跑后仍失败的 4 条）：

| 用例 | 摘要 | 定性 |
| --- | --- | --- |
| `screen-tool-shape.spec.ts:246` 椭圆工具拖拽创建 | 创建后选中断言失败（"未选中"） | 阶段 1 验收记录已注明的 2 个过期失败之一 |
| `screen-tool-shape.spec.ts:339` 创建期间不出现框选或 Moveable 冲突 | selection-info 期望"已选中 1 个矩形"实际"未选中" | 同上（椭圆/创建后选中相关过期） |
| `screen-conflict.spec.ts:97` 双客户端保存冲突 | 期望 HTTP 409 实际收到 429（Throttler 限流干扰） | 环境性失败，待主线甄别；阶段 1 基线曾记录该用例并行 worker 下 flaky |
| `screen-save-publish.spec.ts:12` 保存已发布项目后匿名预览不可用 | `getByText('大屏项目不存在或未发布')` 5000ms 未出现 | 待主线甄别；阶段 1 基线曾记录该用例并行 worker 下 flaky |

重跑恢复的 1 条：`screen-interactions.spec.ts:991` 图层拖拽排序（并行时序 flaky，重跑通过）。

## 0.3 数据源 E2E 定位与 API Mock 契约

> 沿用阶段 1 `baseline-before.md` §13 的定位风格：优先角色（role）、可访问名称（name）、
> 既有语义属性（`data-testid` / `[data-component-id]` / `aria-label`）；禁止依赖 Tailwind
> 工具类、Moveable/Selecto 内部类名、`nth-child`、硬编码组件 ID。
>
> Mock helper 骨架已落地：`apps/web/e2e/helpers/api-mock.helper.ts`（仅 helper 与类型，
> 不含测试用例）。

### 1. 可直接复用的既有稳定定位

| 目标 | 定位方式 | 来源 |
| --- | --- | --- |
| 画布表面 | `getByTestId('canvas-surface')` | screen-canvas.tsx |
| 组件容器 | `locator('[data-component-id="..."]')` | screen-canvas.tsx |
| 保存 / 发布按钮 | `getByRole('button', { name: '保存' / '发布' })` | screen-editor.tsx |
| 状态栏选中信息 | `getByTestId('canvas-status-bar').getByTestId('selection-info')` | canvas-status-bar.tsx |
| 冲突对话框 | `getByRole('alertdialog')` | save-conflict-dialog.tsx |
| 图层行 | `getByTestId('layer-row')` | layer-panel.tsx |
| 画布设置分组 | 属性面板"画布设置"分组（宽度/高度 NumberInput、背景 ColorInput、缩放 Select，可访问名称分别为 `宽度`/`高度`/`背景`/`缩放`） | property-panel.tsx:264-315 |

### 2. 阶段 2 待新增的约定定位（实现任务落地时按此命名，E2E 先行约定）

| 目标 | 定位策略 |
| --- | --- |
| 数据层分组容器 | `data-testid="datasource-section"`（4.1 四层分组骨架落地时添加） |
| 数据源类型切换 | `getByRole('radio', { name: '静态数据' / 'API' })`；若用 Radix Tabs 则 `getByRole('tab', ...)` |
| 静态数据编辑区 | `data-testid="static-data-editor"`，提交按钮 `getByRole('button', { name: '应用' })` |
| 校验错误提示 | `getByRole('alert')` 或 `data-testid="datasource-error"`，断言可读文案 |
| 字段映射下拉 | Radix Select：`getByRole('combobox', { name: '维度字段' / '数值字段' })`；选项 `getByRole('option', { name })` |
| API URL 输入 | `getByRole('textbox', { name: '请求地址' })`（或 label 为 `URL`） |
| 请求头 / 查询参数编辑 | `data-testid="api-headers-editor"` / `data-testid="api-params-editor"` |
| 刷新间隔 | `getByRole('spinbutton', { name: '刷新间隔' })` |
| 请求测试按钮 | `getByRole('button', { name: '请求测试' })` |
| 响应预览 | `data-testid="response-preview"`（含状态码与截断响应） |
| 加载态 | `data-testid="chart-loading"` |
| 错误态 | `data-testid="chart-error"`，断言可读错误文案而非原始响应全文 |
| 空数据态 | `data-testid="chart-empty"` |
| 逻辑层分组 | `data-testid="logic-section"`；排序字段/方向 `getByRole('combobox', { name: '排序字段' / '排序方向' })`；条数 `getByRole('spinbutton', { name: '条数限制' })` |
| 视觉层分组 | `data-testid="visual-section"`；标题 `getByRole('textbox', { name: '标题' })` |
| 交互层分组 | `data-testid="interaction-section"`；悬停提示 `getByRole('switch', { name: '悬停提示' })` |
| 画布设置区（8.x 已入历史） | `data-testid="canvas-settings-section"` 包裹现有分组；缩放 Select `getByRole('combobox', { name: '缩放' })` |

三态互斥约定：同一组件同一时刻 `chart-loading` / `chart-error` / `chart-empty` 至多一个可见；
断言时同时校验另外两者不可见。

### 3. API Mock 契约（`page.route` 拦截）

- 拦截目标：组件 `apiConfig.url` 指向的**外部数据接口**；默认 Mock 地址
  `DEFAULT_MOCK_API_URL = 'https://mock-data.nebula.e2e/chart'`（不存在的专用域名，
  必须全程被 route 拦截）。**禁止**拦截 Nebula 后端 `/api/v1/*`（项目数据走真实后端）。
- Mock 不依赖真实外部网络；每个用例独立创建/清理项目数据的约定不变（沿用
  `screen-api.helper.ts` 工厂）。
- helper：`apps/web/e2e/helpers/api-mock.helper.ts`，导出四个场景函数，均返回
  `ApiMockHandle`（`requestCount()` 供定时刷新计数断言，`dispose()` 解除拦截）：

```ts
// 成功：2xx + JSON（默认 [{ name, value }] 示例，可传嵌套结构验证数据路径）
const success = await mockApiSuccess(page, { body: { data: { list: [...] } } });

// 失败：HTTP 非 2xx（默认 500）或网络层中止（模拟网络/CORS）
await mockApiFailure(page, { status: 500 });
await mockApiFailure(page, { mode: 'network' });

// 慢响应：延迟 delayMs 后成功，用于断言加载态
await mockApiSlow(page, { delayMs: 2000 });

// 空数据：2xx + 空数组（或空嵌套结构），用于断言统一空态
await mockApiEmpty(page);
await mockApiEmpty(page, { body: { data: { list: [] } } });
```

- 定时刷新计数（10.3 使用）：`const mock = await mockApiSuccess(page)` 后对
  `mock.requestCount()` 做随时间增长的断言，离开页面后断言计数不再增长。
