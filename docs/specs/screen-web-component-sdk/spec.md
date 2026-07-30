# 大屏设计器 Web Component SDK Spec

> 状态：实施中（阶段 2 Checkpoint A 已完成）
> 最近更新：2026-07-30
> 定位：定义大屏设计器以前端 Web Component SDK 交付时的产品边界、宿主适配器、文档协议、元素 API、隔离机制与验收标准

## 1. Why

当前大屏设计器位于 `apps/web/src/features/screen/`，编辑能力本身具有复用价值，但入口仍直接依赖 Nebula 应用运行时：

- `ScreenEditor` 直接读取 TanStack Router 参数并执行页面导航。
- 加载、保存和发布直接依赖 TanStack Query、Nebula HTTP Client、JWT 刷新与业务错误码。
- `useScreenEditorStore`、尺寸提示 Store 和部分蓝图状态是模块级单例。
- Tailwind、shadcn/ui token、React Flow 样式和字体依赖应用全局 CSS。
- Radix Portal 默认渲染到 `document.body`，无法自然工作在 Shadow DOM 内。
- 快捷键、DOM 查询、pointer 监听和 localStorage key 存在页面全局假设。
- API 数据源和数据集能力直接依赖浏览器请求或 Nebula 后端。

因此，不能把现有页面直接切换为 Vite library mode 后发布。系统需要先建立无路由、无认证、无固定后端的编辑器边界，再用 Web Component 提供框架无关的集成入口。

## 2. Goals

- 提供可由原生 HTML、React、Vue 或其他 Web 宿主直接使用的 `<nebula-screen-editor>`。
- SDK 只交付前端能力，不包含、启动或约束宿主的后端实现技术。
- 宿主通过类型化 JavaScript Adapter 提供项目加载、保存、发布、导入导出和快照服务。
- SDK 不读取宿主 Token，不内置 Nebula JWT、Axios 拦截器或固定 REST 路径。
- 每个元素实例拥有独立 Store、DOM 查询范围、Portal 容器、快捷键焦点与清理生命周期。
- 使用 open Shadow DOM 隔离宿主样式，同时允许通过少量 CSS variables 配置主题。
- 首版支持静态数据源、6 个内置组件和现有编辑器主要设计能力。
- 首先在 pnpm workspace 内完成集成验证，再发布私有 npm ESM 包。

## 3. Non-Goals

首版不包含：

- 独立预览 Web Component。
- API 数据源、数据集数据源或由蓝图直接发起任意网络请求。
- 外部项目注册自定义 renderer、属性面板或蓝图节点的插件 API。
- 固定 REST API 契约、内置 Token 参数、内置登录页或认证刷新逻辑。
- 大屏项目列表、项目创建、项目删除与宿主导航外壳。
- 移动端编辑体验、触摸端多指手势和低于最小容器尺寸的完整布局承诺。
- 旧版浏览器 polyfill；首版构建目标固定为 Chromium 120+。
- 单文件离线产物或 CommonJS 产物。
- 修改 `apps/nestjs-server`、Prisma Schema 或替宿主实现后端接口。
- 国际化体系；首版界面语言维持简体中文。

## 4. Confirmed V1 Scope

| 维度 | V1 决策 |
| --- | --- |
| 自定义元素 | 仅 `<nebula-screen-editor>` |
| 后端边界 | 宿主注入 JavaScript Adapter |
| 项目操作 | 加载、保存、发布、导入、导出、快照列表/创建/恢复/删除/清空 |
| 数据源 | 仅 static |
| 组件 | text / bar-chart / rect / ellipse / image / button |
| 插件 | 不开放 |
| 分发 | workspace 验证后发布私有 npm ESM |
| 浏览器 | Chromium 120+；发布前在当前稳定版 Chrome 与 Edge 冒烟验证 |
| 布局 | 填满宿主容器，建议最小 1024x640，不承诺移动端编辑 |
| 样式隔离 | open Shadow DOM |
| 运行时依赖 | React 等实现依赖打入 SDK，不要求宿主安装 React |

## 5. Architecture

### 5.1 Runtime Boundary

```text
Host Application
  ├─ authentication / routing / backend client
  ├─ project-id + ScreenHostAdapter
  └─ <nebula-screen-editor>
       └─ open ShadowRoot
            ├─ SDK styles + theme tokens
            ├─ portal root
            └─ React root
                 ├─ ScreenEditorWorkbench
                 ├─ instance-scoped stores
                 ├─ built-in component registry
                 └─ adapter operation controller
```

### 5.2 Responsibility Matrix

| Responsibility | SDK | Host |
| --- | --- | --- |
| 画布、工具、图层、属性面板、历史栈 | 是 | 否 |
| 内置组件与静态数据配置 | 是 | 否 |
| Shadow DOM、Portal、快捷键隔离 | 是 | 否 |
| 文档运行时校验与版本迁移 | 是 | 可在服务端重复校验 |
| 加载/保存/发布 UI 与状态 | 是 | 提供 Adapter 实现 |
| 鉴权、Token、Cookie、刷新登录 | 否 | 是 |
| REST/GraphQL 路径和响应拆包 | 否 | 是 |
| 数据库、并发控制、权限校验 | 否 | 是 |
| 预览页面和打开方式 | 仅派发请求事件 | 是 |
| API/dataset 数据执行 | 否 | V1 不接入 SDK |

### 5.3 Source Ownership

- `packages/screen-sdk/` 是可发布 SDK 的唯一源码与构建边界。
- `packages/shared/` 继续作为 Nebula 内部领域 Schema 的单一数据源；SDK 通过公共 facade 导出所需契约，产物不得泄漏 workspace 私有路径。
- `apps/web/` 保留项目列表、路由、认证、预览页和 Nebula Host Adapter。
- `apps/web/src/features/screen/api.ts` 与 `hooks.ts` 不迁入 SDK。
- `apps/nestjs-server/` 不因本功能发生代码或数据模型变更。
- 抽离过程中不得长期维护两份编辑器 Store、画布交互逻辑或属性 Schema；临时迁移桥接必须在对应任务结束前删除。

## 6. Public Document Contract

### 6.1 Canonical Document

SDK 的持久化主体与宿主业务元数据分离。规范输出始终是 V2 蓝图与版本化文档：

