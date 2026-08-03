# 大屏统一组件契约与 React 19、Vue 3 注册桥接 Spec

> 状态：设计中
> 最近更新：2026-08-03
> 定位：统一大屏组件、文档、宿主运行时与数据执行契约，并定义普通 React 19 组件与 Vue 3 SFC 注册为大屏组件的正式桥接方案

## 0. 文档状态

本文已冻结需求边界与技术方向，可用于实现任务拆分。实现完成并通过
[checklist.md](./checklist.md) 后，状态更新为“生效中”。

本规格取代以下仍在活动代码或文档中出现的双轨设计：

- 组件 manifest API v1/v2。
- Custom Element model v1/v2。
- Screen Document V1/V2 与 Dynamic Screen Document V3 并行。
- `@nebula/screen-sdk` 与 `@nebula/screen-dynamic-sdk` 并行。
- React/Vue 只能作为 SDK 宿主、不能直接注册普通框架组件的现状。

项目处于未发布的建设阶段，本次变更不承担历史数据或已发布消费者兼容义务。

## 1. 背景与问题

当前大屏组件扩展已经采用 Manifest + Web Component + 实例注册表，宿主可以将
`ScreenComponentPlugin` 注入设计器。该协议具备跨框架基础，但 React 19 与 Vue 3 支持仍停留在宿主侧：

- Vue 应用可以挂载 `<nebula-screen-editor>`、`<nebula-screen-designer>` 或
  `<nebula-screen-viewer>`。
- React 应用可以通过 ref 挂载上述元素，但普通 `ComponentType` 不能直接成为组件插件。
- 外部组件测试仍使用手写 `HTMLElement`，没有 Vue 编写的真实大屏组件。
- 现有 Web 虽然使用 React，组件 registry 中注册的仍是 Vanilla Custom Element，不构成 React 组件桥接证据。
- 普通 Vue SFC 不能直接传给 registry，组件作者需要自行理解 Custom Element ABI、model
  property、标准事件和构造器幂等约束。
- 普通 React 组件同样需要作者手写 `HTMLElement`、`createRoot()` 生命周期和 callback props 事件转换。
- Vue emit 不会自动转换为 `nebula-component-event`，普通 SFC 样式在 Shadow DOM 中也不能
  自动工作。

同时，当前分支重新出现了多个版本化契约和两个 SDK 包：

- `ScreenComponentElementModel` 与 `ScreenComponentElementModelV2` 并存。
- manifest validator 同时接受 `nebula.screen-component/v1` 和 `/v2`。
- static SDK 使用正式文档，dynamic SDK 使用 `DynamicScreenDocumentV3`。
- dynamic SDK 通过独立 `/dynamic` 类型入口和 alpha 包暴露数据能力。

这些分支不是已发布兼容边界，而是建设期间的阶段性实现。继续在其上增加框架专属 V1/V2
适配器会固化不必要的复杂度，因此必须先收敛成唯一现行契约，再建立 React/Vue 桥接。

## 2. 目标

- 只保留一套正式的组件 manifest、元素 model、Screen Document 和宿主 Adapter。
- 只保留 `@nebula/screen-sdk` 一个设计器/查看器 SDK 包。
- 使用固定 wire marker 拒绝未知输入，但不维护多版本联合、运行时分支或迁移逻辑。
- 文档数据源只支持 `static` 与通用 `host-resource`。
- 数据请求由宿主 Adapter 执行，SDK 和组件不接触 Token、URL、SQL 或敏感请求头。
- 提供 `@nebula/screen-component-react`，允许普通 React 19 函数组件/组件类型注册为大屏组件。
- 提供 `@nebula/screen-component-vue`，允许普通 Vue 3 SFC/组件对象注册为大屏组件。
- 默认将 `model.props` 映射为普通 React props，并把 React callback props 转换为标准组件事件。
- 默认将 `model.props` 映射为普通 Vue props，并允许显式映射完整 model。
- 将 Vue emits 转换为受 manifest 白名单与 JSON 边界保护的标准组件事件。
- 默认使用 Light DOM 兼容普通 SFC 样式，同时允许组件作者显式选择 Shadow DOM。
- 通过真实 React TSX 与 Vue SFC 分别完成组件库、画布、属性编辑、预览、数据、事件和卸载闭环。

## 3. 非目标

本规格不包含：

- React 18 及以下、React Server Components、Vue 2、Options API 专用封装或其他前端框架适配包。
- SSR、旧浏览器 Custom Element polyfill 或移动端编辑承诺。
- 从项目文档、URL 或组件市场动态加载组件代码。
- 不受信任组件的 iframe/Worker 安全沙箱。
- 自定义 React/Vue 属性面板、任意属性面板 render function。
- 将宿主 React/Vue App、Router、QueryClient、Pinia、i18n、Token、Cookie 或内部 Store 注入组件。
- 在文档中定义 API URL、SQL、认证信息或请求头等一等传输配置字段；普通字符串只做结构校验，最终由
  resource resolver 的字段 allowlist 拒绝伪装内容。
- 保留 API/dataset 数据源、XJ 专用 `host/xj-metric` wire 类型或旧动态文档。
- 历史文档迁移、兼容 alias、deprecated API 或一次性数据转换脚本。
- 同一 Document 中同时运行同一 type/tagName 的不兼容实现。

## 4. 已确认决策

| 决策项 | 结论 |
| --- | --- |
| 规格范围 | 同时完成唯一契约收敛与 React 19、Vue 3 桥接 |
| SDK 包 | `@nebula/screen-dynamic-sdk` 合并回 `@nebula/screen-sdk` |
| 版本策略 | 单一固定 marker，不维护 V1/V2/V3 分支 |
| 旧数据 | 直接删除或重置，不提供迁移 |
| 数据源 | `static` + 通用 `host-resource` |
| Vue 输入 | 普通 SFC 或 Vue `Component` 对象 |
| React 输入 | 普通函数组件或 React `ComponentType` |
| 默认数据映射 | `model.props` 分别映射为普通 React/Vue props |
| React 事件映射 | manifest event id 映射到桥接层注入的 callback prop，回调参数转换为标准事件 payload |
| 样式策略 | Light DOM 默认，Shadow DOM 显式 opt-in |
| Vue 版本 | Vue `^3.5.0` peer dependency |
| React 版本 | React/React DOM `^19.1.0` peer dependencies |
| 注册责任 | registry factory 统一调用 `customElements.define()` |
| 动态请求 | 仅宿主 Adapter 执行 |
| wire schema 归属 | `@nebula/shared` 的 `screen.schema.ts` 为唯一来源；core 只做 registry-aware 语义校验 |
| marker 同值输入 | `schemaVersion: 1` 只标识当前 shape；拒绝旧专属字段，无法识别 shape 完全相同的历史输入来源 |
| 项目持久化 | `screen_projects.document` 为唯一非空 document 存储；API 返回嵌套 document，开发/E2E 数据直接重置 |
| Dataset 引用 | Screen 不维护 DatasetReference；Dataset 如被使用，仅作为宿主内部 host-resource 实现 |
| Monaco 边界 | designer 接收专用 framework-neutral mount Port，不公开 React/Monaco 类型或通用 panel renderer |
| Vue 示例包 | `packages/indicator-card-vue`，`@nebula-example/indicator-card-vue` |
| React 示例包 | `packages/indicator-card-react`，`@nebula-example/indicator-card-react` |
| Vue consumer | `apps/screen-sdk-vue-consumer`，`@nebula/screen-sdk-vue-consumer` |
| 工具链 | Node.js `22.22.3`+，pnpm `9.15.0`；`@types/node ^24` 不代表 runtime 要求 |

