# 大屏 SDK 动态数据能力 Spec

> 状态：已归档
> 最近更新：2026-08-03
> 定位：记录独立 dynamic SDK、文档 V3 和组件 API v2 的阶段性设计；不再作为当前实现依据
> 归档原因：由统一组件契约与 Vue 3 注册桥接规格取代

> 归档说明：项目不再维护 static/dynamic 与 V1/V2/V3 双轨。唯一现行目标契约见
> [大屏统一组件契约与 Vue 3 注册桥接 Spec](../screen-component-vue-bridge/spec.md)。

## 0. 实施状态（A1 切片）

- 新增 `@nebula/screen-dynamic-sdk`（0.3.0-alpha.0，private）：
  `<nebula-screen-designer>` / `<nebula-screen-viewer>` Web Components
- 文档 V3（`DynamicScreenDocumentV3`，schemaVersion=3）+ 两阶段 parser（wire + registry-aware）
- 数据执行契约 `ScreenDataAdapterPort` + 实例级 `ScreenDataCoordinator`（去重/取消/超时/迟到防护）
- 组件 API v2（`nebula.screen-component/v2`，`dataCapability = none | static | host-metric`）
- 契约 fixture 组件 `xj.metric-card/v1`、`xj.chart.bar/v1` + fake adapter（测试/E2E）
- Vue 3 consumer（`apps/dynamic-sdk-vue-consumer`）Playwright smoke 通过
- 静态 `@nebula/screen-sdk` 未改动，V3 文档对其 fail-closed（V2 parser 拒绝 schemaVersion=3）
- 详见 `packages/screen-dynamic-sdk/README.md`


## 1. Background

`@nebula/screen-sdk` V1 只支持 static 数据源、static 全局变量和不发起业务请求的蓝图白名单。Nebula Web 现有 dynamic runtime 仍支持 API、dataset、API/computed 全局变量、`requestApi`、`refreshData` 和动态数据事件。

动态能力涉及认证、敏感 header、后端代理、数据集权限、缓存和网络取消，不能通过向 V1 static profile 偷渡 fetch callback 或通用 plugin API 解决。本规格为后续独立版本预留设计入口。

## 2. Goals

- 定义动态数据 SDK 的版本化文档和能力协商方式。
- 明确 API/dataset 请求由宿主还是 SDK runtime 执行，以及认证和敏感信息边界。
- 保持 `@nebula/screen-editor-core` 单一编辑器实现，并与 V1 static runtime 并行组装。
- 为现有 Nebula 动态项目提供无损、可回退、可观测的迁移路径。

## 3. Non-Goals

- 不修改 `ScreenDocumentV1`、`ScreenHostAdapter` 或 V1 static capability 白名单。
- 不在 V1 导出 renderer、属性面板、蓝图节点或任意 fetch plugin API。
- 不在本阶段迁移 `/screen/$id` 生产路由。
- 不在未确定安全模型前把 Token、Cookie 或敏感 header 交给 SDK。

## 4. Required Design Decisions

后续进入实施前必须另行评审并冻结：

1. 文档版本升级还是独立 capability manifest；旧 V1 consumer 必须稳定拒绝未来动态文档。
2. API 数据源采用宿主执行端口、受限请求描述还是后端代理，不允许 SDK 直接读取宿主认证状态。
3. dataset 标识、参数绑定、响应 Schema、缓存、刷新与 AbortSignal 契约。
4. API/computed 全局变量、`requestApi`、`refreshData`、`dataLoaded/dataError` 的精确白名单和错误诊断。
5. SSRF、协议白名单、敏感 header 脱敏、CSP/CORS、超时、响应大小与审计策略。
6. static/dynamic runtime 的包入口、版本、体积和兼容分流方式。

## 5. Migration Boundary

- 当前 Nebula 动态项目继续由 `apps/web` 的 `DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE` 打开。
- V1 SDK 继续用 `parseScreenDocument` fail-closed 拒绝动态配置，不做字段删除或 static 替换。
- 迁移工具必须先证明 load-save-load 无损 round-trip，并允许项目级回退到现有 dynamic runtime。
- 生产分流不得仅检查 active `dataSource.type`；必须覆盖保留的 API 配置、全局变量和蓝图节点/锚点。

## 6. Testing Baseline

- 契约测试覆盖版本判别、能力协商、错误诊断和旧 consumer 拒绝路径。
- 安全测试覆盖 Token/header 脱敏、协议白名单、AbortSignal、超时和响应上限。
- 双 runtime 回归证明 V1 static 产物不包含动态请求代码。
- 迁移 E2E 覆盖 API、dataset、动态全局变量和蓝图数据事件的无损编辑与回退。

## 7. Open Questions

- 动态数据执行端口是否作为 `ScreenHostAdapter` 的版本化能力组，还是发布独立主版本契约。
- dataset 契约是否保持 Nebula 专有，或抽象为宿主自定义数据资源标识。
- preview 是否接收宿主提供的临时数据会话，还是继续由宿主路由加载。

上述问题冻结前，本规格保持“设计中”，不得据此向 V1 公共 API 添加实现。
