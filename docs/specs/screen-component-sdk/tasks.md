# 大屏组件 SDK 与组件注册表 Tasks

> 状态：设计中（待规格评审后实施）
> 最近更新：2026-08-01
> 定位：按可独立合并、可验证、可回退的纵向切片拆解组件 SDK 实施任务

## 执行规则

- 每个 Task 只交付一个可观察结果，禁止顺手实现后续 capability。
- 每个阶段完成定向测试后立即更新本文件和 checklist，不集中到最后补状态。
- 依赖阶段未通过退出门时，不开始其下游任务。
- compatibility adapter 只用于迁移，必须标注删除条件，不新增外部调用方。
- 任一阶段出现动态数据、远程加载或自定义 UI 需求时暂停并回到规格评审。

## 阶段 0：冻结协议，不改变生产行为

- [ ] Task 0.1: 评审并冻结组件协议 V1
  - 确认 manifest identity、JSON props、property fields、event 和 element model 契约
  - 确认宿主显式注册、实例 registry 和注册时机
  - 确认 V1 非目标与安全边界
  - 确认目标版本 `screen-sdk@0.2.0`、`./components` 入口与 V2 Adapter opt-in
  - 将 spec 状态从“设计中”调整为“生效中”
  - _Requirements: 1, 2, 3, 12, 13_

- [ ] Task 0.2: 建立 `@nebula/screen-component-sdk` package 骨架
  - 创建独立 ESM package、tsconfig、ESLint、Vitest 与 exports
  - package 不依赖 React、ReactDOM、Router、Query、Axios 或 editor-core
  - 先只导出类型、常量和 `defineScreenComponent()` identity helper
  - 增加依赖边界测试
  - _Requirements: 1, 12_

- [ ] Task 0.3: 实现 manifest 纯校验
  - 校验 apiVersion、type、SemVer、tagName、category、默认尺寸和 JSON boundary
  - 校验 propsSchema 根对象、defaultProps 与 additionalProperties=false
  - 校验 property pointer/control 和 event id
  - 校验 order、唯一 id/pointer、禁止 `$ref` 和单一 defaultProps 来源
  - 输出稳定 diagnostics，不定义 Custom Element
  - _Requirements: 1, 3, 6, 7_

### Checkpoint 0

- 新 package 可独立 build/typecheck/test。
- 现有 SDK/core/app production 代码未改动。
- 非法 manifest 负例覆盖完整。

## 阶段 1：实例注册表承接现有内置组件

- [ ] Task 1.1: 定义 core 内部 registration 与 registry snapshot
  - 从 manifest 派生 definition、renderer kind、property schema 和 events
  - 实现 immutable `get/has/list`，不导出底层 Map
  - 实现 duplicate type/tagName 和 atomic build
  - 为两个 registry 快照编写隔离测试
  - _Requirements: 3, 4, 10_

- [ ] Task 1.2: 将六个内置定义转换为 manifest
  - 保留 text/bar-chart/rect/ellipse/image/button 兼容 type
  - 内置 tagName 使用 `nebula-screen-*-v1`
  - legacy renderer/property schema 通过内部 registration 扩展承接
  - 不在本阶段改动 renderer DOM 或视觉行为
  - _Requirements: 9, 10_

- [ ] Task 1.3: 建立 Registry Context
  - 在每个 `ScreenEditorWorkbench` 实例注入 registry
  - 默认 profile 注入仅内置 registry
  - 禁止组件库、画布和蓝图从模块级 registry 读取新定义
  - 保留旧 registry 作为 compatibility adapter 的唯一输入
  - _Requirements: 4, 10_

- [ ] Task 1.4: 动态派生组件库查询
  - 将组件库分类、搜索、最近使用和收藏过滤改为当前 registry 查询
  - 移除模块加载时 `CATEGORIES` / `COMPONENT_DEFINITIONS` 快照依赖
  - 未注册的历史收藏和最近使用保持过滤行为
  - _Requirements: 4, 10_

- [ ] Task 1.5: 动态派生 renderer/schema/icon/events
  - renderer 在 render 时按当前 registry O(1) 查询
  - 属性面板、图层和蓝图锚点使用同一 registration
  - compatibility registration 代理现有 6 个 React renderer
  - 现有六组件 UI 与测试结果保持不变
  - _Requirements: 4, 10_