## 5. 术语

| 术语 | 含义 |
| --- | --- |
| 固定 marker | 当前唯一 wire 契约的常量标识，只用于拒绝未知输入，不用于运行时版本分流 |
| Component Plugin | `{ manifest, define }`，registry 接收的最小注册单元 |
| Vue Bridge | 将 Vue Component 包装为稳定 Custom Element 构造器和 Component Plugin 的适配层 |
| React Bridge | 将 React ComponentType 包装为稳定 Custom Element 构造器和 Component Plugin 的适配层 |
| Host Resource | 由宿主定义、鉴权和执行的数据资源，文档只保存资源意图 |
| Data Capability | manifest 对组件可接受数据源种类和 host resource type 的声明 |
| Element Model | SDK 通过 JavaScript property 原子赋给组件 Custom Element 的 detached snapshot |

## 6. 总体架构

### 6.1 包依赖

```text
@nebula/screen-component-sdk       framework-free component contracts
              ↑
              ├──────── @nebula/screen-component-react
              │               React 19 bridge, optional peer dependencies
              │
              ├──────── @nebula/screen-component-vue
              │               Vue 3 bridge, optional peer dependency
              │
              └──────── @nebula/screen-editor-core
                              ↑
                       @nebula/screen-sdk
                         designer + viewer
                              ↑
                    Vanilla / React / Vue hosts
```

约束：

- `screen-component-sdk` 保持零运行时依赖，不导入 Vue、React 或 editor core。
- `screen-component-react` 只依赖 `screen-component-sdk`，并将 React 与 React DOM 声明为 peer dependencies。
- `screen-component-vue` 只依赖 `screen-component-sdk`，并将 Vue 声明为 peer dependency。
- `screen-editor-core` 不依赖 `screen-component-react`。
- `screen-editor-core` 不依赖 `screen-component-vue`。
- `screen-editor-core` 的编辑器实现可继续使用 React；`screen-sdk` 将该内部 runtime 打入自包含产物，不能把
  React 变成 Vanilla consumer 必装的 peer，也不能把内部 React 类型暴露为组件 ABI。
- `screen-sdk` 不自动导入任意 React/Vue 组件包；宿主必须显式组合 registry。
- 删除 `screen-component-sdk/dynamic` 和 `screen-dynamic-sdk` 公共入口。

### 6.2 运行时数据流

```text
React Component / Vue SFC + Manifest
      │
      ▼
defineReactScreenComponent() / defineVueScreenComponent()
      │ ScreenComponentPlugin
      ▼
createScreenComponentRegistry()
      │ stable CustomElementConstructor
      ▼
<nebula-screen-designer> / <nebula-screen-viewer>
      │ element.model = detached snapshot
      ▼
Framework Custom Element → mapModel/default props → React/Vue component
      │ React callback / Vue emit
      ▼
event map → nebula-component-event → core validation → blueprint runtime
```

## 7. 唯一契约

### 7.1 固定 marker 规则

公共常量只保留：

```ts
export const SCREEN_DOCUMENT_SCHEMA_VERSION = 1 as const;
export const SCREEN_COMPONENT_API_VERSION = 'nebula.screen-component/v1' as const;
export const SCREEN_COMPONENT_MODEL_API_VERSION = 1 as const;
```

规则：

- 所有 parser 只接受上述唯一值。
- 不导出 `Legacy*`、`*V1`、`*V2`、`*V3` 或版本联合类型。
- 不根据 marker 选择 parser、renderer、Adapter 或数据能力实现。
- 未来若改变 wire 契约，应直接建立新的正式决策；本规格不预留双轨兼容代码。
- `schemaVersion: 1` 与历史 V1 数值相同不表示 parser 需要识别来源。仅当前 strict shape 是权威；包含
  旧专属 marker、字段或数据源的输入必须拒绝，shape 完全相同的输入按当前文档处理。
- 外部组件 `type` 的 `/v1` 与 `tagName` 的 `-v1` 继续保留。它们是浏览器全局
  Custom Element 不可撤销约束下的组件实现身份，不代表 SDK 同时支持多套协议。

### 7.2 Manifest

```ts
export type ScreenComponentDataSourceKind = 'static' | 'host-resource';

export interface ScreenComponentDataCapability {
  readonly acceptedSources: readonly ScreenComponentDataSourceKind[];
  readonly hostResourceTypes?: readonly string[];
}

export interface ScreenComponentManifest {
  readonly apiVersion: typeof SCREEN_COMPONENT_API_VERSION;
  readonly type: string;
  readonly implementationVersion: string;
  readonly tagName: string;
  readonly name: string;
  readonly category: ScreenComponentCategory;
  readonly icon?: ScreenComponentIconToken;
  readonly description?: string;
  readonly keywords?: readonly string[];
  readonly defaultSize: { readonly width: number; readonly height: number };
  readonly defaultProps: Readonly<ScreenComponentProps>;
  readonly defaultStyle?: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly propsSchema: ScreenComponentPropsSchema;
  readonly propertyPanel?: readonly ScreenComponentPropertySection[];
  readonly events?: readonly ScreenComponentEventDefinition[];
  readonly dataCapability: ScreenComponentDataCapability;
}
```

`dataCapability` 校验规则：

- `acceptedSources` 去重，只允许 `static`、`host-resource`。
- 空数组表示组件不接受数据源，不再使用字符串 `none`。
- 只有包含 `host-resource` 时才允许设置 `hostResourceTypes`。
- 接受 `host-resource` 时，`hostResourceTypes` 必须是非空、去重的稳定标识数组。
- `hostResourceTypes` 使用宿主无关标识，例如 `metric`、`timeseries`，不能包含 URL、租户 ID
  或认证信息。

### 7.3 Element Model

```ts
export type ScreenComponentMode = 'design' | 'preview' | 'viewer';

export type ScreenComponentDataState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: ScreenComponentJsonValue }
  | {
      readonly status: 'error';
      readonly error: {
        readonly message: string;
        readonly reason: 'network' | 'timeout' | 'aborted' | 'invalid-response' | 'unavailable';
      };
    };

export interface ScreenComponentElementModel {
  readonly apiVersion: typeof SCREEN_COMPONENT_MODEL_API_VERSION;
  readonly componentId: string;
  readonly mode: ScreenComponentMode;
  readonly interactive: boolean;
  readonly props: Readonly<ScreenComponentProps>;
  readonly style: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly size: { readonly width: number; readonly height: number };
  readonly dataCapability: Readonly<ScreenComponentDataCapability>;
  readonly dataState: ScreenComponentDataState;
}

export interface ScreenComponentElement extends HTMLElement {
  model: ScreenComponentElementModel;
}
```

规则：

- 所有设计器、预览和查看器路径赋同一种 model。
- 无数据源组件使用 `dataState: { status: 'idle' }`。
- static 数据由 SDK 解析为 `success`；host-resource 数据由数据协调器回写状态。
- model 赋值前必须经过 JSON 边界校验和 detached clone。
- model 更新复用同一个 Custom Element，不因 props、style、size、mode 或 dataState 改变而重建。

