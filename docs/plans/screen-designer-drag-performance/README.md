# 大屏设计器拖拽卡顿优化计划

> 状态：生效中 ｜ 最近更新：2026-07-29（2026-07-29 对照代码核对补勾：P0/P1 与 3.1 已落地，见文件末尾说明）
> 范围：`apps/web/src/features/screen/`（编辑器外壳 + 画布）
> 类型：性能优化执行计划

## 1. 背景与问题

画布（`ScreenCanvas`）的组件拖拽在独立使用时很流畅，但集成在大屏设计器（`ScreenEditor` 外壳：工具栏 / 左右面板 / 状态栏 / 标尺 / 上下文菜单）中后出现卡顿。

**用户反馈的最明显卡顿点**：选中 / 取消选中组件时（点击切换选中、框选结束、点击空白取消选中），而非拖拽移动过程中。

经代码走查确认两类问题：
- **A. 选中/取消选中卡顿（用户最敏感）**：`flushSync` 同步冲刷把昂贵面板的渲染强行塞进点击那一帧
- **B. 拖拽每帧外壳渲染（次要）**：拖拽路径本身（onDrag → DOM style 直写）已高度优化，但外壳对高频状态的订阅仍有放大

## 2. 根因分析

### 2.1 选中/取消选中卡顿（问题 A，主战场）

