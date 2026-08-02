# 大屏组件 SDK 与组件注册表 Spec

> 状态：已归档（2026-08-02）
> 最近更新：2026-08-02
> 定位：定义大屏组件跨框架开发、显式注册、设计期配置、运行时渲染、事件桥接与文档校验契约
>
> 本文记录已完成的双轨 rollout 设计，不再作为实现依据。现行组件作者 API 见
> [component-author-guide.md](./component-author-guide.md)，宿主与历史 document 迁移边界见
> [migration-0.2.md](./migration-0.2.md) 和
> [development-guide.md](../../architecture/development-guide.md)。

## 1. Background

`@nebula/screen-sdk` 已通过 `<nebula-screen-editor>` 解决编辑器作为整体被 Vanilla、React、Vue 等宿主使用的问题。现有 6 个固定组件是 SDK V1 的阶段性能力，不是组件生态的最终架构。

当前组件系统仍有以下限制：

- `ComponentModule.renderer` 是 React `ComponentType`，组件作者必须进入 Nebula React 源码。
- 组件注册表是模块级全局 `Map`，不支持两个编辑器实例使用不同组件集合。
- 组件库、renderer、图标和属性 Schema 存在模块加载时快照，晚注册不能完整生效。
- SDK `ScreenDocumentV1` 严格固定 text / bar-chart / rect / ellipse / image / button 六种类型。
- Custom Element 自身只解决渲染，不包含组件库元数据、默认值、属性校验、属性面板、事件、版本和迁移信息。

因此，本功能不是简单增加一个 `register(tagName)` API，而是建立一套框架无关的组件包协议，并让组件包、实例注册表、组件库 UI、画布、预览和文档校验共享同一数据源。

本规格是 [组件库重设计](../component-library-redesign/spec.md) 的后续演进。既有 `registerComponent(ComponentModule)` 作为迁移起点，不作为新的公共组件插件 API。

## 2. Product Goal

### 2.1 User Stories

- 作为组件作者，我可以使用原生 Web Component、Lit、Vue Custom Element 或 React wrapper 开发组件，而不需要依赖 Nebula 编辑器内部 React API。
- 作为宿主开发者，我可以显式导入受信任的组件包，并把组件注册表注入某个编辑器实例。
- 作为大屏设计者，我可以在组件库中搜索、拖入、配置和编排外部组件，操作方式与内置组件一致。
- 作为项目维护者，我可以在缺少组件定义或 props 不兼容时得到稳定诊断，而不是加载占位组件后覆盖原文档。

### 2.2 Success Definition

首个可用版本以一个外部“指标卡”组件完成以下闭环为成功：

```text
组件包定义
  -> 宿主显式注册
  -> 组件库展示
  -> 拖入画布
  -> 声明式属性编辑
  -> 编辑/预览渲染
  -> 标准事件进入蓝图
  -> 保存、重载、导入导出不丢失
```

## 3. Delivery Principles

本功能采用小步快跑，不先完成大规模重构再验证结果。

### 3.1 Vertical Slice First

- 每个阶段必须形成可运行、可测试、可回退的提交。
- 第一条纵向切片只接入一个示例组件，不同时迁移全部内置组件。
- 组件库、画布、属性面板、事件和持久化按闭环顺序逐步接入。

### 3.2 Compatibility Before Replacement

- `ScreenDocumentV1` 继续按既有六组件严格校验。
- `@nebula/screen-sdk@0.1.x` 的 API 和保存行为保持不变；本功能通过 `0.2.0` 和 `./components` 入口显式发布。
- 未注入外部 registry 的 `0.2.0` 默认模式继续接受 V1 Adapter，并保持 V1 document 输出。
- 先用 compatibility adapter 把现有内置组件接到实例注册表，再逐个迁移 renderer。
- 新注册表稳定前，旧 React renderer 路径保留为内部回退；不得作为公共 API 导出。
- 每迁移一个内置组件即删除该组件对应的旧分支，不长期维护两份实现。

### 3.3 Contract Before Capability

- 每个切片只实现已冻结的协议字段。
- 不因“以后可能需要”提前开放网络、任意函数、编辑器 Store 或服务注入。
- 新能力需要增加组件协议版本或独立 capability，不修改已发布语义。

### 3.4 Fail Closed

- 注册表构建必须原子化，任一插件非法则不返回部分注册表。
- 文档缺少组件定义、组件契约版本不受支持或 props 非法时拒绝创建编辑会话。
- 不得删除未知组件、剥离未知 props 或用占位组件继续保存。

## 4. Scope

### 4.1 Goals

- 提供无 React 依赖的组件作者 SDK。
- 使用 Custom Element 作为跨框架渲染 ABI。
- 使用 serializable manifest 描述组件定义、props、属性面板和事件。
- 由宿主显式导入并注册组件包，不扫描 DOM 或自动执行远程脚本。
- 每个编辑器实例持有不可变组件注册表快照。
- 内置和外部组件最终共享 manifest、注册表、属性和事件协议。
- 提供注册表感知的 `ScreenDocumentV2` 校验。
- 保持 SDK V1 文档读取与稳定拒绝语义。

### 4.2 Non-Goals

首个组件协议版本不包含：

- 远程 URL 加载、组件市场、组件上传、签名和供应链分发。
- 外部组件执行 API/dataset 请求或读取宿主 Token、Cookie、认证 Store。
- 自定义 React/Vue 属性面板、任意 render function 或任意 HTML 注入。
- 自定义蓝图节点、动作执行器或宿主服务注入。
- 组件主动修改编辑器 Store、其他组件或项目文档。
- iframe / Worker 安全沙箱。
- SSR、旧浏览器 polyfill 或移动端编辑承诺。
- 跨大版本组件 props 自动迁移；V1 只定义检测与拒绝边界。

动态数据继续由 [大屏 SDK 动态数据能力规格](../screen-sdk-dynamic-data/spec.md) 管理，不在本规格中扩展。

## 5. Terminology

| 术语                 | 含义                                       |
| ------------------ | ---------------------------------------- |
| Component Element  | 实际渲染画布内容的 Custom Element                 |
| Component Manifest | 可序列化组件描述，包含身份、默认值、props schema、属性面板和事件   |
| Component Plugin   | `{ manifest, define }`，组件包对外导出的注册单元      |
| Component Registry | 某个编辑器实例可使用的组件插件不可变快照                     |
| Built-in Component | SDK 自带组件，协议上与外部组件一致                      |
| Legacy Renderer    | 迁移期间包装现有 React renderer 的内部适配器，不属于公共 API |

## 6. Architecture

### 6.1 Layers

```text
Host Application
  ├─ imports trusted component packages
  ├─ createScreenComponentRegistry([...plugins])
  └─ <nebula-screen-editor>.componentRegistry = registry
                              |
                              v
@nebula/screen-sdk
  ├─ built-in component plugins
  ├─ ScreenDocument V1/V2 boundary
  └─ Web Component host API
                              |
                              v
@nebula/screen-editor-core (private)
  ├─ instance registry context
  ├─ component library projection
  ├─ custom-element renderer bridge
  ├─ property-panel composition
  └─ blueprint event bridge
                              |
                              v
Component Element
  └─ Vanilla / Lit / Vue / React implementation
```

