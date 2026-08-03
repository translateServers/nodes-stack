# 大屏统一组件契约与 Vue 3 注册桥接 Spec

> 状态：设计中
> 最近更新：2026-08-03
> 定位：统一大屏组件、文档、宿主运行时与数据执行契约，并定义普通 Vue 3 SFC 注册为大屏组件的正式桥接方案

## 0. 文档状态

本文已冻结需求边界与技术方向，可用于实现任务拆分。实现完成并通过
[checklist.md](./checklist.md) 后，状态更新为“生效中”。

本规格取代以下仍在活动代码或文档中出现的双轨设计：

- 组件 manifest API v1/v2。
- Custom Element model v1/v2。
- Screen Document V1/V2 与 Dynamic Screen Document V3 并行。
- `@nebula/screen-sdk` 与 `@nebula/screen-dynamic-sdk` 并行。
- Vue 只能作为 SDK 宿主、不能直接注册普通 SFC 的现状。

项目处于未发布的建设阶段，本次变更不承担历史数据或已发布消费者兼容义务。

## 1. 背景与问题

当前大屏组件扩展已经采用 Manifest + Web Component + 实例注册表，宿主可以将
`ScreenComponentPlugin` 注入设计器。该协议具备跨框架基础，但 Vue 3 支持仍停留在宿主侧：

- Vue 应用可以挂载 `<nebula-screen-editor>`、`<nebula-screen-designer>` 或
  `<nebula-screen-viewer>`。
- 外部组件测试仍使用手写 `HTMLElement`，没有 Vue 编写的真实大屏组件。
- 普通 Vue SFC 不能直接传给 registry，组件作者需要自行理解 Custom Element ABI、model
  property、标准事件和构造器幂等约束。
- Vue emit 不会自动转换为 `nebula-component-event`，普通 SFC 样式在 Shadow DOM 中也不能
  自动工作。

同时，当前分支重新出现了多个版本化契约和两个 SDK 包：

- `ScreenComponentElementModel` 与 `ScreenComponentElementModelV2` 并存。
- manifest validator 同时接受 `nebula.screen-component/v1` 和 `/v2`。
- static SDK 使用正式文档，dynamic SDK 使用 `DynamicScreenDocumentV3`。
- dynamic SDK 通过独立 `/dynamic` 类型入口和 alpha 包暴露数据能力。

这些分支不是已发布兼容边界，而是建设期间的阶段性实现。继续在其上增加 Vue V1/V2
适配器会固化不必要的复杂度，因此必须先收敛成唯一现行契约，再建立 Vue 桥接。

## 2. 目标

- 只保留一套正式的组件 manifest、元素 model、Screen Document 和宿主 Adapter。
- 只保留 `@nebula/screen-sdk` 一个设计器/查看器 SDK 包。
- 使用固定 wire marker 拒绝未知输入，但不维护多版本联合、运行时分支或迁移逻辑。
- 文档数据源只支持 `static` 与通用 `host-resource`。
- 数据请求由宿主 Adapter 执行，SDK 和组件不接触 Token、URL、SQL 或敏感请求头。
- 提供 `@nebula/screen-component-vue`，允许普通 Vue 3 SFC/组件对象注册为大屏组件。
- 默认将 `model.props` 映射为普通 Vue props，并允许显式映射完整 model。
- 将 Vue emits 转换为受 manifest 白名单与 JSON 边界保护的标准组件事件。
- 默认使用 Light DOM 兼容普通 SFC 样式，同时允许组件作者显式选择 Shadow DOM。
- 通过真实 Vue SFC 完成组件库、画布、属性编辑、预览、数据、事件和卸载闭环。

## 3. 非目标

本规格不包含：

- Vue 2、Options API 专用封装或其他前端框架适配包。
- SSR、旧浏览器 Custom Element polyfill 或移动端编辑承诺。
- 从项目文档、URL 或组件市场动态加载组件代码。
- 不受信任组件的 iframe/Worker 安全沙箱。
- 自定义 React/Vue 属性面板、任意属性面板 render function。
- 将宿主 Vue App、Router、Pinia、i18n、Token、Cookie 或内部 Store 注入组件。
- 在文档中保存 API URL、SQL、认证信息或请求头。
- 保留 API/dataset 数据源、XJ 专用 `host/xj-metric` wire 类型或旧动态文档。
- 历史文档迁移、兼容 alias、deprecated API 或一次性数据转换脚本。
- 同一 Document 中同时运行同一 type/tagName 的不兼容实现。

## 4. 已确认决策

| 决策项 | 结论 |
| --- | --- |
| 规格范围 | 同时完成唯一契约收敛与 Vue 3 桥接 |
| SDK 包 | `@nebula/screen-dynamic-sdk` 合并回 `@nebula/screen-sdk` |
| 版本策略 | 单一固定 marker，不维护 V1/V2/V3 分支 |
| 旧数据 | 直接删除或重置，不提供迁移 |
| 数据源 | `static` + 通用 `host-resource` |
| Vue 输入 | 普通 SFC 或 Vue `Component` 对象 |
| 默认数据映射 | `model.props` 映射为 Vue props |
| 样式策略 | Light DOM 默认，Shadow DOM 显式 opt-in |
| Vue 版本 | Vue `^3.5.0` peer dependency |
| 注册责任 | registry factory 统一调用 `customElements.define()` |
| 动态请求 | 仅宿主 Adapter 执行 |

