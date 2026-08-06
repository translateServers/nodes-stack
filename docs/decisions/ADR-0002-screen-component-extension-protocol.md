# ADR-0002: 大屏组件扩展采用 Manifest + Web Component + 实例注册表

> 状态：已替代
> 日期：2026-08-01
> 定位：确定大屏组件跨框架开发、注册和运行的长期扩展协议
> 替代：由 [ADR-0003](./ADR-0003-screen-unified-contract-framework-bridges.md) 收敛为唯一组件与文档契约

## 背景

`@nebula/screen-sdk` 已把完整编辑器封装为 `<nebula-screen-editor>`，解决宿主框架无关集成。现有组件注册表仍接收 React `ComponentType`，只能由 Nebula 内部源码注册，并且使用模块级 Map 和加载时派生快照。

组件扩展需要同时满足：

- 组件作者可使用 Vanilla、Lit、Vue 或 React。
- 宿主明确控制可执行的组件包，不由项目文档加载代码。
- 组件除 renderer 外还需要元数据、默认值、props 校验、属性面板和事件。
- 同页多个编辑器实例可使用不同组件集合。
- 现有内置组件可渐进迁移，不能一次性重写后才验证。
- SDK V1 “六内置组件、不开放插件”的已发布边界不能被静默改变。

## 考虑的方案

### 方案 A：Manifest + Web Component + 实例注册表

组件包导出 serializable manifest 与幂等 `define()`；Custom Element 作为渲染 ABI；宿主显式组合不可变 registry 并注入编辑器实例。

优点：

- 组件实现框架无关。
- manifest 可驱动组件库、校验、属性面板和蓝图。
- 注册表可实例隔离并 fail-closed。
- 项目文档只保存稳定 type，不保存代码位置。
- 可用 compatibility adapter 渐进迁移内置 React 组件。

缺点：

- 需要新增组件作者协议和文档 V2。
- `customElements` 仍是 Document 全局，标签版本冲突必须治理。
- 第三方代码与宿主同 realm，不提供安全沙箱。

### 方案 B：公开现有 React ComponentModule

直接从 SDK 导出 `registerComponent({ renderer, schema, icon })`。

优点：

- 对当前代码改动最小。
- 可直接复用现有 React renderer 和属性 Schema。

缺点：

- 组件作者被绑定到 React 和 Nebula 内部类型。
- 宿主 React 版本、Context 和 bundle 容易冲突。
- 不能满足组件作者跨框架目标。
- 任意 React render/customRender 扩大公共 API 和安全面。

结论：不接受。

### 方案 C：只注册 Custom Element tagName

宿主调用 `registerComponent('acme-kpi')`，编辑器直接渲染标签。

优点：

- API 简单。
- renderer 天然跨框架。

缺点：

- 缺少稳定 type、默认尺寸、props schema、属性面板和事件定义。
- 无法严格校验、搜索、迁移或生成蓝图锚点。
- 容易把 tagName 和实现细节写入项目文档。

结论：不接受。

### 方案 D：iframe 远程插件

每个组件通过远程 URL 加载到 iframe，以 postMessage 与编辑器通信。

优点：

- 可建立更强的运行时隔离。
- 适合未来不受信任的组件市场。

缺点：

- 布局、交互、字体、截图、拖拽和性能成本高。
- 需要远程仓库、签名、权限、通信和版本基础设施。
- 超出当前“宿主显式注册受信任组件”范围。

结论：当前不接受；未来组件市场若需要运行不受信任代码，应另立 ADR。

## 取舍分析

Web Component 只适合作为 renderer ABI，不能单独承担完整组件协议。Manifest 提供可序列化的设计期和运行时契约，实例注册表负责把宿主选择的组件集合注入编辑器。三者组合后才能同时支持跨框架、严格校验和多实例隔离。

浏览器 `customElements` 无法撤销或重复定义。系统不尝试隐藏该平台约束，而是要求外部 type 与所有 tagName 带契约主版本；既有六个内置 type 作为兼容保留值。宿主在同一 Document 中为每个主版本选择唯一实现。

组件代码与宿主同 realm，因此本方案只适用于宿主显式导入的受信任组件。项目文档不得包含脚本 URL，也不得触发动态 import。

## 结论

最终选择：**方案 A，Manifest + Web Component + 实例注册表。**

具体规则：

- 新增轻量、无框架依赖的 `@nebula/screen-component-sdk`。
- 组件包导出 `{ manifest, define }`，Custom Element 接收原子 model property。
- 宿主通过 `createScreenComponentRegistry()` 显式组合组件。
- registry 是编辑器实例级不可变快照；重复和非法注册在所有环境 fail-closed。
- 公共属性面板只接受声明式字段，不接受 ReactNode/render function。
- 组件只通过标准 `nebula-component-event` 上报 manifest 已声明事件。
- 组件协议 V1 不接收 dataSource/logic/interaction 或运行时服务，动态数据继续走独立规格。
- 新增 registry-aware `ScreenDocumentV2` 和 V2 Adapter；V1 六组件严格契约与默认保存行为保持不变。
- 新能力通过 `@nebula/screen-sdk@0.2.0` 的 `./components` 入口显式 opt-in，不回写改变 `0.1.x`。
- 内置组件先通过 compatibility adapter 接入同一 registry，再逐个删除旧路径。

## 与 ADR-0001 的关系

[ADR-0001](./ADR-0001-screen-sdk-static-runtime-boundary.md) 禁止在 SDK V1 公开 renderer、属性面板和蓝图插件。该结论继续有效。

本 ADR 适用于后续组件协议 V1 与 Screen Document V2，不向既有 Screen SDK V1 偷渡 plugin API，也不改变 static/dynamic 数据能力边界。

## 影响

- 新增公开组件作者包和 SDK registry factory。
- private core 从全局 React registry 迁移到实例 registry。
- Screen SDK 公共文档升级为 V1/V2 联合。
- 组件库、renderer、属性面板和蓝图定义改为 registry 投影。
- 六内置组件采用单组件、单检查点方式迁移。
- 第三方组件包属于受信任代码；安全审查和版本选择由宿主负责。
- 远程加载、组件市场、动态数据和自定义 action/node 均需独立规格或 ADR。