### Checkpoint 1

- 用户看不到行为变化。
- 两个 Workbench 可注入不同 registry，定义不泄漏。
- 六组件完整回归通过。
- 所有新查询不依赖模块加载快照。

## 阶段 2：第一条外部组件渲染切片

- [ ] Task 2.1: 实现组件插件 define 与 registry 工厂
  - 内部实验入口导出异步 `createScreenComponentRegistry()`
  - 自动组合内置 legacy registrations 与宿主 plugins
  - 调用幂等 `plugin.define()` 并验证返回构造器与 tagName 注册结果一致
  - 任一失败时原子 reject
  - _Requirements: 2, 3_

- [ ] Task 2.2: 实现 Custom Element renderer bridge
  - 根据 manifest.tagName 创建 element
  - 通过 ref/property 赋值 detached model
  - 同 id/type 更新时复用 DOM，删除/type 变化时清理
  - 通用容器继续拥有 geometry/style/layer
  - _Requirements: 5, 11_

- [ ] Task 2.3: 增加 Vanilla 指标卡示例组件
  - 示例 package 只依赖 screen-component-sdk
  - manifest 提供全部必填字段，但本切片暂不声明 propertyPanel 和 events
  - 仅在 component lab/test host 显式注册后出现在组件库
  - 支持拖入设计画布，并在 renderer harness 验证 design/preview model
  - _Requirements: 1, 2, 5_

### Checkpoint 2

- 指标卡完成“注册 -> 组件库 -> 拖入 -> 设计画布渲染”。
- renderer harness 已验证 preview model；真实预览和持久化留待 V2 切片。
- 暂不开放属性面板和自定义事件。
- 移除指标卡 plugin 后默认六组件行为不变。
- production SDK element 尚不导出外部注册入口，保存/发布命令不接触实验组件。

## 阶段 3：声明式属性闭环

- [ ] Task 3.1: 实现 JSON Pointer props 工具
  - 只允许相对 props 根的 RFC 6901 pointer
  - 实现不可变 read/update/reset
  - 覆盖转义、数组、缺失路径和 prototype pollution 负例
  - _Requirement: 6_

- [ ] Task 3.2: 实现公共 property field adapter
  - 将 text/textarea/color/switch/number/select 映射到现有编辑器控件
  - 组件专属 section 进入 appearance tab
  - 位置、样式、图层、事件 section 继续由编辑器拥有
  - 不支持 custom render
  - _Requirements: 6, 10_

- [ ] Task 3.3: 接入完整 props 校验与历史栈
  - 每次字段更新后校验完整 props
  - 非法更新不写 Store、不入历史
  - 合法更新触发 dirty/change、undo/redo 和新 model
  - 指标卡增加 title/value/color 属性
  - _Requirements: 5, 6_

### Checkpoint 3

- 指标卡属性可编辑、撤销、重做。
- renderer 不重建 Element。
- defaultProps、propertyPanel 与 propsSchema 漂移会在注册时失败。

## 阶段 4：标准事件闭环

- [ ] Task 4.1: 实现 `nebula-component-event` bridge
  - 按 renderer 闭包确定 componentId
  - 校验 event allowlist、JSON payload 和 64 KiB 上限
  - 按 runtime interactive 闸门决定是否派发
  - 合法 payload detached clone 后写入 `V2TriggerEvent.payload` 和 event context
  - 清理 element listener
  - _Requirements: 7, 11_

- [ ] Task 4.2: Registry 驱动蓝图锚点
  - manifest events 派生 `evt:*` source handles
  - V1 保持 click/hover 固定白名单，V2 使用 registry-derived source allowlist
  - 继续使用现有 show/hide/toggleVisibility target actions
  - 编译器和诊断使用当前 registry
  - _Requirements: 7, 10_

- [ ] Task 4.3: 指标卡事件 E2E
  - 增加 `valueClick` manifest event
  - component lab preview runtime 中事件触发另一个组件 show/hide
  - 未声明事件、超大 payload 和 interactive=false 不执行
  - 合法 payload 到达 executor，原对象后续修改不影响运行时上下文
  - _Requirement: 7_

### Checkpoint 4

- 指标卡完成“事件声明 -> 蓝图连线 -> 预览执行”。
- 外部组件仍不能注册 action 或访问运行时服务。

## 阶段 5：ScreenDocumentV2 与持久化