**点击组件选中的数据流**（[screen-canvas.tsx Selecto.onDragStart](../../../apps/web/src/features/screen/components/screen-canvas.tsx#L1969-L1973) / [onSelectEnd](../../../apps/web/src/features/screen/components/screen-canvas.tsx#L2096-L2099)）：

```
用户点击组件
  → flushSync(() => { selectComponents(ids); setTargets(...) })  ← 同步冲刷
  → moveableRef.current.dragStart(mouseEvt)
```

`flushSync` 的本意是让 Moveable 控制框立即显示（避免抽帧），但它会**强制同步渲染所有 store 订阅者**，把两个昂贵面板的渲染塞进点击那一帧：

| # | 根因 | 渲染开销 | 证据 |
| --- | --- | --- | --- |
| **S1** | **PropertyPanel 同步重建 Schema 表单**：订阅 `selectedComponentIds`（无 defer），选中变化即重建 `PropertySchemaRenderer` 整套字段表单。`flushSync` 让它在点击帧同步执行 | 高（表单字段数 × 组件 schema） | [property-panel.tsx#L175](../../../apps/web/src/features/screen/components/property-panel.tsx#L175)、[L218-L225](../../../apps/web/src/features/screen/components/property-panel.tsx#L218-L225) |
| **S2** | **LayerPanel 同步重建图层树**：订阅 `selectedComponentIds`（无 defer）+ 整个 `s.project`，选中变化即重建整棵图层树（含排序、分组嵌套、选中态高亮） | 高（随组件数线性增长） | [layer-panel.tsx#L285-L286](../../../apps/web/src/features/screen/components/layer-panel.tsx#L285-L286) |
| S3 | **ScreenCanvas 同步重渲染**：订阅 `selectedComponentIds`，重算 `selectedIdSet`/`elementGuidelines`/`handlers` 等 useMemo。本身开销中等，但被 `flushSync` 拉进同步帧 | 中 | [screen-canvas.tsx#L382](../../../apps/web/src/features/screen/components/screen-canvas.tsx#L382) |
| S4 | **`useEditorSession` 未 memo + 左右面板未 memo**：选中触发 `dispatchInteraction('pointer-down'/'pointer-up')` → ScreenEditor 重渲染 → session 引用变 → 所有 session 消费方 memo 失效 → 面板整树重渲染（放大 S1/S2） | 放大效应 | [use-editor-session.ts#L193-L214](../../../apps/web/src/features/screen/hooks/use-editor-session.ts#L193-L214)、[editor-left-panel.tsx#L18](../../../apps/web/src/features/screen/components/editor-left-panel.tsx#L18)、[editor-right-panel.tsx#L13](../../../apps/web/src/features/screen/components/editor-right-panel.tsx#L13) |

**关键洞察**：`flushSync` 不能直接移除（移除后控制框会抽帧，[screen-canvas.tsx#L506-L517](../../../apps/web/src/features/screen/components/screen-canvas.tsx#L506-L517) 注释已说明），但可以让昂贵面板**不参与同步冲刷**——用 `useDeferredValue` 把它们对 `selectedComponentIds` 的响应降级为 transition。这正是 [CanvasStatusBar 已有的模式](../../../apps/web/src/features/screen/components/canvas-status-bar.tsx#L98-L103)，但 PropertyPanel / LayerPanel 没跟上。

### 2.2 拖拽每帧外壳渲染（问题 B，次要）

Moveable `onDrag` 每帧执行（[screen-canvas.tsx](../../../apps/web/src/features/screen/components/screen-canvas.tsx#L1282-L1313)）：

- DOM style 直写（同步，便宜）——独立画布也流畅的关键
- rAF 节流后调用 `setDimension` 写入 `useDimensionStore`（**每帧一次**）

`useDimensionStore` 定义在 [screen-canvas.tsx](../../../apps/web/src/features/screen/components/screen-canvas.tsx#L189-L195)，全应用唯一订阅者是状态栏 [canvas-status-bar.tsx](../../../apps/web/src/features/screen/components/canvas-status-bar.tsx#L114)（`s.dimension` 整体订阅）。

| # | 根因 | 触发时机 | 证据 |
| --- | --- | --- | --- |
| R1 | **CanvasStatusBar 每帧重渲染**：订阅整个 `dimension` 对象，渲染树含 `TooltipProvider`、3 个 Radix `Tooltip`、Radix `DropdownMenu`。独立画布无此组件 | 拖拽中每帧 | [canvas-status-bar.tsx#L114](../../../apps/web/src/features/screen/components/canvas-status-bar.tsx#L114)、[L125-L213](../../../apps/web/src/features/screen/components/canvas-status-bar.tsx#L125-L213) |
| R2 | **Moveable `flushSync` 放大效应**：传入 `flushSync` prop 后，react-moveable 每个事件同步冲刷 React root 的 pending 更新，rAF 里排队的状态栏更新被同步冲进当前帧，阻塞主线程 | 拖拽中每帧 | [moveable-container.tsx#L136](../../../apps/web/src/features/screen/components/moveable-container.tsx#L136) |
| R3 | **拖拽结束 `updateComponent` → project 新引用 → 外壳级重渲染**：ScreenEditor 订阅整个 `s.project`；LayerPanel 订阅整个 `s.project`；EditorToolbar 订阅 `isDirty`/`canUndo`/`canRedo`；PropertyPanel 订阅 `components` → 松手瞬间一次性大范围渲染（图层面板重建树、属性面板重建 schema 表单）→ 松手掉帧 | 拖拽结束一次 | [screen-editor.tsx#L48](../../../apps/web/src/features/screen/components/screen-editor.tsx#L48)、[layer-panel.tsx#L285](../../../apps/web/src/features/screen/components/layer-panel.tsx#L285)、[property-panel.tsx#L173-L175](../../../apps/web/src/features/screen/components/property-panel.tsx#L173-L175) |
| R4 | **平移路径同样问题**：`setCanvasScaleAndOffset` 每帧（rAF 节流）写入主 store，ScreenEditor 订阅 `canvasScale`/`canvasOffset` → 平移时整个外壳（含未 memo 面板 + 标尺）每帧重渲染 | 抓手平移中每帧 | [screen-canvas.tsx#L968-L970](../../../apps/web/src/features/screen/components/screen-canvas.tsx#L968-L970)、[screen-editor.tsx#L49-L50](../../../apps/web/src/features/screen/components/screen-editor.tsx#L49-L50) |
| R5 | **CanvasRulers 跟随每帧渲染**：scale/offset prop 每帧变化 → Ruler 重渲染 + `ruler.scroll()` | 平移中每帧 | [canvas-rulers.tsx#L82-L89](../../../apps/web/src/features/screen/components/canvas-rulers.tsx#L82-L89) |

### 2.3 已确认无问题的部分（不要重复优化）

- `onDrag` 内 DOM style 直写 + `composeComponentTransform`（[screen-canvas.tsx#L1288-L1303](../../../apps/web/src/features/screen/components/screen-canvas.tsx#L1288-L1303)）
- `CanvasComponentWrapper` memo + `visibleComponents`/`componentMap` useMemo
- `MoveableContainer` memo + `targets` 独立 store 订阅
- 历史栈浅拷贝 + 手势合并（`blueprintGesture`）——拖拽中间态不入栈

## 3. 优化目标

| 指标 | 现状 | 目标 | 测量方式 |
| --- | --- | --- | --- |
| **选中/取消选中到控制框出现的延迟** | 可感知卡顿 | < 50ms | Profiler / performance.mark |
| 选中同步帧内渲染的外壳组件数 | PropertyPanel + LayerPanel + ScreenCanvas 全部同步 | 仅 ScreenCanvas + MoveableContainer 同步；PropertyPanel / LayerPanel 走 transition | Profiler 录制点击选中 |
| 拖拽中编辑器外壳组件渲染次数 | 状态栏等每帧渲染 | **0 次/帧**（仅 Moveable + 尺寸指示器渲染） | React Profiler 录制拖拽 3s |
| 拖拽帧率 | 卡顿 | 稳定 ≥ 55fps | `requestAnimationFrame` 计数 |
| 松手卡顿（pointerup → 恢复交互） | 外壳级重渲染 | < 100ms | Profiler |

## 4. 执行任务

### 阶段 0：性能基线（先行，避免盲改）

- [ ] 0.1 **自动化渲染计数器**：用 Playwright 脚本进入编辑器页 → 模拟点击选中/取消选中/拖拽 → 通过 `<Profiler>` 包裹或注入渲染计数，输出各组件渲染次数。**避免依赖手动操作 React DevTools**
- [ ] 0.2 在画布容器加临时 `performance.mark`（选中开始/控制框出现/拖拽每帧/结束），记录基线延迟与帧率

### 阶段 1（P0）：消除选中/取消选中的同步冲刷（对应 S1/S2/S3/S4，用户最敏感）

- [x] 1.1 **PropertyPanel 对选中态降级**：`selectedComponentIds` 订阅结果用 `useDeferredValue` 包裹（与 [CanvasStatusBar 既有模式](../../../apps/web/src/features/screen/components/canvas-status-bar.tsx#L98-L103) 一致）。点击选中时 ScreenCanvas + MoveableContainer 同步渲染（控制框立即出现），PropertyPanel 的 Schema 表单重建走 transition，下一帧再提交
- [x] 1.2 **LayerPanel 对选中态降级**：同 1.1，`selectedComponentIds` 用 `useDeferredValue` 包裹。选中高亮滞后一帧（<50ms 不可感知），但点击响应立即返回
- [x] 1.3 **`useEditorSession` 返回值 `useMemo` 化**：依赖项为状态机字段与稳定回调，保证 ScreenEditor 重渲染时 session 引用稳定，memo 消费方不再失效（消除 S4 放大效应）
- [x] 1.4 **`EditorLeftPanel` / `EditorRightPanel` 加 `memo`**：两者不接收 props，memo 后 ScreenEditor 重渲染时完全跳过（含 ComponentLibrary / LayerPanel / PropertyPanel 子树）

### 阶段 2（P1）：消除拖拽中每帧的外壳渲染（对应 R1/R2）

- [x] 2.1 **尺寸指示器独立化**：从 CanvasStatusBar 拆出 `<DimensionIndicator />` 小组件，仅它订阅 `useDimensionStore`；状态栏其余部分（工具/开关/缩放）不再订阅 dimension。进一步：指示器内部用 `useEffect` + ref 直写 `textContent` 更新数值，**不走 React render**，彻底消除每帧 React 渲染
- [x] 2.2 **`CanvasStatusBar` 拆分 dimension 订阅**：拖拽期间状态栏主体不重渲染，仅尺寸数值通过 ref 直写更新

### 阶段 3（P2）：降低松手与平移的外壳渲染（对应 R3/R4/R5）

- [x] 3.1 **ScreenEditor 细粒度订阅**：移除 `s.project` 整对象订阅（[screen-editor.tsx#L48](../../../apps/web/src/features/screen/components/screen-editor.tsx#L48)）；`handleSave`/`handleExport`/`handlePublish`/`editingComponent` 等改用 `useScreenEditorStore.getState()` 读取；仅保留画布尺寸等真正驱动渲染的字段订阅
- [ ] 3.2 **LayerPanel 订阅细化**：`s.project` → 派生图层树所需的最小数据指纹（id/name/type/zIndex/hidden/locked/parentId），避免 props/style 变化也触发重建
- [ ] 3.3 **视口高频状态隔离**：平移手势期间 `canvasScale`/`canvasOffset` 写入独立高频 store（或 ref + 手势结束写回主 store），ScreenEditor 不再每帧重渲染
- [ ] 3.4 **CanvasRulers 命令式同步**：rAF 回调中调用 `rulersRef.current?.syncScroll()`（Handle 已存在），标尺脱离 React 每帧渲染链

### 阶段 4：防回归

- [ ] 4.1 E2E 性能用例（Playwright）：脚本化选中/拖拽，断言选中同步帧内 PropertyPanel/LayerPanel 不渲染、拖拽期间 CanvasStatusBar/EditorToolbar 渲染次数为 0
- [ ] 4.2 更新 [development-guide.md](../../architecture/development-guide.md) 的"性能红线"小节：① 高频状态（每帧）禁止进入主 editor-store 与外壳组件订阅；② `flushSync` 调用方的所有兄弟订阅者必须 `useDeferredValue` 降级

## 5. 风险与回归点

| 风险 | 缓解 |
| --- | --- |
| 1.1 中 textContent 直写绕过 React，可能与状态栏其他显示态不同步 | 保留 `visible` 切换走 React（低频），仅数值直写；参考 `raf-throttle.ts` 的 DOM 直写契约注释 |
| 2.1 移除 `s.project` 订阅后，`handleSave` 等闭包读到旧 project | 统一改 `useScreenEditorStore.getState().project` 即时读取；相关回调已多用此模式（[screen-editor.tsx#L384](../../../apps/web/src/features/screen/components/screen-editor.tsx#L384)） |
| 2.2/2.3 deferred 后面板数值滞后一帧 | 与状态栏既有 `useDeferredValue` 模式一致（[canvas-status-bar.tsx#L98-L103](../../../apps/web/src/features/screen/components/canvas-status-bar.tsx#L98-L103)），<50ms 不可感知 |
| 3.1 视口状态拆分影响缩放工具/适应屏幕等现有调用方 | `setCanvasScaleAndOffset` 保持对外 API 不变，仅内部路由到手势态 |

## 6. 验收标准

1. React Profiler 录制拖拽：除 `MoveableContainer`、`DimensionIndicator` 外，编辑器外壳组件渲染次数为 0
2. 拖拽帧率稳定 ≥ 55fps（1920×1080 画布、50+ 组件场景）
3. `pnpm typecheck`、`pnpm lint`、`pnpm --filter @nebula/web test` 全绿
4. 现有 E2E（`pnpm --filter @nebula/web e2e`）无回归

---

> 2026-07-29 核对说明：对照代码库批量补勾——1.1/1.2 依据 `property-panel.tsx` 与 `layer-panel.tsx` 中 `selectedComponentIds` 的 `useDeferredValue` 包裹；1.3 依据 `use-editor-session.ts` 返回值 `useMemo` 化；1.4 依据 `editor-left-panel.tsx` / `editor-right-panel.tsx` 的 `memo`；2.1/2.2 依据 `canvas-status-bar.tsx` 中独立的 `DimensionIndicator`（ref 直写 `textContent`，主体不再订阅 dimension）；3.1 依据 `screen-editor.tsx` 已移除 `s.project` 整对象订阅、回调改用 `useScreenEditorStore.getState()`。未勾选项经核实仍未落地：3.2（`layer-panel.tsx` 仍整订阅 `s.project`）、3.3（无独立视口高频 store，`ScreenEditor` 仍订阅 `canvasScale`/`canvasOffset`）、3.4（`CanvasRulers` 仍随 scale/offset prop 每帧重渲染）、0.x 与 4.x（无性能基线与 E2E 防回归用例，`development-guide.md` 无「性能红线」小节）。
