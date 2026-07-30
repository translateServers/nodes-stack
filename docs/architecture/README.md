# 架构文档

> 定位：面向技术设计与开发实施。回答"系统怎么设计、模块如何划分、数据如何流动、如何新增功能"

## 两类内容

本层文档分为两类，都是**开发实现的依据**：

### 架构设计（描述系统结构）

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [system-overview.md](./system-overview.md) | 生效中（2026-07-24） | 系统总览。新人入职第一篇必读。monorepo 结构、技术栈、通信约定、数据库模型、路由、常用命令 |
| [screen-editor-architecture.md](./screen-editor-architecture.md) | 生效中（2026-07-29） | 大屏设计器架构。核心 feature 的目录组织、状态管理、组件注册表、画布系统、工具系统、属性面板、数据层 |
| [blueprint-runtime-architecture.md](./blueprint-runtime-architecture.md) | 生效中（2026-07-29） | 蓝图运行时架构。节点类型、纯函数编译器、薄执行器 + 依赖注入、宿主总闸门、预览集成、沙盒调试 |
| _待创建_ | — | 部署架构（前端/后端/数据库/缓存拓扑） |

### 开发指南（描述如何动手，step-by-step）

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [development-guide.md](./development-guide.md) | 生效中（2026-07-24） | 开发指南。环境配置、新增大屏组件、新增后端模块、新增 API 端点、新增页面与导航、新增工具、新增蓝图节点、共享包变更、常见问题 |

## 归属规则

- 文档描述"系统的整体设计结构与原理" → 放本目录
- 文档是"某个功能的详细规格" → 放 `specs/`
- 文档是"step-by-step 的开发操作手册" → 放本目录（开发指南子类）

## 与其他层的关系

| 对比层 | 区别 |
|---|---|
| `specs/` | architecture 是"整体怎么设计"，specs 是"这个功能具体怎么实现" |
| `conventions/` | architecture 是"系统长什么样"，conventions 是"写代码遵守什么约定" |
| `decisions/` | architecture 描述"当前设计"，decisions 记录"为什么这么设计" |

## 对开发的价值

- **新人入职必读**：从 [system-overview.md](./system-overview.md) 开始理解全局
- **新增功能时**：参考 [development-guide.md](./development-guide.md) 按步骤操作
- **理解设计原理**：阅读"架构设计"类文档，避免破坏既有设计

## 受众

开发、架构师。
