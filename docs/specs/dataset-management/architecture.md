# 数据集管理 · 模块架构与数据流

> 状态：设计完成
> 最近更新：2026-07-24
> 定位：定义后端模块、前端 Feature 模块、API 端点与数据流路径

## 1. 后端模块划分

新增 `apps/nestjs-server/src/modules/dataset/` 与 `datasource-connection/` 两个模块：

```
dataset/
├─ dataset.module.ts
├─ dataset.controller.ts        // CRUD + execute + test
├─ dataset.service.ts           // 业务逻辑
├─ dataset-cache.service.ts     // 缓存层(Redis 或内存 LRU)
├─ dataset-executor/
│  ├─ executor.interface.ts     // DatasetExecutor 抽象
│  ├─ static.executor.ts        // 静态数据直接返回
│  ├─ api.executor.ts           // HTTP 代理请求
│  ├─ sql.executor.ts           // 数据库查询
│  └─ websocket.executor.ts     // WS 长连接管理(第三阶段)
├─ dataset-filter.service.ts    // filter 表达式求值（JSONata）
├─ dataset-mock.service.ts      // Mock 数据生成
└─ dto/
   ├─ create-dataset.dto.ts
   ├─ update-dataset.dto.ts
   ├─ execute-dataset.dto.ts    // { datasetId, params, useMock }
   └─ test-connection.dto.ts

datasource-connection/
├─ connection.module.ts
├─ connection.controller.ts     // CRUD + test
├─ connection.service.ts
├─ connection-crypto.service.ts // 密码 AES+RSA 加密(参考 Light Chaser)
└─ dto/...
```

### 1.1 Executor 抽象

`DatasetExecutor` 接口统一四种类型的执行入口：

```ts
interface DatasetExecutor<TConfig> {
  execute(config: TConfig, params: Record<string, unknown>): Promise<unknown>
  test(config: TConfig, params: Record<string, unknown>): Promise<TestResult>
}
```

- `execute`：正式执行，受缓存策略控制
- `test`：测试执行，不缓存，返回原始结果 + 解析后结果 + 耗时等元信息

## 2. 后端 API 端点

在 `apps/web/src/api/core/endpoints.ts` 中新增 `dataset` 与 `connection` 端点：

> 路径不含 `API_BASE_URL` 前缀（`/api/v1`），完整 URL 为 `/api/v1` + 下表路径。

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/dataset` | 列表（按 projectId 过滤） |
| GET | `/dataset/:id` | 详情 |
| POST | `/dataset` | 创建 |
| PATCH | `/dataset/:id` | 更新 |
| DELETE | `/dataset/:id` | 删除（软删除，归档） |
| POST | `/dataset/:id/execute` | **执行数据集**（body: `{ params, useMock }`） |
| POST | `/dataset/:id/test` | 测试执行（不缓存，返回原始 + 解析后结果） |
| POST | `/dataset/batch` | 批量执行（**第三阶段**，预览页一次加载多数据集） |
| GET | `/datasource-connection` | 连接列表 |
| GET | `/datasource-connection/:id` | 连接详情 |
| POST | `/datasource-connection` | 创建连接 |
| PATCH | `/datasource-connection/:id` | 更新连接 |
| DELETE | `/datasource-connection/:id` | 删除连接 |
| POST | `/datasource-connection/:id/test` | 测试连接 |

> 端点命名采用完整业务语义 `datasource-connection`（为避免与未来"组件连接"等概念混淆，此端点采用完整名；现有端点如 `/roles`、`/screen` 为短名）。

### 2.1 鉴权与权限

> 现状核查：现有后端仅有 `JwtAuthGuard` + `ThrottlerGuard`，**无项目级 RBAC**，`ScreenProject` 无 owner/成员字段；`/screen/:id/preview` 为 `@Public()` 匿名公开。详见 [security-decisions.md](./security-decisions.md) §7.3 / §7.5。

**第一阶段（MVP）**：

- 数据集 / 连接的 CRUD 与 test 端点：登录用户（JWT），与现有 screen 模块一致
- `execute` / `batch` 端点：匿名可访问（跟随 preview 语义），但仅允许执行**已发布项目**的数据集，配独立限流 + SSRF 防护 + 资源配额（security-decisions §7.5）
- 连接凭证的加密与脱敏不受权限阶段影响，始终按 security-decisions §7.1 / §7.4 执行

**后续阶段**：项目级权限模型（ownership + 成员表 + 权限 Guard）作为独立前置能力落地后收紧：连接管理 = 项目管理员、数据集 CRUD = 项目编辑、预览执行 = 项目查看。

## 3. 前端 Feature 模块

新增 `apps/web/src/features/dataset/`：

```
dataset/
├─ api.ts                       // API 客户端封装
├─ hooks/
│  ├─ use-datasets.ts           // TanStack Query: 列表/详情
│  ├─ use-dataset-mutation.ts   // 增删改
│  ├─ use-dataset-execute.ts    // 执行测试
│  └─ use-dataset-source.ts     // 编辑器内: 组件绑定数据集后拉取数据
├─ pages/
│  ├─ dataset-list.tsx          // 管理页: 列表
│  ├─ dataset-editor.tsx        // 管理页: 编辑(含测试)
│  └─ connection-list.tsx       // 连接管理页
├─ components/
│  ├─ dataset-form.tsx          // 数据集表单(按 type 动态渲染)
│  ├─ static-config-form.tsx
│  ├─ api-config-form.tsx
│  ├─ sql-config-form.tsx
│  ├─ connection-selector.tsx   // 连接下拉选择
│  ├─ field-mapping-editor.tsx  // 图形化字段映射
│  ├─ filter-editor.tsx         // filter 表达式编辑器(Monaco，新依赖)
│  ├─ refresh-config-form.tsx
│  ├─ mock-config-form.tsx
│  ├─ dataset-test-panel.tsx    // 测试结果展示(原始 + 解析后)
│  └─ dataset-picker.tsx        // 编辑器内选择数据集的弹窗
└─ types.ts