### 7.4 数据源

```ts
export interface ScreenStaticDataSource {
  readonly type: 'static';
  readonly staticData: ScreenComponentJsonValue;
  readonly dataPath?: string;
  readonly fieldMapping?: Readonly<Record<string, string>>;
}

export interface ScreenHostResourceDataSource {
  readonly type: 'host-resource';
  readonly resourceType: string;
  readonly resourceId: string;
  readonly params?: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly binding?: Readonly<Record<string, ScreenComponentJsonValue>>;
}

export type ScreenDataSource = ScreenStaticDataSource | ScreenHostResourceDataSource;

export const SCREEN_HOST_RESOURCE_MAX_RESPONSE_BYTES = 1_048_576;

export const SCREEN_HOST_RESOURCE_FORBIDDEN_KEYS = [
  'authorization',
  'cookie',
  'endpoint',
  'header',
  'headers',
  'method',
  'script',
  'sql',
  'token',
  'uri',
  'url',
] as const;
```

约束：

- `resourceId` 使用字符串，避免绑定宿主数据库主键类型。
- `params` 与 `binding` 只允许 JSON value，不定义 URL、请求头、Token、SQL 或 script 等一等传输配置字段。
- `resourceType` 必须匹配 `[a-z][a-z0-9-]{0,63}`；`resourceId` 长度为 1-256，且不得以 URI scheme 开头。
- parser 对 `params`、`binding` 的所有嵌套 object key 执行大小写不敏感的 forbidden-key 检查；命中上述
  常量即拒绝。该规则检查请求描述结构，不扫描普通字符串内容。
- 宿主后端仍必须按 `resourceType` 对 params/binding 做字段 allowlist、类型和权限校验，不能依赖客户端 key
  检查防止秘密或请求配置伪装在其他字段中。
- parser 必须确认组件 manifest 接受当前 source kind。
- `host-resource.resourceType` 必须在 manifest `hostResourceTypes` 白名单内。
- 文档拒绝 `api`、`dataset`、`host/xj-metric`、`sql`、`script` 等旧分支。
- Screen 不维护 DatasetReference。Dataset 若被宿主资源层使用，Screen document 只保存普通 host-resource
  intent，不能用其推导 Dataset 删除保护或引用数。

### 7.5 Screen Document

```ts
export interface ScreenComponentDocumentNode {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly position: ScreenComponentPosition;
  readonly style: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly props: Readonly<ScreenComponentProps>;
  readonly dataSource?: ScreenDataSource;
  readonly status: { readonly locked: boolean; readonly hidden: boolean };
  readonly zIndex: number;
  readonly parentId?: string | null;
}

export interface ScreenDocument {
  readonly schemaVersion: typeof SCREEN_DOCUMENT_SCHEMA_VERSION;
  readonly canvas: ScreenCanvasConfig;
  readonly components: readonly ScreenComponentDocumentNode[];
  readonly globalVariables: readonly ScreenStaticGlobalVariable[];
  readonly blueprint?: EventBlueprint;
}
```

规则：

- wire schema 使用 strict object，未知字段必须拒绝，不能依赖 Zod strip。
- 全局变量首期只保留 static。
- `status` 使用 `{ locked, hidden }`，同时表达设计器锁定与运行时隐藏状态。
- blueprint 使用当前单一组件节点实现，不恢复历史蓝图版本联合。
- `refreshData` 仅允许指向配置了 `host-resource` 的组件。
- parser 先校验 wire，再使用当前实例 registry 校验 type、props、数据能力、事件和动作。

#### 7.5.1 代码归属与持久化

- `packages/shared/src/schemas/screen.schema.ts` 是唯一 `ScreenDocumentSchema`、document 类型和 Screen API
  DTO 来源，并从 `@nebula/shared/schemas` 导出。
- `screen-editor-core` 不得定义第二份 document wire Zod schema；`parseScreenDocument(input, registry)` 先调用
  shared strict schema，再补充 registry-aware 语义诊断。
- 后端 `ScreenProject` API response 使用 `{ id, name, description, status, thumbnail, createdAt, updatedAt,
  document }`，不再把 `canvas/components/blueprint/globalVariables` 展平到项目根。
- 更新请求只接受可选项目元数据与可选完整 `document`；当 `document` 出现时按原子替换处理，不接受分散的
  canvas/components/blueprint/globalVariables 更新字段。
- `screen_projects.document` 是唯一且非空的持久化 document 字段。历史 `canvas`、`components`、`blueprint`
  列、legacy reader 和写回迁移在 BUS-4 删除；开发/E2E SQLite 在执行时取得明确确认后重置，不提供数据迁移。

### 7.6 宿主 Adapter

项目操作与数据执行通过一个 `ScreenHostAdapter` 注入：

```ts
export interface ScreenHostResourceIntent {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly params?: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly binding?: Readonly<Record<string, ScreenComponentJsonValue>>;
}

export interface ScreenHostResourceSummary {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly name: string;
  readonly metadata?: Readonly<Record<string, ScreenComponentJsonValue>>;
}

export type ScreenDataContextSource = 'design' | 'preview' | 'viewer';

export interface ScreenDataExecutionContext {
  readonly contextId: string;
  readonly projectId: string;
  readonly source: ScreenDataContextSource;
}

export interface ScreenHostDataAdapter {
  listResources(input: {
    readonly resourceType: string;
    readonly signal?: AbortSignal;
  }): Promise<readonly ScreenHostResourceSummary[]>;
  openContext(context: ScreenDataExecutionContext): Promise<void>;
  syncContext(context: ScreenDataExecutionContext): Promise<void>;
  closeContext(contextId: string): Promise<void>;
  execute(
    request: {
      readonly contextId: string;
      readonly componentId: string;
      readonly intent: ScreenHostResourceIntent;
    },
    signal: AbortSignal,
  ): Promise<{ readonly data: ScreenComponentJsonValue }>;
}

export interface ScreenHostAdapter {
  loadProject(input: LoadProjectInput): Promise<ScreenProjectEnvelopeInput>;
  saveProject(input: SaveProjectInput): Promise<ScreenProjectEnvelopeInput>;
  publishProject?(input: PublishProjectInput): Promise<ScreenProjectEnvelopeInput>;
  importProject?(input: ImportProjectInput): Promise<ScreenProjectEnvelopeInput>;
  exportProject?(input: ExportProjectInput): Promise<ScreenProjectExport>;
  snapshots?: ScreenSnapshotAdapter;
  data?: ScreenHostDataAdapter;
}
```

行为：

- 文档包含 `host-resource` 而 `adapter.data` 缺失时，load/preview/viewer 必须 fail closed。
- SDK 只向 Adapter 传递已由 parser 验证的 intent。
- Adapter 不得信任客户端 `contextId/projectId/resourceId`，宿主后端仍负责认证与对象权限校验。
- 数据协调器继续负责同请求去重、AbortSignal、超时、迟到结果防护和卸载清理。
- Adapter 返回数据必须通过 JSON 边界和响应大小限制后才能写入 model。
- `execute()` 的 detached JSON 结果按 UTF-8 序列化后不得超过
  `SCREEN_HOST_RESOURCE_MAX_RESPONSE_BYTES`（1 MiB）；超限映射为 `invalid-response`，不把正文交给组件。

