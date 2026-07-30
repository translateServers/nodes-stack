# 大屏设计器 Web Component SDK Checklist

> 状态：实施中（阶段 2 已完成）
> 最近更新：2026-07-30
> 定位：用于开发自验、集成验收和私有 npm 发布判定的检查清单

## 1. 阶段 1 契约

- [x] V1 仅提供 `<nebula-screen-editor>`
- [x] 宿主通过 JavaScript Adapter 自行实现后端接入
- [x] load/save 为必需能力，publish/import/export/snapshots 为可选能力组
- [x] V1 仅支持 static 数据源与 6 个内置组件
- [x] V1 不开放自定义组件插件
- [x] V1 构建目标固定为 Chromium 120+
- [x] 编辑器填满宿主容器，建议最小 1024x640，不承诺移动端
- [x] workspace 验证后发布私有 npm ESM
- [x] `ScreenDocumentV1`、Envelope、Transfer、Adapter、Error 与元素 API 已写入 spec
- [x] 实施任务、依赖关系、测试策略和发布边界已写入 tasks/spec

## 2. Package and Contracts

- [x] `packages/screen-sdk` 已创建并被 pnpm workspace/Turbo 识别
- [x] package name 为 `@nebula/screen-sdk`，workspace 阶段 `private: true`
- [x] ESM build、source map、声明文件与 clean 正常
- [x] build target 固定为 `chrome120`
- [x] exports 包含 `.`、`./auto-register`、`./contracts`
- [x] `ScreenDocumentV1Schema` 导出且 schemaVersion 固定为 1
- [x] component type 只允许 text/bar-chart/rect/ellipse/image/button
- [x] 6 个 props 分支按 type 严格校验，未知 props 不被静默 strip
- [x] `ScreenProjectDraftSchema` 校验名称、描述与 document
- [x] `ScreenProjectEnvelope` 使用不透明非空 revision
- [x] `ScreenProjectTransferV1Schema` 含 format 与 formatVersion
- [x] `ScreenProjectEnvelopeInput` 可规范化为 V2 Envelope 并校验项目 id
- [x] 导入文件最大值固定为 10 MiB
- [x] SDK 导出 JSON Schema，后端团队可据此重复校验
- [x] declaration rollup 不泄漏 workspace 私有源码路径
- [x] 诊断 code 使用 `ScreenSdkDiagnosticCode` 枚举而非任意字符串
- [x] API/dataset/global API/requestApi/refreshData 有稳定诊断码和路径
- [x] V1 蓝图输入可迁移为规范 V2 输出
- [x] 不支持文档不会被静默改写或部分加载

## 3. Adapter Boundary

- [ ] SDK 只通过 `ScreenHostAdapter` 加载和保存项目
- [x] SDK 源码没有固定 API base URL、endpoint 或 Nebula response envelope
- [x] SDK 不读取 Token、Cookie 或 auth store
- [x] 所有 Adapter 方法接收 AbortSignal
- [x] save/publish/import/restore 使用当前 revision
- [ ] 成功操作均用完整返回 Envelope 更新基线
- [x] SDK 不把 Store 内部 draft/document/transfer 引用直接交给 Adapter
- [x] SDK 向 Adapter 传递 detached clone，恶意 Adapter 修改输入不影响 Store
- [ ] Adapter 缺少 publish 时发布入口隐藏
- [ ] Adapter 缺少 import/export 时对应文件入口隐藏
- [ ] Adapter 缺少 snapshots 时快照入口隐藏
- [x] HTTP/GraphQL/BizCode 错误可映射到统一 `ScreenAdapterError`
- [x] 文档错误通过 error.diagnostics 暴露稳定 code/path 且不含敏感原值
- [x] error event 使用 `ScreenPublicError`，不暴露 Adapter 原始 message/stack/cause/response/附加字段
- [x] 含模拟 Token/Cookie 的恶意 Adapter Error 脱敏测试通过
- [x] error event operation 使用 `ScreenOperation` 稳定联合
- [x] SnapshotSummary 校验带时区时间、非负计数和正尺寸
- [x] ScreenExportFile 校验 JSON Blob MIME 与安全 basename
- [x] Abort 不作为普通错误提示

## 4. Store and Instance Isolation

- [ ] 主编辑器 Store 由 factory 创建，不再是模块单例
- [ ] React 组件通过实例 Context 订阅 Store
- [ ] dimension Store 按实例创建
- [ ] alignment Store 按实例创建
- [ ] blueprint viewport cache 按实例创建
- [ ] localStorage preference key 包含 SDK namespace
- [ ] 固定 `window.__screenEditorStore` 已移除或改为显式实例 debug API
- [ ] 两个实例项目内容互不影响
- [ ] 两个实例选中状态互不影响
- [ ] 两个实例 undo/redo 历史互不影响
- [ ] 两个实例临时工具和画布视口互不影响

## 5. Workbench Extraction

