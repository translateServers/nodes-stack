# Checklist

## P0：画布模式与安全默认值

- [x] 编辑器画布模式类型只包含 `design` 与 `interactive`
- [x] 首次进入编辑器默认使用 `design`
- [x] 加载或切换项目时回到 `design`
- [x] 旧版 `eventsEnabled=true` 不会自动开启交互调试或执行蓝图副作用
- [x] 无效或损坏的偏好数据安全回退到 `design`
- [x] Store 不再向业务代码公开模糊的 `eventsEnabled` / `toggleEvents` 语义

## P0：状态栏与模式反馈

- [x] 状态栏不再显示 `Event`，改为明确的"设计/交互"模式控制
- [x] 设计模式 tooltip 说明画布可编辑、组件交互与蓝图关闭
- [x] 交互模式 tooltip 说明画布编辑暂停、组件交互与蓝图开启
- [x] 模式控制可通过键盘操作，并具有正确的可访问名称和状态
- [x] 交互调试时画布存在不遮挡内容的视觉标识
- [x] Escape 可从交互调试返回设计模式

## P0：设计模式事件隔离

- [x] 设计模式下单击组件只执行设计器选中逻辑
- [x] 设计模式下不会执行 componentClick/click 蓝图规则
- [x] 设计模式下不会执行 componentHover/hover 蓝图规则
- [x] 设计模式下不会显示柱状图业务 tooltip
- [x] 设计模式下按钮等组件不会执行运行时业务行为
- [x] 设计模式下组件内部调用事件回调也会被统一派发入口拒绝
- [x] Moveable、Selecto、右键菜单与视口缩放等设计器能力无回归

## P0：交互调试输入所有权

- [x] 交互调试下单击组件可执行原生交互和 click 蓝图规则
- [x] 交互调试下指针进入组件可执行 hover 蓝图规则
- [x] 交互调试下单击组件不会改变选中状态
- [x] 交互调试下拖动组件不会改变组件位置
- [x] 交互调试下无法通过 Moveable 缩放或旋转组件
- [x] 交互调试下空白拖动不会启动 Selecto 框选
- [x] 交互调试下创建工具和文本编辑手势不会启动
- [x] 被阻止的编辑手势不会新增历史记录或改变 `isDirty`
- [x] 状态栏缩放、适应画布等允许的视口能力保持可用

## P1：运行时会话生命周期

- [x] 每次进入交互调试都创建干净运行时会话
- [x] pageLoad 在每个会话中只触发一次
- [x] V1 interval 在会话期间运行，退出后停止
- [x] V2 interval 在会话期间运行，退出后停止
- [x] 退出交互调试会清空 `visibilityOverrides`
- [x] 退出交互调试会清空 `apiDataOverrides`
- [x] 退出交互调试会取消可取消的数据刷新请求
- [x] 已退出会话的异步结果不会写入新会话
- [x] 再次进入交互调试不会恢复上一次会话的临时状态
- [x] 切换项目不会泄漏前一项目的运行时状态
- [x] 卸载编辑器后不存在遗留定时器和可取消请求

## P1：运行时覆盖与设计数据隔离

- [x] `setVisibility` 结果在编辑画布交互调试中可见
- [x] 运行时显隐优先级为 `visibilityOverrides > component.status.hidden`
- [x] `refreshDataSource` 结果通过 `apiDataOverrides` 在编辑画布中可见
- [x] 退出交互调试后组件恢复由项目设计数据决定的渲染结果
- [x] 运行时显隐不修改 `component.status.hidden`
- [x] 运行时数据刷新不修改原始 `dataSource`
- [x] 运行时覆盖不进入撤销/重做历史
- [x] 运行时覆盖不改变编辑器 `isDirty`

## P2：完整预览一致性

- [x] `/screen-editor-preview/$id` 不包含 Moveable、Selecto、选中框和编辑器手势
- [x] `/screen-editor-preview/$id` 加载后触发一次 pageLoad
- [x] `/screen-editor-preview/$id` 支持 click、hover、interval 和运行时覆盖
- [x] `/screen-preview/$id` 的完整运行时行为无回归
- [x] 编辑器当前 `interactionMode` 不影响任一独立预览路由
- [x] 编辑器交互调试、编辑器预览和公开预览的运行时状态彼此隔离

## P2：测试与文档

- [x] Store 与偏好测试覆盖默认值、迁移、非法值和项目切换
- [x] 状态栏测试覆盖模式显示、切换、tooltip 与可访问性
- [x] 画布测试覆盖设计模式无误触和交互调试不可编辑
- [x] 运行时测试覆盖关闭、重开、项目切换、定时器和请求清理
- [x] 预览测试覆盖 pageLoad、click、hover、interval 与覆盖状态
- [ ] `docs/specs/screen-editor/README.md` 与最终行为一致
- [ ] `docs/architecture/screen-editor-architecture.md` 与最终交互架构一致
- [ ] `docs/architecture/blueprint-runtime-architecture.md` 与最终会话及预览语义一致
- [x] `docs/specs/README.md` 包含本规格索引与正确状态

## 质量门

- [x] 相关前端单元测试全部通过
- [x] `pnpm biome:check` 通过（新增文件通过，既有文件 CRLF 为既有问题）
- [x] 根目录 `pnpm typecheck` 通过
- [x] 根目录 `pnpm lint` 通过

## 手动验收路径

- [ ] 设计模式：拖拽带 click/hover 蓝图的组件，不触发蓝图动作
- [ ] 设计模式：悬停柱状图，不出现业务 tooltip
- [ ] 交互调试：点击组件触发显隐动作，组件自身不被选中或移动
- [ ] 交互调试：悬停组件触发 hover 动作
- [ ] 交互调试：pageLoad 和 interval 行为符合完整运行时语义
- [ ] 交互调试：刷新数据源后画布显示新数据
- [ ] 退出交互调试：显隐和数据覆盖全部恢复
- [ ] 再次进入交互调试：无上次会话残留
- [ ] 切换项目：新项目处于设计模式且无旧运行时状态
- [ ] 编辑器预览与公开预览：完整事件链路正常且无编辑器控件
