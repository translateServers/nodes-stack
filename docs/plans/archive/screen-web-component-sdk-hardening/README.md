# 大屏设计器 Web Component SDK 架构加固计划

> 状态：已归档
> 最近更新：2026-08-02
> 定位：针对 Web Component SDK 注册表、数据边界、renderer 隔离和公共 API 不变量的实施计划

> 实施记录（2026-08-02）：阶段 0-4 和 package/browser 质量门已完成。Playwright 现在使用独立端口、每次重建的测试数据库、worker 作用域认证令牌和显式 E2E 限流豁免；默认 6-worker 全量 Web E2E 已连续两次 60/60 通过。

## 1. 背景

架构评审确认当前 SDK 的分层方向基本合理：

- `@nebula/screen-component-sdk` 负责框架无关的 manifest、props、事件和 JSON 契约
- `@nebula/screen-editor-core` 负责实例 registry、Custom Element bridge 和编辑器接入
- `@nebula/screen-sdk` 负责公开 Custom Element、V1/V2 runtime 和显式 opt-in 入口
- 宿主显式导入并注册受信任组件，不由项目文档加载脚本

但实现仍有四类运行时不变量没有完全收紧：

1. registry 构建在重复检测完成前就产生了全局 `customElements.define()` 副作用
2. V2 `props` wire schema 没有统一执行 JSON 边界校验
3. host renderer 按 `tagName` 进行模块级缓存，可能跨 registry 复用错误的事件 allowlist
4. 公共 `ScreenComponentRegistry` 只有结构化 TypeScript 类型，没有运行时品牌约束，宿主可绕过工厂不变量

这些问题不会改变当前无外部插件的 Web 生产路径，但会影响正式开放第三方组件后的失败恢复、数据完整性和多实例隔离。

## 2. 目标与约束

### 2.1 目标

- 让 registry 构建在进入全局 Custom Element 注册阶段前完成所有可失败校验
- 让 V2 持久化数据和 Custom Element model 使用一致、可测试的 JSON 边界
- 保证 renderer 的缓存和事件 allowlist 与 registry/registration 实例绑定
- 让公开 SDK 只接受通过 registry factory 创建的公共 facade
- 增加能够复现四类风险的回归测试和质量门

### 2.2 兼容约束

- 不改变 V1 文档格式、V1 Adapter 签名和默认 V1 runtime 路径
- 不改变 V2 文档中只保存稳定 `type`、不保存 `tagName`/脚本 URL/构造器的规则
- 不引入远程组件加载、组件市场、iframe/Worker 沙箱或供应链签名
- 不把动态数据、宿主 Token、Adapter、Store、Router 或网络能力加入外部组件 ABI
- 不修改 NestJS 持久化模型；生产 V2 route switch 仍由独立计划负责
- 保持 `@nebula/screen-component-sdk` 无 React、Router、Query 和 private core 依赖

## 3. 设计决策

### 3.1 Registry 采用“预检、解析、提交”三阶段

registry factory 拆成三个阶段：

1. **纯预检**：校验全部 host manifest，检查 host 与 built-in 之间以及 host 内部的 `type/tagName` 重复，不执行 Custom Element 注册
2. **构造器解析**：调用全部 plugin `define()`，验证返回值为构造器，并要求 `define()` 对 `customElements` 注册保持无副作用且可幂等
3. **全局提交**：在所有插件都通过前两阶段后，统一检查当前 `CustomElementRegistry` 的已有构造器，再执行注册；同构造器视为幂等，不同构造器拒绝

由于浏览器不能撤销 `customElements.define()`，第三阶段不能承诺任意外部代码并发修改全局 registry 时的事务回滚。计划通过以下方式把 SDK 自身失败窗口降到最小：

- factory 内部对提交阶段串行化
- 提交前一次性检查全部已存在的 tagName/constructor 关系
- 明确 `plugin.define()` 不得自行调用 `customElements.define()`
- 失败时不返回部分 public registry；已经存在的全局定义只允许按幂等规则复用

### 3.2 JSON 边界由一个纯校验入口统一维护

V2 parser 在 props schema 校验前，先对所有外部输入的 JSON value 做边界校验。至少覆盖：