```ts
export const SCREEN_DOCUMENT_VERSION = 1 as const;

export interface ScreenDocumentV1 {
  schemaVersion: typeof SCREEN_DOCUMENT_VERSION;
  canvas: CanvasConfig;
  components: StaticScreenComponent[];
  blueprint?: EventBlueprintV2;
  globalVariables: StaticGlobalVariable[];
}

export const SCREEN_SDK_COMPONENT_TYPES = [
  'text',
  'bar-chart',
  'rect',
  'ellipse',
  'image',
  'button',
] as const;

export type ScreenSdkComponentType = (typeof SCREEN_SDK_COMPONENT_TYPES)[number];

export interface ScreenSdkComponentPropsMap {
  text: { content?: string };
  'bar-chart': { title?: string; data?: unknown };
  rect: Record<string, never>;
  ellipse: Record<string, never>;
  image: { src?: string; alt?: string };
  button: { text?: string };
}

export type StaticScreenComponent = {
  [Type in ScreenSdkComponentType]: Omit<ScreenComponent, 'type' | 'props' | 'dataSource'> & {
    type: Type;
    props: ScreenSdkComponentPropsMap[Type];
    dataSource?: StaticDataSourceConfig;
  };
}[ScreenSdkComponentType];

export interface StaticDataSourceConfig {
  type: 'static';
  staticData: unknown;
  dataPath?: string;
  fieldMapping?: FieldMapping;
}

export interface StaticGlobalVariable {
  id: string;
  name: string;
  type: 'static';
  value?: unknown;
  description?: string;
}

export interface ScreenDocumentInput
  extends Record<string, unknown> {
  schemaVersion: number;
  canvas: unknown;
  components: unknown[];
  blueprint?: unknown;
  globalVariables?: unknown[];
}
```

`ScreenSdkComponentSchema` 必须按 `type` 建立 6 分支判别联合：

- 未知组件类型返回 `UNKNOWN_COMPONENT_TYPE`，不得渲染通用占位后继续保存。
- 每个分支校验上表已知 props；未知 props 返回 `INVALID_COMPONENT_PROPS`，不得由 Zod 静默 strip。
- `image.src` 只允许空字符串、data URL 或 http(s) URL，不接受 file/blob 持久化 URL。
- `bar-chart.props.data` 仅作为既有静态数据兼容输入；首次编辑数据时迁移为 `dataSource.staticData`。

实现时新增并导出：

- `ScreenDocumentV1Schema`
- `ScreenDocumentInputSchema`
- `ScreenSdkComponentSchema`
- `ScreenProjectDraftSchema`
- `ScreenProjectEnvelopeInputSchema`
- `ScreenProjectTransferV1Schema`
- `validateScreenSdkCapabilities(document)`
- 对应 TypeScript 类型与 JSON Schema 产物

### 6.2 Project Envelope

宿主返回的项目对象包含编辑元数据、并发基线和文档：

```ts
export type ScreenProjectStatus = 'draft' | 'published';

export interface ScreenProjectDraft {
  name: string;
  description?: string | null;
  document: ScreenDocumentV1;
}

export interface ScreenProjectEnvelope extends ScreenProjectDraft {
  id: string;
  status: ScreenProjectStatus;
  revision: string;
}

export interface ScreenProjectEnvelopeInput
  extends Omit<ScreenProjectEnvelope, 'document'> {
  document: ScreenDocumentInput;
}
```

规则：

- `name` trim 后必须非空；`description` 只接受 string、null 或缺省。
- `revision` 是非空、不透明字符串。SDK 只能原样保存和回传，不解析时间或数字语义。
- 每次成功保存、发布、导入或恢复快照后，Adapter 必须返回完整新 Envelope input；SDK 校验并规范化为 `ScreenProjectEnvelope`。
- Adapter 返回的 `id` 必须与当前 `project-id` 一致，否则按 `VALIDATION` 处理。
- 普通保存或发布成功后，SDK 更新 Envelope 基线并清空 dirty，但保留撤销/重做历史；之后执行 undo 必须重新进入 dirty。
- Adapter 的保存/发布响应若包含与提交草稿不同的规范化内容，SDK 以响应为准并清空不再适用的历史栈。
- 导入、快照恢复或项目切换成功后，SDK 原子替换项目并清空旧历史、选中和 dirty。
- `createdAt`、`updatedAt`、缩略图、创建人等宿主字段不进入 SDK 公共文档契约。
- 宿主可以在自己的 Adapter 闭包中保留额外元数据。

### 6.3 Transfer File

JSON 导入导出使用显式格式标识，避免把任意宿主数据库实体当作 SDK 文件格式：

```ts
export interface ScreenProjectTransferV1 {
  format: 'nebula-screen';
  formatVersion: 1;
  name: string;
  description?: string | null;
  document: ScreenDocumentV1;
}
```

```ts
export const SCREEN_TRANSFER_MAX_BYTES = 10 * 1024 * 1024;
```

- SDK 在调用 `importProject` 前读取 JSON、校验 transfer schema，并展示名称、组件数与画布尺寸。
- 超过 10 MiB 的文件在本地读取前拒绝，并以 `VALIDATION` 呈现。
- Adapter 仍必须在服务端执行自己的校验与权限控制。
- Adapter 的 `exportProject` 返回 `application/json` transfer Blob 和文件名；SDK 负责触发浏览器下载。
- 现有 Nebula `ScreenProject` JSON 不属于 V1 transfer 格式；兼容转换由 Nebula Host Adapter 负责，不进入 SDK 核心。

### 6.4 Input Validation and Migration

加载顺序固定为：

1. 用宽松 wire schema 校验 `ScreenProjectEnvelopeInput` 的 id、name、status、revision 与 document 容器结构。
2. 独立检查 `schemaVersion`，未来版本返回 `UNSUPPORTED_SCHEMA_VERSION`，不退化为普通字段错误。
3. 对 raw components、globalVariables 与 blueprint 做能力预扫描，产出动态数据、未知组件和禁用蓝图功能的稳定诊断。
4. 能力预扫描通过后，用 `CanvasConfigSchema` 与 6 分支 `ScreenSdkComponentSchema` 做严格领域校验。
5. 规范化缺失的 `globalVariables` 为 `[]` 并校验 static 分支。
6. 若输入包含 V1 蓝图，调用既有迁移器转换为 V2，再执行 V2 白名单与组件引用校验。
7. 全部校验成功后输出 `ScreenProjectEnvelope` 并创建编辑会话。

禁止行为：

