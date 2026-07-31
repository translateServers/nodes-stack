# 大屏设计器 Web Component SDK Tasks

> 状态：实施中（阶段 5 已完成，待进入阶段 6 Web Component 与 Shadow DOM）
> 最近更新：2026-07-31
> 定位：按可独立验证的阶段拆解 SDK 契约、实例化改造、宿主适配、Web Component 封装、集成与发布任务

## 阶段 1：冻结规格与公共契约

- [x] Task 1: 确认 V1 产品边界
  - [x] 仅交付 `<nebula-screen-editor>`，不交付预览元素
  - [x] 宿主通过 JavaScript Adapter 自行对接后端
  - [x] Adapter 范围覆盖加载、保存、发布、导入导出与快照管理
  - [x] 首版仅 static 数据源、6 个内置组件、不开放插件
  - [x] 构建目标为 Chromium 120+，并支持桌面自适应容器，建议最小 1024x640
  - [x] workspace 验证后发布私有 npm ESM

- [x] Task 2: 冻结数据与 Adapter 契约
  - [x] 定义 `ScreenDocumentV1`、`ScreenProjectDraft`、`ScreenProjectEnvelope`
  - [x] 定义不透明 `revision` 乐观锁语义
  - [x] 定义 `ScreenProjectTransferV1` 导入导出格式
  - [x] 定义 `ScreenHostAdapter` 与 `ScreenSnapshotAdapter`
  - [x] 定义 Adapter 可选能力派生规则
  - [x] 定义统一错误码、冲突处理与 AbortSignal 生命周期

- [x] Task 3: 冻结 Web Component 契约
  - [x] 定义 attributes、properties、methods 与 CustomEvent
  - [x] 定义幂等显式注册与 auto-register 入口
  - [x] 定义 Shadow DOM、Portal、容器布局与双实例隔离要求
  - [x] 定义 static 能力支持/拒绝矩阵
  - [x] 定义 V1 测试策略与发布验收边界

## 阶段 2：建立包与文档协议

- [x] Task 4: 创建 `@nebula/screen-sdk` workspace package
  - [x] 创建 `packages/screen-sdk/package.json`、tsconfig、Vite、Vitest 与 ESLint 配置
  - [x] 配置 `src/index.ts`、`src/auto-register.ts`、`src/contracts/index.ts` 入口
  - [x] 配置 ESM build、source map、声明文件 rollup 与 clean
  - [x] 将构建 target 固定为 `chrome120`
  - [x] workspace 阶段保持 `private: true`
  - [x] 将 package 纳入 Turbo build/typecheck/lint/test 流程

- [x] Task 5: 实现版本化文档契约
  - [x] 在共享 Schema 层新增通用 `ScreenDocumentSchema`，避免复制既有 Canvas/Component/Blueprint 定义
  - [x] 在 SDK 实现 `ScreenDocumentV1Schema` 与 static 分支收窄
  - [x] 定义 6 个组件 type 常量、props map 与判别联合 Schema，拒绝未知 type/props
  - [x] 实现 `ScreenProjectDraftSchema` 与项目名称校验
  - [x] 实现 `ScreenProjectTransferV1Schema`
  - [x] 实现 `ScreenProjectEnvelopeInput` 到规范 Envelope 的解析与 id 一致性校验
  - [x] 固化导入文件最大 10 MiB 约束
  - [x] 实现 `validateScreenSdkCapabilities`
  - [x] 实现 V1 蓝图输入到 V2 规范输出的边界迁移
  - [x] 导出 TypeScript 类型、Zod Schema 与 JSON Schema
  - [x] 测试 API/dataset/global API/requestApi/refreshData 拒绝路径

- [x] Task 6: 实现 Adapter 公共类型与错误工具
  - [x] 定义 load/save/publish/import/export/snapshot 的完整 input/output 类型
  - [x] 实现 Envelope、SnapshotSummary 与 ScreenExportFile 响应 Schema
  - [x] 定义 `ScreenAdapterError` 与类型守卫/规范化辅助函数
  - [x] 实现 `ScreenPublicError` 安全映射，剥离原始 message/stack/cause/response/自定义字段
  - [x] 定义 `ScreenSdkDiagnosticCode` 枚举、路径语义与 diagnostics 透传
  - [x] 定义稳定 `ScreenOperation` 联合，禁止 error event 使用任意 operation 字符串
  - [x] 定义 capability 派生纯函数
  - [x] 为必需方法缺失、可选方法显隐、错误映射、恶意输入修改和 AbortSignal 编写测试
  - [x] 为非法快照时间/计数/尺寸、非法 Blob MIME 和不安全文件名编写负例测试

