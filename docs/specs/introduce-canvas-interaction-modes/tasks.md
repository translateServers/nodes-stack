# Tasks

> 方法：小步快跑。每个阶段形成可独立验证的用户价值；P0 完成后先验证"编辑不误触、交互可测试"，再进入运行时覆盖与体验完善。

## P0：建立明确的画布模式

- [x] Task 1: 将 Event 布尔状态迁移为画布交互模式
  - [x] 在编辑器状态中定义 `CanvasInteractionMode = 'design' | 'interactive'`
  - [x] 将 `eventsEnabled` / `toggleEvents` 替换为 `interactionMode` / `setInteractionMode`
  - [x] 默认模式固定为 `design`，加载新项目时回到 `design`
  - [x] 更新偏好持久化：只接受合法 `interactionMode`，旧 `eventsEnabled` 无论何值均安全迁移到 `design`
  - [x] 为默认值、合法值、旧偏好、损坏数据和项目切换补充 Store/偏好测试

- [x] Task 2: 将状态栏改为设计/交互模式控制
  - [x] 将 `Event` 文案替换为明确的"设计/交互"模式文案
  - [x] 为两种模式提供输入所有权说明 tooltip
  - [x] 保持 shadcn/ui 与现有状态栏视觉、键盘操作和可访问性规范
  - [x] 在交互调试模式下显示不遮挡画布内容的模式标识
  - [x] 补充状态栏模式显示、切换、`aria-*` 与 tooltip 测试

## P0：隔离编辑手势与业务交互

- [x] Task 3: 建立统一画布交互能力契约
  - [x] 新增画布交互 Context 或等价单一入口，提供 `mode`、`canEditCanvas`、`canDispatchNativeEvents`、`canDispatchBlueprintEvents`
  - [x] 设计模式能力固定为：可编辑、不可触发组件业务交互、不可派发蓝图事件
  - [x] 交互调试能力固定为：不可直接编辑、可触发组件业务交互、可派发蓝图事件
  - [x] 组件渲染层通过统一契约读取能力，不直接读取旧 Event 状态
  - [x] 为能力派生和 Provider 缺失时的安全默认值补充测试

- [x] Task 4: 在设计模式关闭组件业务交互
  - [x] 设计模式不为组件容器绑定业务 click 与 hover 回调
  - [x] 设计模式不向组件内部注入可用的蓝图事件派发回调
  - [x] 对按钮、柱状图 tooltip 等现有组件原生交互进行门控，设计模式下不产生业务行为
  - [x] 在统一蓝图事件派发入口增加最终模式校验，防止组件绕过 DOM 门控
  - [x] 补充设计模式点击只选中、不执行 click 蓝图，以及悬停不执行 hover/tooltip 的测试

- [x] Task 5: 在交互调试模式暂停冲突的画布编辑能力
  - [x] 交互调试时禁用 Moveable 的 draggable、resizable、rotatable
  - [x] 交互调试时禁用 Selecto 的点击选择与框选入口
  - [x] 交互调试时阻止创建工具和文本编辑手势启动，并清理进入模式前的瞬时交互状态
  - [x] 保留状态栏缩放、适应画布等无设计数据副作用的视口能力
  - [x] Escape 优先退出交互调试并返回设计模式
  - [x] 补充交互调试中点击可触发蓝图但不选中、拖拽不改位置、框选不启动、历史栈不变化的测试

## P1：完成交互调试运行时闭环

- [x] Task 6: 建立可重置的交互调试运行时会话
  - [x] 以模式进入为会话起点，使 pageLoad 每个会话只触发一次
  - [x] 保持 V1/V2 interval 在会话期间运行，并在退出时清理
  - [x] 为运行时提供明确的 reset/dispose 入口或等价生命周期机制
  - [x] 退出交互调试、切换项目、卸载编辑器时清空 `visibilityOverrides` 与 `apiDataOverrides`
  - [x] 退出时取消可取消的数据刷新请求，防止过期响应写回新会话
  - [x] 补充"开启->产生覆盖->关闭->再次开启"和项目切换的状态隔离测试

- [x] Task 7: 让编辑画布消费运行时覆盖
  - [x] 交互调试下按 `visibilityOverrides > component.status.hidden` 计算组件可见性
  - [x] 将 `apiDataOverrides` 透传给编辑画布中的组件渲染器
  - [x] 设计模式恢复仅由项目设计数据决定的渲染结果
  - [x] 确保运行时覆盖不调用项目更新 API、不进入历史栈、不改变 `isDirty`
  - [x] 补充 setVisibility 与 refreshDataSource 在交互调试中可见、退出后恢复的集成测试

## P2：预览一致性、体验与回归

- [x] Task 8: 固化完整预览边界并补齐回归测试
  - [x] 确认 `/screen-editor-preview/$id` 与 `/screen-preview/$id` 均使用完整蓝图运行时
  - [x] 确认两类预览不读取编辑器当前 `interactionMode`
  - [x] 补充编辑器预览 pageLoad、componentClick 与运行时覆盖的测试
  - [x] 补充公开预览既有 click、hover、pageLoad、interval 场景回归测试

- [ ] Task 9: 同步生效文档中的模式与运行时语义
  - [ ] 更新 `docs/specs/screen-editor/README.md`：画布交互模式、状态栏、编辑器预览语义和已知限制
  - [ ] 更新 `docs/architecture/screen-editor-architecture.md`：交互能力契约、输入所有权和运行时覆盖消费
  - [ ] 更新 `docs/architecture/blueprint-runtime-architecture.md`：编辑器交互调试、pageLoad/interval、会话清理与预览边界
  - [ ] 更新上述文档的"最近更新"日期，并同步 `docs/specs/README.md` 索引状态

- [x] Task 10: 执行质量门与手动验收
  - [x] 运行相关前端单元测试，覆盖 Store、状态栏、画布、运行时和预览
  - [x] 运行 `pnpm biome:check`（新增文件通过）
  - [x] 运行根目录 `pnpm typecheck`
  - [x] 运行根目录 `pnpm lint`
  - [ ] 按 checklist 完成浏览器手动验收，确认设计模式无误触、交互调试可用、退出后无状态泄漏

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1。
- Task 4 依赖 Task 3。
- Task 5 依赖 Task 2、Task 3；可与 Task 4 的组件门控部分并行实施。
- Task 6 依赖 Task 1、Task 3。
- Task 7 依赖 Task 6；其渲染器透传部分可在 Task 6 生命周期接口明确后并行。
- Task 8 依赖 Task 6、Task 7，以便同时验证运行时会话边界。
- Task 9 依赖 Task 1-8 的最终实现语义。
- Task 10 依赖所有其他任务。

# Increment Checkpoints

- **Checkpoint A（P0）**：用户可以明确切换设计/交互；设计时无业务误触，交互时不能移动组件但可以触发 click/hover 蓝图。
- **Checkpoint B（P1）**：显隐和刷新数据动作在编辑画布可见；退出、重入和切换项目无旧状态泄漏。
- **Checkpoint C（P2）**：独立预览无回归，文档与代码一致，质量门通过。