### 7.7 Nebula Web Host Resource Gateway

Nebula Web 的参考 Adapter 必须通过 Nest Screen 模块的宿主资源网关执行数据，不能从浏览器直接调用任意 URL
或把 document intent 原样转交通用代理：

```text
GET  /screen/:projectId/resources?resourceType=metric
POST /screen/:projectId/resources/execute
POST /screen/:projectId/preview/resources/execute
```

- `GET` 和普通 `POST` 使用 JWT/RBAC；公开 preview `POST` 使用 `@Public()` + 独立限流，但只接受已发布项目。
- execute body 为 `{ contextId, componentId, intent }`，response 为 `{ data: ScreenComponentJsonValue }`；
  `contextId/componentId` 只用于关联与审计，不能作为授权依据。
- 后端使用固定 resolver registry 按 `resourceType` 分派。首个 `metric` resolver 将 opaque `resourceId` 映射为
  Dataset id，并以 `Dataset.projectId === path projectId` 作为权威归属检查；不得查询或重建
  DatasetReference。公开调用还必须验证项目已发布。
- 每个 resolver 提供 strict Zod intent schema，对 params/binding 执行字段 allowlist、类型、数量与长度限制；
  未知字段直接拒绝。文档 parser 的 forbidden-key 检查只是第一道结构门，不能替代 resolver schema。
- resolver 从服务端 Dataset/Connection 配置解析真实 URL、headers、Token 或 SQL；这些值不得出现在 document、
  Adapter 日志、错误响应或组件 model 中。
- Web Adapter 在 `openContext()` 保存 source/project 关联，在 execute 时选择 authenticated 或 preview endpoint；
  close 后请求必须 abort，后端仍独立重验项目、资源和发布状态。

## 8. 单一 SDK

### 8.1 公共元素

`@nebula/screen-sdk` 只提供：

- `<nebula-screen-designer>`：设计、保存、发布和预览入口。
- `<nebula-screen-viewer>`：预览、已发布和审核查看入口。

删除 `<nebula-screen-editor>` 的独立公共实现和 `screen-dynamic-sdk` 元素。仓库内宿主统一迁移到
designer/viewer，不保留 tag alias。

### 8.2 包入口

```text
@nebula/screen-sdk
@nebula/screen-sdk/auto-register
@nebula/screen-sdk/components
@nebula/screen-sdk/contracts
@nebula/screen-sdk/testing
```

要求：

- `components` 导出 registry factory 和组件协议类型。
- `contracts` 导出唯一 Document/Adapter/Zod/JSON Schema。
- `testing` 只导出 fixture 与测试辅助，不进入正常 runtime chunk。
- 删除 `@nebula/screen-component-sdk/dynamic`。
- 删除 `@nebula/screen-dynamic-sdk` package、workspace consumer 依赖和构建任务。
- `apps/dynamic-sdk-vue-consumer` 重命名为 `apps/screen-sdk-vue-consumer`，包名固定为
  `@nebula/screen-sdk-vue-consumer`，且只依赖正式公开入口。
- `apps/web` 通过 canonical designer/viewer 与专用 Monaco Port 接入，不保留直接组合 private core 的生产路径。

### 8.3 Web Monaco JSON 编辑器 Port

Web 现有 Monaco JSON 编辑能力通过专用 Port 注入 designer。该 Port 不是通用 React/Vue 属性面板扩展点，
只服务已有的组件 JSON 编辑工作流：

```ts
export interface ScreenComponentJsonEditorDiagnostic {
  readonly endColumn?: number;
  readonly endLineNumber?: number;
  readonly message: string;
  readonly path?: readonly (string | number)[];
  readonly severity: 'error' | 'info' | 'warning';
  readonly startColumn?: number;
  readonly startLineNumber?: number;
}

export interface ScreenComponentJsonEditorInput {
  readonly ariaLabel: string;
  readonly jsonSchema: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly modelUri: string;
  readonly onChange: (value: string) => void;
  readonly onDiagnosticsChange: (
    diagnostics: readonly ScreenComponentJsonEditorDiagnostic[],
  ) => void;
  readonly readOnly: boolean;
  readonly theme: 'dark' | 'light';
  readonly value: string;
}

export interface ScreenComponentJsonEditorHandle {
  unmount(): void;
  update(input: ScreenComponentJsonEditorInput): void;
}

export interface ScreenComponentJsonEditorPort {
  mount(
    host: HTMLElement,
    input: ScreenComponentJsonEditorInput,
  ): ScreenComponentJsonEditorHandle;
}
```

- `<nebula-screen-designer>` 仅通过 `componentJsonEditor?: ScreenComponentJsonEditorPort` property 接收该 Port。
- Port、registry、Adapter、project/document 必须在首次 load 前设置；首次 load 后替换 Port fail closed。
- SDK public declarations 不得出现 React、Monaco 或任意通用 custom panel renderer 类型。
- Web 在 Port 内部可用 React/Monaco mount/unmount，但这不能改变 SDK、core 或外部组件 ABI。

## 9. Vue 3 桥接

### 9.1 包定义

新增 `packages/screen-component-vue`：

```json
{
  "name": "@nebula/screen-component-vue",
  "peerDependencies": {
    "vue": "^3.5.0"
  },
  "dependencies": {
    "@nebula/screen-component-sdk": "workspace:*"
  }
}
```

包不得依赖 `screen-sdk`、`screen-editor-core`、React、Router、Pinia、i18n 或 UI 组件库。

### 9.2 公共 API

```ts
import type { Component } from 'vue';

export interface VueScreenComponentEventBinding {
  readonly vueEvent?: string;
  readonly mapPayload?: (
    ...args: readonly unknown[]
  ) => ScreenComponentJsonValue | undefined;
}

export interface DefineVueScreenComponentOptions<TProps extends Record<string, unknown>> {
  readonly manifest: ScreenComponentManifest;
  readonly component: Component;
  readonly mapModel?: (model: Readonly<ScreenComponentElementModel>) => TProps;
  readonly events?: Readonly<Record<string, VueScreenComponentEventBinding>>;
  readonly shadowRoot?: boolean;
}

export function defineVueScreenComponent<TProps extends Record<string, unknown> = ScreenComponentProps>(
  options: DefineVueScreenComponentOptions<TProps>,
): ScreenComponentPlugin;
```

实现可以为精确 Vue Props 推导增加 overload，但不得使用 `any`、`@ts-ignore` 或将不安全断言暴露到
公共声明。

### 9.3 Props 映射

- 未提供 `mapModel` 时，业务 SFC 接收 `model.props` 作为普通 Vue props。
- 默认映射不把 `style`、`size`、`mode`、`interactive` 或 `dataState` 混入业务 props。
- 需要这些字段时，组件作者通过 `mapModel(model)` 返回目标 Props。
- `mapModel` 每次 model 原子替换时重新执行。
- 后续更新只更新同一 Vue 组件实例的 props，不重新创建 Custom Element 或 Vue app。
- element connected 但尚未收到首个 model 时，不渲染业务 SFC。
- 映射结果作为只读输入使用；组件不得通过 props 修改编辑器状态。

示例：