- 不得把 `api` 或 `dataset` 自动改成 `static`。
- 不得删除不支持的蓝图节点后继续加载。
- 不得因校验失败覆盖当前已经打开的项目。
- 不得把包含敏感 header 的动态配置写入日志或错误详情。

不支持的文档返回 `UNSUPPORTED_DOCUMENT_FEATURE` 诊断，并列出稳定路径与功能代码，不包含原始敏感值。

```ts
export type ScreenSdkDiagnosticCode =
  | 'INVALID_DOCUMENT'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'UNKNOWN_COMPONENT_TYPE'
  | 'INVALID_COMPONENT_PROPS'
  | 'UNSUPPORTED_DATA_SOURCE'
  | 'UNSUPPORTED_GLOBAL_VARIABLE_TYPE'
  | 'UNSUPPORTED_BLUEPRINT_NODE'
  | 'UNSUPPORTED_BLUEPRINT_EVENT'
  | 'UNSUPPORTED_BLUEPRINT_ACTION'
  | 'DANGLING_COMPONENT_REFERENCE';

export interface ScreenSdkDiagnostic {
  code: ScreenSdkDiagnosticCode;
  path: ReadonlyArray<string | number>;
  severity: 'error' | 'warning';
  message: string;
}
```

## 7. Host Adapter Contract

### 7.1 Adapter Interface

```ts
export interface ScreenHostAdapter {
  loadProject(input: LoadProjectInput): Promise<ScreenProjectEnvelopeInput>;
  saveProject(input: SaveProjectInput): Promise<ScreenProjectEnvelopeInput>;
  publishProject?: (input: PublishProjectInput) => Promise<ScreenProjectEnvelopeInput>;
  importProject?: (input: ImportProjectInput) => Promise<ScreenProjectEnvelopeInput>;
  exportProject?: (input: ExportProjectInput) => Promise<ScreenExportFile>;
  snapshots?: ScreenSnapshotAdapter;
}

export interface LoadProjectInput {
  projectId: string;
  signal: AbortSignal;
}

export interface SaveProjectInput {
  projectId: string;
  revision: string;
  draft: ScreenProjectDraft;
  signal: AbortSignal;
}

export interface PublishProjectInput {
  projectId: string;
  revision: string;
  signal: AbortSignal;
}

export interface ImportProjectInput {
  projectId: string;
  revision: string;
  file: File;
  transfer: ScreenProjectTransferV1;
  signal: AbortSignal;
}

export interface ExportProjectInput {
  projectId: string;
  revision: string;
  signal: AbortSignal;
}

export interface ScreenExportFile {
  fileName: string;
  blob: Blob;
}
```

`ScreenExportFileSchema` 必须校验：

- `fileName` 长度为 1-255，不含 `/`、`\\`、控制字符或 `..` 路径段，并以 `.json` 结尾。
- `blob` 是 Blob，且 MIME 为 `application/json` 或带 charset 的 `application/json`。
- SDK 只使用净化后的 basename 作为 download 文件名。

`loadProject` 与 `saveProject` 是必需方法。其他能力通过方法是否存在自动派生：

- 无 `publishProject` 时隐藏发布按钮和菜单项。
- 无 `importProject` 或 `exportProject` 时隐藏对应文件菜单项。
- 无 `snapshots` 时隐藏快照管理入口。
- SDK 完整 V1 验收使用实现全部能力的测试 Adapter。

### 7.2 Snapshot Adapter

```ts
export interface ScreenSnapshotSummary {
  id: string;
  name: string;
  createdAt: string;
  componentCount: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface ScreenSnapshotAdapter {
  list(input: SnapshotListInput): Promise<ScreenSnapshotSummary[]>;
  create(input: SnapshotCreateInput): Promise<ScreenSnapshotSummary>;
  restore(input: SnapshotRestoreInput): Promise<ScreenProjectEnvelopeInput>;
  remove(input: SnapshotRemoveInput): Promise<void>;
  clear(input: SnapshotClearInput): Promise<void>;
}

export interface SnapshotListInput {
  projectId: string;
  signal: AbortSignal;
}

export interface SnapshotCreateInput extends SnapshotListInput {
  revision: string;
  draft: ScreenProjectDraft;
}

export interface SnapshotRestoreInput extends SnapshotListInput {
  snapshotId: string;
  revision: string;
}

export interface SnapshotRemoveInput extends SnapshotListInput {
  snapshotId: string;
}

export type SnapshotClearInput = SnapshotListInput;
```

所有 Snapshot input 均包含 `projectId` 和 `signal`。其中：

- `create` 额外包含当前 `revision` 与 `draft`，允许宿主保存尚未正式提交的编辑状态。
- `restore` 额外包含 `snapshotId` 与当前 `revision`，必须由宿主执行并发控制。
- `restore` 成功返回完整新 Envelope，SDK 据此重置本地基线。
- `remove` 与 `clear` 不修改当前编辑文档。
- `ScreenSnapshotSummarySchema` 校验 id/name 非空、createdAt 是带时区 ISO 8601、componentCount 是非负整数、canvasWidth/canvasHeight 是正整数。
- Adapter 返回的 Envelope、导出文件、快照列表和快照 mutation 响应均经过对应运行时 Schema 校验。

### 7.3 Error Contract

```ts
export type ScreenAdapterErrorCode =
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'UNSUPPORTED_DOCUMENT_FEATURE'
  | 'UNAVAILABLE'
  | 'DIRTY_STATE'
  | 'ABORTED'
  | 'UNKNOWN';

export interface ScreenAdapterError extends Error {
  code: ScreenAdapterErrorCode;
  recoverable?: boolean;
  serverRevision?: string;
  diagnostics?: readonly ScreenSdkDiagnostic[];
}

export interface ScreenPublicError {
  code: ScreenAdapterErrorCode;
  message: string;
  recoverable?: boolean;
  serverRevision?: string;
  diagnostics?: readonly ScreenSdkDiagnostic[];
}
```