- `undefined`、function、symbol、bigint
- `NaN`、`Infinity`
- class instance、DOM Node、Promise/thenable
- 循环引用和 prototype pollution key

边界校验应使用 path-local 的循环检测，避免把同一个普通对象被两个字段共享引用误判成循环。通过后再执行 manifest props schema；失败只返回稳定 diagnostics，不把非法对象交给 Store 或 Custom Element。

Custom Element model 构建继续允许内部 `ComponentStyle` 的 optional `undefined` 被剥离，但不能静默把 `NaN`、class instance 或循环引用转换成合法值。

### 3.3 Renderer 缓存按 registration 隔离

host renderer 缓存改为 `WeakMap<ScreenComponentRegistration, Renderer>` 或等价的 registry/registration 作用域，不再以全局 `tagName` 作为唯一 key。

这样即使两个 registry 在同一 Document 中复用同一合法构造器和 tagName，只要 manifest 的事件列表、属性契约或其他派生信息不同，也不会复用错误闭包。Custom Element 的浏览器级全局定义仍保持不变，变化只作用于 SDK renderer 派生层。

### 3.4 Public registry 采用运行时品牌

`@nebula/screen-sdk/components` 工厂返回的 facade 使用 core 持有的 `WeakSet`/私有品牌登记。公开 Element 入口只接受已登记 facade；core 内部测试和 workspace 级组件仍可使用独立的 internal registry 类型。

品牌的目的不是安全沙箱，而是保护 factory 建立的以下不变量：

- manifest 已校验并被冻结
- host constructor 已定义或通过一致性检查
- type/tagName 无重复
- public registration 不暴露 legacy renderer/schema/icon 字段
- facade 与对应 internal snapshot 一一关联

## 4. 执行阶段

### 阶段 0：基线和测试夹具

- [x] 0.1 固定当前 V1/V2、registry factory、renderer bridge、SDK Element 和 tarball consumer 的测试基线
- [x] 0.2 增加唯一 tagName/constructor 工厂，支持在同一 jsdom Document 中构造跨 registry 场景
- [x] 0.3 增加非法 JSON props fixture：NaN、Infinity、class instance、循环引用、prototype key 和共享引用
- [x] 0.4 明确测试中 internal registry stub 与 public facade 的使用边界，避免新测试继续依赖结构化伪造 public registry

**阶段出口**：不改变实现行为；新增夹具可稳定复现四类风险，现有质量门通过。

### 阶段 1：修复 registry 构建原子性

涉及模块：

- `packages/screen-editor-core/src/registry/registry-factory.ts`
- `packages/screen-editor-core/src/registry/instance-registry.ts`
- `packages/screen-component-sdk/src/contracts/plugin.ts`

任务：

- [x] 1.1 抽取 host manifest 预检函数，批量校验所有插件并映射稳定 registry error/diagnostics
- [x] 1.2 在任何 `define()` 前检测 host-host、host-built-in 的重复 type/tagName
- [x] 1.3 将 constructor resolution 与 Custom Element commit 分离；只有全部 constructor resolution 成功后才允许注册
- [x] 1.4 增加提交锁/串行提交机制，处理同一 realm 内并发创建 registry 的竞争
- [x] 1.5 把 `define()` 的“只返回构造器、不注册 Custom Element”的要求写入组件作者指南和 plugin contract 注释
- [x] 1.6 保留已有构造器一致时的幂等行为；不同构造器继续返回 `DUPLICATE_COMPONENT_TAG_NAME`
- [x] 1.7 增加失败后重试测试：后续 duplicate/define 失败不得留下本次失败插件独占的新 tagName
- [x] 1.8 增加已有全局定义冲突和并发 factory 调用测试

**阶段出口**：registry 失败不返回部分快照；SDK 自身在 commit 前不会因为后续校验失败产生新的 Custom Element 定义。

### 阶段 2：收紧 V2 JSON 边界

涉及模块：

- `packages/screen-component-sdk/src/validation/json-boundary.ts`
- `packages/screen-component-sdk/src/validation/props-schema.ts`
- `packages/screen-editor-core/src/contracts/document.ts`
- `packages/screen-editor-core/src/registry/custom-element-renderer.tsx`

任务：