- [ ] Task 5.1: 定义 V2 wire/domain contract
  - 保留现有 `ScreenDocumentV1Schema`
  - 新增 `ScreenDocumentV2WireSchema` 与 `ScreenSdkDocument` 联合
  - 新增 V2 Envelope、Draft、Transfer(formatVersion=2) 和 Snapshot 类型
  - 保留 V1 Adapter/Transfer 类型，新增带 `documentVersion: 2` marker 的 AdapterV2
  - 生成 V2 wire JSON Schema
  - _Requirements: 8, 9, 12, 13_

- [ ] Task 5.2: 实现 registry-aware parser
  - wire 校验后按 type 查询 registry
  - 校验 props 与 manifest events
  - 外部组件出现 dataSource/logic/interaction 时返回 unsupported capability
  - 输出 missing definition/apiVersion/props 稳定 diagnostics
  - 当前项目在失败时保持不变
  - _Requirements: 8, 14_

- [ ] Task 5.3: 扩展 0.2 diagnostics 与 error pipeline
  - 在既有 ScreenSdkDiagnostic 形状上扩展组件 code，保留 severity
  - parse/validate/registry/Adapter error 使用同一 ScreenSdkDiagnosticV2
  - ScreenPublicErrorV2 和 nebula-error 安全保留新 diagnostics
  - 覆盖原始 props/payload/Adapter error 脱敏
  - _Requirements: 3, 7, 8_

- [ ] Task 5.4: 实现 V1 -> V2 无损规范化
  - 六内置组件 V1 文档可规范化为 V2
  - 仅在 V2 Adapter/外部 registry 显式模式首次成功保存输出 V2
  - 默认 registry + V1 Adapter 继续输出 V1
  - V2 模式加载 V1 时设置 migration pending，阻止发布直至保存 V2 成功
  - 旧 SDK 对 V2 保持 unsupported 拒绝
  - 覆盖 load-save-load round-trip
  - _Requirement: 9_

- [ ] Task 5.5: 接入 Adapter/Transfer/Snapshot
  - V2 load/save/publish/import/export/snapshot 使用独立版本类型
  - V1 transfer 不得嵌入 V2 document
  - V2 export 返回结构化 fileName + TransferV2，由 SDK 校验并序列化 Blob
  - 实现 ScreenProjectExportV2Schema，覆盖不安全文件名和非法 transfer 负例
  - 指标卡保存、重载、导入导出、快照恢复不丢 props
  - 文档中 tagName/moduleUrl/script 字段被拒绝
  - _Requirements: 8, 12_

### Checkpoint 5

- 外部组件完成持久化闭环。
- V1 六组件项目继续加载。
- 缺少 plugin 时 fail-closed，不覆盖、不降级文档。

## 阶段 6：SDK Element 与 Nebula Host 接入

- [ ] Task 6.1: 增加 `componentRegistry` element property
  - JavaScript-only，不加入 observed attributes
  - 未赋值时使用内置默认 registry
  - 首次 load 开始时冻结并以 InvalidStateError 拒绝替换
  - 外部 registry 搭配 V1 Adapter 时在 load 前拒绝
  - adapter/save/publish/getDraft/getDocument/validate 使用 V1/V2 闭合联合
  - ready/change/success/preview/error 事件同步升级为 V2 event map
  - 声明文件扩展 HTMLElementTagNameMap
  - _Requirements: 2, 3, 4, 13_

- [ ] Task 6.2: 接入 static runtime 配置
  - registry 在 React runtime mount 前就绪
  - project parser、Workbench 和 Host Controller 使用同一 snapshot
  - disconnect 释放 runtime listener，不尝试 undefine Custom Element
  - _Requirements: 4, 8, 11_

- [ ] Task 6.3: 发布 `@nebula/screen-sdk/components` opt-in 入口
  - 导出 registry factory、V2 document/adapter/element/event/error 类型
  - 将 package 目标版本调整为 0.2.0，并提供 0.1 -> 0.2 迁移说明
  - 默认 V1 Adapter 路径不自动升级文档
  - _Requirements: 2, 8, 9, 13_

- [ ] Task 6.4: Nebula Web 共享注册配置
  - 建立单一 registry factory
  - 编辑路由、编辑器内预览、公开预览复用同一配置
  - dynamic runtime 不通过组件插件绕过数据安全边界
  - 保留既有 SDK production route switch gates，不因 registry 可用而提前切路由
  - _Requirements: 2, 4, 8_