- Adapter 必须把 HTTP、GraphQL 或其他传输错误转换为上述错误。
- SDK 不读取 HTTP status、Nebula BizCode 或响应 envelope。
- `CONFLICT` 必须保留本地草稿，展示重新加载/取消选项，不提供 V1 强制覆盖。
- `UNAUTHORIZED` 与 `FORBIDDEN` 只展示安全错误并派发事件，登录跳转由宿主处理。
- 文档与能力校验错误必须通过 `diagnostics` 暴露稳定 code/path，不把原始配置值放入 message。
- SDK 使用错误 code 的内置安全文案构造 `ScreenPublicError`；不得把 Adapter Error 的原始 message、stack、cause、response 或自定义字段放入 UI/Event。
- `nebula-error` 只携带 `ScreenPublicError`。即使 Adapter Error 附带 Token、Cookie 或完整响应，公开错误也不得包含这些值。
- AbortSignal 导致的取消不得展示为普通失败 toast。

### 7.4 Concurrency and Cancellation

- 同一实例同一时刻最多执行一个项目 mutation：save、publish、import、snapshot create/restore/remove/clear 互斥。
- snapshot list 与 export 是只读操作，可以与其他只读操作并行，但必须在项目切换或断连时取消。
- load 与 mutation 不并行；开始加载新项目时先取消当前 mutation。
- 切换 `project-id` 时中止旧项目全部未完成操作。
- 元素 `disconnectedCallback` 时中止全部操作。
- 保存成功后必须使用响应 Envelope，不得只在本地递增 revision。
- 发布前若 `isDirty=true`，SDK 阻止发布并提示先保存。
- SDK 在调用 Adapter 前对 `draft` 与 transfer 执行 `structuredClone`，不把 Store 内部引用交给宿主代码。
- `File`、`Blob` 与 AbortSignal 按浏览器对象直接传递；即使恶意测试 Adapter 修改普通输入对象，也不得改变当前 Store。

## 8. Web Component Contract

### 8.1 Registration

SDK 提供两种 ESM 入口：

```ts
import { defineNebulaScreenEditor } from '@nebula/screen-sdk';

defineNebulaScreenEditor();
```

```ts
import '@nebula/screen-sdk/auto-register';
```

- `defineNebulaScreenEditor()` 必须幂等，使用 `customElements.get()` 防止重复定义。
- 自动注册入口只执行元素注册，不发起请求，不扫描 DOM，不自动创建元素。
- SDK 导出 `NebulaScreenEditorElement`、`NebulaScreenEditorEventMap` 和事件 detail 类型，并扩展 `HTMLElementTagNameMap`。

### 8.2 Attributes and Properties

| Surface | Type | Required | Semantics |
| --- | --- | --- | --- |
| `project-id` attribute / `projectId` property | string | 是 | 当前项目标识，变化时重新加载 |
| `theme` attribute/property | `'light' \| 'dark'` | 否 | 默认 `light`，只作用于当前 ShadowRoot |
| `readonly` attribute/property | boolean | 否 | 禁止设计数据修改，仍允许查看与视口操作 |
| `adapter` property | `ScreenHostAdapter` | 是 | 只能通过 JavaScript property 注入 |
| `options` property | `ScreenEditorOptions` | 否 | 调试、偏好持久化和实例选项 |

禁止通过 HTML attribute 传递 Token、完整项目 JSON、Adapter 或敏感 header。

```ts
export interface ScreenEditorOptions {
  debug?: boolean;
  persistPreferences?: boolean;
  preferenceNamespace?: string;
}
```

- `persistPreferences` 默认 `true`，只持久化 UI 偏好，不持久化项目、历史或快照。
- `preferenceNamespace` 默认 `nebula:screen-sdk:v1`，宿主可为多租户或测试提供独立 namespace。
- 元素只有在 `project-id` 与 `adapter` 都有效时加载。赋值顺序不影响结果；重复赋同一引用不重复加载。
- 替换为新的 Adapter 引用时取消当前操作，并用新 Adapter 重新加载当前项目。

### 8.3 Methods

```ts
export interface NebulaScreenEditorElement extends HTMLElement {
  adapter: ScreenHostAdapter | undefined;
  options: ScreenEditorOptions | undefined;
  projectId: string;
  theme: 'light' | 'dark';
  readonly: boolean;

  whenReady(): Promise<void>;
  reload(options?: { discardChanges?: boolean }): Promise<void>;
  save(): Promise<ScreenProjectEnvelope>;
  publish(): Promise<ScreenProjectEnvelope>;
  getDraft(): ScreenProjectDraft | null;
  getDocument(): ScreenDocumentV1 | null;
  validate(): ScreenSdkDiagnostic[];
  undo(): void;
  redo(): void;
  fitToScreen(): void;
  focusComponent(componentId: string): boolean;
}
```

- `getDraft()` 与 `getDocument()` 返回不可影响 Store 的快照，不返回内部可变引用。
- 不支持的可选能力调用时抛出 `UNAVAILABLE`，UI 中对应入口应已隐藏。
- readonly 模式下直接调用 Adapter-backed 异步 mutation 方法以 `FORBIDDEN` 拒绝；`undo()` / `redo()` 的同步语义见 9.2。
- `reload()` 在 dirty 时默认以 `DIRTY_STATE` 拒绝；只有显式传入 `discardChanges: true` 才允许放弃本地更改。
- `whenReady()` 在当前项目首次成功渲染后 resolve，加载失败时 reject；项目或 Adapter 切换后创建新的等待周期。

### 8.4 Events

所有事件均为 `CustomEvent`，并设置 `bubbles: true`、`composed: true`。

