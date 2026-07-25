# 前后端对接契约方案

> 状态：生效中
> 最近更新：2026-07-25
> 定位：前后端分离开发模式下，如何通过"契约先行 + 双向验证"保证对接成功。**所有新功能开发前必读。**

## 1. 背景与问题

前后端按同一份 spec 文档独立开发，结果对接失败。根因是文档同时存在"完整设计"和"分阶段路线图"，前后端各挑对自己方便的章节实现，且关键约定字段（如 `projectId`）的来源、传递方式、必填性未明确。

典型失败场景：
- 后端 DTO 强制 `projectId` 必填，前端 UI 没有项目上下文 → 列表查询 400
- shared schema 存在但后端 controller 未实现路由 → 前端调用 404
- 后端在 shared 之外 `.and()` 扩展 schema，前端按 shared 校验通过 → 后端校验失败

## 2. 核心思路

**把契约从前后端任一方的代码里抽出来，作为独立的第三方产物。** 前后端都是契约的"消费者"，不是"定义者"。

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  前端代码    │ ←── │  契约文件    │ ──→ │  后端代码    │
│ (消费契约)   │     │ (shared 中)  │     │ (消费契约)   │
└─────────────┘     └─────────────┘     └─────────────┘
                          ↑
                   双方共同 review 冻结