### 阶段 2 执行记录

- Checkpoint A 已完成：公共类型、错误、能力矩阵和三个包入口可独立构建。
- SDK 契约测试 40 项通过；shared 既有测试 195 项通过。
- SDK typecheck、lint、build 与变更范围 Biome 检查通过；声明文件未泄漏 workspace 路径。
- 全仓 typecheck、lint 通过。根 Biome 仍受既有 CRLF 行尾基线阻断；Web 回归仅既有 ECharts/jsdom 尺寸用例 4 项失败，其余 2467 项通过。

## 阶段 3：编辑器状态实例化

- [x] Task 7: 将主编辑器 Store 改为实例工厂
  - [x] 把模块单例改为 `createScreenEditorStore(initialOptions)`
  - [x] 新增 Store Context、Provider 与 selector hook
  - [x] 迁移所有直接 `useScreenEditorStore` 引用
  - [x] 把偏好读取移到实例创建时，使用带 namespace 的 key
  - [x] 移除固定 `window.__screenEditorStore`，改为显式 debug 选项
  - [x] 保持历史栈、dirty、蓝图迁移和现有操作语义
  - [x] 改造并迁移 editor-store 测试

- [x] Task 8: 实例化辅助状态与缓存
  - [x] 将 `useDimensionStore` 改为实例 Store
  - [x] 将 `useAlignmentLinesStore` 改为实例 Store
  - [x] 将 blueprint viewport module cache 改为实例状态
  - [x] 收藏、最近使用和面板宽度 key 加 SDK namespace
  - [x] 快照从 localStorage hook 脱离，改走 Host Adapter
  - [x] 编写同页双实例状态隔离测试

### 阶段 3 执行记录

- 主 Store、辅助 Store、蓝图视口缓存和本地偏好 key 已完成实例隔离。
- 项目、选中态、历史栈、dirty、画布视口、临时工具栈及辅助 Store 的双实例隔离测试已覆盖。
- `ScreenEditor` 与快照对话框不再读取 localStorage；快照列表与 mutation 通过宿主注入的异步、可取消 Adapter 执行。
- Nebula 路由宿主注入兼容现有完整 `ScreenProject` 的 localStorage Adapter，保留旧 key、动态项目和 20 条上限；阶段 5 再由 Workbench 操作控制器接入 SDK 公共 `ScreenHostAdapter` Envelope/Draft 契约。

## 阶段 4：抽离无宿主依赖的编辑器工作台

- [x] Task 9: 创建 `ScreenEditorWorkbench`
  - [x] 从现有 `ScreenEditor` 拆出无 Router、Query 与后端 hook 的 React 工作台
  - [x] 通过 props/context 接收项目 Envelope、operation controller、主题和 portal root
  - [x] 从 SDK 工具栏移除应用级 back 命令，static preview/navigation 改为 composed request event
  - [x] 建立实例内部 notification surface，不要求宿主 toast callback
  - [x] 将 `h-screen` 与窗口尺寸假设改为容器尺寸
  - [x] 保留工具栏、左右面板、画布、状态栏与蓝图入口
  - [x] 将蓝图编辑器改为动态加载边界

- [x] Task 10: 建立 static SDK capability profile
  - [x] BarChart 仅保留 static data path 与解析管线
  - [x] 属性面板只显示静态数据表单、字段映射和逻辑层
  - [x] 全局变量只允许 static 类型
  - [x] 从 SDK 注册定义中移除动态数据事件/动作
  - [x] 蓝图只允许 component/condition/delay/comment 节点和 spec 中列出的 evt/act/globalType 白名单
  - [x] requestApi/refreshData 不进入 SDK core dependency
  - [x] navigate 改为 `nebula-navigate-request`
  - [x] 确保图片/背景资源加载边界写入文档和测试

