# 架构决策记录（ADR）

> 定位：记录重要技术决策的推理过程，回答"为什么这么决策"

## 什么是 ADR

ADR（Architecture Decision Record）是记录架构决策的简短文档。每个 ADR 描述：
- 背景：为什么要做这个决策
- 方案：考虑过哪些方案
- 取舍：各方案的优缺点
- 结论：最终选择与理由

## ADR 列表

| 编号 | 标题 | 状态 | 日期 |
| --- | --- | --- | --- |
| [ADR-0001](./ADR-0001-screen-sdk-static-runtime-boundary.md) | 大屏 SDK 静态 Runtime 边界与组合方式 | 已接受 | 2026-07-31 |
| [ADR-0002](./ADR-0002-screen-component-extension-protocol.md) | 大屏组件扩展采用 Manifest + Web Component + 实例注册表 | 已接受 | 2026-08-01 |

## 命名规范

`ADR-NNNN-简短标题.md`（如 `ADR-0001-dataset-backend-proxy.md`）

- `NNNN`：四位序号，从 0001 开始，不复用
- 标题：kebab-case，简短描述决策主题

## 模板

新增 ADR 请复制 [_template.md](./_template.md)。

## 何时写 ADR

- 引入新技术栈或框架
- 架构方向变更（如单体 → 微服务）
- 关键取舍决策（如性能 vs 可维护性）
- 跨团队影响的技术规范

不需要写 ADR 的场景：
- 常规 bug 修复
- 局部重构
- 显而易见的实现选择