```

## 3. 轻量方案的三层产物

### 3.1 第一层：完整 Schema（数据结构契约）

把请求体、查询参数、响应体所有 Zod schema 都放到 `packages/shared/src/schemas/` 下，命名约定：

| 类型 | 命名约定 | 示例 |
|---|---|---|
| 实体 Schema | `XxxSchema` | `DatasetSchema` |
| 创建请求体 | `CreateXxxRequestSchema` | `CreateDatasetRequestSchema` |
| 更新请求体 | `UpdateXxxSchema` | `UpdateDatasetSchema` |
| 列表查询参数 | `ListXxxQuerySchema` | `ListDatasetQuerySchema` |
| 响应（含 API 层字段） | `XxxResponseSchema` | `DatasetResponseSchema` |
| 执行结果 | `XxxResultSchema` | `DatasetExecuteResultSchema` |

**关键规则**：
- 后端 DTO（`apps/nestjs-server/src/modules/*/dto/*.dto.ts`）**只做 `createZodDto` 包装**，不再 `.and()` 扩展字段
- 跨层字段（如 `projectId`）在 shared 中显式声明可选性，**不在后端 dto.ts 私自扩展**
- 前端 api.ts 用 shared 中的 `CreateXxxRequestSchema` / `XxxResponseSchema` 做预校验和响应校验

### 3.2 第二层：端点注册表（路径/方法契约）

每个模块在 `packages/shared/src/contracts/` 下新建 `*.contract.ts`，声明端点元数据：

```typescript
// packages/shared/src/contracts/dataset.contract.ts
export const DATASET_CONTRACT = {
  phase: 1 as const,
  endpoints: {
    list: {
      method: 'GET',
      path: '/dataset',
      phase: 1,
      description: '获取数据集列表',
      query: ListDatasetQuerySchema,
      response: z.array(DatasetResponseSchema),
    } as const satisfies EndpointContract,
    // ... 其他端点
  },
} as const;
```

**关键字段**：
- `phase`：阶段标记。`1=本期实现`，`2/3=未来阶段`。前后端以 phase 为准，**不再以文档 prose 描述为准**
- `method` + `path`：路径不含全局前缀 `/api/v1`，由前后端各自拼接
- `pathParams` / `query` / `body` / `response`：明确参数位置与 Schema 引用

**消费方式**：
- 前端 api.ts 从 contract 读 path / method，调用 shared 的 HTTP 工具
- 后端 controller 装饰器与 contract 保持一致（**人工对齐 + 冒烟测试校验**）

### 3.3 第三层：对接前冒烟测试

对接前由发起对接的一方跑一份最小冒烟测试，覆盖所有 `phase=1` 端点：

```bash
# 简化示例：scripts/smoke-test.sh
curl -X GET $API/dataset                  # 列表（不传 projectId）
curl -X POST $API/dataset -d '{...}'      # 创建
curl -X POST $API/dataset/batch -d '{...}'# 批量执行
curl -X GET $API/datasource-connection    # 连接列表
# ...
```

**判断标准**：每个 `phase=1` 端点必须返回符合契约的响应（HTTP 2xx + Schema 校验通过）。任一失败即对接失败，必须修复后重试。

## 4. 开发流程

### 阶段 1：开发前——契约冻结（共同任务）

1. 双方共同评审 `packages/shared/src/contracts/*.contract.ts`
2. 确认 `phase` 标记：哪些端点本期实现，哪些推迟
3. 确认所有 Schema 在 shared 中定义完整（含 Request / Query / Response）
4. PR 合入 main 分支后，**任何修改必须双方 review**

### 阶段 2：独立开发

**前端**：
- 从 `DATASET_CONTRACT.endpoints.xxx` 读 path / method
- 用 shared 中的 `CreateXxxRequestSchema` / `XxxResponseSchema` 做校验
- 不再硬编码路径，不再在 api.ts 之外定义 schema

**后端**：
- controller 装饰器（`@Get` / `@Post` 路径）与 contract 保持一致
- DTO 只做 `createZodDto(XxxRequestSchema)` 包装，不再 `.and()` 扩展
- service 层用 `XxxResponseSchema.parse()` 输出响应

### 阶段 3：对接前——双向验证

**A. 静态验证**：
- 前端：`pnpm typecheck` + `pnpm lint` 通过
- 后端：`pnpm typecheck` + `pnpm test` 通过

**B. 运行时冒烟测试**：
- 后端启动服务
- 跑一份覆盖所有 `phase=1` 端点的冒烟脚本
- 每个端点返回 2xx + Schema 校验通过

### 阶段 4：对接后——契约变更

任一方需要修改契约（新增端点、修改字段、调整 phase）：
1. 提 PR 修改 `contracts/*.contract.ts` + 对应 schema
2. 双方 review 合入
3. 各自跟进实现

**禁止**任一方私自修改契约。CI 可加 contract diff 检查（未来工作）。

## 5. 失败回退机制

| 场景 | 处理方式 |
|---|---|
| 前端发现契约需要改 | 提 PR 修改 contract → 双方 review → 合入 → 后端跟进 |
| 后端发现契约需要改 | 同上 |
| 一方私自修改契约 | 冒烟测试 fail（contract 与实现不一致） |
| 端点未实现（phase 标错） | 冒烟测试 fail，明确是哪一方没做 |
| Schema 字段不对齐 | typecheck 或冒烟测试 fail |

## 6. 文件组织

```
packages/shared/src/
├── schemas/                       # 第一层：数据结构契约
│   ├── dataset.schema.ts          #   含 CreateXxxRequestSchema / ListXxxQuerySchema / XxxResponseSchema
│   └── datasource-connection.schema.ts
├── contracts/                     # 第二层：端点注册表
│   ├── dataset.contract.ts       #   含 phase / method / path / schema 引用
│   └── index.ts
└── index.ts                       # 统一导出
```

## 7. 命名约定速查

| 类型 | 命名 | 位置 |
|---|---|---|
| 实体 Schema | `XxxSchema` | `schemas/xxx.schema.ts` |
| 创建请求 | `CreateXxxRequestSchema` | `schemas/xxx.schema.ts` |
| 更新请求 | `UpdateXxxSchema` | `schemas/xxx.schema.ts` |
| 列表查询 | `ListXxxQuerySchema` | `schemas/xxx.schema.ts` |
| 响应（含 API 层字段） | `XxxResponseSchema` | `schemas/xxx.schema.ts` |
| 端点契约 | `XXX_CONTRACT` | `contracts/xxx.contract.ts` |
| 端点 key | `camelCase`（如 `listConnections`） | contract 内 |

## 8. 跨层字段处理规则

如 `projectId` 这类"前端 UI 不持有、后端需要做隔离"的字段：

| 字段类型 | 处理方式 |
|---|---|
| 前端不持有但后端需要 | 在 shared `CreateXxxRequestSchema` 中声明为 `.optional()`，后端 service 层回退到默认值 |
| 响应中后端有但前端不读 | 在 shared `XxxResponseSchema` 中声明为 `.optional()`，前端 Zod strip 模式会忽略 |
| 任何一方需要必填 | 必须双方共同 review 决定，并在 contract `description` 中说明原因 |

## 9. 与现有文档的关系

| 文档 | 关系 |
|---|---|
| `specs/<feature>/` | 功能设计文档，描述"做什么"。契约是"怎么对接"，互补 |
| `conventions/coding-standards.md` | 编码规范，含 API 客户端约定。本文件是 API 契约约定的细化 |
| 后端 Swagger（`/api/v1/docs`） | 后端单向导出，供调试参考。**不作为契约单一数据源** |

## 10. 适用范围与未来扩展

### 当前（轻量方案）
- 手动维护 contract 文件
- 对接前手动跑冒烟测试
- 依赖双方 review 保证契约一致

### 未来可扩展（中量/重量）
- CI 自动化：后端启动 → 导出 OpenAPI JSON → 前端 CI 拉取 → `openapi-typescript` 生成类型 → diff 前端 contract
- 端到端契约测试：用 Pact 或类似工具，强制前后端契约一致
- `createApiClient(contract)` 工具：从 contract 自动生成 typed client，减少前端样板代码