```ts
import MetricCard from './MetricCard.vue';
import { defineVueScreenComponent } from '@nebula/screen-component-vue';

export const metricCardPlugin = defineVueScreenComponent({
  manifest: metricCardManifest,
  component: MetricCard,
  mapModel: (model) => ({
    ...model.props,
    loading: model.dataState.status === 'loading',
    data: model.dataState.status === 'success' ? model.dataState.data : null,
    width: model.size.width,
    height: model.size.height,
  }),
  events: {
    valueClick: {
      vueEvent: 'value-click',
      mapPayload: (value) => ({ value: typeof value === 'number' ? value : 0 }),
    },
  },
});
```

### 9.4 Vue emits 桥接

`events` 的 key 是 manifest event id，规则如下：

- key 不在 `manifest.events` 时，`defineVueScreenComponent()` 立即失败。
- `vueEvent` 缺省时使用 event id。
- 未提供 `mapPayload` 时，Vue emit 只能有零个或一个参数。
- 一个参数必须是合法 JSON value，并作为标准事件 payload。
- 多参数 emit 必须提供 `mapPayload`，由组件作者显式转换成单个 JSON value。
- `mapPayload` 返回 `undefined` 表示事件无 payload。
- 映射结果必须被复制成 detached plain JSON，不能把 Vue reactive Proxy 直接传入 core。
- bridge 派发：

```ts
new CustomEvent('nebula-component-event', {
  detail: payload === undefined ? { name: eventId } : { name: eventId, payload },
  bubbles: true,
  composed: true,
});
```

- 事件字段权威名称是 `detail.name`，不得使用 `detail.eventId`。
- core 必须在处理事件时检查当前 model `interactive`，不能只依赖组件或 bridge 自律。
- core 继续执行 manifest allowlist、JSON 边界、UTF-8 64 KiB 上限和 detached clone。

### 9.5 Custom Element 构造器

- bridge 使用 Vue 3.5 `defineCustomElement()`，不自行实现 `HTMLElement + createApp()` 生命周期。
- `defineVueScreenComponent()` 调用时创建并捕获一次构造器。
- plugin `define()` 每次返回同一个构造器引用。
- bridge 不得调用 `customElements.define()`。
- registry factory 继续负责预检、构造器解析、串行全局 commit 和冲突检测。
- 同一 tagName 已由不同构造器定义时 fail closed。

### 9.6 Light DOM 与 Shadow DOM

默认 `shadowRoot: false`：

- 普通 `.vue` SFC、scoped CSS 和由组件包显式导入的 CSS 可直接工作。
- 接受宿主 CSS 可能影响组件、组件 CSS 可能影响宿主的 Light DOM 边界。
- 组件不得依赖编辑器内部类名、CSS module 名或未公开 CSS 变量。

显式 `shadowRoot: true`：

- 组件作者必须使用 `.ce.vue`、Vue Custom Element mode 或显式 inline styles。
- 仅允许继承公开 CSS custom properties。
- Shadow DOM 是样式隔离，不是安全沙箱。

core 对实际 Custom Element 统一设置：

```css
display: block;
width: 100%;
height: 100%;
box-sizing: border-box;
```

### 9.7 生命周期

- 首个 model 到达后才挂载业务 SFC。
- props/data/mode 更新不触发 app 重建。
- element 断开后由 Vue Custom Element 生命周期完成 `onUnmounted` 和 effect cleanup。
- 同步 DOM move 不得误判为永久卸载。
- editor/viewer 卸载时必须取消 host resource 请求、移除事件监听并释放数据上下文。
- 浏览器全局 Custom Element 定义不可撤销；测试使用唯一 tagName 隔离用例。

## 10. React 19 桥接

### 10.1 包定义

新增 `packages/screen-component-react`：

```json
{
  "name": "@nebula/screen-component-react",
  "peerDependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "dependencies": {
    "@nebula/screen-component-sdk": "workspace:*"
  }
}
```

包不得依赖 `screen-sdk`、`screen-editor-core`、Vue、Router、TanStack Query、状态管理或 UI 组件库。
React 与 React DOM 在 build 中保持 external；测试可在 devDependencies 中提供 peer，但发布产物不得打入第二份
React runtime。

### 10.2 公共 API

```ts
import type { ComponentType } from 'react';

export interface ReactScreenComponentEventBinding {
  readonly callbackProp?: string;
  readonly mapPayload?: (
    ...args: readonly unknown[]
  ) => ScreenComponentJsonValue | undefined;
}

export interface DefineReactScreenComponentOptions<TProps extends object> {
  readonly manifest: ScreenComponentManifest;
  readonly component: ComponentType<TProps>;
  readonly mapModel?: (model: Readonly<ScreenComponentElementModel>) => TProps;
  readonly events?: Readonly<Record<string, ReactScreenComponentEventBinding>>;
  readonly shadowRoot?: boolean;
}

export function defineReactScreenComponent<TProps extends object = ScreenComponentProps>(
  options: DefineReactScreenComponentOptions<TProps>,
): ScreenComponentPlugin;
```

实现可以增加 Props 推导 overload，但不得使用 `any`、`@ts-ignore` 或把 bridge 内部 root/element 类型泄漏到
公共声明。组件事件 callback prop 应声明为可选，由 bridge 在运行时注入。

### 10.3 Props 与 model 映射

- 未提供 `mapModel` 时，业务 React 组件接收 `model.props` 作为普通 props。
- 默认映射不把 `style`、`size`、`mode`、`interactive` 或 `dataState` 混入业务 props。
- `mapModel(model)` 可读取完整只读 model，其返回值必须是满足 JSON 边界的 plain object。
- event callback props 由 bridge 最后合并并覆盖同名映射值，项目文档不能伪造函数或替换事件出口。
- element connected 但尚未收到首个 model 时，不创建 React root，也不渲染业务组件。
- 后续 model 更新在同一 root 中渲染同一组件类型，不改变 key，React 组件实例与 hook state 保持稳定。

示例：

```tsx
import { defineReactScreenComponent } from '@nebula/screen-component-react';

interface MetricCardProps {
  readonly title: string;
  readonly value: number;
  readonly loading?: boolean;
  readonly onValueClick?: (value: number) => void;
}

function MetricCard(props: MetricCardProps) {
  return (
    <button type="button" onClick={() => props.onValueClick?.(props.value)}>
      {props.loading ? 'Loading' : `${props.title}: ${props.value}`}
    </button>
  );
}

export const metricCardPlugin = defineReactScreenComponent({
  manifest: metricCardManifest,
  component: MetricCard,
  mapModel: (model) => ({
    title: typeof model.props.title === 'string' ? model.props.title : '',
    value: typeof model.props.value === 'number' ? model.props.value : 0,
    loading: model.dataState.status === 'loading',
  }),
  events: {
    valueClick: {
      callbackProp: 'onValueClick',
      mapPayload: (value) => ({ value: typeof value === 'number' ? value : 0 }),
    },
  },
});
```

### 10.4 Callback Props 事件桥接

`events` 的 key 是 manifest event id，规则如下：

