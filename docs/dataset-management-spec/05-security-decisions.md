# 数据集管理 · 关键技术决策与安全

> 状态：设计完成
> 最近更新：2026-07-24
> 定位：阐明 filter 沙箱、后端代理、SQL 安全、缓存、Mock、迁移等关键技术决策，以及安全与权限设计

## 1. filter 沙箱化

### 1.1 问题

Light Chaser 与 GoView 均用 `eval` 执行 filter，存在 XSS 风险：
- Light Chaser：`eval("(" + filter + ")")`
- GoView：`javascript:` 前缀执行任意 JS

### 1.2 方案

使用 `new Function` 构造受限执行环境：

```ts
new Function('data', 'context', `
  with (context) {
    ${filterBody}
  }
`)
```

- `context` 受限对象：仅暴露 `$data`（原始数据）、`$params`（请求参数）、`$utils`（白名单工具函数，如 `dateFormat`、`groupBy`、`sum`）
- **不暴露** `window` / `document` / `fetch` / `eval` / `Function`
- 执行超时（如 100ms）+ try/catch 包裹，失败返回原始数据并记录错误
- 编辑器内提供 filter 模板库（常见转换：数组转 ECharts dataset、日期分组、TopN 等）

### 1.3 执行位置

- **服务端执行**：数据集执行在后端，filter 也在后端执行，前端不直接执行用户 filter
- **编辑态测试**：前端只发送 filter 代码到后端 `/test` 端点执行，避免前端沙箱逃逸风险

## 2. 后端代理决策

### 2.1 决策

数据集的 `api` / `sql` 类型一律走后端代理，前端不直接 fetch 外部 URL。

### 2.2 理由

- 解决 CORS（外部 API 通常不允许跨域）
- 统一鉴权（连接池的凭证不暴露给前端）
- 可加服务端缓存（减少外部 API 压力）
- 可记录请求日志、监控告警
- 现有 `api` 数据源保留前端直连（向后兼容），仅 `dataset` 类型走后端

### 2.3 实现

- 后端 `ApiExecutor` 使用 Node.js 的 `undici` 或 `axios`
- 超时控制（默认 10s）
- 错误分类（network / http / timeout / parse）复用现有 `ApiRequestError` 设计

## 3. SQL 安全

参考 Light Chaser 的安全实践：

- **强制 select 开头**：正则校验 `^\s*select\b`
- **参数化查询**：禁止字符串拼接 SQL，参数通过 `?` 占位符绑定
- **只读用户**：建议数据源连接使用只读数据库账号（文档建议，非强制）
- **结果限制**：默认 `LIMIT 1000`，可在数据集配置中调整上限
- **SQL 编码**：传输时 Base64 编码（避免防火墙拦截，参考 Light Chaser v1.3.0）

## 4. 缓存策略

### 4.1 后端缓存

`DatasetCacheService` 实现：
- 内存 LRU + 可选 Redis（多实例部署）
- key = `dataset:{id}:params:{hash(params)}`
- TTL 由数据集 `cache.ttl` 配置
- 标签失效：`cache.tags` 支持按标签批量失效（如"销售"标签下所有数据集）
- 主动失效：数据集更新时清除该 id 的所有缓存

### 4.2 前端缓存

`useDatasetSource` hook 实现：
- 编辑态：每次配置变更后重新请求（不缓存）
- 预览态：按 `refresh.interval` 轮询，复用现有 `useApiDataSource` 的 AbortController + 竞态防护

## 5. Mock 机制

### 5.1 问题

Light Chaser 与 GoView 调试强依赖真实数据源，无 Mock 能力。

### 5.2 方案

数据集内置 `mock` 配置，编辑态默认启用。

| generator | 说明 |
|---|---|
| `static` | 直接返回 `mock.data` |
| `faker-template` | 基于 [faker](https://fakerjs.dev/) 模板生成随机数据 |
| `echo-params` | 回显绑定参数，用于调试参数绑定正确性 |

### 5.3 faker 模板示例

```json
{
  "list|10": [
    {
      "name": "{{faker.person.fullName}}",
      "value|0-1000": 1
    }
  ]
}
```

### 5.4 启用策略

- 编辑器内组件数据源为 `dataset` 时，编辑态默认 `useMock: true`（可在配置中切换）
- 预览态默认 `useMock: false`，可在预览页工具栏切换

## 6. 与现有数据源迁移的兼容

现有 `apps/web/src/features/screen/lib/data-source-migration.ts` 处理 `props.data → dataSource.staticData` 一次性迁移。

### 6.1 新增迁移路径（可选，非强制）

- 用户可在组件数据源配置中点击"提取为数据集"，将当前 `api` / `static` 配置提取为独立数据集实体，组件自动切换为 `dataset` 类型并绑定
- 此为用户主动操作，不做自动迁移，避免破坏现有项目

### 6.2 兼容性保证

- 现有 `static` / `api` 数据源完全保留，不强制迁移
- 现有 `api` 数据源仍由前端直连（向后兼容）
- `dataset` 是新增的可选类型，用户按需采用

## 7. 安全与权限

### 7.1 数据源连接凭证保护

- 密码字段前端用 AES+RSA 双重加密传输（参考 Light Chaser）
- 后端用项目级密钥加密存储，不回显明文
- 编辑连接时密码字段为空，留空表示不修改
- `lastTestResult` 仅记录成功/失败，不记录错误详情（防信息泄露）

### 7.2 filter 执行安全

- 沙箱化（见第 1 节）
- 服务端执行（数据集执行在后端，filter 也在后端执行，前端不直接执行用户 filter）
- 编辑态测试 filter 时，前端只发送 filter 代码到后端 `/test` 端点执行

### 7.3 权限控制

复用现有 nestjs-server 权限体系：

| 操作 | 所需权限 |
|---|---|
| 数据集 CRUD | 项目编辑权限 |
| 数据源连接管理 | 项目管理员权限（含敏感凭证） |
| 预览页执行数据集 | 项目查看权限 |
| 数据集测试执行 | 项目编辑权限 |

API 端点接入现有 RBAC 中间件。

### 7.4 敏感信息脱敏

复用现有 `apps/web/src/features/screen/blueprint/lib/request-api-mask.ts` 的脱敏逻辑：
- 数据集执行日志中，敏感 header（authorization / cookie / x-api-key 等）替换为 `***`
- 前后端共用脱敏规则（已在 `packages/shared` 中实现）
