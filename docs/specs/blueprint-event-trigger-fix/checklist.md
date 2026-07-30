# Checklist

## 阶段 1：扩展组件渲染接口

- [x] `RendererComponentProps` 接口包含 `componentId: string` 字段
- [x] `ComponentRenderer` 从 `component.id` 取值传给 `<Renderer componentId={...} />`
- [x] `PreviewComponentRenderer` 透传 `component.id` 给 `ComponentRenderer`
- [x] `screen-canvas.tsx` 的 `CanvasComponentWrapper` 透传 `component.id`（编辑器画布接口一致）
- [x] `BarChartComponent` 入参解构 `componentId`（仅类型声明）
- [x] `pnpm --filter @nebula/web typecheck` 通过

## 阶段 2：图表组件派发 dataLoaded / dataError 事件

- [x] `bar-chart-component.tsx` 调用 `useComponentEvent()` 读取事件回调
- [x] `useEffect` 监听 `apiState.status === 'success'` 时派发 `(componentId, 'dataLoaded')`
- [x] `useEffect` 监听 `apiState.status === 'error'` 时派发 `(componentId, 'dataError')`
- [x] `useEffect` 监听 `datasetState.status === 'success'` 时派发 `(componentId, 'dataLoaded')`
- [x] `useEffect` 监听 `datasetState.status === 'error'` 时派发 `(componentId, 'dataError')`
- [x] `apiRawDataOverride !== undefined` 时不派发（避免双重触发）
- [x] 编辑器画布 Event 关闭时，稳定事件回调由运行时总闸门丢弃
- [x] deps 数组包含 `componentId`、`apiState.status`、`datasetState.status`
- [x] 测试用例：API success 触发 dataLoaded
- [x] 测试用例：API error 触发 dataError
- [x] 测试用例：dataset success 触发 dataLoaded
- [x] 测试用例：dataset error 触发 dataError
- [x] 测试用例：编辑态不触发事件
- [x] `pnpm --filter @nebula/web exec vitest run src/features/screen/registry/components/bar-chart-component.test.tsx` 通过

## 阶段 3：V1/V2 interval 触发器调度

- [x] `use-blueprint-preview-runtime.ts` 新增 `useEffect` 管理 interval 调度
- [x] 按蓝图版本分别调度 V1/V2 interval 规则
- [x] 遍历规则过滤 V1 `triggerConfig.type === 'interval'` / V2 `triggerEventId === 'interval'`
- [x] 按 `triggerConfig.intervalMs` 建立 `setInterval`
- [x] tick 回调只执行所属规则，避免不同周期规则交叉触发
- [x] tick 错误捕获并 `console.warn`
- [x] cleanup 函数清理所有 `setInterval`
- [x] 规则集变化时自动清理重建
- [x] `isEnabled === false` 时不建立任何定时器
- [x] 测试用例：interval 触发器按 intervalMs 触发动作
- [x] 测试用例：组件卸载后定时器清理
- [x] 测试用例：V1/V2 多 interval 规则按各自周期隔离执行
- [x] `pnpm --filter @nebula/web exec vitest run src/features/screen/blueprint/runtime/use-blueprint-preview-runtime.test.tsx` 通过

## 阶段 4：最终验证

- [x] `pnpm --filter @nebula/web typecheck` 通过
- [x] `pnpm --filter @nebula/web lint` 通过
- [x] `pnpm biome:check` 通过
- [x] `pnpm --filter @nebula/web exec vitest run src/features/screen` 全部通过（107 文件，2286 passed，14 skipped）
- [ ] 手动验证：click 事件链路无回归（需用户在浏览器中手动验证）
- [ ] 手动验证：dataLoaded 事件能触发动作（需用户在浏览器中手动验证）
- [ ] 手动验证：dataError 事件能触发动作（需用户在浏览器中手动验证）
- [ ] 手动验证：interval 触发器按配置间隔触发动作（需用户在浏览器中手动验证）
- [ ] 手动验证：编辑器画布 Event 关闭时不触发，开启时完整运行蓝图（需用户在浏览器中手动验证）