### 6.2 Package Ownership

新增公开轻量包：

```text
packages/screen-component-sdk/
├── src/contracts/       JSON value、manifest、property、event 类型与 schema
├── src/define.ts        defineScreenComponent()
├── src/testing.ts       组件包契约测试辅助函数
└── package.json         ESM；无 React / Router / Query / editor-core 依赖
```

各包职责：

| Package                        | Owns                              | Does not own                 |
| ------------------------------ | --------------------------------- | ---------------------------- |
| `@nebula/screen-component-sdk` | 组件作者协议、manifest 校验、测试辅助函数         | 编辑器 UI、Store、内置组件、宿主 Adapter |
| `@nebula/screen-editor-core`   | 实例注册表、渲染桥、属性与事件接入                 | 公共 npm 入口、宿主认证、远程组件加载        |
| `@nebula/screen-sdk`           | 内置插件、注册表工厂、元素 property、V1/V2 文档契约 | 第三方组件实现、组件市场                 |
| `apps/web`                     | Nebula 宿主注册配置、动态编辑器和预览组装          | 公共组件协议定义                     |

依赖方向：

```text
screen-component-sdk
          ↓
screen-editor-core ← shared
          ↓
screen-sdk       apps/web
```

`screen-component-sdk` 不得反向依赖 `screen-sdk` 或 private core。第三方组件包只需依赖 `screen-component-sdk`。

### 6.3 Three Sources, One Projection

- 组件包是分发单元。
- 组件注册表是运行时权威数据源。
- 组件库面板只是注册表的查询与展示，不拥有独立定义数组。

renderer、属性面板、图层图标和蓝图锚点均通过当前实例注册表查询，不再建立模块加载时静态快照。

## 7. Public Component Contract

### 7.1 JSON Boundary

公共协议只接受可结构化克隆的 JSON 值：

```ts
export type ScreenComponentJsonPrimitive = string | number | boolean | null;

export type ScreenComponentJsonValue =
  | ScreenComponentJsonPrimitive
  | ScreenComponentJsonValue[]
  | { [key: string]: ScreenComponentJsonValue };

export type ScreenComponentProps = Record<string, ScreenComponentJsonValue>;
```

以下值非法：`undefined`、`bigint`、`symbol`、function、class instance、DOM Node、Promise、循环引用和不可结构化克隆对象。

### 7.2 Manifest

```ts
export const SCREEN_COMPONENT_API_VERSION = 'nebula.screen-component/v1' as const;

export const SCREEN_COMPONENT_ICON_TOKENS = [
  'chart',
  'text',
  'media',
  'shape',
  'button',
  'table',
  'container',
  'code',
] as const;

export interface ScreenComponentManifestV1 {
  apiVersion: typeof SCREEN_COMPONENT_API_VERSION;
  type: string;
  implementationVersion: string;
  tagName: string;
  name: string;
  category: 'chart' | 'text' | 'media' | 'decoration' | 'table' | 'container';
  icon?: (typeof SCREEN_COMPONENT_ICON_TOKENS)[number];
  description?: string;
  keywords?: readonly string[];
  order?: number;
  defaultSize: { readonly width: number; readonly height: number };
  defaultProps: Readonly<ScreenComponentProps>;
  propsSchema: Readonly<Record<string, ScreenComponentJsonValue>>;
  propertyPanel?: readonly ScreenComponentPropertySection[];
  events?: readonly ScreenComponentEventDefinition[];
}
```

Identity rules:

- 外部组件 `type` 使用宿主无关、带命名空间和契约主版本的稳定标识，例如 `acme.kpi/v1`。
- 外部 type 必须匹配 `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+/v([1-9][0-9]*)$`；捕获组是契约主版本。
- `type` 不得使用内置保留前缀 `nebula.`，第三方不得覆盖内置 type。
- text / bar-chart / rect / ellipse / image / button 是为兼容既有文档保留的内置 type 例外；外部组件不得使用这些值。
- `implementationVersion` 是 SemVer，用于诊断与宿主发布管理；同一 `type` 的 minor/patch 必须向后兼容。
- 破坏 props 或事件契约时必须发布新 type，例如 `acme.kpi/v2`。
- `tagName` 必须满足 Custom Element 命名规则，并以匹配 type 契约主版本的 `-v<major>` 结尾，例如 `acme-kpi-v1`；内置组件同样遵守。
- `order` 如提供必须是有限整数；缺省为 0，同分保持 registry registration order。
- 文档只保存 `type`，不得保存 `tagName`、实现版本、构造函数或脚本 URL。

### 7.3 Props Schema

`propsSchema` 使用 JSON Schema 2020-12 的受限 object 子集。schema `type` 只接受 object / array / string / number / integer / boolean / null 单值，不接受联合数组。V1 支持：

- `type`、`properties`、`required`、`additionalProperties`
- `enum`、`const`
- `minimum`、`maximum`、`multipleOf`
- `minLength`、`maxLength`、`pattern`
- `items`、`minItems`、`maxItems`
- `title`、`description`

V1 禁止所有 `$ref`、组合关键字、自定义执行关键字和会加载外部资源的 schema。根 schema 必须为 object，并显式设置 `additionalProperties: false`。manifest `defaultProps` 是唯一默认值来源，propsSchema 不声明第二套 default。

注册时必须验证 `defaultProps`；项目加载、属性更新、保存和导入时必须再次验证实例 props。不得只依赖属性面板控件约束。

### 7.4 Declarative Property Panel

公共属性面板只开放可序列化字段：

```ts
export interface ScreenComponentPropertySection {
  id: string;
  title: string;
  defaultOpen?: boolean;
  fields: readonly ScreenComponentPropertyField[];
}

interface ScreenComponentPropertyFieldBase {
  id: string;
  label: string;
  pointer: string;
  description?: string;
}

export type ScreenComponentPropertyField =
  | (ScreenComponentPropertyFieldBase & {
      control: 'text' | 'textarea' | 'color' | 'switch';
    })
  | (ScreenComponentPropertyFieldBase & {
      control: 'number';
      min?: number;
      max?: number;
      step?: number;
    })
  | (ScreenComponentPropertyFieldBase & {
      control: 'select';
      options: readonly { label: string; value: string | number }[];
    });
```

Rules:

- `pointer` 使用相对 `props` 根的 RFC 6901 JSON Pointer，例如 `/title`、`/axis/labelColor`。
- pointer 必须指向 `propsSchema` 中已声明的属性。
- control 必须与目标 schema 类型兼容。
- section id 在 manifest 内唯一；field id 在 section 内唯一；同一 pointer 不得绑定两个字段。
- 组件专属 section 固定进入“属性”tab；位置、尺寸、样式、图层和事件 section 由编辑器组合。
- 不允许 `render`、`customRender`、ReactNode、HTML 字符串或回调函数。