- [ ] `ScreenEditorWorkbench` 不导入 TanStack Router
- [ ] `ScreenEditorWorkbench` 不导入 TanStack Query
- [ ] SDK 不导入 Axios、Nebula HTTP Client 或 auth store
- [ ] SDK 不导入 dataset feature
- [ ] SDK 源码不使用 apps/web 的 `@/` alias
- [ ] SDK 不显示应用级返回按钮，宿主自行提供返回/关闭导航
- [ ] preview/navigate 通过 composed event，操作反馈在 ShadowRoot 内展示并可由事件观测
- [ ] 编辑器根节点不使用 `h-screen/w-screen`
- [ ] fitToScreen 基于宿主容器 rect
- [ ] 蓝图编辑器可动态加载
- [ ] apps/web API/hooks/route/list/preview 继续留在宿主层

## 6. Static Capability Profile

- [ ] bar-chart 支持 staticData、dataPath、fieldMapping 和 logic
- [ ] 数据属性面板不显示 API 与 dataset 类型
- [ ] SDK 不导入或调用 `useApiDataSource`
- [ ] SDK 不导入或调用 `useDatasetSource`
- [ ] 全局变量面板只允许 static
- [ ] requestApi 节点不在 SDK 蓝图库出现
- [ ] requestApi global node、refreshData action 和动态数据锚点不在 SDK 出现
- [ ] condition/delay/comment 与 pageLoad/interval/navigate/scrollTo 按白名单可用
- [ ] 未知 node kind/globalType/evt/act 被稳定诊断拒绝
- [ ] navigate 只派发 `nebula-navigate-request`
- [ ] SDK 不直接 `fetch` 业务数据
- [ ] 远程图片/背景资源边界有 CSP/CORS 文档说明
- [ ] 动态文档加载失败时当前项目不被覆盖

## 7. Project Operations

- [ ] `project-id + adapter` 就绪后只加载一次
- [ ] property 与 attribute 赋值顺序不影响加载
- [ ] project-id 快速切换时旧响应不能覆盖新项目
- [ ] project-id/Adapter 变化会清除旧画面；宿主负责在 dirty 时确认受控切换
- [ ] load 失败可重试且不伪造 ready
- [ ] 编辑提交会设置 dirty 并派发 dirty/change 事件
- [ ] 拖拽每帧不派发完整文档事件
- [ ] Ctrl/Cmd+S 与保存按钮共用同一操作控制器
- [ ] 保存请求不并发
- [ ] save/publish/import/snapshot create/restore/remove/clear 跨类型互斥
- [ ] mutation 竞争使用表驱动测试覆盖，迟到响应不写回
- [ ] 保存成功更新 revision 并清除 dirty
- [ ] 普通保存/发布保留 undo/redo 历史，导入/恢复/项目切换清空旧历史
- [ ] 保存响应若重写草稿，SDK 以响应为准并清空不适用历史
- [ ] dirty 时发布被阻止
- [ ] publish 只提交 projectId + revision
- [ ] conflict 保留草稿、dirty 和历史栈
- [ ] conflict 支持重新加载与取消，不提供强制覆盖

## 8. Import, Export, and Snapshots

- [ ] 导入只接受 JSON 文件
- [ ] 超过 10 MiB 的导入文件在读取前被拒绝
- [ ] transfer 本地校验通过后才允许确认
- [ ] 导入预览展示名称、组件数与画布尺寸
- [ ] dirty 导入前显示覆盖警告
- [ ] 导入成功应用返回 Envelope 并清空旧历史
- [ ] 导出通过 Adapter 获取 Blob
- [ ] 下载使用安全文件名并释放 Object URL
- [ ] 导入/导出成功派发类型化 operation success 事件
- [ ] 快照列表完全来自 Adapter
- [ ] 创建快照包含当前未保存 draft
- [ ] 恢复和清空快照需要二次确认
- [ ] 恢复成功应用返回 Envelope
- [ ] 恢复失败保留当前项目和历史
- [ ] 快照恢复 conflict 保留当前项目，项目切换后的迟到恢复响应被忽略
- [ ] 删除/清空快照不修改当前文档
- [ ] 快照 create/restore/remove/clear 成功派发对应 operation success detail

## 9. Web Component API

- [ ] `defineNebulaScreenEditor()` 重复调用安全
- [ ] auto-register 不发请求、不扫描 DOM
- [ ] `project-id`、`theme`、`readonly` attribute/property 行为一致
- [ ] Adapter 只能通过 JavaScript property 注入
- [ ] Token、完整项目和敏感 header 不通过 attribute 传入
- [ ] `whenReady/reload/save/publish/getDraft/getDocument/validate` 正常
- [ ] dirty 状态下 `reload()` 默认拒绝，显式 discard 才可重新加载
- [ ] `undo/redo/fitToScreen/focusComponent` 正常
- [ ] `getDraft()` 与 `getDocument()` 不暴露内部可变引用
- [ ] 所有 CustomEvent 均 bubbles + composed
- [ ] change 事件包含项目名称、描述和 document 的完整 draft
- [ ] ready/change/dirty/selection/save/publish/preview/navigate/error 事件 detail 符合 spec
- [ ] disconnectedCallback 卸载 React Root
- [ ] disconnectedCallback 中止全部 Adapter 操作
- [ ] 断连后迟到响应不派发事件、不写 Store
- [ ] `HTMLElementTagNameMap`、EventMap 与 CustomEvent detail 类型可供 TypeScript 宿主使用

