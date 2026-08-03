# ADR-0003: 大屏唯一契约、Host Resource 与 React/Vue 桥接

> 状态：已接受
> 日期：2026-08-03
> 定位：确定大屏唯一 wire 契约、后端持久化、宿主数据资源、Web Monaco 边界和 React 19、Vue 3 组件桥接的长期实现方向

## 背景

现有实现同时存在 shared 持久化文档、core Legacy/V1/V2 文档、dynamic V3 文档以及 static/dynamic
SDK 两条运行时。Web Adapter 将后端的扁平项目响应投影为 core V2 文档，Screen 保存路径还会迁移 legacy
document，并基于 `datasetId` 重建 Screen 到 Dataset 的引用索引。

这些分支是建设期实现，并非已发布兼容边界。继续在其上增加 React/Vue 支持会永久固化多套 parser、Adapter、
model 和数据能力。项目尚未发布，确认直接重置开发数据，不提供历史迁移。

## 考虑的方案

### 方案 A：保留 shared/core/dynamic 多套文档并增加框架适配

- 优点：短期改动较小。
- 缺点：React/Vue bridge 必须理解 V1/V2/V3；Web Adapter 持续承担隐式转换；无法删除 dynamic SDK。

结论：不接受。

### 方案 B：新建独立 contracts workspace 包

- 优点：wire contract 独立于应用和编辑器。
- 缺点：本次引入额外 workspace、导出和构建迁移，shared 仍需复制 API DTO。

结论：不接受。

### 方案 C：shared 单一 wire contract + core 语义校验 + 单一 SDK

- `@nebula/shared` 定义唯一 document wire schema 与后端 API DTO。
- core 仅在 shared wire schema 通过后执行 registry-aware 语义校验和 runtime。
- SDK 使用单一 designer/viewer，React/Vue bridge 分别只依赖 component SDK。

优点：前后端共享同一数据结构，core 不反向依赖后端，框架 bridge 不需要理解宿主运行时。

缺点：需要一次性移除 shared/core/dynamic 的重复契约、后端 legacy 路径和旧数据。

## 结论

最终选择：**方案 C，直接收敛为 shared 单一 wire contract。**

### 唯一契约与 marker

- `packages/shared/src/schemas/screen.schema.ts` 是 `ScreenDocumentSchema`、Screen API DTO 和公开
  document TypeScript 类型的唯一代码单一来源。
- core 不再声明第二份 document Zod wire schema；它只从 shared 导入当前类型/schema，并在
  `parseScreenDocument(input, registry)` 中追加 registry、props、data capability、事件和蓝图语义校验。
- 当前唯一 marker 保持 `schemaVersion: 1`。marker 只拒绝不匹配输入，不表达数据来源。
- parser 必须 strict 拒绝旧专属 marker、字段和数据源；若历史数据与当前 schema 形状完全相同，系统将它
  视为当前文档，不能且不尝试推断来源。
- 不保留版本联合、fallback parser、normalization、alias 或 migration。

### 后端存储与 API

- `screen_projects.document` 成为唯一且非空的序列化 `ScreenDocument` 存储。
- 移除 `canvas`、`components`、`blueprint` 历史列，以及所有读取/写回 legacy 列的代码。
- API response 使用项目元数据加完整 `document`，不再扁平展开 document 字段。
- 更新请求可单独修改项目元数据；提供 `document` 时必须是完整替换，不接受分散的
  `canvas/components/blueprint/globalVariables` 字段。
- 开发和 E2E SQLite 按 schema 重置，不迁移历史 document。任何实际删除或重建 SQLite 文件仍需要执行时的
  明确用户确认，绝不触碰生产数据。

### 数据资源与 Dataset

- 文档只允许 `static` 与 `host-resource`。host-resource 使用宿主无关的
  `resourceType/resourceId/params/binding`，不定义 URL、Token、headers 或 SQL 等传输配置字段；客户端执行
  forbidden-key 结构检查，宿主 resolver 再以 strict 字段 allowlist 防止伪装内容。
- Dataset 可以由宿主作为某种 host resource 的后端实现，但 Screen document 不保存 `datasetId`，不直接调用
  Dataset API。
- 删除 Screen 到 Dataset 的 `DatasetReference` 索引、保存时的 rebuild，以及基于该索引的 Dataset 删除拦截。
  host-resource 对实际资源的权限和生命周期由宿主资源层负责。

### Web Monaco Port

- 仅为现有组件 JSON 编辑器保留一个专用、框架无关的公开 Port；它不是通用属性面板 renderer API。
- `@nebula/screen-sdk` 公开 `ScreenComponentJsonEditorPort`，其 `mount(host, input)` 返回可
  `update(input)` 和 `unmount()` 的 handle。input 包含 aria label、JSON schema、model URI、value、
  readOnly、theme、`onChange` 和 `onDiagnosticsChange`。
- `<nebula-screen-designer>` 通过 `componentJsonEditor` property 接收该 Port，且必须在
  registry/Adapter/project/document 触发首次 load 前赋值。
- 声明不能暴露 React `ComponentType`、`ReactNode` 或 Monaco 类型。Web 在 Port 内部继续使用 React/Monaco。

### React/Vue 桥接与示例

- React 桥接使用独立包 `@nebula/screen-component-react`，React 与 React DOM `^19.1.0` 均为 peer
  dependency。它通过最小 `HTMLElement` 子类管理 `createRoot()`，不复用宿主 root/Context，也不自行调用
  `customElements.define()`。
- Vue 桥接使用独立包 `@nebula/screen-component-vue`，Vue `^3.5.0` 为 peer dependency，并使用
  `defineCustomElement()`；它同样不自行注册 tagName。
- 两个 bridge 互不依赖，只依赖框架无关的 `@nebula/screen-component-sdk`。React-based editor core 与
  screen SDK 不依赖任一 bridge，也不在公共组件 ABI 中暴露框架类型；screen SDK 继续将内部 React runtime
  打入自包含产物，因此 Vanilla consumer 无需安装 React peer。
- 真实 React 示例使用目录 `packages/indicator-card-react`，npm 包名
  `@nebula-example/indicator-card-react`；Web consumer 负责完成真实 React TSX 纵向验证。
- 真实 Vue 示例使用目录 `packages/indicator-card-vue`，npm 包名
  `@nebula-example/indicator-card-vue`，与现有 Vanilla 指标卡并列。
- 本地、CI 和 Docker 统一以 Node.js `22.22.3` 为最小基线；pnpm 固定 `9.15.0`。
  `@types/node ^24` 仅为类型依赖，不要求 Node 24 runtime。

## 与既有 ADR 的关系

- 本 ADR 取代 ADR-0001 的 static/dynamic runtime profile、static-only document 和 API/dataset 边界。
- 本 ADR 取代 ADR-0002 的 component API V1、Screen Document V2、legacy migration 和双 SDK 结论。
- ADR-0002 中“Manifest + Web Component + 实例 registry”“宿主显式导入受信任组件”及 registry 全局 commit
  原则被本 ADR 保留并收敛为唯一正式契约。

## 影响

- 路线 A、B、C 可在本 ADR 冻结后并行实施；D 必须消费 A/B/C 的接口。
- 删除旧实现只能在 BUS-3 建立替代证据后由 BUS-4 执行。
- active 架构文档中描述 V1/V2/V3、legacy migration 或 static/dynamic profile 的段落仅代表当前实现，
  不得作为新增代码依据；BUS-5 负责完成全量重写。
