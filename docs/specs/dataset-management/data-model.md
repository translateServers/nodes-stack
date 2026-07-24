# 数据集管理 · 数据模型设计

> 状态：设计完成
> 最近更新：2026-07-24
> 定位：定义数据集、数据源连接、组件绑定的 Schema 与持久化模型，是前后端契约的依据

## 1. 数据集 Schema

新增 `packages/shared/src/schemas/dataset.schema.ts`：

```
DatasetSchema
├─ id: string (cuid)
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
│  └─ filter?: string               // JS 函数字符串(沙箱执行)
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
│  └─ data?: unknown                // static mock 数据
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
- **覆盖语义**：`overrideFieldMapping` / `overrideLogic` 为空时使用数据集默认配置；非空时覆盖

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
  id          String   @id @default(cuid())
  projectId   String   // 关联 ScreenProject
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
}

model DataSourceConnection {
  id          String   @id @default(cuid())
  projectId   String
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
}
```

### 4.1 作用域决策

- **项目级隔离**：数据集和连接都按 `projectId` 隔离（项目内复用），不做全局跨项目共享
- **软删除**：`status = 'archived'` 表示归档，不物理删除；归档后引用组件显示警告
- **唯一约束**：`projectId + name` 唯一，避免重名冲突

## 5. 业务码扩展

在 `packages/shared/src/types/api.types.ts` 的 `BizCode` 中新增 80xxx 段：

```
// 数据集相关
DATASET_NOT_FOUND = 80001
DATASET_NAME_EXISTS = 80002
DATASET_CONNECTION_FAILED = 80003
DATASET_EXECUTION_FAILED = 80004
DATASET_SQL_INVALID = 80005          // 非 select 语句
DATASET_MOCK_DISABLED = 80006

// 数据源连接相关
CONNECTION_NOT_FOUND = 80101
CONNECTION_NAME_EXISTS = 80102
CONNECTION_TEST_FAILED = 80103
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
| 80101 | 404 | 连接不存在 |
| 80102 | 409 | 连接名称冲突 |
| 80103 | 502 | 连接测试失败 |

## 6. 字段映射复用

`FieldMapping` 复用现有 `screen.schema.ts` 中的定义：

```
{ dimension: string; value: string }  // 默认推断：name→维度、value→数值
```

数据集的 `shape.fieldMapping` 与组件绑定的 `overrideFieldMapping` 共用此类型，保证管线一致。