## 10. Shadow DOM and UI

- [ ] 使用 open ShadowRoot
- [ ] 每个实例有独立 React root 与 portal root
- [ ] Tailwind/shadcn/React Flow 样式打入 SDK
- [ ] Dialog Portal 位于当前 ShadowRoot
- [ ] AlertDialog Portal 位于当前 ShadowRoot
- [ ] ContextMenu Portal 位于当前 ShadowRoot
- [ ] DropdownMenu Portal 位于当前 ShadowRoot
- [ ] Select Portal 位于当前 ShadowRoot
- [ ] Sheet Portal 位于当前 ShadowRoot
- [ ] Tooltip Portal 位于当前 ShadowRoot
- [ ] adoptedStyleSheets 与 style fallback 正常
- [ ] 宿主全局 button/input/svg/* 样式不污染 SDK
- [ ] light/dark 主题只作用于当前实例
- [ ] spec 中 9 个稳定 CSS variables 的名称、默认值与取值类型一致
- [ ] 宿主变量覆盖优先，画布用户颜色不被 UI theme 覆盖
- [ ] readonly 禁止所有设计和服务端 mutation，但允许导出、列表、预览和视口操作
- [ ] readonly 下 save/publish reject FORBIDDEN，undo/redo no-op，Adapter mutation 调用数为 0
- [ ] 字体资源在 tarball 消费项目中可加载
- [ ] 首版没有承诺未记录的 slot、class 或 `::part` API

## 11. DOM, Focus, and Layout

- [ ] 组件与蓝图 DOM 查询限定在实例 root/container
- [ ] 不使用全局 document 查询 Moveable target 或 React Flow Handle
- [ ] 固定表单 id 已改为 useId/ref
- [ ] active editor 决定快捷键接收者
- [ ] 输入控件与浮层打开时快捷键正确挂起
- [ ] window blur 清理临时工具与修饰键
- [ ] pointer/window 监听在手势结束和卸载时清理
- [ ] ResizeObserver 响应宿主容器变化
- [ ] 1440x900 与 1024x640 容器布局可用
- [ ] 小于最小尺寸时显示明确提示
- [ ] 不依赖 `window.innerWidth` 计算编辑器尺寸

## 12. Host Integration and Regression

- [ ] Vanilla TS 宿主不安装 React即可使用 SDK
- [ ] Fake Adapter 覆盖全部 V1 服务能力
- [ ] Nebula Host Adapter 复用现有 screen API
- [ ] `updatedAt` 仅在宿主 Adapter 内映射为 revision
- [ ] Nebula JWT、401 refresh 和 Query cache 保留在 apps/web
- [ ] preview request 由宿主打开现有预览路由
- [ ] 本功能未修改 NestJS、Prisma 或数据库迁移
- [ ] apps/web 的 API/dataset 能力未被删除或静默降级
- [ ] 动态项目在迁移条件满足前继续使用现有应用入口

## 13. Tests and Release

- [x] 文档 Schema 与 capability validator 单测通过
- [x] Adapter/error/cancellation 单测通过
- [ ] Store factory 与双实例单测通过
- [ ] Custom Element 生命周期测试通过
- [ ] Shadow Portal 与宿主 CSS 隔离测试通过
- [ ] Vanilla 宿主 Playwright E2E 通过
- [ ] 当前稳定版 Chrome 与 Edge 发布冒烟通过
- [ ] 双实例焦点/快捷键 E2E 通过
- [ ] 保存冲突、导入导出和快照 E2E 通过
- [ ] 现有画布、工具、属性、历史与蓝图核心测试通过
- [x] `pnpm --filter @nebula/screen-sdk typecheck` 通过
- [x] `pnpm --filter @nebula/screen-sdk lint` 通过
- [x] `pnpm --filter @nebula/screen-sdk test` 通过
- [x] `pnpm --filter @nebula/screen-sdk build` 通过
- [ ] `pnpm biome:check` 通过
- [x] 根 `pnpm typecheck` 与 `pnpm lint` 通过
- [ ] 首次 gzip 体积基线已记录
- [ ] `pnpm pack` tarball 内容正确
- [ ] 空白 Vanilla Vite 项目安装 tarball 后 typecheck/build 通过
- [ ] 字体、source map 与动态 chunk URL 在 tarball 消费场景正常
- [ ] 私有 registry `0.1.0` 发布成功
