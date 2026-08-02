# 大屏组件 SDK 与组件注册表 Checklist

> 状态：生效中（按阶段实施中）
> 最近更新：2026-08-02（V2 optional operations、真实拖入与 preview request 定向质量门通过）
> 定位：用于逐阶段自验组件作者协议、实例注册表、运行时闭环和 SDK 发布边界

## 1. Spec Review

- [x] 宿主跨框架与组件作者跨框架被明确区分
- [x] 首版采用宿主显式注册，不支持文档驱动代码加载
- [x] 内置组件最终使用同一 manifest/registry 协议
- [x] 首版只覆盖渲染、props 和事件
- [x] 动态数据、自定义 UI、蓝图插件和远程市场明确排除
- [x] ADR-0001 的 SDK V1 static/no-plugin 边界保持不变
- [x] ADR-0002 已评审接受
- [x] spec 状态已调整为生效中

## 2. Incremental Checkpoints

- [x] Checkpoint 0：协议 package 独立验证，生产行为零变化
- [x] Checkpoint 1：实例 registry 承接六内置组件，用户行为零变化
- [x] Checkpoint 2：component lab 完成指标卡注册、真实组件库拖入与 design/preview renderer 验证
- [x] Checkpoint 3：指标卡 props、校验和历史栈闭环
- [x] Checkpoint 4：指标卡事件、payload 和蓝图闭环
- [x] Checkpoint 5：V2 Adapter/Transfer/Snapshot 持久化闭环
- [x] Checkpoint 6：SDK 0.2 components 入口与多宿主闭环
- [x] Checkpoint 7：内置 renderer 逐个迁移并删除 legacy 路径

## 3. Component Author SDK

- [x] `@nebula/screen-component-sdk` 可独立安装、typecheck 和 build
- [x] package 不依赖 React、ReactDOM、Router、Query、Axios 或 private core
- [x] 导出 JSON value、manifest、property field、event、model 和 plugin 类型
- [x] `defineScreenComponent()` 不注册编辑器、不扫描 DOM、不发请求
- [x] manifest apiVersion/type/version/tagName/category 校验完整
- [x] type 带命名空间和契约主版本
- [x] 第三方 type 不能使用内置保留前缀或覆盖内置 type
- [x] defaultProps 通过 propsSchema
- [x] propsSchema 根为 object 且 additionalProperties=false
- [x] property pointer/control 与 propsSchema 一致
- [x] manifest order、section/field id 和 pointer 唯一性校验完整
- [x] propsSchema 不支持 `$ref`，defaultProps 是唯一默认值来源
- [x] event id 唯一且格式合法
- [x] 非 JSON 值和循环引用被拒绝

## 4. Registry

- [x] `createScreenComponentRegistry()` 默认组合全部内置和宿主 plugins，宿主可用白名单选择内置组件
- [x] registry 是不可变快照，不导出 mutation API 或底层 Map
- [x] public registry facade 不暴露 legacy renderer/schema/icon，且 registration/manifest/list 均冻结
- [x] 任一 plugin 失败时不返回部分 registry
- [x] duplicate type 在开发和生产均拒绝
- [x] duplicate tagName 在开发和生产均拒绝
- [x] plugin.define() 返回构造器与 tagName 注册结果一致
- [x] 重复创建 registry 时 plugin.define() 返回同一构造器
- [x] factory failure 使用稳定 ScreenComponentRegistryError code/diagnostics
- [x] `isScreenComponentRegistryError()` 可安全收窄 unknown error
- [x] 外部修改原 plugin/manifest 不影响 registry snapshot
- [x] 两个编辑器实例可使用不同 type 集合
- [x] 浏览器全局 customElements 与实例 registry 边界有测试

## 5. Component Library Projection