```ts
export type ScreenChangeReason =
  | 'project-metadata'
  | 'canvas'
  | 'component'
  | 'blueprint'
  | 'global-variable'
  | 'history';

export type ScreenOperation =
  | 'load'
  | 'reload'
  | 'save'
  | 'publish'
  | 'import'
  | 'export'
  | 'snapshot-list'
  | 'snapshot-create'
  | 'snapshot-restore'
  | 'snapshot-remove'
  | 'snapshot-clear'
  | 'project-change'
  | 'validate';

export type ScreenOperationSuccessDetail =
  | { projectId: string; operation: 'import'; envelope: ScreenProjectEnvelope }
  | { projectId: string; operation: 'export'; fileName: string }
  | {
      projectId: string;
      operation: 'snapshot-create';
      snapshot: ScreenSnapshotSummary;
    }
  | {
      projectId: string;
      operation: 'snapshot-restore';
      envelope: ScreenProjectEnvelope;
    }
  | { projectId: string; operation: 'snapshot-remove'; snapshotId: string }
  | { projectId: string; operation: 'snapshot-clear' };

export interface NebulaScreenEditorEventMap {
  'nebula-ready': CustomEvent<{ projectId: string; envelope: ScreenProjectEnvelope }>;
  'nebula-change': CustomEvent<{
    projectId: string;
    draft: ScreenProjectDraft;
    reason: ScreenChangeReason;
  }>;
  'nebula-dirty-change': CustomEvent<{ projectId: string; dirty: boolean }>;
  'nebula-selection-change': CustomEvent<{ projectId: string; componentIds: string[] }>;
  'nebula-save-success': CustomEvent<{
    projectId: string;
    envelope: ScreenProjectEnvelope;
  }>;
  'nebula-publish-success': CustomEvent<{
    projectId: string;
    envelope: ScreenProjectEnvelope;
  }>;
  'nebula-operation-success': CustomEvent<ScreenOperationSuccessDetail>;
  'nebula-preview-request': CustomEvent<{
    projectId: string;
    revision: string;
    draft: ScreenProjectDraft;
  }>;
  'nebula-navigate-request': CustomEvent<{
    projectId: string;
    url: string;
    target: '_blank' | '_self';
  }>;
  'nebula-error': CustomEvent<{
    projectId?: string;
    operation: ScreenOperation;
    error: ScreenPublicError;
  }>;
}

declare global {
  interface HTMLElementTagNameMap {
    'nebula-screen-editor': NebulaScreenEditorElement;
  }
}
```

| Event | Detail | Trigger |
| --- | --- | --- |
| `nebula-ready` | `{ projectId, envelope }` | 项目成功加载并完成首次渲染 |
| `nebula-change` | `{ projectId, draft, reason }` | 历史提交点或项目元数据产生变更 |
| `nebula-dirty-change` | `{ projectId, dirty }` | dirty 布尔值变化 |
| `nebula-selection-change` | `{ projectId, componentIds }` | 选中集合变化 |
| `nebula-save-success` | `{ projectId, envelope }` | 保存成功 |
| `nebula-publish-success` | `{ projectId, envelope }` | 发布成功 |
| `nebula-operation-success` | `ScreenOperationSuccessDetail` | 导入、导出或快照 mutation 成功 |
| `nebula-preview-request` | `{ projectId, revision, draft }` | 用户点击预览 |
| `nebula-navigate-request` | `{ projectId, url, target }` | 交互蓝图请求导航 |
| `nebula-error` | `{ projectId?, operation, error }` | 可观察的加载或操作失败 |

`nebula-change` 不得在拖拽每一帧派发完整文档，只在历史语义提交点派发。

## 9. Editor Behavior

### 9.1 Loading

- 首次等待 `adapter` 或 `project-id` 时显示中性空状态，不显示网络错误。
- 加载中显示 SDK 内置 loading UI。
- 加载失败显示重试入口并派发 `nebula-error`。
- 同项目 `reload` 时保留当前画面但进入不可编辑状态，成功后原子替换。
- `project-id` 或 Adapter 引用变化是宿主的权威切换命令：取消旧操作、清除旧项目画面并加载新项目，即使旧项目 dirty 也不弹 SDK 内确认框。
- 宿主在改变 `project-id` 前应根据 `nebula-dirty-change` 自行确认导航；SDK 不阻塞受控属性变化。
- 新项目加载失败时展示新项目错误状态，不得继续把旧项目显示为新 `project-id`。

### 9.2 Save and Publish

- readonly 模式隐藏或禁用保存、发布、导入、快照创建/恢复/删除/清空以及所有设计数据修改；导出、快照列表、预览和视口操作仍可用。
- readonly 下 `save()` / `publish()` 以 `FORBIDDEN` reject，`undo()` / `redo()` 安全 no-op，且不得调用 Adapter mutation。
- readonly 下允许 `reload()`、`getDraft()`、`getDocument()`、`validate()`、`fitToScreen()` 与 `focusComponent()`。
- 项目编辑产生 dirty 后，工具栏展示未保存状态。
- Ctrl/Cmd+S 与保存按钮调用同一 `save()` 控制器。
- 保存期间按钮禁用，重复命令复用或忽略当前 Promise，不并发请求。
- 保存成功使用返回 Envelope 重建保存基线并清除 dirty。
- 发布只提交 `projectId + revision`，不隐式携带未保存文档。
- 发布冲突与保存冲突使用同一错误语义。

### 9.3 Import and Export

- 导入只接受 `.json` 或 `application/json`。
- 导入文件不得超过 `SCREEN_TRANSFER_MAX_BYTES`。
- SDK 本地解析 transfer 文件并展示预览，确认后才调用 Adapter。
- 导入确认时若当前 dirty，必须展示覆盖警告。
- 导入成功返回新 Envelope，并清空旧历史栈。
- 导出由 Adapter 返回 Blob；SDK 使用安全文件名触发下载并及时释放 Object URL。

### 9.4 Snapshots

- 快照列表、创建、恢复、删除和清空均通过 `adapter.snapshots`。
- 创建快照捕获当前内存草稿，不要求先保存。
- 恢复和清空前必须二次确认。
- 恢复失败保留当前文档和历史栈。
- 列表时间按宿主返回的 ISO 时间显示，SDK 不推断时区。
- `createdAt` 必须是包含时区信息的 ISO 8601 字符串。

### 9.5 Preview

首版没有预览元素或预览路由。用户执行预览命令时：

1. SDK 派发 `nebula-preview-request`。
2. 宿主监听事件并决定打开页面、弹窗或忽略。
3. SDK 不调用 `window.open`，不拼接 URL。

### 9.6 Host Shell Commands and Feedback

- SDK 工具栏不显示现有应用的“返回列表”按钮，返回、关闭和路由切换由宿主外壳负责。
- preview 与 blueprint navigate 使用已定义的 composed CustomEvent 请求宿主处理。
- 保存、导入、快照和剪贴板等操作反馈由 ShadowRoot 内的 SDK notification surface 展示。
- SDK 同时通过 success/error 事件提供宿主观测，不要求宿主注入 toast callback。

## 10. Static Capability Profile

### 10.1 Supported

- 静态数组/对象数据。
- `dataPath`、字段映射、排序与条数限制。
- 静态全局变量与模板插值。
- 图片和画布背景的 URL 作为展示资源；其加载受宿主 CSP/CORS 控制，不属于数据源请求。

V2 蓝图使用精确白名单：