- key 不在 `manifest.events` 时，`defineReactScreenComponent()` 立即失败。
- `callbackProp` 缺省时使用 `on${eventId 首字母大写}`，例如 `valueClick` 对应 `onValueClick`。
- callback prop 必须是非空字符串，且多个 event 不得映射到同一 prop。
- 每个 Custom Element 实例在生命周期内为每个 event 创建一个稳定 callback 引用。
- 未提供 `mapPayload` 时，callback 只能有零个或一个参数；一个参数必须是合法 JSON value。
- 多参数 callback 必须提供 `mapPayload`，返回 `undefined` 表示事件无 payload。
- mapper 输出复用 component SDK 的 detached JSON、prototype pollution 与 UTF-8 64 KiB 边界。
- bridge 派发与 Vue 相同的 `nebula-component-event`；无 payload 时省略该字段，detail 权威 shape 为
  `{ name, payload? }`。
- core 仍以当前可信 model 的 `interactive` 和 manifest allowlist 为最终事件闸门。

### 10.5 Custom Element 与 React Root 生命周期

- React 没有对应 `defineCustomElement()` 的官方 API；bridge 实现最小 `HTMLElement` 子类并使用
  `react-dom/client` 的 `createRoot()`，不得复用宿主 React root 或 Context。
- `defineReactScreenComponent()` 调用时创建并捕获一次 Custom Element 构造器；`plugin.define()` 始终返回同一引用。
- bridge 不调用 `customElements.define()`，registry factory 继续负责原子 commit 与构造器冲突检测。
- Light DOM 使用元素本身作为 root container；Shadow DOM 使用一次性 `attachShadow()` 返回值作为 root container。
- bridge 不自动包裹 `StrictMode`，不创建随机 key，不在 model 更新时重建 root。
- 永久断开通过 microtask 后复检 `element.isConnected` 再 `root.unmount()`，同步 DOM move 不得误卸载。
- 永久断开后重新连接时可基于最后一个 detached model 创建新 root；旧 effect、listener 和 callback 必须已清理。
- root unmount 后到达的 model、事件或异步回调必须被忽略。

### 10.6 Light DOM 与 Shadow DOM

默认 `shadowRoot: false`：

- 组件包显式导入的普通 CSS/CSS Modules 可在 Light DOM 中工作。
- 接受宿主 CSS 与组件 CSS 可能互相影响的边界，组件不得依赖编辑器内部类名。

显式 `shadowRoot: true`：

- React root 挂载到 ShadowRoot；组件作者必须通过 inline style、组件渲染的 `<style>` 或包内明确安装的
  stylesheet 提供样式。
- bridge 不把宿主 CSS-in-JS provider、theme、Router、QueryClient 或其他 React Context 注入 ShadowRoot。
- Shadow DOM 只提供样式隔离，不是安全沙箱。

core 对 React Custom Element 使用与 Vue/Vanilla 相同的 block/100%/box-sizing 容器样式。

## 11. 权威校验与错误边界

### 11.1 注册时

`defineVueScreenComponent()` 必须验证：

- manifest 合法。
- event map key 全部已声明。
- Vue event name 非空且不重复映射到冲突监听器。
- `component` 是可由 Vue 渲染的 Component。
- `shadowRoot` 为 boolean 或缺省。

`defineReactScreenComponent()` 必须验证：

- manifest 合法。
- event map key 全部已声明，callback prop 非空且唯一。
- `component` 是可由 React 渲染的 ComponentType。
- `shadowRoot` 为 boolean 或缺省。

registry factory 继续验证：

- type/tagName 唯一。
- `define()` 返回构造器。
- 已存在 tagName 的构造器身份一致。
- 任一失败不返回部分 registry。

### 11.2 文档加载时

唯一 parser 必须拒绝：

- 固定 marker 不匹配。
- 未注册组件 type。
- props 不满足 manifest schema。
- dataSource kind 不在 manifest capability 中。
- host resource type 不在组件白名单中。
- 未声明事件、动作或悬空组件引用。
- 非 JSON 值、循环引用和 prototype pollution key。

### 11.3 运行时

- `mapModel` 或 React/Vue render 失败不得覆盖或修改项目文档。
- wire 与 registry 语义通过后，designer/viewer load controller 发现文档含 host-resource 但缺少
  `adapter.data` 时必须在挂载组件和执行请求前 fail closed；该检查不属于纯 document parser。
- 事件映射失败只记录 code、组件 type 和 event id，不记录 payload、props 或敏感数据。
- host resource 失败写入脱敏 `dataState.error`，不把响应正文、请求信息或 Token 交给组件。
- unmount 后到达的请求结果必须忽略。

## 12. 安全与信任边界

- 外部 React/Vue 组件包是宿主显式导入的受信任代码，与宿主运行在同一 realm。
- 项目文档不能声明模块 URL、脚本、构造器、React/Vue 组件或动态 import。
- 组件只能接收 detached model，不能接收 Adapter、Token、Cookie、Router、QueryClient 或 Store。
- host resource 只描述意图；认证、权限、真实请求和审计属于宿主后端。
- 所有持久化 props、model/mapModel 数据 props、数据状态和事件 payload 必须满足 JSON 边界；React bridge
  在该边界之后注入的受信 callback functions 是运行时能力，不属于 document/model JSON props。
- `interactive=false` 必须由 core 强制阻止业务事件进入蓝图。
- Light DOM 不提供安全隔离；Shadow DOM 也不是脚本沙箱。

## 13. 删除与替换策略

本次直接删除，不保留兼容层：

- `ScreenComponentElementModelV2`、`ScreenDynamicComponentElement`。
- `SCREEN_COMPONENT_API_VERSION_V2` 和 `screen-component-sdk/dynamic`。
- `DynamicScreenDocumentV3*`、V1/V2 Document 联合和 legacy parser/migration。
- `@nebula/screen-dynamic-sdk` package。
- `<nebula-screen-editor>` 旧公共元素及 auto-register 路径。
- XJ fixture 组件中的专用 `host/xj-metric` wire 类型。
- 版本化 Adapter、Transfer、Snapshot alias 和兼容测试。
- 开发数据库、fixture、snapshot 中的旧文档数据。

保留：

- 历史归档文档，用于解释曾经的设计过程。
- 外部组件 type `/v1`、tagName `-v1` 和 implementation SemVer。
- package SemVer；它与 wire marker 不属于同一概念。

## 14. Requirements

### R1：唯一组件与文档契约

系统 SHALL 只公开和执行一套正式组件、文档和 Adapter 契约。

#### Scenario：公共类型检查

- **WHEN** 消费者检查 `screen-component-sdk`、`screen-editor-core` 和 `screen-sdk` 声明文件
- **THEN** 只能找到无版本后缀的正式类型
- **AND** 不存在 `Legacy*`、`*V1`、`*V2`、`*V3` 或版本联合

#### Scenario：未知 marker

- **WHEN** 宿主加载 marker 不等于当前固定值的 manifest、model 或 document
- **THEN** 系统 fail closed
- **AND** 不尝试迁移或选择其他 parser

### R2：单一 Screen SDK

系统 SHALL 通过 `@nebula/screen-sdk` 同时提供 designer、viewer、registry 和正式契约。

#### Scenario：干净消费者安装

- **WHEN** Vanilla、React 或 Vue 消费者安装打包后的 SDK
- **THEN** 可从正式入口加载 designer 和 viewer
- **AND** 不需要安装或导入 `@nebula/screen-dynamic-sdk`

### R3：受限数据源

系统 SHALL 只接受 static 和通用 host-resource 数据源，并由宿主执行 host-resource。