### 7.5 Events

```ts
export interface ScreenComponentEventDefinition {
  id: string;
  name: string;
  description?: string;
}

export interface ScreenComponentEventDetail {
  name: string;
  payload?: ScreenComponentJsonValue;
}
```

- event `id` 在单个 manifest 内唯一，并匹配 `^[a-z][A-Za-z0-9]*$`。
- 蓝图 source handle 统一为 `evt:${id}`。
- `events` 缺省或为空表示组件没有蓝图 source handle。
- 需要 click / hover 的组件必须在 manifest 显式声明；不使用隐式默认事件。
- 组件动作仍只使用编辑器已有 show / hide / toggleVisibility，不由外部组件注册。

### 7.6 Plugin

```ts
export interface ScreenComponentPluginV1 {
  readonly manifest: ScreenComponentManifestV1;
  define(): CustomElementConstructor | Promise<CustomElementConstructor>;
}

export function defineScreenComponent(
  plugin: ScreenComponentPluginV1,
): ScreenComponentPluginV1;
```

`defineScreenComponent()` 在组件包初始化时执行纯契约校验，不注册编辑器、不扫描 DOM、不发请求。`plugin.define()` 必须幂等，并返回 manifest tagName 对应的构造器；它不得自行调用 `customElements.define()`。registry factory 会在全部插件通过预检和构造器解析后，串行提交全局 Custom Element 定义。

## 8. Component Registry Contract

### 8.1 Creation

宿主从 `@nebula/screen-sdk/components` 显式创建注册表：

```ts
import {
  createScreenComponentRegistry,
  type ScreenHostAdapterV2,
} from '@nebula/screen-sdk/components';
import { defineNebulaScreenEditor } from '@nebula/screen-sdk';
import { AcmeKpiComponent } from '@acme/nebula-screen-components';

defineNebulaScreenEditor();

const registry = await createScreenComponentRegistry({
  // 不传时默认加载全部内置组件；也可传 [] 禁用全部内置组件。
  builtInComponents: ['text', 'bar-chart'],
  components: [AcmeKpiComponent],
});

declare const adapter: ScreenHostAdapterV2;
const editor = document.querySelector('nebula-screen-editor');
editor.componentRegistry = registry;
editor.adapter = adapter;
editor.projectId = 'screen-1';
```

`createScreenComponentRegistry()` 未传 `builtInComponents` 时默认包含 SDK 的六个内置组件。宿主可传入
内置 type 白名单，或传入空数组禁用全部内置组件；外部组件仍通过 `components` 显式传入。

### 8.2 Immutability and Atomicity

```ts
interface ScreenComponentRegistrationBase {
  readonly manifest: Readonly<ScreenComponentManifestV1>;
}

export type ScreenComponentRegistration =
  | (ScreenComponentRegistrationBase & {
      readonly source: 'built-in';
      readonly elementConstructor?: CustomElementConstructor;
    })
  | (ScreenComponentRegistrationBase & {
      readonly source: 'host';
      readonly elementConstructor: CustomElementConstructor;
    });

export interface ScreenComponentRegistry {
  readonly size: number;
  get(type: string): ScreenComponentRegistration | undefined;
  has(type: string): boolean;
  list(): readonly ScreenComponentRegistration[];
}

export interface CreateScreenComponentRegistryOptions {
  builtInComponents?: readonly string[];
  components?: readonly ScreenComponentPluginV1[];
}

export function createScreenComponentRegistry(
  options?: CreateScreenComponentRegistryOptions,
): Promise<ScreenComponentRegistry>;

export type ScreenComponentRegistryErrorCode =
  | 'INVALID_COMPONENT_MANIFEST'
  | 'INVALID_BUILTIN_COMPONENT_TYPE'
  | 'UNSUPPORTED_COMPONENT_API_VERSION'
  | 'DUPLICATE_COMPONENT_TYPE'
  | 'DUPLICATE_COMPONENT_TAG_NAME'
  | 'COMPONENT_DEFINE_FAILED';

export interface ScreenComponentRegistryError extends Error {
  readonly code: ScreenComponentRegistryErrorCode;
  readonly diagnostics: readonly ScreenSdkDiagnosticV2[];
}

export function isScreenComponentRegistryError(
  error: unknown,
): error is ScreenComponentRegistryError;
```

- 返回对象是不可变快照，不导出底层 `Map` 或 mutation API。
- 注册顺序不影响 type 查找；组件库排序由 category + order/registration order 派生。
- 任一 manifest、define 或重复校验失败时 Promise reject，不返回部分注册表。
- factory 只以 `ScreenComponentRegistryError` reject，宿主可按稳定 code 处理；diagnostics 不包含 manifest 原始对象或构造器源码。
- SDK 同时导出 `isScreenComponentRegistryError()`，调用方不需要不安全类型断言处理失败。
- 外部代码修改传入 plugin/manifest 不得影响已创建快照。
- public `ScreenComponentRegistry` 是结构化 TypeScript 接口，但运行时只接受 factory 关联的 facade；手写对象在 Element load 前以 `VALIDATION` 拒绝。
- factory 依次执行 manifest/duplicate 预检、全部 constructor resolution、串行 Custom Element commit；前两个阶段失败不得留下 SDK 产生的新 tagName 定义。

### 8.3 Duplicate Rules

以下情况构建失败：

- 同一 registry 中 type 重复。
- 外部 type 与内置 type 重复。
- 两个不同 type 使用同一 tagName。
- tagName 已由不同构造器定义，或 `plugin.define()` 返回值与 `customElements.get(tagName)` 不一致。
- 同一 type 出现不兼容 `apiVersion`。

开发和生产环境行为一致，禁止生产环境静默覆盖。

### 8.4 Instance Scope and Global Custom Elements

组件定义的可见性按 `ScreenComponentRegistry` 实例隔离；浏览器 `customElements` 仍是 Document 全局能力：

- 两个编辑器可以使用不同 type 集合。
- 同一 Document 不能用同一 tagName 注册两个构造器。
- 需要并存不兼容主版本时必须使用不同 type 和 tagName。
- Registry 不能撤销 `customElements.define()`，但可以不向某个编辑器暴露该组件。

### 8.5 Assignment Timing

`NebulaScreenEditorElement` 新增 JavaScript-only property：

```ts
componentRegistry: ScreenComponentRegistry | undefined;
```

- 未设置时使用“仅内置组件”默认注册表，保持现有宿主可用。
- 自定义注册表必须在 `adapter + projectId` 触发首次加载前赋值。
- 首次项目加载开始后注册表被冻结；当前版本不支持热替换。
- 冻结后赋新引用必须同步抛出 `InvalidStateError` DOMException 并保留原注册表，不重启或部分重载当前项目。
- 未来如需热更新，另行定义带冲突检查和文档重校验的 API。

