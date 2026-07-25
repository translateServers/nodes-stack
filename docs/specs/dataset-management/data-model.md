# 数据集管理 · 数据模型设计

> 状态：设计完成
> 最近更新：2026-07-24
> 定位：定义数据集、数据源连接、组件绑定的 Schema 与持久化模型，是前后端契约的依据

## 1. 数据集 Schema

新增 `packages/shared/src/schemas/dataset.schema.ts`：

```
DatasetSchema
├─ id: string (uuid)
├─ name: string (1-50 字符, 项目内唯一)
├─ description: string (可选)
├─ type: 'static' | 'api' | 'sql' | 'websocket'
├─ category: string (业务分组,如 "销售"/"库存")
├─ tags: string[] (可选,便于检索)
│
├─ config: 判别联合 (按 type 分支)
│  ├─ static: { staticData: unknown }
│  ├─ api: {
│  │    connectionId?: string       // 可选关联 http-api 连接(提供 baseUrl + 公共 header)
│  │    path: string                // 相对路径或完整 URL
│  │    method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'
│  │    headers?: Record<string,string>
│  │    params?: Record<string, unknown>
│  │    body?: unknown
│  │    contentType: 'json'|'form-data'|'x-www-form-urlencoded'
│  │  }
│  ├─ sql: {
│  │    connectionId: string        // 必须关联数据库连接
│  │    sql: string                 // 必须 select 开头
│  │  }
│  └─ websocket: {
│       url: string
│       protocol?: string[]
│       messageFormat: 'json'|'text'
│     }
│
├─ shape: 数据形态契约
│  ├─ dataPath?: string             // 点分隔路径,如 "data.list"
│  ├─ fieldMapping?: FieldMapping   // 默认字段映射(可被组件覆盖)
│  └─ filter?: string               // JSONata 表达式(服务端求值)
│
├─ refresh: 刷新策略
│  ├─ interval: number              // 0=不轮询,>0=秒
│  ├─ intervalUnit: 'second'|'minute'|'hour'
│  └─ stopOnHidden: boolean         // 组件隐藏时停止刷新
│
├─ cache: 缓存策略(后端代理用)
│  ├─ enabled: boolean
│  ├─ ttl: number                   // 秒
│  └─ tags: string[]                // 缓存标签,支持批量失效
│
├─ mock: Mock 配置
│  ├─ enabled: boolean
│  ├─ generator: 'static'|'faker-template'|'echo-params'
│  ├─ data?: unknown                // static mock 数据
│  └─ template?: string             // faker 模板表达式
│
├─ status: 'active'|'archived'
├─ createdBy: string
├─ createdAt: string (ISO)
└─ updatedAt: string (ISO)
```

### 1.1 关键字段说明

- **`config` 判别联合**：与现有 `DataSourceConfigSchema` 一致，按 `type` 分发，便于 Zod 校验
- **`shape` 契约**：数据集定义"数据长什么样"，组件绑定可覆盖；解决 Light Chaser 把字段映射塞进组件配置、无法跨组件复用的问题
- **`refresh` 策略**：数据集级定义默认刷新策略，组件绑定可覆盖（双层配置，参考 GoView 全局 + 组件双层轮询）
- **`cache` 策略**：仅后端代理用，前端不感知；`tags` 支持按业务域批量失效
- **`mock` 配置**：内置 Mock，编辑态默认启用；解决 Light Chaser 调试强依赖真实数据源的问题
- **`mock` 字段联动校验**：`generator = 'static'` 时 `data` 必填，`generator = 'faker-template'` 时 `template` 必填（Zod `superRefine` 实现）
- **`websocket` 分阶段启用**：type 枚举保留 `websocket` 以避免后续存量数据迁移；执行端按阶段实现，未启用阶段调用 execute 返回 `DATASET_TYPE_NOT_SUPPORTED`（80007，见 §5）

## 2. 数据源连接 Schema

新增 `packages/shared/src/schemas/datasource-connection.schema.ts`：

