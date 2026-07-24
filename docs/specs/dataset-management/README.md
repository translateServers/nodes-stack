# 数据集管理功能规格

> 状态：设计中
> 最近更新：2026-07-24
> 定位：为大屏设计器引入独立可复用的数据集实体，替代当前组件内联的 `static` / `api` 数据源配置。本目录是设计规格，不含实现代码。

## 设计目标速览

- 跨组件复用：同一数据集可被多组件引用，避免重复填写 URL/SQL
- 前后端分离代理：后端代理外部请求，解决 CORS、统一鉴权、可加缓存
- 图形化字段映射：降低非开发人员使用门槛
- 安全沙箱：filter 函数沙箱化执行，避免 eval 的 XSS 风险
- Mock 与调试：内置 Mock 机制，不依赖真实数据源即可调试
- 与现有架构兼容：复用现有 `dataSource` 判别联合、`chart-data-parser` 管线、蓝图运行时抽象

## 文档清单

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [overview.md](./overview.md) | 设计完成 | 设计目标、原则、核心概念、与 Light Chaser / GoView 的差异定位 |
| [data-model.md](./data-model.md) | 设计完成 | 共享 Schema、数据源连接 Schema、DataSourceConfig 扩展、Prisma 模型、业务码 |
| [architecture.md](./architecture.md) | 设计完成 | 后端模块、API 端点、前端 Feature 模块、路由与导航、数据流设计 |
| [ui-design.md](./ui-design.md) | 设计完成 | 管理页（列表/编辑）、图形化字段映射、编辑器内集成、连接管理页 |
| [security-decisions.md](./security-decisions.md) | 设计完成 | 关键技术决策（沙箱/代理/SQL/缓存/Mock/迁移）、安全与权限 |
| [testing-roadmap.md](./testing-roadmap.md) | 设计完成 | 测试策略、实施路线图、风险与对策、与现有系统集成点清单 |

## 调研依据

- Light Chaser（`xiaopujun/light-chaser`）：数据源连接池 + 组件内联数据配置，无独立数据集实体，filter 用 eval 执行
- GoView（`dromara/go-view`）：数据池（Pond）实现跨组件共享，但无独立持久化，filter 用 `javascript:` 前缀执行
- Nebula 现状：`DataSourceConfigSchema` 仅 `static` / `api` 两类型，绑定在组件实例内部，API 由浏览器直接 fetch

## 关联文档

- `packages/shared/src/schemas/screen.schema.ts`：现有 `DataSourceConfigSchema`，本规格在其上扩展 `'dataset'` 分支