## 9. Custom Element Runtime ABI

### 9.1 Model Property

```ts
export interface ScreenComponentElementModelV1 {
  readonly apiVersion: 1;
  readonly componentId: string;
  readonly mode: 'design' | 'preview';
  readonly interactive: boolean;
  readonly props: Readonly<ScreenComponentProps>;
  readonly style: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly size: { readonly width: number; readonly height: number };
}

export interface ScreenComponentElement extends HTMLElement {
  model: ScreenComponentElementModelV1;
}
```

Rules:

- SDK 通过 JavaScript property 原子赋值，不把结构化 props 序列化为 HTML attribute。
- 每次赋值使用 detached snapshot，组件修改 model 不得改变编辑器 Store。
- 同一组件 id/type 更新 props 时复用 DOM element，不重复 mount。
- type 变化或组件删除时销毁旧 element，并移除 SDK 添加的监听器。
- element 应填满容器；定位、尺寸、旋转、zIndex、显隐和通用滤镜仍由外层 Canvas wrapper 管理。
- `design` 模式不得自行导航、请求保存或修改项目；`interactive=false` 时 SDK 忽略业务事件。

### 9.2 Standard Event

组件统一派发：

```ts
new CustomEvent<ScreenComponentEventDetail>('nebula-component-event', {
  detail: { name: 'valueClick', payload: { value: 100 } },
  bubbles: true,
  composed: true,
});
```

SDK event bridge：

1. 从当前 renderer 闭包取得可信 componentId，不接受组件在 detail 中声明 componentId。
2. 检查 `detail.name` 是否存在于当前 manifest events。
3. 检查 payload 是 JSON value，序列化后不超过 64 KiB。
4. 仅在当前运行时允许事件时派发到蓝图 `componentEvent`。
5. 合法 payload 以 detached snapshot 写入 `V2TriggerEvent.payload` 和只读 `event.payload` 运行时上下文。
6. 非法事件被忽略并在 debug 模式产生不含原始 payload 的诊断。

## 10. Property Editing Flow

```text
Manifest propertyPanel
  -> Registry validates pointer/control
  -> Property panel reads component.props
  -> User edits field
  -> immutable JSON Pointer update
  -> propsSchema validates complete props
  -> editor-store.updateComponent()
  -> renderer receives a new detached model
```

- 单字段写入后校验完整 props，失败则不提交历史栈。
- defaultProps 缺失的 optional 值由控件显示为空，不在读取时自动写回。
- reset 使用 manifest defaultProps 对应 pointer 的值。
- 属性更新进入现有历史栈并触发 dirty/change 语义。
- property panel 不信任组件 DOM 内部表单，不监听任意 change/input 作为配置写入。

## 11. Blueprint Integration

- 蓝图节点通过实例注册表的 manifest 获取名称、图标和 events。
- source handle 由 `events[].id` 派生，不读取全局 `COMPONENT_DEFINITIONS` 快照。
- 外部事件进入现有 V2 `componentEvent` 执行链，payload 沿用现有事件上下文。
- V1 文档与 runtime 继续使用固定 click/hover 白名单；V2 component source handle 改为 registry-derived allowlist，global node、target action 和数据能力仍使用现有 static 白名单。
- V1 组件协议不允许注册 action；目标组件仍使用 show/hide/toggleVisibility。
- 删除或缺少组件定义时，蓝图引用产生稳定诊断，不删除节点或边。

## 12. Screen Document V2

### 12.1 Why V2

`ScreenDocumentV1` 的六分支判别联合是已经完成并测试的静态契约。把未知 type 改成“只要注册过就接受”会改变 V1 consumer 的安全语义，因此必须新增文档版本。

### 12.2 Contract

```ts
export const SCREEN_DOCUMENT_V2_VERSION = 2 as const;

export interface ScreenDocumentV2 {
  schemaVersion: typeof SCREEN_DOCUMENT_V2_VERSION;
  canvas: CanvasConfig;
  components: ScreenComponent[];
  blueprint?: EventBlueprintV2;
  globalVariables: StaticGlobalVariable[];
}

export interface ScreenDocumentV2Input extends Omit<ScreenDocumentInput, 'schemaVersion'> {
  schemaVersion: typeof SCREEN_DOCUMENT_V2_VERSION;
}

export type ScreenSdkDocument = ScreenDocumentV1 | ScreenDocumentV2;
```

V2 使用两阶段校验：

1. `ScreenDocumentV2WireSchema` 校验文档容器和组件公共字段。
2. `parseScreenDocumentV2(input, registry)` 先校验 component props、staticData 和 global variable value 的 JSON 边界，再按 `component.type` 查询 manifest，并用对应 propsSchema 和事件能力校验。

组件特定 schema 由注册表在运行时提供，因此 V2 的静态 JSON Schema 只能描述 wire shape；组件包分别发布 manifest/props schema。

V2 只扩展组件 type/props/events，不扩大 SDK 的数据或蓝图执行权限。`@nebula/screen-sdk` static runtime 仍在 registry 校验后执行现有 static capability validator，仅允许 static data source、static global variable 和既有 global node / target action 白名单；组件 source event 在 V2 中由 registry manifest 白名单替代固定 click/hover。`apps/web` dynamic runtime 继续按当前动态 profile 处理 API/dataset；公共动态数据 SDK 契约仍由独立规格决定。

外部组件协议 V1 不包含数据输入。V2 parser 对 `source='host'` 的组件拒绝 dataSource、logic 和 interaction 字段，并返回 `UNSUPPORTED_COMPONENT_CAPABILITY`。内置组件继续按当前 profile 校验这些字段。

### 12.3 Persistence Rules

- V1 文档仍按现有严格 parser 加载。
- 默认 registry + V1 Adapter 模式保持 V1 内存和输出行为，不自动升级文档。
- 注入含外部组件的 registry 时必须同时注入 `ScreenHostAdapterV2`；V1 输入在该显式模式下无损规范化为 V2，首次成功保存输出 V2。
- V1 输入在 V2 模式下设置 `documentMigrationPending=true`，不创建 undo 历史，但按 dirty/publish gate 处理；保存 V2 成功后清除。迁移完成前禁止直接发布。
- V2 文档只保存稳定 type，不保存 tagName、脚本 URL 或 Custom Element constructor。
- 外部组件 props 必须为 JSON object，并通过当前 registry 的 schema；`NaN`/`Infinity`、class instance、DOM Node、Promise、循环引用和 prototype pollution key 必须拒绝。普通共享引用不是循环引用。
- 旧 SDK 遇到 schemaVersion=2 时继续返回 `UNSUPPORTED_SCHEMA_VERSION`，不得误解析。
- V1 Transfer、Envelope、Snapshot 和 Adapter 类型保持不变；V2 使用独立版本化契约。