- [x] 2.1 将 JSON value 校验改为 path-local cycle detection，并补充共享引用测试
- [x] 2.2 在 `parseScreenDocumentV2()` 的 registry-aware props 校验前执行 JSON boundary pass
- [x] 2.3 对 V2 中其他 `z.unknown()` 持久化值做边界盘点，至少覆盖 built-in `dataSource.staticData` 和 `globalVariables.value`
- [x] 2.4 保证非法 props 返回 `INVALID_COMPONENT_PROPS` 或既有稳定 JSON diagnostic，不抛出 Zod/structuredClone 原始异常
- [x] 2.5 让 renderer model 构建拒绝非有限数字、class instance 和循环引用；保留 style optional `undefined` 的剥离行为
- [x] 2.6 增加 parser、renderer 和 event bridge 三层边界一致性测试，确保同一类非法值不会在不同入口得到不同语义
- [x] 2.7 检查 detached clone 的输入输出，确认非法值不会进入 Store、V2 save、preview request 或蓝图 payload

**阶段出口**：V2 parser、renderer ABI 和事件桥对 JSON 边界的拒绝集合一致；合法 JSON 数据的 V1/V2 行为不变。

### 阶段 3：修复 renderer 缓存隔离

涉及模块：

- `packages/screen-editor-core/src/registry/registry-derive.ts`
- `packages/screen-editor-core/src/registry/custom-element-renderer.tsx`

任务：

- [x] 3.1 将 `hostRendererCache` 改为 registration/registry 作用域的 WeakMap
- [x] 3.2 确保同一 registration 仍复用稳定 renderer 引用，避免无意义的 React remount
- [x] 3.3 增加两个 registry 复用同一 tagName/constructor、但 events manifest 不同的测试
- [x] 3.4 通过真实 CustomEvent 验证每个 registry 只接受自己的 event allowlist
- [x] 3.5 验证 tagName 变化、组件卸载、preview/design 模式切换时 listener 清理不回归
- [x] 3.6 检查 property schema、icon、events、actions 的其他派生缓存是否存在相同的全局闭包风险

**阶段出口**：同一 Document 内两个 editor instance 的 registry 派生结果互不串用；同 registration 更新仍保持 DOM 复用。

### 阶段 4：收紧 public registry facade

涉及模块：

- `packages/screen-editor-core/src/registry/instance-registry.ts`
- `packages/screen-sdk/src/components/index.ts`
- `packages/screen-sdk/src/element/nebula-screen-editor-element.ts`
- `packages/screen-sdk/src/element/v2-contracts.ts`

任务：

- [x] 4.1 增加 public facade 的运行时 brand 和 `isPublicScreenComponentRegistry()` 判断
- [x] 4.2 让 `resolveScreenComponentRegistryForRuntime()` 区分 public facade、internal registry 和未知结构化对象
- [x] 4.3 SDK Element 收到未知 registry 对象时在 load 前返回稳定 `VALIDATION`，不创建部分 runtime
- [x] 4.4 保留 core internal 测试入口，但不再把它作为 public SDK facade 的隐式 fallback
- [x] 4.5 更新 public type 注释、迁移指南和组件作者指南，明确 registry 必须来自 factory
- [x] 4.6 将现有手写 public registry 测试改为真实 factory facade；internal core 测试继续使用 internal 类型
- [x] 4.7 增加品牌对象可用、伪造对象拒绝、brand 与 internal snapshot 映射一致性测试

**阶段出口**：公开 SDK API 的运行时行为与文档一致；非法/伪造 registry 在 load 前稳定拒绝。

### 阶段 5：集成验证和发布闸门

- [x] 5.1 运行 `@nebula/screen-component-sdk` 单元测试和边界测试
- [x] 5.2 运行 `@nebula/screen-editor-core` registry、document、renderer、V2 host controller 测试
- [x] 5.3 运行 `@nebula/screen-sdk` Element、static runtime、tarball consumer 测试
- [x] 5.4 运行 component lab 的真实拖入、Custom Element 渲染和 V2 preview 测试
- [x] 5.5 运行 Web screen E2E、SDK Host Chromium、Chrome/Edge release smoke（默认 6-worker 全量 Web E2E 连续两次 60/60 通过）
- [x] 5.6 运行 `pnpm typecheck`、`pnpm lint`、`pnpm biome:fix`、`pnpm biome:check`
- [x] 5.7 检查构建产物不泄漏 workspace-private core/shared 声明依赖
- [x] 5.8 更新 [screen-component-sdk spec](../../../specs/screen-component-sdk/spec.md) 和 [component author guide](../../../specs/screen-component-sdk/component-author-guide.md) 的实施实况

