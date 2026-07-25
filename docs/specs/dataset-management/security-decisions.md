# 数据集管理 · 关键技术决策与安全

> 状态：设计完成
> 最近更新：2026-07-24
> 定位：阐明 filter 表达式引擎、后端代理、SQL 安全、缓存、Mock、迁移等关键技术决策，以及安全与权限设计

## 1. filter 表达式引擎（安全执行）

### 1.1 问题

Light Chaser 与 GoView 均用 `eval` 执行 filter，存在 XSS 风险：
- Light Chaser：`eval("(" + filter + ")")`
- GoView：`javascript:` 前缀执行任意 JS

评审已否决 `new Function` + `with` 受限作用域方案，原因：
- `with (context)` 只把 context 属性加到作用域链前端，**无法遮蔽全局对象**——Node 环境下 `globalThis` / `process` / `fetch` 沿作用域链依然可达，`globalThis.process.env` 即可读取数据库凭证（击穿 §7.1 全部凭证保护）
- 同步执行**无法实施超时**：`while(true){}` 直接卡死事件循环
- 服务端执行用户 JS 会把浏览器端 XSS 升级为服务端 RCE，风险放大而非收敛

### 1.2 方案：声明式表达式引擎（第一阶段）

filter 字段使用 [JSONata](https://jsonata.org/) 表达式而非 JS 函数体：

- **图灵不完备**：无循环、无 I/O、无全局对象访问，天然免疫注入与死循环
- **服务端执行**：`DatasetFilterService` 调用 `jsonata(expression).evaluate(data)`，求值包超时兜底（如 1s），失败返回原始数据并记录错误
- **能力覆盖**：路径提取、过滤、聚合、排序、字符串/日期函数内置，覆盖"数组转 ECharts dataset、日期分组、TopN"等常见转换
- **表达式模板库**：编辑器内置常用 JSONata 模板，与图形化字段映射互补

### 1.3 JS filter（第三阶段，可选）

如确需 JS 表达能力，作为第三阶段高级能力单独安全评估，**前置条件是引入 `isolated-vm`**（真正的 V8 隔离 + 内存/CPU 配额）。Node 内置 `vm` 模块存在已知逃逸，不作为安全边界。

### 1.4 执行位置

- **服务端执行**：数据集执行在后端，filter 也在后端求值，前端不直接执行用户表达式
- **编辑态测试**：前端只发送表达式到后端 `/test` 端点求值

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

### 2.4 SSRF 防护（必做）

后端代理使服务端代替用户发起任意 URL 请求，必须防 SSRF：

- **目标校验**：URL 解析后做 DNS 解析，拦截内网地址——RFC1918（`10/8`、`172.16/12`、`192.168/16`）、环回（`127/8`）、链路本地（`169.254/16`，含云元数据端点）、IPv6 等价段
- **重定向限制**：最多跟随 3 次重定向，每次跳转重新做目标校验（防开放重定向绕过）
- **协议白名单**：仅 `http:` / `https:`
- **可配置允许域**：连接可配置 `allowedHosts` 白名单，配置后仅允许白名单内域名
- **响应大小上限**：默认 5MB，超限按 `DATASET_EXECUTION_FAILED`（80004）报错

## 3. SQL 安全

参考 Light Chaser 的安全实践并修正其不足：

- **强制 select 开头**：正则校验 `^\s*select\b`；CTE（`WITH ... SELECT`）一阶段不放行，后续按需开放并校验不含写入关键字
- **禁止多语句**：拒绝语句分隔符 `;` 出现在语句体中（参数值内的 `;` 由参数化绑定处理），杜绝 `select 1; drop table ...` 堆叠注入
- **参数化查询**：禁止字符串拼接 SQL，参数通过 `?` 占位符绑定
- **只读用户**：建议数据源连接使用只读数据库账号（文档建议，非强制）
- **结果行数上限由驱动层强制**：如 `pg` 的 `rowLimit` 或将用户 SQL 包装为 `SELECT * FROM (<user_sql>) LIMIT n`；默认 1000，可上调但不允许移除
- ~~SQL Base64 传输编码~~（已删除：Base64 不是安全机制，照搬 Light Chaser 无收益）

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
- `useMock` 参数独立覆盖 `mock.enabled`，调用时传 `useMock: true` 即使用 Mock 数据，无论 `mock.enabled` 是否为 true

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

- 密码字段前端用 AES+RSA 双重加密传输（参考 Light Chaser）：前端用 RSA 公钥加密随机 AES 密钥，后端用 RSA 私钥解密 AES 密钥再解密 payload
- 后端用项目级密钥加密存储，不回显明文
- 编辑连接时密码字段为空，留空表示不修改
- `lastTestResult` 仅记录成功/失败，不记录错误详情（防信息泄露）

### 7.2 filter 执行安全

- 表达式化（JSONata，见第 1 节）
- 服务端执行（数据集执行在后端，filter 也在后端求值，前端不直接执行用户表达式）
- 编辑态测试 filter 时，前端只发送表达式到后端 `/test` 端点求值

### 7.3 权限控制

**现状核查**：现有 nestjs-server 仅有 `JwtAuthGuard` + `ThrottlerGuard`，**不存在项目级 RBAC**；`ScreenProject` 模型无 owner/成员字段；现有预览接口 `/screen/:id/preview` 为 `@Public()` 匿名公开。本规格不假设项目级权限能力存在，分阶段处理：

**第一阶段（MVP）**：

| 操作 | 所需权限 |
|---|---|
| 数据集 CRUD / 测试执行 | 登录用户（JWT 鉴权，与现有 screen 模块一致） |
| 数据源连接管理 | 登录用户（JWT；连接凭证按 §7.1 全程加密，收紧为项目管理员待权限模型落地） |
| 预览页执行数据集（execute / batch） | 匿名可访问（跟随 preview 的 `@Public` 语义），受 §7.5 防护约束 |

**后续阶段**：项目级权限模型（`ScreenProject` ownership + 成员表 + 权限 Guard）是独立前置能力，落地后收紧为：连接管理 = 项目管理员、数据集 CRUD = 项目编辑、预览执行 = 项目查看。

### 7.4 敏感信息脱敏

现状：敏感请求头**键名识别**已在 `packages/shared/src/schemas/screen.schema.ts` 实现（`SENSITIVE_HEADER_KEYS` / `isSensitiveHeaderKey`，前后端共用）；脱敏函数 `request-api-mask.ts` 目前位于 `apps/web/src/features/screen/blueprint/lib/`，仅前端可用。

- 实施时**将脱敏函数下沉到 `packages/shared`**，后端数据集执行日志直接复用同一实现
- 数据集执行日志中，敏感 header（authorization / cookie / x-api-key 等）替换为 `***`

### 7.5 匿名执行防护（execute 端点）

预览页匿名可访问 `execute`，需防滥用：

- **仅已发布项目**：仅允许执行所属项目状态为 `published` 的数据集（与 `findPublishedProjectById` 语义一致），草稿 / 归档数据集拒绝执行
- **独立限流**：`execute` / `batch` 端点配置独立 Throttler 规则（如每 IP 每分钟 30 次），与全局规则分离
- **SSRF 防护**：§2.4 全部规则对匿名请求同样生效
- **资源配额**：单请求超时 10s、响应上限 5MB（§2.4），超限即失败
- **缓存共享注意**：匿名场景下缓存 key 不含调用方身份（`dataset:{id}:params:{hash}` 已天然按数据集隔离）；未来引入成员权限后需重审缓存键

## 8. 新增依赖清单

| 依赖 | 端 | 阶段 | 用途 |
|---|---|---|---|
| `jsonata` | 后端 | 一 | filter 表达式求值 |
| `@nestjs/schedule` | 后端 | 一 | 归档数据集 30 天定时清理（见 data-model §4.1） |
| `@faker-js/faker` | 后端 | 二 | Mock `faker-template` 生成器 |
| `monaco-editor` | 前端 | 阶段一可选用 textarea 降级，阶段二正式引入 Monaco | SQL / JSON / 表达式编辑器（见 ui-design §6） |
| `isolated-vm` | 后端 | 三（可选） | JS filter 真隔离执行，仅在启用 JS filter 时引入 |
