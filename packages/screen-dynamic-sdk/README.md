# @nebula/screen-dynamic-sdk

大屏动态 SDK：Nebula 大屏设计器与查看器 Web Components，动态数据能力由宿主 adapter 委托执行。

> 阶段：A1 契约切片（0.3.0-alpha.0，private）
> 对应规格：`docs/specs/screen-sdk-dynamic-data/spec.md` + `xjdatahub .agent/specs/nebula-screen-replacement`

## 能力边界（第一阶段）

- 文档：V3 动态文档（`DynamicScreenDocumentV3`，schemaVersion=3），旧 consumer fail-closed
- 数据源：仅 `static` 与 `host/xj-metric`；禁止任意 API / SQL / 脚本
- 数据执行：宿主 `ScreenDataAdapterPort` 委托后端，SDK 不经手 Token / URL / SQL
- 蓝图：`pageLoad/interval/navigate/scrollTo` + `show/hide/toggleVisibility/refreshData`；禁止 `requestApi`
- 组件：组件 API v2（`nebula.screen-component/v2`），`dataCapability = none | static | host-metric`

## 使用（Vue 3 / React / 原生）

```ts
import '@nebula/screen-dynamic-sdk/auto-register';
import { createXjContractFixtureRegistry } from '@nebula/screen-dynamic-sdk';

const registry = await createXjContractFixtureRegistry(); // A1 契约组件；A2 替换为 XJ 生产注册表

const designer = document.createElement('nebula-screen-designer');
designer.componentRegistry = registry; // 先注册表后 document（document 冻结注册表）
designer.document = v3Document;
designer.dataAdapter = hostAdapter; // ScreenDataAdapterPort
container.append(designer);
await designer.whenReady();
designer.save(); // 返回 V3 文档（宿主持久化）
```

Viewer 相同，使用 `nebula-screen-viewer`；`options.refreshIntervalSeconds` 控制定时刷新。

## 宿主需要提供的

1. **组件注册表**：`createScreenComponentRegistry({ components: [...] })`（editor-core/experimental），
   XJ 生产组件 manifest 使用 API v2 + `dataCapability: 'host-metric'`。
2. **数据适配端口**：实现 `ScreenDataAdapterPort`（resourceList / openContext / syncContext /
   closeContext / execute），委托后端执行，服务端从已验证 context 解析组件与指标。
3. **React 运行时**：SDK 内部使用 React；宿主需提供 react / react-dom（SDK 构建已外部化）。

## 质量门（A1-GATE）

- `pnpm --filter @nebula/screen-dynamic-sdk build`：boundary + 构建 + 声明完整
- `pnpm --filter @nebula/screen-dynamic-sdk test`：元素挂载 / fake adapter 数据闭环 / 定时刷新
- `pnpm --filter @nebula/screen-dynamic-sdk size`：gzip 合计 ≤ 900 KiB（当前约 190 KiB）
- `pnpm --filter @nebula/screen-dynamic-sdk verify:tarball`：tarball 入口完整
- `apps/dynamic-sdk-vue-consumer`：Vue 3 + Vite 8 消费者 Playwright smoke（designer 挂载 / 保存 / viewer 数据渲染）