- [ ] Task 6.5: 多框架消费文档与冒烟
  - Vanilla 完整 E2E
  - React ref 赋值示例与 build smoke
  - Vue template ref 赋值示例与 build smoke
  - 不要求宿主安装 React 以使用 SDK
  - _Requirements: 1, 2_

### Checkpoint 6

- SDK tarball 消费者可显式注册指标卡。
- 编辑和所有预览入口使用同一 registry。
- 双实例不同 registry E2E 通过。

## 阶段 7：内置组件逐个收敛

- [ ] Task 7.1: 迁移 text
  - 用 React-to-Custom-Element 内部 adapter 验证 model/lifecycle
  - 保持文本编辑 overlay 行为
  - 通过 text 单测和 SDK Host E2E 后删除 text legacy 分支
  - _Requirements: 5, 10, 11_

- [ ] Task 7.2: 逐个迁移 rect / ellipse / image / button
  - 每次只迁移一个组件
  - 每个组件通过原测试和视觉 E2E 后删除对应 legacy 分支
  - 不在迁移中修改组件视觉设计
  - _Requirements: 5, 10, 11_

- [ ] Task 7.3: 迁移 bar-chart
  - 通过内部 compatibility bridge 保留 static data/logic/interaction
  - 不向外部组件公开 fetch 或动态数据 runtime
  - 动态数据公共 ABI 留待独立规格
  - 通过 static/dynamic chart 回归后删除 bar-chart legacy 分支
  - _Requirements: 5, 9, 10_

- [ ] Task 7.4: 删除旧注册路径
  - 删除模块级 mutable registry 和派生快照
  - 删除 Legacy Renderer adapter
  - 更新 architecture/development guide 为组件包工作流
  - 增加边界测试阻止旧 API 回流
  - _Requirement: 10_

### Checkpoint 7

- 内置和外部 definitions/renderer/property/events 只走新 registry。
- 旧 `registerComponent(ComponentModule)` 不再进入生产路径。
- 六组件无预期视觉或行为回归。

## 阶段 8：质量门与预览发布

- [ ] Task 8.1: 定向质量门
  - component-sdk/core/screen-sdk typecheck、lint、test、build
  - 组件 manifest、registry、renderer、property、event、V2 parser 测试通过
  - Biome fix/check 通过

- [ ] Task 8.2: 浏览器回归
  - SDK Host 完整 E2E
  - Nebula Web 编辑/预览 E2E
  - 双实例、Shadow DOM、快捷键、Portal、断连回归
  - Chrome/Edge 冒烟

- [ ] Task 8.3: Tarball consumer
  - component-sdk 与 screen-sdk tarball 安装
  - Vanilla/React/Vue consumer typecheck/build
  - declaration 不泄漏 private core/shared 源路径
  - 记录新增组件架构后的 gzip 体积基线

- [ ] Task 8.4: 文档收口
  - 更新 spec/checklist 实际状态
  - 更新 screen-editor architecture 与 development guide
  - 提供组件作者最小示例和宿主注册示例
  - 记录动态数据、远程 registry 和组件迁移后续事项

## Task Dependencies

- 阶段 0 是所有代码任务的前置条件。
- 阶段 1 依赖 manifest 契约，但不依赖 Custom Element renderer。
- 阶段 2 依赖阶段 1；阶段 3、4 均依赖阶段 2，可在各自基础工具完成后并行。
- 阶段 5 依赖阶段 2-4 的实际协议反馈，避免先冻结错误的 V2 文档。
- 阶段 6 依赖阶段 5 的持久化契约。
- 阶段 7 可在阶段 2 后逐个开始，但删除旧路径必须等待阶段 6 完成。
- 阶段 8 依赖所有发布范围任务完成。

## Scope Stop Conditions

出现以下需求时停止当前任务，不直接扩展实现：

- 从项目文档或 URL 动态加载组件代码。
- 外部组件需要 API/dataset、Token 或 fetch callback。
- 外部组件需要自定义 React/Vue 属性面板。
- 外部组件需要自定义蓝图 action/node。
- 同一页面要求同一 type/tagName 同时运行两个不兼容实现版本。

上述需求必须先更新 spec/ADR，再新增任务。