```ts
export interface ScreenProjectDraftV2 {
  name: string;
  description?: string | null;
  document: ScreenDocumentV2;
}

export interface ScreenProjectEnvelopeV2 extends ScreenProjectDraftV2 {
  id: string;
  status: ScreenProjectStatus;
  revision: string;
}

export interface ScreenProjectEnvelopeInputV2
  extends Omit<ScreenProjectEnvelopeV2, 'document'> {
  document: ScreenDocumentV2Input;
}

export interface ScreenProjectTransferV2 {
  format: 'nebula-screen';
  formatVersion: 2;
  name: string;
  description?: string | null;
  document: ScreenDocumentV2;
}

export interface SaveProjectInputV2 extends LoadProjectInput {
  revision: string;
  draft: ScreenProjectDraftV2;
}

export interface ImportProjectInputV2 extends PublishProjectInput {
  file: File;
  transfer: ScreenProjectTransferV2;
}

export interface ScreenProjectExportV2 {
  fileName: string;
  transfer: ScreenProjectTransferV2;
}

export interface SnapshotCreateInputV2 extends SnapshotListInput {
  revision: string;
  draft: ScreenProjectDraftV2;
}

export interface ScreenSnapshotAdapterV2 {
  list(input: SnapshotListInput): Promise<ScreenSnapshotSummary[]>;
  create(input: SnapshotCreateInputV2): Promise<ScreenSnapshotSummary>;
  restore(input: SnapshotRestoreInput): Promise<ScreenProjectEnvelopeInputV2>;
  remove(input: SnapshotRemoveInput): Promise<void>;
  clear(input: SnapshotClearInput): Promise<void>;
}

export interface ScreenHostAdapterV2 {
  readonly documentVersion: 2;
  loadProject(
    input: LoadProjectInput,
  ): Promise<ScreenProjectEnvelopeInput | ScreenProjectEnvelopeInputV2>;
  saveProject(input: SaveProjectInputV2): Promise<ScreenProjectEnvelopeInputV2>;
  publishProject?: (input: PublishProjectInput) => Promise<ScreenProjectEnvelopeInputV2>;
  importProject?: (input: ImportProjectInputV2) => Promise<ScreenProjectEnvelopeInputV2>;
  exportProject?: (input: ExportProjectInput) => Promise<ScreenProjectExportV2>;
  snapshots?: ScreenSnapshotAdapterV2;
}
```

- `ScreenProjectTransferV1.formatVersion=1` 只能包含 V1 document。
- `ScreenProjectTransferV2.formatVersion=2` 只能包含 V2 document。
- V2 import 先按 formatVersion 判别，禁止在 V1 transfer 中嵌入 V2 document。
- `ScreenProjectExportV2Schema` 同时校验安全 JSON fileName 与结构化 TransferV2；SDK 校验后自行 `JSON.stringify`、创建 Blob 并触发下载，不信任 Adapter 返回的 opaque Blob 内容。
- `ScreenSnapshotAdapterV2.restore()` 返回 V2 Envelope；create draft 使用 V2。
- `ScreenHostAdapterV2.documentVersion=2` 是运行时 capability marker。外部 registry 搭配 V1 Adapter 时在 load 前拒绝。

### 12.4 Diagnostics

0.2 在现有 `ScreenSdkDiagnostic` 形状上扩展 code，继续保留 path / severity / message，避免创建平行错误协议：

```ts
export type ScreenSdkDiagnosticCodeV2 =
  | ScreenSdkDiagnosticCode
  | ScreenComponentRegistryErrorCode
  | 'MISSING_COMPONENT_DEFINITION'
  | 'UNSUPPORTED_COMPONENT_CAPABILITY'
  | 'INVALID_COMPONENT_PROPS'
  | 'INVALID_COMPONENT_EVENT';

export interface ScreenSdkDiagnosticV2 extends Omit<ScreenSdkDiagnostic, 'code'> {
  readonly code: ScreenSdkDiagnosticCodeV2;
}

export interface ScreenAdapterErrorV2 extends Omit<ScreenAdapterError, 'diagnostics'> {
  readonly diagnostics?: readonly ScreenSdkDiagnosticV2[];
}

export interface ScreenPublicErrorV2 extends Omit<ScreenPublicError, 'diagnostics'> {
  readonly diagnostics?: readonly ScreenSdkDiagnosticV2[];
}
```

- `parseScreenDocumentV2()`、`validate()`、registry errors、Adapter normalization 和 `nebula-error` 全部使用 `ScreenSdkDiagnosticV2`。
- `toScreenPublicError()` 的 0.2 分支保留安全 diagnostics，同时继续剥离 Adapter 原始 message/stack/cause/response。
- 诊断包含稳定 code/path/severity/message，不包含完整 props、event payload、构造函数源码或 Adapter 原始错误。

## 13. Built-in Component Migration

### 13.1 Target State

text / bar-chart / rect / ellipse / image / button 均拥有与外部组件相同的 manifest，并由默认实例注册表提供。组件库、属性面板、蓝图和文档校验不再为内置组件维护平行定义。

### 13.2 Incremental Migration

迁移顺序：

1. 先把 6 个现有定义转换为 manifest，renderer 暂由 legacy adapter 代理，用户行为不变。
2. 用 `text` 验证 React renderer 包装为 Custom Element 的桥接方式。
3. 迁移 rect / ellipse / image / button 等无动态数据组件。
4. 最后迁移 bar-chart；其既有 dataSource/logic/interaction 通过内部 compatibility bridge 保持，不向外部组件开放数据执行能力。
5. 所有内置组件迁移后删除全局 module registry、静态 RENDERERS 和 legacy adapter。

每迁移一个组件必须通过该组件现有单元测试与 SDK Host E2E，再删除旧分支；禁止一次性迁移全部组件后集中排错。

## 14. Host Integration

### 14.1 Web Component SDK

- 本功能目标版本为 `@nebula/screen-sdk@0.2.0`；`0.1.x` 代码和契约不回写改变。
- `@nebula/screen-sdk/components` 导出 registry factory、V2 Adapter/Document 和相关公共类型，形成显式 opt-in。
- `<nebula-screen-editor>` 新增 `componentRegistry` property，不新增 HTML attribute。
- `whenReady()` 只在注册表完成定义且项目通过 registry-aware parser 后 resolve。
- SDK 不自动发现 npm 包、不读取全局变量、不扫描已定义 Custom Element。

0.2 Element、方法与事件使用以下闭合联合类型；默认 V1 路径返回的仍是 V1 分支：