## 5. 术语

| 术语 | 含义 |
| --- | --- |
| 固定 marker | 当前唯一 wire 契约的常量标识，只用于拒绝未知输入，不用于运行时版本分流 |
| Component Plugin | `{ manifest, define }`，registry 接收的最小注册单元 |
| Vue Bridge | 将 Vue Component 包装为稳定 Custom Element 构造器和 Component Plugin 的适配层 |
| Host Resource | 由宿主定义、鉴权和执行的数据资源，文档只保存资源意图 |
| Data Capability | manifest 对组件可接受数据源种类和 host resource type 的声明 |
| Element Model | SDK 通过 JavaScript property 原子赋给组件 Custom Element 的 detached snapshot |

## 6. 总体架构

### 6.1 包依赖

```text
@nebula/screen-component-sdk       Vue-free component contracts
              ↑
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
- `screen-component-vue` 只依赖 `screen-component-sdk`，并将 Vue 声明为 peer dependency。
- `screen-editor-core` 不依赖 `screen-component-vue`。
- `screen-sdk` 不自动导入任意 Vue 组件包；宿主必须显式组合 registry。
- 删除 `screen-component-sdk/dynamic` 和 `screen-dynamic-sdk` 公共入口。

### 6.2 运行时数据流

```text
Vue SFC + Manifest
      │
      ▼
defineVueScreenComponent()
      │ ScreenComponentPlugin
      ▼
createScreenComponentRegistry()
      │ stable CustomElementConstructor
      ▼
<nebula-screen-designer> / <nebula-screen-viewer>
      │ element.model = detached snapshot
      ▼
