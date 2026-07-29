# Nebula 文档

> 本目录是项目所有设计文档、规范文档、决策记录的统一入口。
> **双依据定位**：既是产品文档的依据，也是开发实现的依据。文档结构遵循 [_structure.md](./_structure.md)。

## 快速入口

### 我是开发，想开始动手

1. 读 [系统总览](./architecture/system-overview.md) 理解全局（新人第一篇必读）
2. 读 [编码规范](./conventions/coding-standards.md) 了解编码约定（**编码前必读**）
3. 读 [大屏设计器架构](./architecture/screen-editor-architecture.md) 理解核心 feature
4. 读 [蓝图运行时架构](./architecture/blueprint-runtime-architecture.md) 理解事件蓝图
5. 动手新增功能时，参考 [开发指南](./architecture/development-guide.md) 按步骤操作
6. 遇到"为什么这样设计"的疑问，查 [决策记录](./decisions/README.md)

### 我是产品，想了解功能定义

1. 读 [产品文档](./product/README.md) 了解产品方向与功能矩阵（_待创建_）
2. 找到对应功能的 [功能规格](./specs/README.md)，查看功能概述与 UI 规格
3. 了解决策背景时，查 [分析文档](./analysis/README.md) 与 [决策记录](./decisions/README.md)

## 七层架构总览

| 层 | 目录 | 回答什么 | 主要受众 |
| --- | --- | --- | --- |
| 产品 | [product/](./product/README.md) | 做什么？为谁做？功能边界 | 产品/设计/利益相关方 |
| 架构 | [architecture/](./architecture/README.md) | 系统怎么设计？如何新增功能？ | **开发**/架构师 |
| 规格 | [specs/](./specs/README.md) | 某功能的具体规格？实现契约？ | **开发**/产品 |
| 规范 | [conventions/](./conventions/README.md) | 遵循什么约定？ | **开发** |
| 决策 | [decisions/](./decisions/README.md) | 为什么这么决策？ | 开发/架构师 |
| 分析 | [analysis/](./analysis/README.md) | 现状如何？有什么缺口？ | 开发/产品 |
| 计划 | [plans/](./plans/README.md) | 怎么落地？分几步？ | 执行者 |

> 完整的分层架构、归属规则、命名规范见 [_structure.md](./_structure.md)。

## 重点文档

### 架构文档

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [system-overview.md](./architecture/system-overview.md) | 生效中（2026-07-24） | 系统总览。新人入职第一篇必读 |
| [screen-editor-architecture.md](./architecture/screen-editor-architecture.md) | 生效中（2026-07-29） | 大屏设计器架构 |
| [blueprint-runtime-architecture.md](./architecture/blueprint-runtime-architecture.md) | 生效中（2026-07-29） | 蓝图运行时架构 |
| [development-guide.md](./architecture/development-guide.md) | 生效中（2026-07-24） | 开发指南（新增组件/模块/API/页面/工具/蓝图节点） |

### 规范文档

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [coding-standards.md](./conventions/coding-standards.md) | 生效中（2026-07-24） | 编码规范总集（编码前必读） |
| [frontend-backend-contract.md](./conventions/frontend-backend-contract.md) | 生效中（2026-07-25） | 前后端对接契约方案（轻量落地）。新功能开发前必读 |

### 功能规格

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| [screen-editor/](./specs/screen-editor/README.md) | 生效中（2026-07-29） | 大屏编辑器功能规格（现状基线） |
| [dataset-management/](./specs/dataset-management/README.md) | 实施中（2026-07-28） | 数据集管理设计规格（独立可复用数据集实体、三层分离、后端代理 + 缓存 + Mock + 沙箱 filter）。第一阶段 MVP 已完成 |
| [blueprint-redesign/](./specs/blueprint-redesign/spec.md) | 生效中（2026-07-26） | 事件蓝图 V2 重新设计（组件即节点、锚点即事件、V1→V2 自动迁移，已落地） |

> 完整功能规格清单见 [specs/README.md](./specs/README.md)。

## 文档与开发流程

```
[product] 产品定义功能 → [analysis] 分析缺口 → [specs] 产出实现契约
    → [decisions] 记录决策 → [plans] 分解任务 → 编码（遵循 conventions）
    → [specs] 更新检查清单 → 计划归档
```

详见 [_structure.md](./_structure.md) 第 7 节。

## 新增文档流程

1. 判断文档属于哪一层（参考 [_structure.md](./_structure.md) 第 3 节）
2. 在对应层目录下创建文件（遵循命名规范）
3. 文档顶部添加元信息（状态/最近更新/定位）
4. 更新该层 `README.md` 索引
5. 若是重要文档，更新本文件

## 关联目录

- `AGENTS.md` — AI agent 指导，含项目结构与常用命令