| Dimension | Supported values |
| --- | --- |
| node kind | `component` / `condition` / `delay` / `comment` |
| global component type | `pageLoad` / `interval` / `navigate` / `scrollTo` |
| trigger handle | `evt:click` / `evt:hover` / 全局 `pageLoad` / 全局 `interval` |
| action handle | `act:show` / `act:hide` / `act:toggleVisibility` / 全局 `navigate` / 全局 `scrollTo` |
| control flow | `condition` 的 then/else、`delay`、不参与执行的 `comment` |

- navigate 执行时只派发 `nebula-navigate-request`。
- show/hide/toggleVisibility 只修改当前交互会话的可见性覆盖，不修改设计文档。
- scrollTo 只在当前元素实例的画布范围内查找目标组件。

### 10.2 Unsupported

- `dataSource.type='api'`。
- `dataSource.type='dataset'`。
- API 类型全局变量。
- 全局 `requestApi` 蓝图节点。
- `evt:dataLoaded` / `evt:dataError` 动态数据事件锚点。
- `act:refreshData` 动作锚点。
- 白名单之外的未来 node kind、globalType、evt:* 或 act:*。
- 在 SDK 内直接调用 `fetch` 执行业务数据请求。

属性面板与组件注册定义必须从 UI 源头隐藏上述能力。文档校验仍需兜底拒绝，不能只依赖 UI 隐藏。

## 11. Instance and DOM Isolation

### 11.1 Store Isolation

- `useScreenEditorStore` 改为 `createScreenEditorStore()`，由每个元素实例创建。
- React 组件通过 Store Context 获取当前实例，不直接引用模块单例。
- dimension、alignment、blueprint viewport cache 同样实例化。
- 开发调试不得再写固定 `window.__screenEditorStore`；如保留调试入口，必须按实例 id 显式开启并在卸载时清理。

### 11.2 Focus and Shortcuts

- 元素 host 可聚焦，进入元素或点击画布后成为 active editor。
- 全局快捷键只作用于 active editor。
- 输入框、textarea、contenteditable 和 Radix 浮层内输入继续遵守现有快捷键挂起规则。
- 元素失焦、window blur 或卸载时清理临时工具和按键状态。

### 11.3 DOM Queries and Events

- 查询从实例 `ShadowRoot`、画布 ref 或蓝图容器 ref 开始。
- 禁止以 `document.querySelector(All)` 查找组件、Handle 或 Moveable target。
- pointermove/pointerup 等确需跨元素跟踪的监听从 `ownerDocument.defaultView` 获取，并在手势结束或卸载时移除。
- 固定表单 id 改为 `useId` 或 ref，两个实例不得产生冲突。

## 12. Shadow DOM and Styling

- 元素使用 `attachShadow({ mode: 'open' })`。
- ShadowRoot 内创建独立 React mount root 与 `<div data-nebula-portal-root>`。
- Dialog、AlertDialog、ContextMenu、DropdownMenu、Select、Sheet、Tooltip 的 Portal container 均来自实例 Context。
- Tailwind、shadcn token、React Flow CSS、动画和字体样式编译为 SDK 自有资源。
- 首选 `adoptedStyleSheets`，保留 `<style>` fallback。
- `:root/html/body` 规则迁移为 `:host` 与 Shadow 内 reset。
- 编辑器根节点使用 `width: 100%; height: 100%`，不得使用 `h-screen/w-screen` 或 `window.innerWidth` 计算宿主布局。
- 使用 `ResizeObserver` 响应容器尺寸变化。
- 容器小于 1024x640 时显示尺寸提示；不保证完整面板布局或移动端编辑能力。
- 首版只承诺稳定的 `--nebula-screen-*` CSS variables，不开放任意 DOM class、slot 或 `::part` 作为稳定 API。

V1 稳定 CSS variables：

| Variable | Type | Light default | Dark default | Semantics |
| --- | --- | --- | --- | --- |
| `--nebula-screen-font-family` | font-family | `"Geist Variable", system-ui, sans-serif` | same | 编辑器 UI 字体 |
| `--nebula-screen-background` | color | `oklch(0.985 0.02 290)` | `oklch(0.12 0.03 290)` | 根背景 |
| `--nebula-screen-foreground` | color | `oklch(0.25 0.12 290)` | `oklch(0.96 0.01 290)` | 主文本 |
| `--nebula-screen-surface` | color | `oklch(1 0 0)` | `oklch(0.18 0.04 290)` | 工具栏、面板与浮层 |
| `--nebula-screen-muted` | color | `oklch(0.96 0.02 290)` | `oklch(0.25 0.04 290)` | 次级背景 |
| `--nebula-screen-primary` | color | `oklch(0.58 0.28 290)` | `oklch(0.7 0.25 290)` | 主操作与焦点 |
| `--nebula-screen-border` | color | `oklch(0.92 0.02 290)` | `oklch(1 0 0 / 12%)` | 边框与分隔线 |
| `--nebula-screen-danger` | color | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | 危险操作与错误 |
| `--nebula-screen-radius` | length | `0.625rem` | same | UI 圆角基线 |

- `theme='dark'` 为未被宿主覆盖的变量切换 SDK 内置暗色默认值。
- 宿主在元素 host 上声明的合法变量值优先于内置 light/dark 默认值。
- 画布内用户组件颜色仍来自项目 document，不由 SDK UI theme variables 覆盖。

## 13. Package and Distribution

建议目录：