- [x] 分类、搜索、收藏和最近使用从当前 registry 查询
- [x] 不再使用模块加载时 COMPONENT_DEFINITIONS 快照
- [x] 外部组件可出现在正确分类并被搜索
- [x] 未注册的收藏/最近使用记录被安全过滤
- [x] 外部 icon 只接受 SDK token，未知值使用 category fallback
- [x] 拖入组件使用 manifest defaultSize/defaultProps
- [x] defaultProps 为 detached clone，不在实例间共享引用

## 6. Renderer ABI

- [x] renderer 按 manifest.tagName 创建 Custom Element
- [x] model 通过 JavaScript property 原子赋值
- [x] model 包含 componentId/mode/interactive/props/style/size
- [x] model 是 detached snapshot
- [x] props 更新复用同一个 Element 实例
- [x] type 变化和组件删除正确卸载 Element
- [x] 定位、尺寸、旋转、层级和显隐继续由 Canvas wrapper 控制
- [x] design/preview 模式可被组件观察
- [x] disconnected/project switch 后无 listener 或异步写回泄漏

## 7. Declarative Properties

- [x] JSON Pointer read/update/reset 覆盖转义和嵌套路径
- [x] prototype pollution 路径被拒绝
- [x] text/textarea/color/switch/number/select 控件可用
- [x] 组件 section 进入 appearance tab
- [x] 通用位置/样式/图层/events section 仍由编辑器提供
- [x] 公共 schema 不含 render/customRender/ReactNode/HTML
- [x] 更新后校验完整 props
- [x] 非法更新不写 Store、不入历史
- [x] 合法更新支持 dirty/change/undo/redo
- [x] renderer 收到新 model 且不 remount

## 8. Events and Blueprint

- [x] 只监听 `nebula-component-event`
- [x] componentId 来自 renderer 上下文，不信任 event detail
- [x] 未声明 event name 不执行蓝图
- [x] 非 JSON payload 不执行蓝图
- [x] 超过 64 KiB payload 不执行蓝图
- [x] interactive=false 时不执行蓝图
- [x] 合法 event 映射到 `evt:${id}`
- [x] V1 继续使用 click/hover 固定白名单
- [x] V2 component source event 使用当前 registry allowlist
- [x] 合法 payload 以 detached snapshot 到达 executor 和 event context
- [x] 外部组件不能注册 action/node/executor
- [x] listener 在 unmount 时清理
- [x] debug 诊断不包含完整 payload

## 9. ScreenDocumentV2

- [x] ScreenDocumentV1Schema 保持现有六分支严格契约
- [x] ScreenDocumentV2WireSchema 只校验 wire shape
- [x] domain parser 使用当前 registry 校验 type 和 props
- [x] V1 可无损规范化为 V2
- [x] 默认 registry + V1 Adapter 保存仍输出 V1
- [x] 外部 registry + V2 Adapter 模式首次保存输出规范 V2
- [x] V1 -> V2 helper 设置 migration pending；V2 runtime 在首次成功保存前阻止发布
- [x] V2 文档不保存 tagName、module URL、constructor 或 script
- [x] missing definition 返回稳定 code/path
- [x] invalid props 返回稳定 code/path 且不泄露完整值
- [x] 新组件 diagnostics 扩展既有 code 并保留 severity/path/message
- [x] parse/validate/registry/Adapter error/nebula-error 使用同一 V2 diagnostic 类型
- [x] ScreenPublicErrorV2 不泄露原始 props、payload 或 Adapter error
- [x] 旧 SDK 稳定拒绝 schemaVersion=2
- [x] AdapterV2 使用 `documentVersion: 2` marker
- [x] TransferV2 使用 formatVersion=2，V1 transfer 不能嵌入 V2 document
- [x] V2 export 返回结构化 TransferV2，由 SDK 校验并序列化 Blob
- [x] SnapshotAdapterV2 类型、parser、controller 与 shared dialog 使用 V2 draft/envelope
- [x] 外部组件 dataSource/logic/interaction 被稳定拒绝
- [x] 指标卡通过真实 V2 Adapter 完成 load-save-load round-trip 且不丢数据
- [x] 缺少 registry 时不覆盖当前项目

