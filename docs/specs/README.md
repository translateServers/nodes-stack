# 功能规格文档

> 定位：功能级详细设计与实现契约。既是产品验收依据，也是**开发实现的核心依据**。

## 核心定位

specs 是本文档体系中**最重要的开发依据**。每个 spec 必须包含可直接落地的契约（Schema、API、类型、UI 结构），开发拿到 spec 应能独立完成实现，无需反复确认细节。

## 文档清单

| 功能 | 索引 | 状态 | 说明 |
| --- | --- | --- | --- |
| 大屏编辑器 | [screen-editor/](./screen-editor/README.md) | 生效中（2026-07-29） | 已实现功能的现状描述：画布/组件/工具/属性面板/图层/数据层/历史栈/快捷键/蓝图/预览/保存发布 |
| 数据集管理 | [dataset-management/](./dataset-management/README.md) | 实施中（2026-07-28） | 独立可复用数据集实体、三层分离、后端代理 + 缓存 + Mock + 沙箱 filter。第一阶段 MVP 已完成，验收进度见 checklist.md |
| 事件蓝图重新设计 | [blueprint-redesign/](./blueprint-redesign/spec.md) | 生效中（2026-07-26） | V2 蓝图：组件即节点、锚点即事件、三阶层节点模型、V1→V2 自动迁移（已落地） |
| 事件蓝图事件触发链路修复 | [blueprint-event-trigger-fix/](./blueprint-event-trigger-fix/spec.md) | 生效中（2026-07-29） | 修复 dataLoaded/dataError/interval 事件触发并明确编辑器画布总闸门（代码已合并，手动验证待确认） |
| 组件库重设计 | [component-library-redesign/](./component-library-redesign/spec.md) | 生效中（2026-07-26） | 统一注册接口 registerComponent、Map 索引、收藏机制、分类折叠（已全部完成） |
| 统一右侧属性面板分类 | [unified-property-panel-categories/](./unified-property-panel-categories/spec.md) | 生效中（2026-07-28） | 属性/数据/交互/事件四大类统一分类、组件滤镜、全局变量（P0/P1 已全部完成，仅剩 P2 质量门验证项，详见 checklist） |
| 数据集管理规格修订 | [dataset-management-revision/](./dataset-management-revision/spec.md) | 已归档（2026-07-25） | 一次性修订：dataset-management 规格与契约方案对齐，已全部落地，结果沉淀在原目录 |
| 数据源管理 | _待创建_ | — | 现有 static/api 数据源 + 字段映射 + 逻辑层规格 |
| 用户与权限 | _待创建_ | — | RBAC 权限体系规格 |

## 每个 spec 必须包含的交付物

一个完整的 spec 子目录应包含以下文档（可合并，但内容必须覆盖）：

| 交付物 | 说明 | 开发用途 |
|---|---|---|
| **功能概述** | 目标、边界、用户故事 | 理解"做什么" |
| **数据模型 / Schema** | Zod schema、Prisma model、TypeScript 类型定义 | 直接复制实现 |
| **API 契约** | 端点、请求/响应结构、错误码、鉴权要求 | 后端实现接口、前端封装 client |
| **UI/UX 规格** | 页面布局、交互流程、组件结构、状态管理 | 前端实现页面 |
| **数据流设计** | 数据如何流动、与现有模块如何集成 | 理解集成点 |
| **测试策略** | 单元/集成/E2E 覆盖点、测试用例清单 | 编写测试 |
| **实现检查清单** | checklist 形式的验收项 | 开发自验、产品验收 |

> 注：`screen-editor/README.md` 是现状描述（已实现功能的基线），不严格遵循上述交付物结构，但覆盖了功能边界与实现要点。新增功能 spec 应严格遵循。

## 子目录结构约定

```
specs/<feature-name>/
├── README.md              功能索引（含文档清单与状态）
├── overview.md            功能概述与目标
├── data-model.md          Schema / Prisma / 类型定义
├── api-contract.md        API 契约（端点/请求/响应/错误码）
├── ui-design.md           UI/UX 规格
├── data-flow.md           数据流与集成点
├── testing.md             测试策略
└── checklist.md           实现检查清单
```

> 小功能可合并为单个文档；大功能按上拆分。无论合并还是拆分，内容必须覆盖上述交付物。
>
> 三件套变体：采用 Spec 工作流（`spec.md` / `tasks.md` / `checklist.md`）的功能目录以 `spec.md` 为入口，由本 README 统一索引，可不单独建目录内 README.md（如 blueprint-redesign、component-library-redesign、unified-property-panel-categories、blueprint-event-trigger-fix、dataset-management-revision）。

## 归属规则

- 文档是"某个功能的完整设计包，开发可直接对照实现" → 放本目录
- 文档是"系统整体架构" → 放 `architecture/`
- 文档是"编码约定" → 放 `conventions/`

## 与开发流程的关系

```
开发开始前：spec 必须处于"生效中"或"设计中"（含明确契约）
    ↓
开发实现：对照 spec 的 Schema/API/UI/测试 交付物编码
    ↓
开发完成后：更新 spec 的实现检查清单（checklist 勾选）
```

详见 [_structure.md](../_structure.md) 第 7 节"文档与开发流程的关系"。

## 受众

- **开发**：实现依据（核心受众）
- **产品**：验收依据