```ts
export type ScreenSdkProjectDraft = ScreenProjectDraft | ScreenProjectDraftV2;
export type ScreenSdkProjectEnvelope = ScreenProjectEnvelope | ScreenProjectEnvelopeV2;
export type ScreenEditorAdapterV2 = ScreenHostAdapter | ScreenHostAdapterV2;

export type ScreenOperationSuccessDetailV2 =
  | Exclude<ScreenOperationSuccessDetail, { operation: 'import' | 'snapshot-restore' }>
  | { projectId: string; operation: 'import'; envelope: ScreenSdkProjectEnvelope }
  | {
      projectId: string;
      operation: 'snapshot-restore';
      envelope: ScreenSdkProjectEnvelope;
    };

export type NebulaScreenEditorEventMapV2 = Omit<
  NebulaScreenEditorEventMap,
  | 'nebula-ready'
  | 'nebula-change'
  | 'nebula-save-success'
  | 'nebula-publish-success'
  | 'nebula-operation-success'
  | 'nebula-preview-request'
  | 'nebula-error'
> & {
  'nebula-ready': CustomEvent<{
    projectId: string;
    envelope: ScreenSdkProjectEnvelope;
  }>;
  'nebula-change': CustomEvent<{
    projectId: string;
    draft: ScreenSdkProjectDraft;
    reason: ScreenChangeReason;
  }>;
  'nebula-save-success': CustomEvent<{
    projectId: string;
    envelope: ScreenSdkProjectEnvelope;
  }>;
  'nebula-publish-success': CustomEvent<{
    projectId: string;
    envelope: ScreenSdkProjectEnvelope;
  }>;
  'nebula-operation-success': CustomEvent<ScreenOperationSuccessDetailV2>;
  'nebula-preview-request': CustomEvent<{
    projectId: string;
    revision: string;
    draft: ScreenSdkProjectDraft;
  }>;
  'nebula-error': CustomEvent<{
    projectId?: string;
    operation: ScreenOperation;
    error: ScreenPublicErrorV2;
  }>;
};

export interface NebulaScreenEditorElementV2 extends HTMLElement {
  adapter: ScreenEditorAdapterV2 | undefined;
  componentRegistry: ScreenComponentRegistry | undefined;
  options: ScreenEditorOptions | undefined;
  projectId: string;
  theme: ScreenEditorTheme;
  readonly: boolean;

  whenReady(): Promise<void>;
  reload(options?: { discardChanges?: boolean }): Promise<void>;
  save(): Promise<ScreenSdkProjectEnvelope>;
  publish(): Promise<ScreenSdkProjectEnvelope>;
  getDraft(): ScreenSdkProjectDraft | null;
  getDocument(): ScreenSdkDocument | null;
  validate(): ScreenSdkDiagnosticV2[];
  undo(): void;
  redo(): void;
  fitToScreen(): void;
  focusComponent(componentId: string): boolean;

  addEventListener<EventName extends keyof NebulaScreenEditorEventMapV2>(
    type: EventName,
    listener: (
      this: NebulaScreenEditorElementV2,
      event: NebulaScreenEditorEventMapV2[EventName],
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<EventName extends keyof NebulaScreenEditorEventMapV2>(
    type: EventName,
    listener: (
      this: NebulaScreenEditorElementV2,
      event: NebulaScreenEditorEventMapV2[EventName],
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}
```

- 0.2 的 `HTMLElementTagNameMap['nebula-screen-editor']` 指向 `NebulaScreenEditorElementV2`。
- V1/V2 draft 和 envelope 均通过 `document.schemaVersion` 收窄；升级说明提供类型守卫示例。
- `save()` / `publish()` 和所有携带 draft/envelope/error 的事件保持同一文档分支，不混合 V1 draft 与 V2 envelope。

### 14.2 Nebula Web

`apps/web` 建立单一宿主注册配置，编辑路由、编辑器内预览和公开预览复用同一 registry factory。不得在三个入口分别维护组件列表。

动态项目继续使用 `DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE`；组件注册表与数据 runtime 是正交能力，不能用组件插件绕过 static/dynamic 数据边界。

现有 NestJS `ScreenComponent.type/props` 是通用 JSON 结构，可保存外部组件实例，但当前后端尚未持久化 SDK schemaVersion 等完整 canonical document 元数据。因此本功能不绕过既有 `/screen/$id` production route switch gates；SDK V2 路由切换仍需先证明服务端无损 round-trip。Nebula dynamic route 可先使用 registry-aware component 校验，外部组件同样不得携带 dataSource/logic/interaction。

### 14.3 Framework Hosts

- Vanilla：直接设置 element property。
- React：通过 ref 在设置 adapter/projectId 前赋值。
- Vue：通过 template ref 在 mounted 时赋值。
- 宿主不需要把组件 package 转换为 React component。

### 14.4 Migration Guide (0.1.x → 0.2.0)

#### Breaking Changes

`@nebula/screen-sdk` 从 `0.1.x` 升级到 `0.2.0` **无破坏性变更**。默认 V1 路径的 API 签名、保存行为和文档格式保持不变。

#### Opt-in Path

外部组件持久化通过显式导入 `@nebula/screen-sdk/components` 启用：

```ts
// 0.1.x — 仅 V1，无需额外导入
import { defineNebulaScreenEditor } from '@nebula/screen-sdk';
defineNebulaScreenEditor();

// 0.2.0 — V1 路径不变（默认）
import { defineNebulaScreenEditor } from '@nebula/screen-sdk';
defineNebulaScreenEditor();

// 0.2.0 — 显式 opt-in V2（需要同时提供 V2 Adapter）
import { defineNebulaScreenEditor } from '@nebula/screen-sdk';
import {
  createScreenComponentRegistry,
  type ScreenHostAdapterV2,
} from '@nebula/screen-sdk/components';

defineNebulaScreenEditor();

const registry = await createScreenComponentRegistry({
  components: [/* 宿主组件 plugin */],
});

const editor = document.querySelector('nebula-screen-editor')!;
editor.componentRegistry = registry;   // V2 registry
editor.adapter = v2Adapter;            // 必须是 ScreenHostAdapterV2
editor.projectId = 'screen-1';
```

#### Compatibility Rules

| 场景 | 0.1.x | 0.2.0 默认 | 0.2.0 opt-in |
| --- | --- | --- | --- |
| V1 Adapter + 默认 registry | ✅ V1 文档 | ✅ V1 文档（不变） | N/A |
| V2 Adapter + 默认 registry | N/A | ❌ load 前拒绝（V2 save 签名不能安全降级为 V1） | ❌ 需先设置显式 registry |
| V2 Adapter + 显式 built-in registry | N/A | N/A | ✅ V2 文档 |
| 外部 registry + V1 Adapter | N/A | ❌ load 前拒绝 | ❌ load 前拒绝 |
| 外部 registry + V2 Adapter | N/A | N/A | ✅ V2 文档（首次保存输出 V2） |

#### Migration Checklist

1. 升级 `@nebula/screen-sdk` 到 `0.2.0`（API 兼容，无需改动现有代码）。
2. 如需注册外部组件，从 `@nebula/screen-sdk/components` 导入 `createScreenComponentRegistry`。
3. 实现 `ScreenHostAdapterV2`（在 V1 Adapter 基础上增加 `documentVersion: 2` marker 和 V2 load/save 方法）。
4. 在 `editor.adapter = ...` 之前设置 `editor.componentRegistry = ...`（V2 模式即使只使用 built-in
   组件也必须提供显式 registry；load 开始后 registry 冻结）。