## 10. SDK Element and Hosts

- [x] `<nebula-screen-editor>` 提供 JavaScript-only componentRegistry property
- [x] 未设置 property 时默认六内置组件可用
- [x] componentRegistry 在首次 load 开始时被冻结
- [x] 冻结后替换被拒绝且原会话不变
- [x] 外部 registry 搭配 V1 Adapter 时在 load 前被拒绝
- [x] `@nebula/screen-sdk/components` 是 0.2.0 显式 opt-in 入口
- [x] 0.2 adapter/save/publish/getDraft/getDocument/validate 声明使用闭合 V1/V2 联合；显式 V2 registry runtime 已接入
- [x] 0.2 ready/change/success/preview/error 声明使用同一 V1/V2 联合；preview request 已通过真实 Workbench 验证
- [x] registry 在 runtime mount 和文档解析前就绪
- [x] `whenReady()` 等待组件定义和项目验证
- [x] Vanilla 宿主完整闭环通过
- [x] React ref 赋值与构建冒烟通过
- [x] Vue template/ref 赋值与构建冒烟通过
- [x] 双实例不同 registry E2E 通过
- [x] Nebula 编辑、编辑器预览和公开预览共享同一 registry factory（59 个定向用例、Web typecheck/lint 通过）
- [x] 动态项目未通过组件插件绕过数据能力边界（registry 与 runtime profile 正交）
- [x] 既有 SDK production route switch gates 未被 registry 功能绕过

## 11. Built-in Migration

- [x] 六组件都有合法 manifest
- [x] 组件库/属性面板/蓝图定义只来自实例 registry
- [x] text 已迁移并删除对应 default registry legacyRenderer 分支
- [x] rect 已迁移并删除对应 default registry legacyRenderer 分支
- [x] ellipse 已迁移并删除对应 default registry legacyRenderer 分支
- [x] image 已迁移并删除对应 default registry legacyRenderer 分支
- [x] button 已迁移并删除对应 default registry legacyRenderer 分支
- [x] bar-chart 已通过内部 bridge 迁移
- [x] bar-chart 未向外部组件暴露动态数据执行能力
- [x] 模块级 mutable registry 已删除
- [x] 静态 renderer/schema/icon 快照已删除
- [x] Legacy Renderer adapter 已删除
- [x] 边界测试阻止旧注册 API 回流生产路径

## 12. Security

- [x] 文档不能触发 import/fetch/script injection
- [x] SDK 不向组件传 Token/Cookie/Adapter/Store/Router/QueryClient
- [x] Custom Element 受信任代码边界写入公开文档
- [x] Shadow DOM 不被描述为安全沙箱
- [x] props 和 payload 使用 detached JSON boundary
- [x] arbitrary SVG/HTML icon 被拒绝
- [x] errors/events 不暴露构造函数源码、完整 props 或 payload

## 13. Quality Gates

- [x] component-sdk typecheck/lint/test/build 通过
- [x] screen-editor-core typecheck/lint/test/build 通过
- [x] screen-sdk typecheck/lint/test/build 通过
- [x] SDK source/dist boundary tests 通过
- [x] SDK Host Playwright E2E 通过
- [x] Nebula Web screen 单元与 E2E 通过
- [x] Chrome/Edge 冒烟通过
- [x] Vanilla/React/Vue tarball consumer 通过
- [x] 声明文件不泄漏 private core/shared 源路径
- [x] gzip 体积变化已记录并解释（3336.4 KiB raw / 899.9 KiB gzip，限制 976.6 KiB）
- [x] `pnpm biome:fix` 后 `pnpm biome:check` 通过
- [x] `pnpm typecheck` 通过
- [x] `pnpm lint` 通过
- [x] 组件作者指南和宿主注册示例完成