```
DataSourceConnectionSchema
├─ id: string
├─ name: string (项目内唯一)
├─ type: 'mysql'|'postgres'|'http-api'
├─ description?: string
│
├─ config: 判别联合
│  ├─ mysql/postgres: {
│  │    host, port, database, username
│  │    password: string            // 加密存储
│  │    ssl?: boolean
│  │  }
│  └─ http-api: {
│       baseUrl: string
│       defaultHeaders?: Record<string,string>
│       authType?: 'none'|'bearer'|'basic'|'api-key'
│       authConfig?: 鉴权配置(加密)
│  │  }
│
├─ status: 'active'|'archived'
├─ lastTestedAt?: string
├─ lastTestResult?: 'success'|'fail'
└─ timestamps...
```

### 2.1 设计要点

- **类型分类**：`mysql` / `postgres` / `http-api` 三类，覆盖数据库与 HTTP API 两种主流外部数据源
- **凭证隔离**：密码字段独立加密存储，不回显明文（参考 Light Chaser 的 AES+RSA 双重加密）
- **测试状态**：`lastTestedAt` + `lastTestResult` 用于列表页状态指示灯
- **作用域**：按 `projectId` 隔离，不做全局跨项目共享；未来如需全局公共连接，可新增 `scope: 'project' | 'global'` 字段

## 3. 现有 DataSourceConfig 扩展

在 `packages/shared/src/schemas/screen.schema.ts` 的 `DataSourceTypeSchema` 中新增 `'dataset'` 分支：

```
DataSourceConfigSchema = z.discriminatedUnion('type', [
  现有 static 分支,
  现有 api 分支,
  新增 dataset 分支: {
    type: 'dataset',
    datasetId: string,
    paramBindings?: Record<string, ParamBinding>,   // 参数绑定
    overrideFieldMapping?: FieldMapping,             // 覆盖数据集默认映射
    overrideLogic?: LogicConfig,                     // 覆盖数据集默认逻辑层
    overrideRefresh?: RefreshStrategy,               // 覆盖数据集默认刷新策略
    // 保留 dataPath / fieldMapping 公共字段以兼容管线
  }
])
```

ParamBinding = {
  source: 'component-prop' | 'component-data' | 'url-param' | 'static' | 'trigger'
  path: string        // source 路径,如 "props.value" / "url.id"
  defaultValue?: unknown
}

### 3.1 兼容性约定

- **类型切换保留配置**：遵循现有设计，切到 `dataset` 时，`staticData` 和 `apiConfig` 仍保留为 optional，便于回切
- **公共字段不变**：`dataPath` / `fieldMapping` / `logic` 在 dataset 分支仍存在，与现有管线兼容
- **覆盖语义**：`overrideFieldMapping` / `overrideLogic` / `overrideRefresh` 为空时使用数据集默认配置；非空时覆盖

### 3.2 ParamBinding 来源

| source | 说明 | 示例 |
|---|---|---|
| `component-prop` | 当前组件的 props 字段 | `props.date` |
| `component-data` | 当前组件的已解析数据（用于联动） | `data.selectedRegion` |
| `url-param` | 预览页 URL query | `url.region` |
| `static` | 固定值 | `"2026-07-24"` |
| `trigger` | 蓝图触发器上下文 | `{{trigger.value}}`，复用现有模板插值 |

## 4. 后端 Prisma 模型

新增 `apps/nestjs-server/prisma/schema/Dataset.prisma`：

```prisma
model Dataset {
  id          String   @id @default(uuid())  // 与现有模型约定一致（uuid，非 cuid）
  projectId   String
  project     ScreenProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  description String?
  type        String   // static|api|sql|websocket
  category    String?
  tags        Json?    // string[]
  config      Json     // 数据集配置(按 type 分支)
  shape       Json?    // { dataPath, fieldMapping, filter }
  refresh     Json?    // { interval, intervalUnit, stopOnHidden }
  cache       Json?    // { enabled, ttl, tags }
  mock        Json?    // { enabled, generator, data, template }
  status      String   @default("active")
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, name])
  @@index([projectId, status])
  @@map("datasets")
}

model DataSourceConnection {
  id          String   @id @default(uuid())
  projectId   String
  project     ScreenProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  type        String   // mysql|postgres|http-api
  description String?
  config      Json     // 连接配置(密码字段加密)
  status      String   @default("active")
  lastTestedAt  DateTime?
  lastTestResult String?
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, name])
  @@index([projectId, status])
  @@map("datasource_connections")
}
```