5. 监听 V2 事件时使用 `NebulaScreenEditorEventMapV2` 类型；V1 事件签名保持兼容。
6. V1 文档在 V2 模式下首次加载时设置 `documentMigrationPending=true`，保存 V2 成功后清除；迁移完成前禁止发布。

#### What 0.2.0 Does NOT Change

- V1 `ScreenDocumentV1` 格式、parser 和保存行为。
- `defineNebulaScreenEditor()` 和 `<nebula-screen-editor>` 的默认 API。
- `./contracts` 入口导出的 V1 JSON Schema。
- 旧 SDK 消费者遇到 `schemaVersion=2` 时继续返回 `UNSUPPORTED_SCHEMA_VERSION`。

## 15. Security Boundary

- Custom Element 与宿主运行在同一 JavaScript realm，属于受信任代码，不是安全沙箱。
- Shadow DOM 只隔离样式，不限制网络、Storage 或全局对象访问。
- 首版只支持宿主显式 import，项目文档不能触发脚本加载。
- SDK 不向组件 model 传 Token、Adapter、Store、Router、QueryClient、fetch callback 或 DOM root。
- props 和 event payload 采用 JSON 边界、detached clone 与体积限制。
- arbitrary SVG/HTML icon 不进入 manifest；首版只使用 SDK icon token 和 category fallback。
- 宿主负责依赖审查、CSP、lockfile 和组件包发布权限。

## 16. Incremental Release Slices

| Slice | Deliverable                            | User-visible change       | Exit gate                                         |
| ----- | -------------------------------------- | ------------------------- | ------------------------------------------------- |
| 0     | 协议包骨架与 manifest validator              | 无                         | package 独立 build/test，现有编辑器零改动                    |
| 1     | 实例 registry + legacy built-ins adapter | 无                         | 六内置组件行为与测试不变；双实例 registry 隔离                      |
| 2     | 外部指标卡仅渲染                               | 仅组件实验页可见                  | Canvas 正确渲染、preview model harness 通过，生产 SDK 入口未开放 |
| 3     | 声明式 props                              | 指标卡可在属性面板配置               | 编辑、undo/redo、renderer model 更新通过                  |
| 4     | 标准事件                                   | 指标卡事件可连接蓝图                | allowlist、payload、runtime 闸门测试通过                  |
| 5     | ScreenDocumentV2                       | 外部组件可保存、重载、导入导出           | V1/V2 parser 与 missing registry 拒绝测试通过            |
| 6     | SDK + Nebula Host 接入                   | Vanilla/React/Vue 宿主可显式注册 | tarball consumer、编辑/预览共享 registry E2E 通过          |
| 7     | 内置组件逐个迁移                               | 无预期视觉变化                   | 每个组件独立迁移；最终删除 legacy registry                     |

任何 slice 未满足退出条件时，不开始依赖它的下一阶段；无依赖的文档、测试工具和示例可并行。

## 17. Requirements

### Requirement 1: Framework-neutral authoring

系统 SHALL 允许组件作者在不依赖 React 和 private editor core 的情况下定义可被大屏编辑器使用的组件包。

#### Scenario: Vanilla component package

- **WHEN** 一个 Vanilla TypeScript 包实现 Custom Element 并导出合法 Component Plugin
- **THEN** 该包可独立 typecheck/build
- **AND** 不需要安装 React、ReactDOM、Router、Query 或 `@nebula/screen-editor-core`

### Requirement 2: Explicit trusted registration

系统 SHALL 只加载宿主显式传给注册表工厂的外部组件。

#### Scenario: Custom element exists but is not registered

- **WHEN** Document 中已定义某个 Custom Element，但宿主未把对应 plugin 传给 registry factory
- **THEN** 该组件不出现在组件库
- **AND** V2 文档引用该 type 时返回 `MISSING_COMPONENT_DEFINITION`

### Requirement 3: Atomic immutable registry

系统 SHALL 为每个编辑器实例建立不可变且原子创建的组件注册表。

#### Scenario: One plugin is invalid

- **WHEN** 5 个 plugin 中第 4 个 manifest 非法
- **THEN** registry factory reject
- **AND** 不返回只包含前 3 个组件的部分 registry

### Requirement 4: Instance isolation

系统 SHALL 允许同页两个编辑器使用不同的外部组件集合。

#### Scenario: Component only exists in instance A

- **WHEN** 实例 A 注册 `acme.kpi/v1`，实例 B 仅使用内置 registry
- **THEN** 指标卡只出现在 A 的组件库
- **AND** B 加载含该组件的 V2 文档时稳定拒绝

### Requirement 5: Runtime model bridge

系统 SHALL 通过单一 model property 向 Component Element 传递 detached render snapshot。

#### Scenario: Property changes

- **WHEN** 用户在属性面板更新指标卡 title
- **THEN** 同一个 Element 实例收到新 model
- **AND** 旧 model 被组件修改也不能影响 Store

### Requirement 6: Declarative property editing

系统 SHALL 从 manifest 的 propsSchema 和 propertyPanel 生成组件专属属性编辑 UI。

#### Scenario: Invalid property update

- **WHEN** number 控件产生不符合 propsSchema 范围的值
- **THEN** 更新不写入 Store 或历史栈
- **AND** 当前合法 props 保持不变

### Requirement 7: Controlled component events

系统 SHALL 只把 manifest 已声明且 payload 合法的标准组件事件转发到蓝图运行时。

#### Scenario: Undeclared event

- **WHEN** 组件派发 `nebula-component-event` 且 name 未在 manifest 声明
- **THEN** 蓝图不执行
- **AND** debug 诊断不包含原始 payload

#### Scenario: Declared event payload

- **WHEN** 组件派发已声明事件和合法 JSON payload
- **THEN** V2 executor 收到 detached `event.payload`
- **AND** 组件随后修改原 payload 不影响正在执行的规则上下文

### Requirement 8: Registry-aware document validation

系统 SHALL 使用当前实例注册表校验 ScreenDocumentV2 的组件 type 和 props。

#### Scenario: Host lacks required component

- **WHEN** Adapter 返回含 `acme.kpi/v1` 的 V2 文档，但 registry 中无该定义
- **THEN** SDK 拒绝替换当前项目
- **AND** 返回带组件路径的 `MISSING_COMPONENT_DEFINITION`

#### Scenario: Export V2 project

- **WHEN** V2 Adapter 导出包含外部组件的项目
- **THEN** Adapter 返回结构化 `ScreenProjectExportV2`
- **AND** SDK 校验 TransferV2 后自行生成 JSON Blob

### Requirement 9: V1 compatibility

系统 SHALL 保持 ScreenDocumentV1 的六组件严格读取和旧 consumer 拒绝未来版本的语义。

#### Scenario: Existing V1 project

