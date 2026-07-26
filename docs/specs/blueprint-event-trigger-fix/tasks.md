# Tasks

## 阶段 1：扩展组件渲染接口，让组件能获取自身 componentId

- [x] Task 1: 扩展 `RendererComponentProps` 接口
  - [x] 在 `apps/web/src/features/screen/registry/renderer.tsx` 的 `RendererComponentProps` 接口新增 `componentId: string` 字段
  - [x] 在 `ComponentRenderer` 函数组件中从 `component.id` 取值，传给 `<Renderer componentId={component.id} ... />`
  - [x] 在 `PreviewComponentRenderer` 中透传 `component.id` 给 `ComponentRenderer`
  - [x] 在 `screen-canvas.tsx` 的 `CanvasComponentWrapper` 中（如有 `ComponentRenderer` 直接调用）保持透传 `component.id`，确保编辑器画布接口一致
- [x] Task 2: 更新现有组件 renderer 签名（不强制消费）
  - [x] `bar-chart-component.tsx`：在 `BarChartComponent` 入参解构 `componentId`（仅类型声明，不强制使用）
  - [x] 其他 5 个组件（text / rect / ellipse / image / button）保留既有入参，新增的 `componentId` 通过 `RendererComponentProps` 类型自动可选传递（不显式解构也可）
  - [x] 运行 `pnpm --filter @nebula/web typecheck` 确保类型一致

## 阶段 2：图表组件派发 dataLoaded / dataError 事件

- [x] Task 3: 在 `bar-chart-component.tsx` 派发数据源事件
  - [x] 通过 `useComponentEvent()` 读取事件回调（编辑态返回 null，自动短路）
  - [x] 使用 `useEffect` 监听 `apiState.status` 变化：`success` → 派发 `dataLoaded`；`error` → 派发 `dataError`
  - [x] 使用 `useEffect` 监听 `datasetState.status` 变化：同上
  - [x] 仅在 `apiRawDataOverride === undefined` 时派发（避免 override 与 hook state 双重触发）
  - [x] 仅在事件回调非 null 时派发（编辑态短路）
  - [x] 在 deps 数组中包含 `componentId`、`apiState.status`、`datasetState.status`，避免闭包过期
- [x] Task 4: 编写测试验证事件派发
  - [x] 在 `bar-chart-component.test.tsx` 中新增测试用例
  - [x] mock `useComponentEvent` 返回一个 spy 函数
  - [x] 验证 API 状态变为 success 时调用 spy with `(componentId, 'dataLoaded')`
  - [x] 验证 API 状态变为 error 时调用 spy with `(componentId, 'dataError')`
  - [x] 验证编辑态（`useComponentEvent` 返回 null）不调用 spy
  - [x] 运行 `pnpm --filter @nebula/web exec vitest run src/features/screen/registry/components/bar-chart-component.test.tsx`

## 阶段 3：V1 蓝图 interval 触发器调度

- [x] Task 5: 在 `use-blueprint-preview-runtime.ts` 实现 interval 调度
  - [x] 新增 `useEffect`，依赖 `v1CompiledRules` 与 `isEnabled`
  - [x] 仅在 `v1CompiledRules.length > 0` 且 `v2CompiledRules.length === 0` 时启用（V2 不支持 interval）
  - [x] 遍历 `v1CompiledRules` 过滤 `triggerConfig.type === 'interval'`，按 `intervalMs` 建立 `setInterval`
  - [x] tick 回调调用 `triggerAndExecute(v1RulesRef.current, { kind: 'interval' }, depsRef.current)`，捕获错误并 console.warn
  - [x] cleanup 函数清理所有 `setInterval`
  - [x] 规则集变化时（依赖变化）自动清理重建
- [x] Task 6: 编写测试验证 interval 调度
  - [x] 在 `use-blueprint-preview-runtime.test.tsx` 中新增测试用例
  - [x] 构造一个 V1 蓝图，含 `intervalMs: 100` 的 interval 触发器与一个 `setVisibility` 动作
  - [x] 使用 `vi.useFakeTimers()` 推进 100ms，验证 `applyVisibility` 被调用
  - [x] 验证组件卸载后 `setInterval` 被清理（推进时间不再触发）
  - [x] 验证 V2 蓝图不建立 interval 调度（V2 不支持）
  - [x] 运行 `pnpm --filter @nebula/web exec vitest run src/features/screen/blueprint/runtime/use-blueprint-preview-runtime.test.tsx`

## 阶段 4：最终验证

- [x] Task 7: 全量质量门验证
  - [x] 运行 `pnpm --filter @nebula/web typecheck` 通过
  - [x] 运行 `pnpm --filter @nebula/web lint` 通过
  - [x] 运行 `pnpm biome:check` 通过
  - [x] 运行 `pnpm --filter @nebula/web exec vitest run src/features/screen` 全部通过（107 文件，2286 passed，14 skipped）
  - [ ] 手动验证：预览页中点击柱状图组件 → 触发 click 事件 → 控制目标组件显隐（验证既有 click 链路无回归）
  - [ ] 手动验证：预览页中柱状图 API 数据源加载完成 → 触发 dataLoaded 事件 → 控制目标组件显隐
  - [ ] 手动验证：预览页中柱状图 API 数据源加载失败 → 触发 dataError 事件 → 控制目标组件显隐
  - [ ] 手动验证：预览页中 V1 蓝图配置 interval=1s 触发器 → 每秒触发动作

# Task Dependencies

- Task 2 依赖 Task 1（组件需先接收 componentId 才能消费）
- Task 3 依赖 Task 1（需要 componentId 派发事件）
- Task 4 依赖 Task 3（测试需在派发逻辑实现后）
- Task 5 与 Task 1-4 解耦（interval 调度不依赖组件层改动）
- Task 6 依赖 Task 5
- Task 7 依赖所有其他 Task 完成