- [x] Task 11: 清除应用级依赖
  - [x] SDK 源码中不存在 `@/` alias
  - [x] SDK 不导入 TanStack Router、TanStack Query、Axios、auth store 或 screen API
  - [x] SDK 不导入 dataset feature
  - [x] 将 Workbench 可达路径的 Sonner 调用替换为实例通知/错误状态
  - [x] 将 app UI primitives 替换为 SDK 内部 UI primitives
  - [x] 通过依赖图测试或静态检查防止应用依赖回流

### 阶段 4 执行记录（已完成）

- 已从 Nebula 宿主组件拆出 `ScreenEditorWorkbench`；Router、Query、`window.open` 与浏览器下载留在宿主，Workbench 通过 Envelope 和 operation controller 接收数据与命令。
- 工具栏不再包含应用级返回命令；根布局改用宿主容器尺寸；V2 蓝图 Sheet 仅在打开时动态加载。
- Workbench 内建立实例通知面，导入、快照和 V2 蓝图剪贴板不再调用全局 Sonner；static 编辑画布 navigate 通过 composed event 请求宿主执行。
- static capability profile、6 组件静态注册表和 static-only BarChart 解析入口已进入 `packages/screen-sdk`；通用图表解析管线上移至 shared，Web 动态能力继续复用同一实现。
- Workbench 默认使用 static profile；Nebula `ScreenEditor` 显式使用 dynamic profile。static profile 在 UI 源头隐藏 API/dataset、固定 static 全局变量、过滤 requestApi 与动态锚点，并在写入 Store 前通过 SDK parser 拒绝动态文档。
- static profile 的 preview/navigate 只从 Workbench 根节点派发 bubbling + composed CustomEvent；Nebula 宿主外壳监听事件后执行现有预览与导航，dynamic profile 保留原 controller 路径。
- SDK 新增 TypeScript AST 边界检查，拒绝应用 alias、Router/Query、Axios、Sonner、相对越界和直接业务 `fetch`，并挂入 build。
- 15 个 Workbench 可达 shadcn primitives 与 `cn` 已收归 `packages/screen-sdk`，浮层组件统一支持实例 portal root；递归依赖图测试阻止应用 UI 回流。
- 阶段 6 创建 Custom Element React Root 时完成 Workbench 私有桥接到可发布元素入口；阶段 7 兼容验证通过前不切换现有动态项目入口。

## 阶段 5：实现 Host Adapter 工作流

- [x] Task 12: 实现加载与项目切换控制器
  - [x] 等待 `projectId + adapter` 后加载
  - [x] 校验 Envelope、迁移蓝图并执行 static capability validation
  - [x] project-id 变化时取消旧操作并原子加载新项目
  - [x] 实现 loading、retry、unsupported 与普通错误 UI
  - [x] 实现 `whenReady()` 和 `nebula-ready`
  - [x] 测试乱序响应、切换失败和断连取消
  - [x] 建立统一 operation coordinator，使全部项目 mutation 跨类型互斥
  - [x] 用表驱动测试覆盖 save/publish/import/snapshot mutation 竞争与迟到响应

- [x] Task 13: 实现保存、发布与冲突处理
  - [x] 保存传入 revision、draft 与 AbortSignal
  - [x] 成功后使用完整返回 Envelope 建立新基线
  - [x] 普通保存/发布保留历史，导入/恢复/项目切换才清空旧历史
  - [x] 服务端返回内容与提交草稿不一致时以响应为准并重置不适用历史
  - [x] dirty 时阻止发布
  - [x] `CONFLICT` 保留草稿与历史，支持重新加载/取消
  - [x] 可选发布能力不存在时隐藏 UI
  - [x] 实现成功/error/dirty CustomEvent

- [x] Task 14: 实现 Adapter 导入导出
  - [x] 在读取前校验文件类型与 10 MiB 大小上限，再校验 transfer JSON
  - [x] 展示项目名称、组件数、画布尺寸和 dirty 覆盖警告
  - [x] 确认后调用 `importProject` 并应用返回 Envelope
  - [x] 调用 `exportProject`，下载返回 Blob 并释放 Object URL
  - [x] 可选能力不存在时隐藏菜单项
  - [x] 成功后派发类型化 `nebula-operation-success`
  - [x] 测试非法文件、服务端校验失败、冲突和下载文件名