> 现有模型约定：`@default(uuid())` + `@@map` 蛇形表名（如 `screen_projects`），新模型保持一致。
> `Screen.prisma` 的 `ScreenProject` 需同步添加 back-relation：`datasets Dataset[]`、`connections DataSourceConnection[]`、`datasetReferences DatasetReference[]`（见 §4.2）。

### 4.1 作用域决策

- **项目级隔离**：数据集和连接都按 `projectId` 隔离（项目内复用），不做全局跨项目共享
- **软删除与清理**：`status = 'archived'` 表示归档；归档后引用组件显示警告；归档满 30 天由定时任务（`@nestjs/schedule` Cron）物理删除。归档/删除前校验引用数（见 §4.2），存在引用时需用户确认
- **唯一约束**：`projectId + name` 唯一，避免重名冲突

### 4.2 引用追踪（引用数的实现机制）

组件对 `datasetId` 的引用埋在 `ScreenProject.components` JSON 字符串内部，无法靠外键发现。新增引用索引表：

```prisma
model DatasetReference {
  id          String @id @default(uuid())
  datasetId   String
  dataset     Dataset @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  projectId   String
  componentId String

  @@unique([datasetId, projectId, componentId])
  @@index([projectId])
  @@map("dataset_references")
}
```

- **写入时机**：项目保存（`PUT /screen/:id`）时由后端解析 components JSON，提取 `dataSource.type === 'dataset'` 的绑定，事务内重建该项目的引用索引（先删后插）
- **读取**：列表页"引用数"、删除/归档前校验均为 `DatasetReference` 聚合查询，O(1)
- **连接引用数**：`Dataset.config` 中的 `connectionId` 为结构化字段，直接对 Dataset 表做聚合查询，无需额外索引表

## 5. 业务码扩展

新增 80xxx 段数据集业务码，需同步扩展三处：

1. `packages/shared/src/types/api.types.ts` 的 `BizCode` 对象：新增 80xxx 段常量
2. `packages/shared/src/types/api.types.ts` 的 `BIZ_CODE_TO_HTTP_STATUS` 映射：新增 80xxx 段到 HTTP 状态码的映射
3. `packages/shared/src/errors/index.ts` 的 `BizMessage` 映射：新增 80xxx 段默认消息（否则 `getBizMessage(80001)` 回退到"未知错误"）

> 现有 `BizCode` 是 `as const` 对象字面量（非 enum），新增条目须**同步扩展 `BIZ_CODE_TO_HTTP_STATUS` 映射**，否则 `getHttpStatus` 回退 500；同理须**同步扩展 `BizMessage` 映射**，否则 `getBizMessage` 回退到"未知错误"。

段位分配：

| 段位 | 模块 |
|---|---|
| 80xxx | 数据集 |

```
// 数据集相关 (80xxx)
DATASET_NOT_FOUND: 80001
DATASET_NAME_EXISTS: 80002
DATASET_CONNECTION_FAILED: 80003
DATASET_EXECUTION_FAILED: 80004
DATASET_SQL_INVALID: 80005          // 非 select 语句 / 含多语句
DATASET_MOCK_DISABLED: 80006
DATASET_TYPE_NOT_SUPPORTED: 80007   // websocket 等当前阶段未实现的类型

// 数据源连接相关 (801xx)
CONNECTION_NOT_FOUND: 80101
CONNECTION_NAME_EXISTS: 80102
CONNECTION_TEST_FAILED: 80103
```

### 5.1 HTTP 状态码映射

| BizCode | HTTP | 说明 |
|---|---|---|
| 80001 | 404 | 数据集不存在 |
| 80002 | 409 | 名称冲突 |
| 80003 | 502 | 上游连接失败 |
| 80004 | 500 | 执行失败（含 filter 错误） |
| 80005 | 400 | SQL 校验失败 |
| 80006 | 400 | Mock 未启用 |
| 80007 | 501 | 数据集类型当前阶段未支持 |
| 80101 | 404 | 连接不存在 |
| 80102 | 409 | 连接名称冲突 |
| 80103 | 502 | 连接测试失败 |

## 6. 字段映射复用

`FieldMapping` 复用现有 `screen.schema.ts` 中的定义：

```
{ dimension: string; value: string }  // 默认推断：name→维度、value→数值
```

数据集的 `shape.fieldMapping` 与组件绑定的 `overrideFieldMapping` 共用此类型，保证管线一致。
