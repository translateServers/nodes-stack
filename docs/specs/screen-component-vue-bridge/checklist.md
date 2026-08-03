# 大屏统一组件契约与 Vue 3 注册桥接验收清单

> 状态：设计中
> 最近更新：2026-08-03
> 定位：用于实现自验、评审和最终发布验收；检查项全部通过后规格方可转为“生效中”
> 验收状态：待验收

## 0. 开工闸门

- [x] 已完成源码、依赖、持久化路径、验证资产和共享写入点的只读评估
- [ ] 唯一 wire `ScreenDocumentSchema` 的代码归属已冻结
- [ ] 固定 marker 与历史同值输入的语义及拒绝矩阵已冻结
- [ ] canonical document 的 API DTO、Prisma 存储和开发数据重置方式已冻结
- [ ] host-resource 下的 dataset 引用所有权已冻结
- [ ] Web Monaco editor 的 designer 注入边界已冻结
- [ ] 真实 Vue 指标卡的目录名与 npm package 名已冻结
- [ ] 本地、CI 和文档的 Node/pnpm 版本已统一
- [ ] superseding ADR 已生效，冲突 ADR 状态已更新
- [ ] Manifest、Model、Document、Adapter、designer/viewer 和 Vue bridge 接口已冻结
- [ ] 现有定向测试、tarball 与 E2E 基线已实际运行并记录
- [ ] 路线 A-G 的精确文件 owner 与定向验证命令已发布
- [ ] 上述闸门关闭前没有实现路线自行新增兼容层或临时公共 API

## 1. 唯一契约

- [ ] 只导出一个 `ScreenComponentManifest`
- [ ] 只导出一个 `ScreenComponentElementModel`
- [ ] 只导出一个 `ScreenDocument`
- [ ] 只导出一个 `ScreenHostAdapter`
- [ ] 公共声明不存在 `Legacy*`、`*V1`、`*V2`、`*V3` 或版本联合
- [ ] parser 只接受当前固定 marker
- [ ] marker 不用于选择不同 runtime/parser/Adapter
- [ ] 外部 type `/v1` 与 tagName `-v1` 仅作为组件实现身份保留
- [ ] 旧契约专属 marker、字段和数据源稳定拒绝且不发生迁移或字段剥离

## 2. Manifest 与数据能力

- [ ] `dataCapability` 为正式 manifest 必填字段
- [ ] `acceptedSources` 只允许 `static`、`host-resource`
- [ ] 空 `acceptedSources` 正确表示无数据能力
- [ ] `hostResourceTypes` 仅在接受 host-resource 时允许
- [ ] host resource type 白名单执行去重和非空校验
- [ ] registry-aware parser 校验 source kind 与 resource type
- [ ] 未声明能力时文档 fail closed

## 3. 唯一 Screen Document

- [ ] document wire schema 为 strict object
- [ ] 组件状态统一为 `{ locked, hidden }`
- [ ] 全局变量只允许 static
- [ ] 数据源只允许 static 与 host-resource
- [ ] host resource 使用字符串 resourceId
- [ ] params/binding 只接受 JSON value
- [ ] 文档不接受 URL、Token、请求头、SQL 或脚本字段
- [ ] props、事件、动作和组件引用均由当前 registry 校验
- [ ] `refreshData` 只允许指向 host-resource 组件
- [ ] 唯一 JSON Schema 已生成并从正式 contracts 入口导出

## 4. Host Adapter 与数据执行

- [ ] `ScreenHostAdapter` 同时承载项目能力与可选 data capability
- [ ] host-resource 文档在缺少 `adapter.data` 时 fail closed
- [ ] resource list 使用通用 resourceType/resourceId
- [ ] execute 只接收已验证 host resource intent
- [ ] 宿主后端继续校验身份、项目、上下文和资源权限
- [ ] 请求支持 AbortSignal、超时、去重和迟到结果防护
- [ ] Adapter 数据输出经过 JSON 边界和响应大小限制
- [ ] 组件卸载后数据上下文关闭且结果不再写入

## 5. 单一 Screen SDK