- [x] Task 15: 实现 Adapter 快照管理
  - [x] 实现列表、创建、恢复、删除和清空操作
  - [x] 创建时传递当前未保存 draft
  - [x] 恢复和清空前二次确认
  - [x] 恢复成功使用返回 Envelope 重建基线
  - [x] 失败时保留当前文档与历史
  - [x] restore 的 CONFLICT 与迟到响应遵循统一 mutation/代际规则
  - [x] snapshots 不存在时隐藏入口
  - [x] create/restore/remove/clear 成功后派发类型化 operation success detail

### 阶段 5 执行记录（已完成）

- SDK 新增无 React 的 `ScreenOperationCoordinator` 与 `ScreenHostController`，通过 generation、AbortSignal 和迟到响应守卫统一管理 load、只读操作与 7 类互斥 mutation。
- Host controller 已覆盖 Envelope 运行时校验、ready/retry、保存发布、冲突、导入导出、快照、能力派生、安全错误和类型化 CustomEvent；49 组 mutation 竞争使用表驱动测试验证。
- Store 新增 Envelope 应用语义：普通保存/发布响应未重写草稿时保留历史；服务端重写时以响应为新基线并清空旧历史，提交后的本地差异通过三方合并重放；导入/恢复/切换执行权威替换。
- Workbench 增加 Host controller bridge，Adapter 可选能力驱动发布、导入导出和快照入口；现有 Nebula dynamic 宿主路径保持兼容，阶段 7 前不切换生产入口。
- SDK 143 项测试通过，SDK typecheck/lint/build 与 Web typecheck/lint 通过；Web 完整回归 2515 项通过、14 项跳过，仅 4 个既有 ECharts/jsdom 零尺寸用例失败，与阶段 2 记录基线一致。

## 阶段 6：Web Component 与 Shadow DOM

- [ ] Task 16: 实现 Custom Element 生命周期
  - [ ] 创建 `NebulaScreenEditorElement`
  - [ ] 实现 observed attributes 与 property/attribute 反射规则
  - [ ] 实现 React Root mount/unmount
  - [ ] 实现显式注册和 auto-register 幂等保护
  - [ ] 实现公共方法并确保返回值不暴露可变 Store 引用
  - [ ] 实现并导出 `getDraft()`，项目名称/描述与 document 使用同一快照语义
  - [ ] 导出 `HTMLElementTagNameMap`、`NebulaScreenEditorEventMap` 与 detail 类型声明
  - [ ] 实现 readonly 命令矩阵：异步 mutation reject、undo/redo no-op、只读命令可用
  - [ ] 测试 readonly 下 Adapter mutation 不被调用
  - [ ] disconnected 时释放 Root、Adapter 操作和事件监听

- [ ] Task 17: 建立 Shadow DOM 样式边界
  - [ ] 编译 SDK 专用 Tailwind/shadcn/React Flow 样式
  - [ ] 将 root/body/html 样式迁移到 `:host` 与 Shadow reset
  - [ ] 创建实例 portal root 和 Portal Context
  - [ ] 改造 Dialog/AlertDialog/ContextMenu/DropdownMenu/Select/Sheet/Tooltip 等 Portal
  - [ ] 使用 adoptedStyleSheets 并提供 style fallback
  - [ ] 打包 Geist 字体或确定稳定系统字体回退
  - [ ] 实现 spec 定义的 9 个稳定 `--nebula-screen-*` variables 及 light/dark 默认值
  - [ ] 测试宿主冲突 CSS 与暗/亮主题
  - [ ] 测试宿主变量覆盖、无效值回退和画布用户颜色不受 UI 主题影响

- [ ] Task 18: 收口 DOM、快捷键和布局范围
  - [ ] 全局 querySelector 改为 ShadowRoot/容器 ref 查询
  - [ ] 固定 DOM id 改为 useId/ref
  - [ ] active editor 焦点仲裁快捷键
  - [ ] 跨窗口 pointer/blur 监听使用 ownerDocument.defaultView 并正确清理
  - [ ] 使用 ResizeObserver 驱动容器布局和 fitToScreen
  - [ ] 容器低于 1024x640 时显示尺寸提示
  - [ ] 编写双实例 Portal、快捷键、DOM query 与 resize 测试

## 阶段 7：参考宿主与兼容验证