- **WHEN** 宿主加载合法 V1 文档且未提供自定义 registry
- **THEN** 六个内置组件继续正常编辑和预览
- **AND** 加载过程不要求外部组件包
- **AND** 保存仍输出 V1 document

### Requirement 10: Unified built-in definitions

系统 SHALL 让内置和外部组件从同一实例注册表向组件库、属性面板和蓝图提供定义。

#### Scenario: Built-in text definition

- **WHEN** 组件库、属性面板和蓝图分别查询 text
- **THEN** 三者得到同一个 registry registration 的派生信息
- **AND** 不再读取平行静态表

### Requirement 11: Clean lifecycle

系统 SHALL 在组件删除、type 变化、项目切换和编辑器断连时清理元素与事件监听。

#### Scenario: Editor disconnects

- **WHEN** 含外部组件的编辑器从 DOM 移除
- **THEN** SDK 移除其添加的监听器并卸载元素
- **AND** 后续事件不能写入已销毁会话

### Requirement 12: No document-driven code loading

系统 SHALL 禁止项目文档声明或触发组件脚本加载。

#### Scenario: Document includes module URL

- **WHEN** V2 文档包含未知 moduleUrl/tagName/script 字段
- **THEN** wire/domain 校验拒绝该字段
- **AND** SDK 不执行 import、script injection 或 fetch

### Requirement 13: Versioned opt-in

系统 SHALL 通过 SDK 0.2 components 入口和 V2 Adapter marker 显式启用外部组件持久化，不改变默认 V1 宿主行为。

#### Scenario: External registry with V1 adapter

- **WHEN** 宿主注入含外部组件的 registry，但 adapter 没有 `documentVersion: 2`
- **THEN** SDK 在项目 load 前拒绝该组合
- **AND** 不调用 Adapter、不创建部分编辑会话

#### Scenario: V1 document loaded through V2 adapter

- **WHEN** V2 Adapter 返回合法 V1 document
- **THEN** SDK 无损规范化为 V2 并标记 migration pending
- **AND** 保存 V2 成功前阻止发布

#### Scenario: V2 save event

- **WHEN** V2 项目保存成功
- **THEN** `save()` 返回 `ScreenProjectEnvelopeV2`
- **AND** `nebula-save-success` 携带同一个 V2 envelope 分支

### Requirement 14: No external data capability

系统 SHALL 在组件协议 V1 拒绝外部组件的数据源、逻辑层和交互层配置。

#### Scenario: External component contains data source

- **WHEN** V2 文档中的 host component 包含 dataSource、logic 或 interaction
- **THEN** SDK 返回 `UNSUPPORTED_COMPONENT_CAPABILITY`
- **AND** 不执行请求、不删除配置后继续加载

## 18. Testing Strategy

### 18.1 Contract Tests

- manifest identity、SemVer、tagName、JSON boundary 和默认 props。
- property pointer/control 与 propsSchema 一致性。
- event id 唯一、payload JSON 和 64 KiB 上限。
- duplicate type/tagName、define failure 和 atomic registry creation。
- 重复创建 registry 时 plugin.define 返回同一构造器。

### 18.2 Core Unit and Integration

- 两个实例 registry 隔离。
- 组件库查询、搜索、拖入与 create instance 使用当前 registry。
- renderer DOM 复用、model detached clone、listener cleanup。
- 属性更新、校验失败、undo/redo 和 dirty。
- 标准事件 allowlist 与蓝图触发。
- 合法 payload detached clone 并到达 V2 executor/event context。
- V1 -> V2 规范化、V2 registry-aware parser 和 diagnostics。

### 18.3 Browser E2E

- Vanilla SDK Host 显式注册指标卡并完成完整闭环。
- 同页双实例不同 registry。
- 设计模式与预览模式 model 行为。
- 属性编辑后保存、重载、导出和快照恢复。
- 指标卡自定义事件触发现有 show/hide 动作。
- 缺少 plugin 时 fail-closed，当前项目不被覆盖。
- React/Vue 宿主至少做 property assignment + load 冒烟；不要求复制完整业务 E2E。

### 18.4 Regression

- 六个内置组件现有单元和 E2E。
- SDK V1 static capability 与 dist boundary。
- Nebula dynamic API/dataset 项目。
- Shadow DOM、双实例、快捷键、Portal 和 tarball consumer。

## 19. Release Gates

### Gate A: Internal Vertical Slice

- 指标卡在开发宿主完成注册、展示、拖入和渲染。
- 未修改 ScreenDocument 公共契约。
- 现有六组件回归通过。

### Gate B: Component SDK Preview

- 指标卡完成属性、事件和 V2 内存 round-trip。
- `screen-component-sdk` package 可被独立消费者安装构建。
- 不承诺生产项目持久化。

### Gate C: Public SDK Integration

- V2 Adapter/Transfer/Snapshot 全链路通过。
- `0.2.0` components 入口显式 opt-in，默认 V1 Adapter 保存行为不变。
- Vanilla tarball consumer 与双实例 E2E 通过。
- V1 consumer 回归与未来版本拒绝路径通过。

### Gate D: Built-in Convergence

- 六组件 definition 全部来自实例 registry。
- legacy renderer 已逐组件迁移并最终删除。
- 架构和开发指南更新为组件包工作流。

## 20. Risks and Mitigations

| Risk                             | Mitigation                                     |
| -------------------------------- | ---------------------------------------------- |
| `customElements` 无法重新定义同名 tag    | type/tagName 带契约主版本；registry 检测冲突；宿主单版本选择      |
| 第三方代码访问同源能力                      | 首版仅显式受信任 import；文档不加载代码；安全边界写入文档               |
| props schema 与 property panel 漂移 | 注册时交叉验证 pointer、control、defaultProps           |
| 全局 registry 泄漏到双实例               | registry Context 实例化；禁止生产路径读取模块级 Map           |
| 一次迁移六组件导致回归难定位                   | legacy adapter + 单组件迁移 + 每组件退出门                |
| V2 静态 JSON Schema 无法包含插件 schema  | wire schema 与 registry domain validation 两阶段校验 |
| 动态数据借组件插件绕过安全边界                  | V1 model 不注入 fetch/Token/Adapter；动态数据独立规格      |

## 21. Related Documents

- [大屏设计器 Web Component SDK](../screen-web-component-sdk/spec.md)
- [大屏 SDK 动态数据能力](../screen-sdk-dynamic-data/spec.md)
- [组件库重设计](../component-library-redesign/spec.md)
- [大屏编辑器功能规格](../screen-editor/README.md)
- [大屏设计器架构](../../architecture/screen-editor-architecture.md)
- [ADR-0001：大屏 SDK 静态 Runtime 边界](../../decisions/ADR-0001-screen-sdk-static-runtime-boundary.md)
- [ADR-0002：大屏组件扩展协议](../../decisions/ADR-0002-screen-component-extension-protocol.md)
- [实施任务](./tasks.md)
- [验收清单](./checklist.md)