#### Scenario：合法 host resource

- **GIVEN** 组件 manifest 接受 `host-resource` 和资源类型 `metric`
- **WHEN** 文档配置 `resourceType='metric'` 且 Adapter 提供 data capability
- **THEN** parser 接受文档
- **AND** SDK 只把已验证 intent 交给 Adapter

#### Scenario：禁止的请求描述

- **WHEN** 文档使用 `api`、`dataset` 数据源，或 params/binding 任意层包含 `url`、`headers`、`token`、
  `sql`、`script` 等 forbidden key
- **THEN** strict parser 拒绝文档
- **AND** 不调用 Adapter

### R4：普通 Vue SFC 注册

组件作者 SHALL 能够用普通 Vue 3 SFC/Component 和 manifest 创建标准 Component Plugin。

#### Scenario：创建 plugin

- **WHEN** 组件作者调用 `defineVueScreenComponent({ manifest, component })`
- **THEN** 返回值满足 `ScreenComponentPlugin`
- **AND** `define()` 重复调用返回同一个 Custom Element 构造器
- **AND** bridge 不自行注册 tagName

### R5：Props 与 model 更新

Vue bridge SHALL 默认把 `model.props` 映射为 Vue props，并保持原子响应式更新。

#### Scenario：默认映射

- **WHEN** SDK 首次赋值 model
- **THEN** 普通 SFC 收到与 `model.props` 对应的 props
- **AND** 首个 model 之前业务 SFC 不渲染

#### Scenario：后续更新

- **WHEN** props、style、size、mode 或 dataState 改变
- **THEN** bridge 更新同一个 Vue 组件实例
- **AND** 不重建 Custom Element 或 Vue app

### R6：Vue 事件桥接

Vue bridge SHALL 将声明的 Vue emits 转换为标准、受校验的 Nebula 组件事件。

#### Scenario：映射事件

- **GIVEN** manifest 声明 `valueClick`
- **WHEN** SFC emit `value-click` 且 mapPayload 返回合法 JSON
- **THEN** bridge 派发 detail 为 `{ name: 'valueClick', payload }` 的标准事件
- **AND** core 使用可信 component id 执行蓝图

#### Scenario：交互关闭

- **WHEN** 当前 model `interactive=false`
- **AND** 组件仍派发标准事件
- **THEN** core 忽略事件
- **AND** 不执行蓝图动作

### R7：样式与生命周期

Vue bridge SHALL 默认兼容普通 SFC 样式，并在元素卸载时完整清理 Vue 副作用。

#### Scenario：Light DOM

- **WHEN** 未设置 `shadowRoot`
- **THEN** 普通 SFC scoped CSS 正常生效
- **AND** Custom Element 填满组件容器

#### Scenario：断开连接

- **WHEN** 组件从画布或 viewer 移除
- **THEN** Vue `onUnmounted` 被调用
- **AND** 监听器、定时器和数据请求被清理

### R8：注册原子性

React/Vue 组件 SHALL 继续服从实例 registry 和浏览器全局 Custom Element 的原子注册规则。

#### Scenario：构造器冲突

- **GIVEN** 同一 tagName 已由不同构造器定义
- **WHEN** 宿主创建 registry
- **THEN** registry 创建失败
- **AND** 不返回部分组件集合

### R9：包依赖边界

React/Vue 桥接 SHALL 是互相独立的可选包。component SDK 保持框架无关；React-based editor core 与
screen SDK 不依赖 bridge，且公共组件 ABI 不暴露 React/Vue 类型。screen SDK 可继续把内部 React runtime
打入自包含产物，但不得要求 Vanilla consumer 安装 React peer。

#### Scenario：Vanilla consumer

- **WHEN** Vanilla 消费者安装 `screen-component-sdk` 和 `screen-sdk`
- **THEN** 依赖图不要求 React、React DOM 或 Vue
- **AND** SDK 正常构建和运行

#### Scenario：React consumer

- **WHEN** React 19.1 消费者安装 `screen-component-react`
- **THEN** 使用消费者提供的单一 React 与 React DOM peer
- **AND** 产物不包含重复 React runtime

#### Scenario：Vue consumer

- **WHEN** Vue 3.5 消费者安装 `screen-component-vue`
- **THEN** 使用消费者提供的单一 Vue peer
- **AND** 产物不包含重复 Vue runtime

### R10：无历史兼容代码

系统 SHALL 直接删除旧契约和开发数据，不保留运行时或离线迁移路径。

#### Scenario：旧文档输入

- **WHEN** 测试向当前 parser 输入包含旧契约专属 marker、字段或数据源的文档
- **THEN** 不满足当前 strict schema 的输入被稳定拒绝
- **AND** 不规范化、不剥离字段、不覆盖现有项目

### R11：Vue 纵向切片

系统 SHALL 使用真实 Vue SFC 证明注册、设计、查看、数据和事件闭环。

#### Scenario：设计器到查看器

- **WHEN** 用户从组件库拖入 Vue 组件、修改 props、保存并在 viewer 打开
- **THEN** 同一 manifest 驱动组件库、属性面板、画布和 viewer
- **AND** props 与 host-resource 数据正确渲染
- **AND** 交互事件按蓝图执行

### R12：普通 React 组件注册

组件作者 SHALL 能够用普通 React 19 ComponentType 和 manifest 创建标准 Component Plugin。

#### Scenario：创建 plugin

- **WHEN** 组件作者调用 `defineReactScreenComponent({ manifest, component })`
- **THEN** 返回值满足 `ScreenComponentPlugin`
- **AND** `define()` 重复调用返回同一个 Custom Element 构造器
- **AND** bridge 不自行注册 tagName

### R13：React Props 与事件桥接

React bridge SHALL 默认映射 model props，并将声明的 callback props 转换为标准组件事件。

#### Scenario：model 更新

- **WHEN** SDK 首次赋值 model 并随后更新 props、size、mode 或 dataState
- **THEN** React 组件收到最新映射 props
- **AND** bridge 保持同一个 React root 和组件实例

#### Scenario：callback 映射

- **GIVEN** manifest 声明 `valueClick`
- **WHEN** React 组件调用 `onValueClick(value)` 且 mapper 返回合法 JSON
- **THEN** bridge 派发 detail 为 `{ name: 'valueClick', payload }` 的标准事件
- **AND** 项目 document 不能覆盖 bridge 注入的 callback prop

#### Scenario：React 交互关闭

- **WHEN** 当前 model `interactive=false`
- **AND** React 组件仍调用 bridge callback prop
- **THEN** core 忽略标准事件
- **AND** 不执行蓝图动作

### R14：React 样式与生命周期

React bridge SHALL 默认兼容 Light DOM 样式，并在永久断开时完整卸载 root 与 effect。

#### Scenario：同步 DOM move

- **WHEN** 编辑器在同一事件循环中断开并重新连接 React Custom Element
- **THEN** bridge 不卸载 React root
- **AND** hook state 与 effect 保持连续

#### Scenario：永久断开

- **WHEN** 组件从画布或 viewer 永久移除
- **THEN** React root 执行 `unmount()`
- **AND** effect cleanup、监听器和事件 callback 不再运行

### R15：React 纵向切片

系统 SHALL 使用真实 React TSX 组件证明 bridge、registry、designer/viewer、数据和蓝图闭环。