- [ ] Task 19: 创建 Vanilla TS SDK 消费宿主
  - [ ] 不安装 React，仅安装 workspace SDK
  - [ ] 实现完整内存 Fake Adapter
  - [ ] 展示加载、保存、发布、导入导出和快照流程
  - [ ] 提供双实例与宿主冲突 CSS 测试页面
  - [ ] 作为 Playwright SDK E2E 宿主

- [ ] Task 20: 创建 Nebula Host Adapter
  - [ ] 将现有 screen API 映射为 load/save/publish Adapter
  - [ ] 将 `updatedAt` 映射为不透明 revision
  - [ ] 将 BizCode/HTTP error 映射为 `ScreenAdapterError`
  - [ ] 保留 Query cache invalidation、JWT 和 toast 在 apps/web
  - [ ] 监听 preview request 并打开现有预览路由
  - [ ] 不修改 NestJS 后端

- [ ] Task 21: 保护现有动态数据能力
  - [ ] SDK 静态 profile 不删除 apps/web 的 API/dataset 实现
  - [ ] 对现有动态项目明确阻止进入静态 SDK，不做静默降级
  - [ ] 记录生产路由切换条件，未满足前保留现有编辑器入口
  - [ ] 为后续动态数据 SDK 能力单独建立规格，不在 V1 偷渡接口

## 阶段 8：质量门与私有发布

- [ ] Task 22: 执行 SDK 单元与集成测试
  - [ ] 文档、Adapter、错误、Store 和 capability 测试通过
  - [ ] Custom Element、Shadow Portal、双实例和断连测试通过
  - [ ] 迁移既有画布、工具、属性、蓝图核心测试
  - [ ] 建立首个构建的 gzip 体积基线

- [ ] Task 23: 执行浏览器 E2E 与全仓回归
  - [ ] Vanilla 宿主完整流程通过
  - [ ] 双实例、冲突 CSS、resize、焦点快捷键通过
  - [ ] text/bar-chart/rect/ellipse/image/button 六组件渲染和属性编辑通过
  - [ ] 图层/历史/蓝图 condition/delay/comment 与允许动作核心流程通过
  - [ ] `pnpm biome:check`、`pnpm typecheck`、`pnpm lint` 通过
  - [ ] Nebula Web 相关单元测试与现有 E2E 无回归
  - [ ] 在当前稳定版 Chrome 与 Edge 各执行一次发布冒烟用例

- [ ] Task 24: 验证并发布私有 npm 包
  - [ ] 配置 exports/files/publishConfig/版本
  - [ ] `pnpm pack` 检查 tarball 内容
  - [ ] 空白 Vanilla Vite 项目安装 tarball 后 typecheck/build 成功
  - [ ] 验证 source map、字体与动态 chunk URL
  - [ ] 发布 `0.1.0` 到私有 registry
  - [ ] 更新 spec/checklist 状态与全局文档索引

## Task Dependencies

- Task 4-6 依赖阶段 1 契约冻结。
- Task 7-8 依赖 Task 4，Schema 工作可与 Store 实例化并行。
- Task 9-11 依赖 Store Provider 可用；static profile 与应用依赖清理可并行。
- Task 12-15 依赖 Task 5-6、Task 9。
- Task 16 依赖 Task 9、Task 12；Task 17-18 可在元素 mount 骨架完成后并行。
- Task 19 依赖 Task 16-18 和完整 Fake Adapter。
- Task 20 依赖 Adapter 契约稳定，可与 Shadow DOM 工作并行。
- Task 21 贯穿 Task 9-20，在生产入口切换前必须完成。
- Task 22-24 依赖所有实现任务完成。

## Increment Checkpoints

- **Checkpoint A（Contracts）**：公共类型、错误、能力矩阵和包入口可独立构建并通过契约测试。
- **Checkpoint B（Instance Core）**：两个 React 工作台实例的 Store、快捷键和 DOM 状态互不影响。
- **Checkpoint C（Adapter Loop）**：Fake Adapter 完成加载、保存、发布、导入导出和快照闭环。
- **Checkpoint D（Web Component）**：Vanilla 宿主中 Shadow DOM 编辑器可用，宿主无需 React。
- **Checkpoint E（Release）**：tarball 在空白项目安装构建成功，全仓质量门与 E2E 通过。
