# 数据集管理 · 概述与核心概念

> 状态：设计完成
> 最近更新：2026-07-24
> 定位：阐明数据集管理的设计目标、原则与核心概念，作为后续章节的总纲

## 1. 现状定位

Nebula 当前数据层能力（位于 `packages/shared/src/schemas/screen.schema.ts` 的 `DataSourceConfigSchema`）：

- 仅支持 `static` / `api` 两种数据源类型，**绑定在组件实例内部**
- API 数据源由浏览器**直接 fetch 外部 URL**，受 CORS 限制
- 无任何"数据集"实体：前后端均无 `dataset` 关键词、无 Prisma 模型、无 API 端点、无管理页面
- 组件配置在 `apps/web/src/features/screen/components/bar-chart-config-sections.tsx` 内联，**无法跨组件复用**

调研两个开源项目后的关键发现：

| 维度 | Light Chaser | GoView | Nebula 现状 |
|---|---|---|---|
| 数据集实体 | 无（组件内联） | Pond（全局共享，无独立持久化） | 无 |
| 连接复用 | 有（数据源连接池） | 无（URL 内联） | 无 |
| 字段映射 | 无（写 JS filter） | 无（写 JS filter） | 有（图形化，但仅组件级） |
| 后端代理 | 有（Java 执行 SQL） | 无（前端直连） | 无（前端直连，受 CORS 限制） |
| Mock | 无 | 有（`/mock/*` 端点） | 无 |
| filter 安全 | eval（不安全） | `javascript:` 前缀（不安全） | 无 filter |

## 2. 设计目标

| 目标 | 说明 |
|---|---|
| 跨组件复用 | 同一份数据集配置可被多个组件引用，避免重复填写 URL/SQL（解决 Light Chaser 的痛点） |
| 前后端分离代理 | 后端代理外部请求，解决 CORS、统一鉴权、可加缓存 |
| 图形化字段映射 | 降低非开发人员门槛（Light Chaser 需写 JS filter） |
| 执行安全 | filter 采用 JSONata 声明式表达式，杜绝 eval/XSS 与沙箱逃逸 |
| Mock 与调试 | 内置 Mock 机制，不依赖真实数据源即可调试 |
| 与现有架构兼容 | 复用现有 `dataSource` 判别联合、`chart-data-parser` 管线、蓝图运行时抽象 |

## 3. 设计原则

1. **数据集 = 独立可复用实体**：参考 GoView 的 Pond，但更彻底——独立持久化、独立管理、独立版本
2. **三层分离**：数据源连接（凭证） / 数据集（查询定义） / 组件绑定（引用 + 参数映射），参考 Light Chaser 的连接池思路并扩展
3. **判别联合扩展**：在现有 `DataSourceConfig` 的 `'static' | 'api'` 基础上新增 `'dataset'` 分支，保持向后兼容
4. **后端代理优先**：所有外部数据请求走后端，前端不直接 fetch 外部 URL
5. **复用现有管线**：`extractDataByPath` / `mapFieldsToChartData` / `applyLogicConfig` 管线不变，数据集只是新的数据来源

## 4. 三层实体模型

```
┌─────────────────────────────────────────────────────────┐
│  数据源连接 (DataSource Connection)                      │
│  ─ 数据库凭证 / 外部 API 基地址 + 鉴权                    │
│  ─ 类型: mysql | postgres | http-api                     │
│  ─ 不含查询逻辑,只含"怎么连"                              │
└─────────────────────────────────────────────────────────┘
                          │ 引用
                          ▼
┌─────────────────────────────────────────────────────────┐
│  数据集 (Dataset)                                        │
│  ─ 命名 + 描述 + 类型(static|api|sql|websocket)          │
│  ─ 查询定义: SQL 语句 / API 路径+方法+参数                │
│  ─ 数据形态契约: dataPath / 字段映射 / filter             │
│  ─ 缓存策略 / 刷新策略                                    │
│  ─ 可被多组件引用                                         │
└─────────────────────────────────────────────────────────┘
                          │ 引用 (datasetId + 参数绑定)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  组件数据源绑定 (Component DataSource Binding)            │
│  ─ dataSource.type === 'dataset'                         │
│  ─ datasetId: 指向数据集                                 │
│  ─ paramBindings: 把组件上下文变量绑到数据集参数           │
│  ─ overrideFieldMapping: 可覆盖数据集默认字段映射         │
│  ─ overrideLogic: 可覆盖数据集默认逻辑层                  │
└─────────────────────────────────────────────────────────┘
```

### 4.1 数据集类型分类

| 类型 | 说明 | 参考来源 |
|---|---|---|
| `static` | 静态 JSON 数据，直接存储在数据集实体内 | 现有 + Light Chaser |
| `api` | HTTP 接口请求（GET/POST/PUT/PATCH/DELETE），走后端代理 | 现有 API 类型提升 |
| `sql` | 数据库 SQL 查询，关联数据源连接 | Light Chaser |
| `websocket` | WebSocket 长连接（路线图第二阶段） | Light Chaser Pro |

> **不做** `dataset-ref`（数据集引用数据集），避免循环依赖与权限穿透问题。

### 4.2 与 Light Chaser / GoView 的差异定位

| 维度 | Light Chaser | GoView | **Nebula 方案** |
|---|---|---|---|
| 数据集实体 | 无（组件内联） | Pond（全局共享，但无独立持久化） | **独立持久化实体** |
| 连接复用 | 有（数据源连接池） | 无（URL 内联） | **有（数据源连接池）** |
| 字段映射 | 无（写 JS filter） | 无（写 JS filter） | **图形化 + filter 双层** |
| 后端代理 | 有（Java 后端执行 SQL） | 无（前端直连） | **有（统一代理 + 缓存）** |
| Mock | 无 | 有（`/mock/*` 端点） | **有（数据集内置 mock 配置）** |
| filter 安全 | eval（不安全） | `javascript:` 前缀（不安全） | **JSONata 表达式引擎（无 eval，图灵不完备）** |
| 实时推送 | Pro 版独有 | 无 | 路线图第二阶段 |

## 5. 与现有架构的兼容性

| 现有模块 | 兼容方式 |
|---|---|
| `DataSourceConfigSchema`（screen.schema.ts） | 新增 `'dataset'` 分支，沿用判别联合模式 |
| `chart-data-parser.ts`（解析管线） | 完全复用，数据集产出数据注入同一管线 |
| `use-api-data-source.ts`（API 请求 hook） | 新增 `use-dataset-source.ts` 平行 hook，复用其 AbortController + 竞态防护设计 |
| `bar-chart-config-sections.tsx`（属性面板） | RadioGroup 新增 dataset 选项 + 新增 DatasetConfigForm section |
| `property-schema/types.ts`（属性 Tab） | `PropertyTabId` 已有 `'data'` tab，直接挂载 |
| 蓝图运行时 `RuntimeDeps` | `refreshDataSource` / `getComponentData` 抽象不变，dataset 实现替换 deps |
| `request-api-mask.ts`（敏感信息脱敏） | 脱敏函数下沉 `packages/shared` 后复用到数据集日志（键名识别已在 shared） |
| `data-source-migration.ts`（数据迁移） | 不强制迁移，提供"提取为数据集"的主动操作 |

详细集成点清单见 [testing-roadmap.md](./testing-roadmap.md)。
