# 数据集管理 · 测试策略与路线图

> 状态：设计完成
> 最近更新：2026-07-24
> 定位：定义测试覆盖点、实施路线图、风险对策与现有系统集成点清单

## 1. 测试策略

### 1.1 单元测试覆盖点

| 模块 | 测试要点 |
|---|---|
| `dataset.schema.ts` | Zod 校验：类型分支、字段必填、SQL select 校验、URL 合法性 |
| `DatasetExecutor` 各实现 | 静态返回 / API 代理 / SQL 执行 / 错误分类 |
| `DatasetCacheService` | 命中/失效/TTL/标签失效 |
| `DatasetFilterService` | 沙箱执行/超时/异常降级/模板库 |
| `DatasetMockService` | static / faker / echo 三种生成器 |
| `useDatasetSource` hook | 参数解析/请求/缓存/竞态/错误态 |
| `chart-data-parser` 复用 | 现有测试不变，新增 dataset 数据源测试用例 |
| 蓝图运行时 | `refreshDataSource` 对 dataset 类型的处理 |

### 1.2 集成测试

- 后端 `/api/dataset/:id/execute` 全链路（含缓存、filter、字段映射）
- 编辑器内组件绑定数据集 → 渲染 → 蓝图触发刷新
- 预览页批量执行
- 数据集更新后引用组件自动失效缓存

### 1.3 E2E（Playwright）

参考现有 M2/M3 E2E 规划：
- 数据集管理页 CRUD
- 组件绑定数据集 → 预览页验证数据加载
- 参数绑定联动（下拉选择器 → 目标组件数据集参数）
- Mock 模式切换

## 2. 实施路线图

### 2.1 第一阶段（MVP）：核心数据集管理

**目标**：实现独立数据集实体的管理与组件绑定，支撑 static + api 类型。

| 工作项 | 模块 |
|---|---|
| 共享 Schema（dataset + connection） | packages/shared |
| Prisma 模型 + 迁移 | nestjs-server |
| Dataset Module（CRUD + execute + test） | nestjs-server |
| StaticExecutor + ApiExecutor | nestjs-server |
| DatasetCacheService（内存 LRU） | nestjs-server |
| DatasetFilterService（沙箱） | nestjs-server |
| 业务码扩展 | packages/shared |
| 前端 features/dataset 模块 | apps/web |
| 管理页（列表 + 编辑） | apps/web |
| 编辑器内 dataset-config-section | apps/web |
| useDatasetSource hook | apps/web |
| DataSourceConfig 扩展 'dataset' 分支 | packages/shared |
| 图形化字段映射编辑器 | apps/web |
| 测试面板（原始 + 解析后） | apps/web |

### 2.2 第二阶段：增强能力

| 工作项 | 说明 |
|---|---|
| DataSourceConnection Module | 数据源连接池（mysql/postgres/http-api） |
| SqlExecutor | 数据库 SQL 查询 |
| Mock 配置 | static + faker + echo |
| 蓝图 refreshDataset 动作 | 主动刷新数据集缓存 |
| 提取为数据集 | 组件现有 api/static 配置提取为数据集 |
| Redis 缓存 | 多实例部署支持 |

### 2.3 第三阶段：实时与高级

| 工作项 | 说明 |
|---|---|
| WebSocket 数据源 | 实时推送 |
| 预览页批量执行 | 一次请求加载多数据集 |
| 后端推送更新 | WS 推送数据集变更到引用组件 |
| 数据集版本管理 | 配置变更历史 |
| 数据集权限 | 项目级 / 全局级共享 |
| filter 模板库 | 常见转换模板 |
| 数据 schema 推断 | 从响应自动推断字段类型 |

## 3. 关键风险与对策

| 风险 | 对策 |
|---|---|
| 后端代理引入性能瓶颈 | 缓存 + 超时 + 连接池复用 + 监控 |
| filter 沙箱逃逸 | `new Function` + 受限 context + 超时 + 服务端执行 |
| SQL 注入 | 参数化查询 + 强制 select + 只读账号 |
| 凭证泄露 | AES+RSA 传输 + 加密存储 + 不回显 |
| 数据集被引用后删除 | 删除前校验引用数，软删除（status=archived）保留 30 天 |
| 缓存一致性 | 数据集更新主动失效 + TTL 兜底 + 标签批量失效 |
| 现有项目兼容 | 不强制迁移，用户主动提取为数据集 |
| 大屏性能（多数据集并发） | 预览页批量执行 + 限流 + 优先级调度 |

## 4. 与现有系统的集成点清单

| 现有模块 | 集成方式 |
|---|---|
| `packages/shared/src/schemas/screen.schema.ts` `DataSourceConfigSchema` | 新增 'dataset' 分支 |
| `apps/web/src/features/screen/lib/chart-data-parser.ts` | 完全复用，数据集产出数据注入同一管线 |
| `apps/web/src/features/screen/hooks/use-api-data-source.ts` | 新增 `use-dataset-source.ts` 平行 hook，复用其 AbortController + 竞态防护设计 |
| `apps/web/src/features/screen/components/bar-chart-config-sections.tsx` | RadioGroup 新增 dataset 选项 + 新增 DatasetConfigForm section |
| `apps/web/src/features/screen/property-schema/types.ts` | `PropertyTabId` 已有 'data' tab，直接挂载 |
| `apps/web/src/features/screen/blueprint/runtime/executor.ts` | `refreshDataSource` / `getComponentData` 抽象不变，dataset 实现替换 deps |
| `apps/web/src/features/screen/blueprint/lib/request-api-mask.ts` | 复用敏感 header 脱敏逻辑到数据集日志 |
| `packages/shared/src/types/api.types.ts` `BizCode` | 新增 80xxx 段 |
| `apps/web/src/api/core/endpoints.ts` | 新增 dataset + connection 端点 |
| `apps/web/src/config/navigation.ts` | 新增菜单项 |
| `apps/nestjs-server/src/modules/screen/screen.controller.ts` | 不改动，数据集独立模块 |

## 5. 质量门禁

实施阶段需通过以下质量门禁（与项目现有约定一致）：

| 门禁 | 命令 | 说明 |
|---|---|---|
| TypeScript 类型检查 | `pnpm typecheck` | 全量类型检查 |
| ESLint | `pnpm lint` | 类型感知规则（no-floating-promises 等） |
| Biome 格式化 | `pnpm biome:check` | 格式与基础 lint |
| 前端单元测试 | `pnpm test` | Vitest |
| 数据集专项测试 | 数据集模块内 | schema / executor / cache / filter / mock |
| 蓝图运行时测试 | 蓝图模块内 | dataset 数据源对蓝图触发器的影响 |

## 6. 文档维护约定

遵循 `docs/README.md` 的维护约定：
- 每个文档顶部需带 `状态` 与 `最近更新` 字段
- 阶段完成后更新状态（如"设计完成" → "实施中" → "已完成"）
- 实施过程中如设计变更，回写本规格文档保持一致性