**阶段出口**：V1 默认路径、V2 显式路径、tarball 消费、多实例隔离和默认 6-worker 全量 Web E2E 均已有回归证据。

## 5. 依赖与并行关系

```text
阶段 0
  ├─> 阶段 1 registry 原子性
  ├─> 阶段 2 JSON 边界
  └─> 阶段 3 renderer 缓存隔离
阶段 1 + 阶段 2 + 阶段 3
  └─> 阶段 4 public facade brand
阶段 4
  └─> 阶段 5 集成验证与发布闸门
```

阶段 1、阶段 2、阶段 3 可以在阶段 0 完成后并行实施。阶段 4 依赖前面三项的最终 registry 类型和 renderer 使用方式，避免在中途同时维护两套 public/internal 语义。

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| plugin `define()` 现有实现自行注册 Custom Element | 预检后仍可能发生不可回滚副作用 | 明确 contract 为无 Custom Element 副作用；组件包测试中断言 registry factory 才是唯一注册方 |
| 并发 registry 构建改变执行顺序 | 同一 tagName 出现竞争或非确定错误 | commit 阶段串行化；补并发测试；错误只按稳定 code 暴露 |
| JSON 边界收紧后拒绝历史脏数据 | 旧 V2 草稿/adapter 响应无法加载 | 只对 V2 registry-aware 路径收紧；返回 path diagnostics；不静默清洗并保存 |
| renderer 缓存作用域扩大 | renderer 对象数量增加，可能有轻微内存成本 | 使用 WeakMap；保持 registration 生命周期与 registry 快照绑定 |
| public brand 破坏 workspace 内部测试 | 测试和内部宿主编译失败 | public facade 与 internal registry 分开命名；先迁移测试 fixture，再收紧 SDK Element 边界 |
| 浏览器 `customElements` 是 realm 全局能力 | 同一 tagName 仍不能由两个构造器共存 | 保持 tagName/constructor 冲突拒绝；跨 realm 支持另立规格，不在本计划扩展 |

## 7. 验收标准

1. 注册表在 manifest、重复项和 constructor resolution 失败时不返回部分 public registry，且 SDK 自身不会在后续校验失败前注册新的 tagName。
2. V2 parser 对非法 JSON props 和其他纳入边界的 opaque value 返回稳定 diagnostics，不进入 Store、save、preview 或 Custom Element model。
3. 两个 registry 使用相同 tagName/constructor 但不同 events manifest 时，renderer 和事件 allowlist 不串用。
4. 直接手写结构化 `ScreenComponentRegistry` 在 public Element load 前被拒绝；factory 返回的 facade 正常工作。
5. V1 默认 registry、V1 Adapter、V1 文档、旧 SDK 遇到 V2 文档的行为保持不变。
6. 相关单元测试、component lab、SDK Host E2E、Web E2E、tarball consumer、typecheck、lint 和 Biome 全部通过。

## 8. 回滚策略

- 本计划不改变持久化文档版本和 Adapter 公共方法，代码可按阶段独立回滚。
- 阶段 1/2/3 可分别回滚，不需要迁移数据库或重写已有项目文档。
- 阶段 4 若发现 workspace internal consumer 未迁移完成，只回退 public brand 检查，保留前面三项运行时修复，并补齐 internal/public 迁移后再重新启用。
- 任何 V2 历史数据若因新边界拒绝，必须保留原始文件和 diagnostics，不允许通过自动剥离字段恢复保存。

## 9. 完成后沉淀

计划完成后：

- 将 plugin `define()` 无副作用要求、registry brand 约束和 JSON boundary 规则沉淀到 `docs/specs/screen-component-sdk/`。
- 将 registry 构建阶段和 renderer cache 作用域更新到 `docs/architecture/screen-editor-architecture.md`。
- 将已完成的执行项全部勾选，计划状态改为“已归档”，并移动到 `docs/plans/archive/`。