- [ ] workspace 只存在 `@nebula/screen-sdk`
- [ ] `@nebula/screen-dynamic-sdk` package 与依赖已删除
- [ ] SDK 只公开 `<nebula-screen-designer>` 与 `<nebula-screen-viewer>`
- [ ] 旧 `<nebula-screen-editor>` 公共实现和 tag alias 已删除
- [ ] root、auto-register、components、contracts、testing 入口可用
- [ ] designer/viewer 使用同一 document、registry、Adapter 和 renderer
- [ ] Web、SDK Host 和 Vue consumer 已迁移到正式入口
- [ ] Vue consumer 不直接导入 private core

## 6. 统一 Renderer ABI

- [ ] design 路径收到 `mode='design'`
- [ ] preview 路径收到 `mode='preview'`
- [ ] viewer 路径收到 `mode='viewer'`
- [ ] interactive 在所有路径显式传递
- [ ] core 在 `interactive=false` 时强制忽略业务事件
- [ ] props/style/size/mode/dataState 更新复用同一个 Custom Element
- [ ] model 每次赋值都是 detached snapshot
- [ ] Custom Element 实际节点稳定填满容器
- [ ] 组件删除、类型变化和 viewer 卸载正确清理元素

## 7. Vue 桥接包

- [ ] 存在 `@nebula/screen-component-vue`
- [ ] Vue `^3.5.0` 为 peer dependency
- [ ] bridge 只依赖 `screen-component-sdk`
- [ ] bridge 不依赖 screen-sdk、core、React、Router、Pinia、i18n 或 UI 库
- [ ] `defineVueScreenComponent()` 返回标准 `ScreenComponentPlugin`
- [ ] bridge 使用 Vue `defineCustomElement()`
- [ ] helper 只创建一次 Custom Element 构造器
- [ ] plugin.define 重复调用返回同一构造器
- [ ] bridge 不调用 `customElements.define()`
- [ ] 公共声明不存在 `any` 或 private 源路径泄漏

## 8. Vue Props 映射

- [ ] 默认将 `model.props` 映射为普通 Vue props
- [ ] 默认映射不隐式混入 style/size/mode/dataState
- [ ] `mapModel` 可访问完整只读 model
- [ ] 首个 model 到达前不渲染业务 SFC
- [ ] 后续 model 更新保持同一 Vue 组件实例
- [ ] props 更新不会重建 Custom Element 或 Vue app
- [ ] mapper 失败不会修改或覆盖项目文档

## 9. Vue 事件映射

- [ ] event map key 必须来自 manifest events
- [ ] 支持 Vue event 同名和别名
- [ ] 无 mapper 时支持零参数和单个 JSON 参数
- [ ] 多参数 emit 必须提供 mapPayload
- [ ] mapper 输出转换为 detached plain JSON
- [ ] Vue reactive Proxy 不会导致未处理的 DataCloneError
- [ ] 标准事件 detail 使用 `{ name, payload }`
- [ ] 标准事件设置 `bubbles=true`、`composed=true`
- [ ] 未声明事件不进入蓝图
- [ ] payload 上限按 UTF-8 byte 计算
- [ ] 事件错误日志不包含 payload 或 props

## 10. 样式与生命周期

- [ ] 默认使用 Light DOM
- [ ] 普通 SFC scoped CSS 在 Light DOM 中生效
- [ ] Shadow DOM 可显式启用
- [ ] Shadow DOM 示例使用 `.ce.vue` 或显式 styles
- [ ] 组件不依赖编辑器内部类名或未公开 CSS 变量
- [ ] Vue `onUnmounted` 在永久断开时调用
- [ ] 同步 DOM move 不造成错误卸载
- [ ] reconnect 行为稳定
- [ ] 卸载后定时器、监听器、事件和请求均清理

## 11. Registry 与多实例

- [ ] registry factory 仍负责全局 Custom Element commit
- [ ] manifest 和重复项在 commit 前预检
- [ ] 同 tagName/同构造器可被不同 registry 使用
- [ ] 同 tagName/不同构造器 fail closed
- [ ] 任一 plugin 失败不返回部分 registry
- [ ] 同页两个 designer/viewer 可使用不同 registry
- [ ] 组件库、画布、属性面板和 viewer 使用同一 registry snapshot

## 12. 真实 Vue 纵向切片