screen/hooks/use-dataset-source.ts        // 编辑器集成: 组件 dataSource.type==='dataset' 时使用
screen/components/dataset-config-section.tsx  // 属性面板 data tab 的新 section
```

### 3.1 UI 组件规范

- **注册表驱动**：数据集类型注册表（类似 `COMPONENT_DEFINITIONS`），新增类型 = 追加一条描述
- **Schema 驱动渲染**：数据集表单按 `config` 判别联合动态渲染，简单字段声明式，复杂编辑器（filter / 字段映射）保留自定义渲染器作为逃生舱
- **shadcn/ui 一致性**：管理页与编辑器内表单均使用 shadcn/ui（遵循项目硬约束）

## 4. 路由与导航

### 4.1 路由新增

新增以下路由文件：

- `apps/web/src/routes/_app.dataset.tsx`：数据集列表页
- `apps/web/src/routes/_app.dataset.$id.tsx`：数据集编辑页
- `apps/web/src/routes/_app.datasource-connection.tsx`：数据源连接管理页

### 4.2 导航菜单

在 `apps/web/src/config/navigation.ts` 的 `menuGroups` 中新增"数据集管理"菜单组：

```
数据集管理
├─ 数据集        → /dataset
└─ 数据源连接    → /datasource-connection
```

## 5. 数据流设计

### 5.1 编辑器内组件绑定数据集的数据流

```
[组件 dataSource.type === 'dataset']
  ↓ datasetId + paramBindings
[useDatasetSource hook]
  ↓ 解析 paramBindings: 从 component props / url params / trigger 取值
  ↓ POST /api/dataset/:id/execute { params, useMock: 编辑态默认 true }
[后端 dataset.service.execute]
  ↓ 查 Dataset 实体 + 关联 Connection
  ↓ 按 type 选 Executor
  │  ├─ static: 直接返回 staticData
  │  ├─ api: 后端代理 HTTP 请求(SSRF 防护 + connection.baseUrl + auth + 公共 header)
  │  ├─ sql: 后端执行 SQL(强制 select,参数化查询)
  │  └─ websocket: 第三阶段
  ↓ 缓存命中检查(若 enabled 且未过期,直接返回缓存)
  ↓ 执行获取原始数据
  ↓ filter 表达式求值(DatasetFilterService, JSONata)
  ↓ dataPath 提取 + 字段映射(shape 契约)
  ↓ 返回 { status, raw, parsed, meta: { fromCache, durationMs } }
[前端 useDatasetSource]
  ↓ 复用现有 useChartData(dataSource, logic, parsed)
  ↓ chart-data-parser 管线: extractDataByPath → mapFields → applyLogicConfig
  ↓ ParseResult
[组件渲染]
  ↓ 蓝图 dataLoaded / dataError 触发器复用
```

### 5.2 关键复用点

- `useChartData` 和 `chart-data-parser` 管线完全不变。数据集只是新的"数据来源"，产出 `apiRawData` 等价物后注入同一管线
- 蓝图运行时（`apps/web/src/features/screen/blueprint/runtime/executor.ts` 的 `RuntimeDeps`）已解耦：
  - `refreshDataSource(componentId)`：组件数据源为 `dataset` 时，触发 `useDatasetSource` 重新请求
  - `getComponentData(componentId)`：读取组件最新解析数据（数据集场景下数据已写入此缓存，无需改动）
  - `requestApi` 动作语义不变（独立 HTTP 请求，不写回数据源）

### 5.3 蓝图运行时集成

现有蓝图抽象已解耦，无需改动执行器。**新增能力建议**（路线图第二阶段）：

- 新增 `refreshDataset(datasetId)` 动作，可主动刷新数据集缓存，触发所有引用组件更新
- 现有 `requestApi` 动作语义不变（独立 HTTP 请求，不写回数据源）

### 5.4 预览页数据流

```
ScreenPreview 加载项目
  ↓ 收集所有组件引用的 datasetId 集合
  ↓ POST /api/dataset/batch { ids, params }  // 一次批量拉取
  ↓ 分发到各组件的 apiRawDataOverride
  ↓ 各组件按自身 refresh 策略启动轮询(走 /execute 端点)
[WebSocket 推送(第三阶段)]
  ↓ 后端 WS 推送数据集更新事件
  ↓ 前端按 datasetId 路由到引用组件
```

### 5.5 后端代理 vs 前端直连的决策

**现状**：现有 `api` 数据源由浏览器直接 fetch，受 CORS 限制。

**决策**：数据集的 `api` / `sql` 类型一律走后端代理。

**理由**：
- 解决 CORS（外部 API 通常不允许跨域）
- 统一鉴权（连接池的凭证不暴露给前端）
- 可加服务端缓存（减少外部 API 压力）
- 可记录请求日志、监控告警
- 现有 `api` 数据源保留前端直连（向后兼容），仅 `dataset` 类型走后端

**实现**：后端 `ApiExecutor` 使用 Node.js 的 `undici` 或 `axios`，超时控制（默认 10s），错误分类（network / http / timeout / parse）复用现有 `ApiRequestError` 设计。目标主机做 SSRF 校验（内网 IP 拦截 / 重定向复核 / 协议白名单），响应上限 5MB，详见 security-decisions §2.4。

**阶段说明**：Connection Module 属第二阶段。第一阶段 api 数据集的 `connectionId` 不启用，`path` 必须为完整 URL，鉴权与公共 header 在数据集自身 `config.headers` 内配置。