#### Scenario：Web 设计器到查看器

- **WHEN** Web 用户拖入 React 指标卡、修改 props、保存并在 viewer 打开
- **THEN** 同一 React plugin 驱动组件库、属性面板、画布和 viewer
- **AND** host-resource 状态与 callback 事件正确进入统一 runtime

## 15. 测试策略

### 15.1 单元测试

`screen-component-sdk`：

- 固定 marker 和唯一 manifest 校验。
- data capability/source/resource type 条件约束。
- JSON clone、Vue Proxy 等非 plain 输入、循环引用和 UTF-8 payload 大小。
- 标准事件 `detail.name`、allowlist、interactive gate 和 detached payload。

`screen-component-react`：

- 默认 props 映射、`mapModel` 与 bridge-owned callback prop 合并顺序。
- 首个 model 前不创建 root，model 更新保持同一 root/组件实例。
- 默认与显式 callback prop、零/单/多参数 payload、非法映射和 mapper 异常。
- stable constructor、Light DOM、Shadow DOM、同步 move、永久 disconnect/reconnect 和 effect cleanup。

`screen-component-vue`：

- 默认 props 映射和 `mapModel`。
- 首个 model 前不渲染。
- model 更新保持同一 Vue 实例。
- 同名 event、别名 event、零/单/多参数 payload。
- 非法 event map、非法 payload 和 mapper 异常。
- stable constructor、Light DOM、Shadow DOM、disconnect/reconnect 和 `onUnmounted`。

`screen-editor-core`：

- 唯一 document parser 与 registry-aware 语义。
- design/preview/viewer 的 mode 与 interactive 传递。
- host-resource dataState 流转、取消、超时和迟到结果。
- Custom Element host 稳定尺寸。
- adapter.data 缺失时 fail closed。

Nest host-resource gateway：

- authenticated/public preview 分支与限流。
- 未发布项目、跨项目 Dataset、未知 resourceType 和 unknown params/binding 字段拒绝。
- resolver 输出 JSON/UTF-8 1 MiB 边界、脱敏错误和 Dataset execute 异常。

### 15.2 集成测试

- React/Vue plugin 分别注入公共 registry facade。
- 组件库拖入后使用 manifest default props/size。
- 属性面板更新到同一个 React/Vue Custom Element。
- save/load/export/import/snapshot 使用唯一 Document。
- React callback 与 Vue emit 分别进入真实 blueprint runtime。
- designer 保存后 viewer 使用同一文档和 registry。

### 15.3 Tarball consumer

从当前源码 build/pack 后，在空白临时目录验证：

- Vanilla consumer 不安装 React、React DOM 或 Vue。
- React consumer 安装 React peers，使用 ref 注入 registry/Adapter，并注册真实 React plugin。
- Vue consumer 使用 template ref 注入 SDK，并注册真实 Vue SFC plugin。
- React/React DOM/Vue 在各自 bridge/example 的 peer 图中分别去重；该检查不把 screen SDK 自包含的私有
  React editor bundle 当作 bridge peer 副本，声明不得泄漏 private core 源路径。
- `indicator-card-react` 与 `indicator-card-vue` 各自 pack/install 后只从 bridge/component SDK 公开入口解析。
- root、auto-register、components、contracts、testing 入口可安装和构建。
- 产物不包含 `screen-dynamic-sdk`、旧 dynamic subpath 或重复框架 runtime。

### 15.4 Chromium E2E

真实浏览器至少覆盖：

1. React Web 宿主挂载 designer 并注册真实 React 指标卡。
2. Vue 宿主挂载 designer 并注册真实 Vue 指标卡。
3. 两种组件分别从组件库拖入并修改 props。
4. 保存并切换 viewer。
5. host-resource loading/success/error、timeout reason 与 abort cleanup。
6. React callback 与 Vue emit 分别触发蓝图动作。
7. React callback 与 Vue emit 在 `interactive=false` 时分别不触发动作。
8. React 同步 DOM move 保持 root，永久删除后 effect cleanup。
9. Vue 删除组件和卸载 viewer 后完成清理。
10. 同页双实例使用不同 registry。

## 16. 质量门

实现完成必须依次通过：

```bash
pnpm biome:fix
pnpm biome:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @nebula/screen-component-sdk verify:tarball
pnpm --filter @nebula/screen-component-react verify:tarball
pnpm --filter @nebula-example/indicator-card-react verify:tarball
pnpm --filter @nebula/screen-component-vue verify:tarball
pnpm --filter @nebula-example/indicator-card-vue verify:tarball
pnpm --filter @nebula/screen-sdk size
pnpm --filter @nebula/screen-sdk verify:tarball
pnpm --filter @nebula/screen-sdk-host e2e
pnpm --filter @nebula/web e2e
pnpm --filter @nebula/screen-sdk-vue-consumer e2e
```

浏览器验收必须同时检查：

- designer/viewer 非空白且尺寸正确。
- React TSX 与 Vue SFC 样式实际生效。
- 页面无新增 console error。
- 组件、工具栏、属性面板和画布不重叠。
- 断开后没有继续执行的请求或事件回调。

## 17. 文档同步

实现阶段必须同步：

- 更新 `docs/specs/screen-component-sdk/component-author-guide.md`，加入 React TSX 与 Vue SFC 作者指南。
- 更新 `docs/architecture/screen-editor-architecture.md` 的唯一 registry/runtime/model 说明。
- 更新 `docs/architecture/development-guide.md` 的 React/Vue 组件步骤。
- 将 `docs/specs/screen-sdk-dynamic-data/spec.md` 标记为已归档并指向本文。
- 更新 `docs/specs/README.md` 和 `docs/README.md`。
- 修正文档中标准事件字段 `eventId` 与 `name` 不一致。
- 归档或标注所有仍把 active runtime 描述为 V1/V2/V3 双轨的规格。

## 18. 验收定义

满足以下条件才可将本文状态改为“生效中”：

- 活跃源码和公开声明中不存在版本化双轨类型或 parser 分支。
- workspace 中不存在 `@nebula/screen-dynamic-sdk`。
- `@nebula/screen-sdk` 同时提供 designer/viewer、唯一文档和数据 Adapter。
- 普通 React 19 组件无需手写 HTMLElement 即可进入 registry。
- 普通 Vue 3 SFC 无需手写 HTMLElement 即可进入 registry。
- 两个 bridge 的 default props、mapModel、事件、Light/Shadow DOM 和卸载均有自动化测试。
- React TSX 完成 designer/viewer/host-resource/blueprint Chromium E2E。
- Vue SFC 完成 designer/viewer/host-resource/blueprint Chromium E2E。
- Vanilla 消费者不被迫安装任一框架，React 与 Vue 消费者只安装各自 peer。
- 所有质量门通过。
- active 文档和代码契约一致。

## 19. 关联资料

- [组件作者与宿主注册指南](../screen-component-sdk/component-author-guide.md)
- [现有组件扩展协议 ADR](../../decisions/ADR-0002-screen-component-extension-protocol.md)
- [大屏设计器架构](../../architecture/screen-editor-architecture.md)
- [开发指南](../../architecture/development-guide.md)
- [被取代的动态数据规格](../screen-sdk-dynamic-data/spec.md)
- [实施任务](./tasks.md)
- [验收清单](./checklist.md)