```text
packages/screen-sdk/
├── src/
│   ├── contracts/
│   ├── core/
│   ├── react/
│   ├── element/
│   ├── styles/
│   ├── index.ts
│   └── auto-register.ts
├── test/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

包规则：

- 包名 `@nebula/screen-sdk`，`type: module`。
- workspace 阶段保持 `private: true`。
- 只输出 ESM、source map、声明文件和必要字体/分包资源。
- 公共 exports 至少包含 `.`、`./auto-register`、`./contracts`。
- React、ReactDOM、Zustand、Radix、Moveable、Selecto 等实现依赖打入 SDK，避免宿主 React 版本冲突。
- 蓝图编辑器允许 ESM 动态分包，V1 不要求单文件。
- 声明文件必须 roll up，不得要求消费者解析 `@nebula/shared` workspace 源路径。
- 发布前执行 `pnpm pack` 并在空白消费项目安装 tarball 验证。
- workspace 验证通过后再移除 `private`，配置私有 registry 的 `publishConfig` 并发布 `0.1.0`。

## 14. Existing Nebula Integration

Nebula Web 作为参考宿主，负责：

- 从路由读取项目 id。
- 使用现有 `getScreenProject`、`updateScreenProject`、`publishScreenProject` 实现 Adapter。
- 将 `updatedAt` 映射为 Adapter 的不透明 `revision`。
- 将 Nebula API/BizCode 错误映射为 `ScreenAdapterError`。
- 在保存/发布后失效现有 TanStack Query 列表缓存。
- 监听 `nebula-preview-request` 并打开现有预览路由。
- 保留 JWT、401 刷新、toast 与登录导航在 `apps/web`。

当前 NestJS 没有导入导出和服务端快照端点。本功能不补后端：

- workspace 参考 Adapter 可以暂时包装既有浏览器导入导出/本地快照实现。
- 外部宿主若要完整服务端能力，应在自己的 Adapter 中调用自身后端。
- SDK 不区分 Adapter 背后是远端服务、IndexedDB、localStorage 还是测试内存实现。

现有 Nebula API/dataset 项目不能直接进入静态 V1 SDK。迁移期间不得删除当前应用的动态数据实现；其产品迁移或后续 SDK 能力扩展需另立规格。

## 15. Security

- SDK 不接受 Token attribute，不记录 Adapter 参数或项目原始数据全文。
- Shadow DOM 是样式边界，不是安全沙箱；宿主仍需设置 CSP、权限和网络策略。
- navigate 只派发事件，不直接执行。
- 不支持的 requestApi、API/dataset 配置在加载阶段被拒绝。
- 图片和背景 URL 仍可能产生浏览器资源请求，宿主通过 CSP/CORS 管控。
- 导入文件限制为 JSON 且最大 10 MiB。
- Adapter 返回值必须经过运行时 Schema 校验，不能因 TypeScript 类型而跳过校验。
- 错误事件不得携带 Token、Cookie、Authorization header 或完整服务端响应。

## 16. Requirements

### Requirement 1: Framework-independent mounting

系统 SHALL 允许不安装 React 的 Chromium 120+ 宿主通过 ESM 注册并挂载 `<nebula-screen-editor>`。

#### Scenario: Vanilla host mounts editor

- **WHEN** 原生 HTML 宿主导入 auto-register 入口、设置 `project-id` 并赋值 `adapter`
- **THEN** 元素加载项目并渲染完整编辑器
- **AND** 宿主不需要提供 React Root、Router 或 QueryClient

### Requirement 2: Host-owned backend

系统 SHALL 仅通过 `ScreenHostAdapter` 执行项目服务操作。

#### Scenario: Save project

- **WHEN** 用户执行保存
- **THEN** SDK 调用 `adapter.saveProject` 并传入项目 id、当前 revision、draft 与 AbortSignal
- **AND** SDK 不自行拼接 URL、读取 Token 或处理 HTTP envelope

### Requirement 3: Versioned static document

系统 SHALL 只加载符合 `ScreenDocumentV1` 和静态能力约束的文档。

#### Scenario: Dynamic data source is returned

- **WHEN** Adapter 返回包含 API 或 dataset 数据源的文档
- **THEN** SDK 拒绝创建编辑会话并显示不支持诊断
- **AND** 不发起该数据源请求
- **AND** 不静默删除或改写配置

#### Scenario: Unknown component is returned

- **WHEN** 文档包含 6 个内置 type 之外的组件或未知 props
- **THEN** SDK 以 `UNKNOWN_COMPONENT_TYPE` 或 `INVALID_COMPONENT_PROPS` 拒绝加载
- **AND** 不渲染可继续保存的通用占位组件

#### Scenario: Unsupported blueprint capability is returned

- **WHEN** 蓝图包含 requestApi、dataLoaded/dataError、refreshData 或未来未知锚点
- **THEN** SDK 按精确节点/边路径返回能力诊断
- **AND** 不执行或删除该节点后继续加载

### Requirement 4: Optimistic concurrency

系统 SHALL 将 Adapter revision 作为保存、发布、导入和快照恢复的并发基线。

#### Scenario: Save conflict

- **WHEN** Adapter 以 `CONFLICT` 拒绝保存
- **THEN** SDK 保留本地草稿、dirty 状态和历史栈
- **AND** 展示重新加载或取消选项
- **AND** 不执行强制覆盖

### Requirement 5: Capability-driven commands

系统 SHALL 根据 Adapter 可选方法决定发布、导入导出和快照 UI 是否可用。

#### Scenario: Snapshot adapter is absent

- **WHEN** 宿主未提供 `adapter.snapshots`
- **THEN** 文件菜单不显示快照管理入口
- **AND** 其他编辑与保存能力保持可用

### Requirement 6: Backend-backed import and export

系统 SHALL 在本地校验 transfer 文件后，通过 Adapter 完成导入持久化和导出文件生成。

#### Scenario: Import succeeds

- **WHEN** 用户确认导入合法 transfer 文件且 Adapter 返回新 Envelope
- **THEN** SDK 原子替换项目、revision 与状态
- **AND** 清空旧历史栈和 dirty
- **AND** 不保留旧项目的选中状态

### Requirement 7: Backend-backed snapshots

系统 SHALL 通过 Snapshot Adapter 完成快照管理，并允许创建包含未保存草稿的快照。

#### Scenario: Restore snapshot

- **WHEN** 用户确认恢复快照且 Adapter 返回新 Envelope
- **THEN** SDK 使用返回值建立新保存基线
- **AND** 当前项目 id 保持不变
- **AND** 恢复失败时当前编辑内容保持不变

### Requirement 8: Shadow DOM isolation

系统 SHALL 将编辑器 UI 与样式渲染在当前元素的 ShadowRoot 内。

#### Scenario: Host has conflicting CSS

- **WHEN** 宿主定义全局 `button`、`input`、`svg` 和 `*` 样式
- **THEN** 编辑器布局、控件和图标保持 SDK 主题外观
- **AND** Radix 浮层仍在当前 ShadowRoot 内正确显示

#### Scenario: Host overrides stable theme variables

- **WHEN** 宿主在元素上设置 spec 声明的 `--nebula-screen-*` 变量
- **THEN** SDK UI 使用宿主值
- **AND** 未覆盖变量继续使用当前 light/dark 默认值

### Requirement 9: Multiple instance isolation

系统 SHALL 支持同一文档中存在两个独立编辑器实例。

#### Scenario: Edit one instance

- **WHEN** 用户在实例 A 选择、拖拽或撤销组件
- **THEN** 实例 B 的项目、选择、历史、快捷键状态和 Portal 不发生变化

### Requirement 10: Focus-scoped shortcuts

系统 SHALL 只把编辑器快捷键派发给当前 active 实例。

#### Scenario: Save shortcut

- **WHEN** 用户最后聚焦实例 B 后按 Ctrl/Cmd+S
- **THEN** 只调用实例 B 的 Adapter 保存方法
- **AND** 实例 A 不改变 operation 状态

### Requirement 11: Clean lifecycle

系统 SHALL 在项目切换和元素卸载时释放 React Root、事件监听、计时器、Portal 与异步任务。

#### Scenario: Disconnect during load

- **WHEN** 元素在 `loadProject` 完成前从 DOM 移除
- **THEN** SDK abort 当前请求并卸载内部 Root
- **AND** 后续响应不再写入 Store 或派发 ready 事件

### Requirement 12: Container-based layout

系统 SHALL 根据宿主元素尺寸而非浏览器视口计算编辑器布局。

#### Scenario: Host resizes panel

- **WHEN** 宿主把元素容器从 1440x900 调整为 1100x700
- **THEN** 编辑器通过 ResizeObserver 更新画布工作区
- **AND** 不读取 `window.innerWidth` 作为编辑器宽度

### Requirement 13: ESM distribution

系统 SHALL 输出可由私有 npm registry 安装的自包含 ESM 包。

#### Scenario: Packed package smoke test

- **WHEN** 在空白 Vanilla Vite 项目安装 `pnpm pack` 生成的 tarball
- **THEN** 类型检查、构建、元素注册和项目加载全部成功
- **AND** 消费项目不需要 workspace alias 或 `@nebula/shared` 源码

### Requirement 14: Runtime-validated adapter responses

系统 SHALL 对所有 Adapter 返回值执行运行时 Schema 校验，不信任 TypeScript 声明。

#### Scenario: Invalid snapshot or export response

- **WHEN** Adapter 返回无时区快照时间、负计数、不安全文件名或非 JSON Blob
- **THEN** SDK 以 `VALIDATION` 拒绝该响应
- **AND** 当前项目状态保持不变
- **AND** `nebula-error` 携带不含敏感原值的 diagnostics

### Requirement 15: Readonly command matrix

系统 SHALL 在 readonly 模式阻止所有设计与服务端 mutation，同时保留只读命令。

#### Scenario: Programmatic mutation in readonly mode

- **WHEN** 宿主调用 `save()`、`publish()`、`undo()` 或 `redo()`
- **THEN** save/publish 以 `FORBIDDEN` reject
- **AND** undo/redo 为 no-op
- **AND** 不调用任何 Adapter mutation

### Requirement 16: Cross-operation mutual exclusion

系统 SHALL 通过单一 operation coordinator 串行化全部项目 mutation。

#### Scenario: Restore starts while save is pending

- **WHEN** save 尚未完成且用户请求恢复快照
- **THEN** SDK 不并发调用 restore
- **AND** 项目切换或断连后的迟到结果不能写回当前 Store

## 17. Testing Strategy

### Unit

- `ScreenDocumentV1Schema`、transfer schema 和静态能力诊断。
- Adapter error normalization、revision 基线和 AbortSignal。
- Store factory、历史栈、dirty 状态与两个实例隔离。
- Custom Element observed attributes、property 赋值顺序、重复注册和断连清理。
- Root-aware Portal、快捷键 active instance 仲裁和 scoped DOM queries。

### Integration

- Fake full Adapter 覆盖加载、保存、发布、冲突、导入导出和快照流程。
- Adapter 缺少可选能力时的菜单显隐与方法错误。
- Shadow DOM 内 Radix Dialog/Select/Tooltip/ContextMenu 交互。
- 非 static 文档拒绝，且业务 `fetch` 不被 SDK 调用。
- project-id 快速切换时旧响应不覆盖新项目。

### E2E

- 新增 Vanilla TS 消费宿主，不依赖 React。
- 同页双实例编辑和 Ctrl/Cmd+S 焦点隔离。
- 宿主冲突 CSS、容器 resize、最小尺寸提示。
- 文本/形状/图片工具、拖拽缩放、图层、属性、撤销重做、蓝图打开。
- 保存冲突、导入覆盖、导出下载、快照恢复。
- Custom Element 移除并重新挂载后无重复监听。

### Quality Gates

```bash
pnpm --filter @nebula/screen-sdk typecheck
pnpm --filter @nebula/screen-sdk lint
pnpm --filter @nebula/screen-sdk test
pnpm --filter @nebula/screen-sdk build
pnpm --filter @nebula/web test
pnpm biome:check
pnpm typecheck
pnpm lint
```

建立首次可用构建的压缩体积基线；后续单次变更超过基线 10% 时必须解释，不在规格阶段预设脱离实测的绝对体积数字。

## 18. Acceptance Boundaries

V1 达到以下边界即可发布 `0.1.0`：

1. Vanilla 宿主可以只通过 ESM、`project-id` 和 Adapter 使用完整编辑器。
2. 宿主自行实现后端；SDK 中不存在 Nebula 路由、JWT、固定 API 地址或 Axios 拦截器依赖。
3. 静态文档可编辑、保存、发布、导入导出和管理快照。
4. 动态数据源与网络蓝图动作被明确拒绝，不执行、不丢数据。
5. 两个实例的状态、DOM、Portal、快捷键和异步任务完全隔离。
6. 宿主 CSS 不污染编辑器，Radix 与 React Flow 样式在 Shadow DOM 内完整。
7. 容器 resize 正常，低于最小尺寸时给出明确提示；不要求移动端编辑。
8. 元素断连、项目切换和操作取消没有监听、计时器或异步写回泄漏。
9. tarball 可在空白消费项目安装、类型检查并构建。
10. 现有 Nebula 业务代码的动态数据能力不因 SDK V1 被删除或静默降级。

## 19. Related Documents

- [大屏编辑器功能规格](../screen-editor/README.md)
- [大屏设计器架构](../../architecture/screen-editor-architecture.md)
- [蓝图运行时架构](../../architecture/blueprint-runtime-architecture.md)
- [编码规范](../../conventions/coding-standards.md)
- [前后端契约规范](../../conventions/frontend-backend-contract.md)
- [实施任务](./tasks.md)
- [验收清单](./checklist.md)