Vue Custom Element → mapModel/default props → Vue SFC
      │ Vue emit
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
```

约束：

- `resourceId` 使用字符串，避免绑定宿主数据库主键类型。
- `params` 与 `binding` 只允许 JSON value，不保存函数、URL、请求头、Token 或 SQL。
- parser 必须确认组件 manifest 接受当前 source kind。
- `host-resource.resourceType` 必须在 manifest `hostResourceTypes` 白名单内。
- 文档拒绝 `api`、`dataset`、`host/xj-metric`、`sql`、`script` 等旧分支。

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
- `apps/dynamic-sdk-vue-consumer` 重命名为单一 SDK Vue consumer，且只依赖正式公开入口。

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
  detail: { name: eventId, payload },
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

## 10. 权威校验与错误边界

### 10.1 注册时

`defineVueScreenComponent()` 必须验证：

- manifest 合法。
- event map key 全部已声明。
- Vue event name 非空且不重复映射到冲突监听器。
- `component` 是可由 Vue 渲染的 Component。
- `shadowRoot` 为 boolean 或缺省。

registry factory 继续验证：

- type/tagName 唯一。
- `define()` 返回构造器。
- 已存在 tagName 的构造器身份一致。
- 任一失败不返回部分 registry。

### 10.2 文档加载时

唯一 parser 必须拒绝：

- 固定 marker 不匹配。
- 未注册组件 type。
- props 不满足 manifest schema。
- dataSource kind 不在 manifest capability 中。
- host resource type 不在组件白名单中。
- host-resource 文档缺少 `adapter.data`。
- 未声明事件、动作或悬空组件引用。
- 非 JSON 值、循环引用和 prototype pollution key。

### 10.3 运行时

- `mapModel` 或 Vue render 失败不得覆盖或修改项目文档。
- 事件映射失败只记录 code、组件 type 和 event id，不记录 payload、props 或敏感数据。
- host resource 失败写入脱敏 `dataState.error`，不把响应正文、请求信息或 Token 交给组件。
- unmount 后到达的请求结果必须忽略。

## 11. 安全与信任边界

- 外部 Vue 组件包是宿主显式导入的受信任代码，与宿主运行在同一 realm。
- 项目文档不能声明模块 URL、脚本、构造器、Vue 组件或动态 import。
- 组件只能接收 detached model，不能接收 Adapter、Token、Cookie、Router、QueryClient 或 Store。
- host resource 只描述意图；认证、权限、真实请求和审计属于宿主后端。
- 所有 props、数据状态和事件 payload 必须满足 JSON 边界。
- `interactive=false` 必须由 core 强制阻止业务事件进入蓝图。
- Light DOM 不提供安全隔离；Shadow DOM 也不是脚本沙箱。

## 12. 删除与替换策略

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

## 13. Requirements

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

- **WHEN** 文档包含 `api`、`dataset`、URL、SQL、Token 或请求头数据源字段
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

Vue 组件 SHALL 继续服从实例 registry 和浏览器全局 Custom Element 的原子注册规则。

#### Scenario：构造器冲突

- **GIVEN** 同一 tagName 已由不同构造器定义
- **WHEN** 宿主创建 registry
- **THEN** registry 创建失败
- **AND** 不返回部分组件集合

### R9：包依赖边界

Vue 桥接 SHALL 是可选包，框架无关 SDK 不得引入 Vue。

#### Scenario：Vanilla consumer

- **WHEN** Vanilla 消费者安装 `screen-component-sdk` 和 `screen-sdk`
- **THEN** 依赖图不要求 Vue
- **AND** SDK 正常构建和运行

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

### R11：端到端闭环

系统 SHALL 使用真实 Vue SFC 证明注册、设计、查看、数据和事件闭环。

#### Scenario：设计器到查看器

- **WHEN** 用户从组件库拖入 Vue 组件、修改 props、保存并在 viewer 打开
- **THEN** 同一 manifest 驱动组件库、属性面板、画布和 viewer
- **AND** props 与 host-resource 数据正确渲染
- **AND** 交互事件按蓝图执行

## 14. 测试策略

### 14.1 单元测试

`screen-component-sdk`：

- 固定 marker 和唯一 manifest 校验。
- data capability/source/resource type 条件约束。
- JSON clone、Vue Proxy 等非 plain 输入、循环引用和 UTF-8 payload 大小。
- 标准事件 `detail.name`、allowlist、interactive gate 和 detached payload。

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

### 14.2 集成测试

- Vue plugin 注入公共 registry facade。
- 组件库拖入后使用 manifest default props/size。
- 属性面板更新到同一个 Vue Custom Element。
- save/load/export/import/snapshot 使用唯一 Document。
- Vue 事件进入真实 blueprint runtime。
- designer 保存后 viewer 使用同一文档和 registry。

### 14.3 Tarball consumer

从当前源码 build/pack 后，在空白临时目录验证：

- Vanilla consumer 不安装 Vue。
- React consumer 使用 ref 注入 registry/Adapter。
- Vue consumer 使用 template ref 注入 SDK，并注册真实 Vue SFC plugin。
- Vue peer 去重，声明不泄漏 private core 源路径。
- root、auto-register、components、contracts、testing 入口可安装和构建。
- 产物不包含 `screen-dynamic-sdk`、旧 dynamic subpath 或重复 Vue runtime。

### 14.4 Chromium E2E

真实浏览器至少覆盖：

1. Vue 宿主挂载 designer。
2. 注册真实 Vue 指标卡组件。
3. 从组件库拖入并修改 props。
4. 保存并切换 viewer。
5. host-resource loading/success/error/abort。
6. Vue emit 触发蓝图动作。
7. `interactive=false` 不触发动作。
8. 删除组件和卸载 viewer 后完成清理。
9. 同页双实例使用不同 registry。

## 15. 质量门

实现完成必须依次通过：

```bash
pnpm biome:fix
pnpm biome:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @nebula/screen-component-vue verify:tarball
pnpm --filter @nebula/screen-sdk verify:tarball
pnpm --filter @nebula/screen-sdk-vue-consumer e2e
```

浏览器验收必须同时检查：

- designer/viewer 非空白且尺寸正确。
- Vue SFC 样式实际生效。
- 页面无新增 console error。
- 组件、工具栏、属性面板和画布不重叠。
- 断开后没有继续执行的请求或事件回调。

## 16. 文档同步

实现阶段必须同步：

- 更新 `docs/specs/screen-component-sdk/component-author-guide.md`，加入 Vue SFC 作者指南。
- 更新 `docs/architecture/screen-editor-architecture.md` 的唯一 registry/runtime/model 说明。
- 更新 `docs/architecture/development-guide.md` 的 Vue 组件步骤。
- 将 `docs/specs/screen-sdk-dynamic-data/spec.md` 标记为已归档并指向本文。
- 更新 `docs/specs/README.md` 和 `docs/README.md`。
- 修正文档中标准事件字段 `eventId` 与 `name` 不一致。
- 归档或标注所有仍把 active runtime 描述为 V1/V2/V3 双轨的规格。

## 17. 验收定义

满足以下条件才可将本文状态改为“生效中”：

- 活跃源码和公开声明中不存在版本化双轨类型或 parser 分支。
- workspace 中不存在 `@nebula/screen-dynamic-sdk`。
- `@nebula/screen-sdk` 同时提供 designer/viewer、唯一文档和数据 Adapter。
- 普通 Vue 3 SFC 无需手写 HTMLElement 即可进入 registry。
- default props、mapModel、事件、Light/Shadow DOM 和卸载均有自动化测试。
- Vue SFC 完成 designer/viewer/host-resource/blueprint Chromium E2E。
- Vanilla/React 消费者不被迫安装 Vue。
- 所有质量门通过。
- active 文档和代码契约一致。

## 18. 关联资料

- [组件作者与宿主注册指南](../screen-component-sdk/component-author-guide.md)
- [现有组件扩展协议 ADR](../../decisions/ADR-0002-screen-component-extension-protocol.md)
- [大屏设计器架构](../../architecture/screen-editor-architecture.md)
- [开发指南](../../architecture/development-guide.md)
- [被取代的动态数据规格](../screen-sdk-dynamic-data/spec.md)
- [实施任务](./tasks.md)
- [验收清单](./checklist.md)