- [ ] 存在普通 `.vue` 指标卡组件，不手写 HTMLElement
- [ ] 指标卡 manifest 声明 props、属性面板、事件和数据能力
- [ ] 组件可从组件库搜索并拖入
- [ ] 默认尺寸和 default props 正确
- [ ] 属性面板更新立即反映到同一 Vue 实例
- [ ] static 数据正确渲染
- [ ] host-resource loading/success/error 正确渲染
- [ ] Vue emit 正确触发蓝图动作
- [ ] 保存重载后配置不丢失
- [ ] viewer 使用同一文档和 registry 正确展示

## 13. 单元与集成测试

- [ ] manifest 唯一 marker 和 data capability 测试通过
- [ ] document strict schema 与 registry-aware parser 测试通过
- [ ] 旧契约专属 marker、字段和数据源拒绝测试通过
- [ ] JSON clone、循环引用、Vue Proxy 和 UTF-8 size 测试通过
- [ ] Vue bridge default props/mapModel 测试通过
- [ ] Vue emits/event map 测试通过
- [ ] Light/Shadow DOM 测试通过
- [ ] disconnect/reconnect/onUnmounted 测试通过
- [ ] renderer mode/interactive/dataState 测试通过
- [ ] data coordinator abort/timeout/late result 测试通过
- [ ] registry 原子性和冲突测试通过

## 14. Tarball Consumer

- [ ] `screen-component-vue` 可独立 build/pack/install/typecheck
- [ ] `screen-sdk` 可独立 build/pack/install/typecheck
- [ ] Vanilla consumer 不安装 Vue 仍可构建
- [ ] React consumer 可通过 ref 使用 designer/viewer
- [ ] Vue consumer 可注册真实 SFC plugin
- [ ] Vue runtime 由 consumer peer 提供且没有重复副本
- [ ] package exports 与 files 白名单正确
- [ ] 声明不泄漏 private core/shared 源路径
- [ ] runtime chunk 不包含 testing fixture
- [ ] 产物不引用 `screen-dynamic-sdk` 或旧 dynamic subpath

## 15. Chromium E2E

- [ ] Vue 宿主 designer 非空白且正确铺满容器
- [ ] Vue SFC 样式实际生效
- [ ] 组件库拖入和属性修改通过
- [ ] 保存并切换 viewer 通过
- [ ] host-resource loading/success/error/abort 通过
- [ ] Vue emit 到蓝图动作通过
- [ ] interactive=false 不执行蓝图动作
- [ ] 删除组件和卸载 viewer 后无迟到回调
- [ ] 双实例 registry 隔离通过
- [ ] 页面无新增 console error
- [ ] 组件、工具栏、属性面板和画布无不合理重叠

## 16. 删除与文档同步

- [ ] `ScreenComponentElementModelV2` 已删除
- [ ] `SCREEN_COMPONENT_API_VERSION_V2` 已删除
- [ ] `screen-component-sdk/dynamic` 已删除
- [ ] `DynamicScreenDocumentV3*` 已删除
- [ ] legacy document parser/migration/alias 已删除
- [ ] XJ 专用 `host/xj-metric` wire 类型已删除
- [ ] 开发 fixture、snapshot 和本地数据已重置为唯一文档
- [ ] 未新增运行时或离线迁移脚本
- [ ] 组件作者指南包含 Vue SFC 示例
- [ ] 大屏架构与开发指南已更新
- [ ] active 文档中的 `eventId/name` 已统一
- [x] 旧动态数据规格已归档并链接本文
- [x] `docs/specs/README.md` 与 `docs/README.md` 已更新

## 17. 质量门

- [ ] `pnpm biome:fix` 通过
- [ ] `pnpm biome:check` 通过
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm test` 通过
- [ ] `pnpm build` 通过
- [ ] `pnpm --filter @nebula/screen-component-vue verify:tarball` 通过
- [ ] `pnpm --filter @nebula/screen-sdk verify:tarball` 通过
- [ ] `pnpm --filter @nebula/screen-sdk-vue-consumer e2e` 通过
- [ ] 所有失败均已修复并重新验证

## 18. 最终状态

- [ ] [tasks.md](./tasks.md) 全部任务完成
- [ ] 本清单全部项目完成
- [ ] [spec.md](./spec.md) 状态更新为“生效中”
- [ ] active 文档与最终实现一致
