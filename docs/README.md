# 大屏设计器文档索引

> 本目录存放项目级设计文档与规范文档。仅保留设计类与规范类文档，计划型文档已移除。
> 维护约定：每个文档顶部需带 `状态` 与 `最近更新` 字段；阶段完成后更新状态。

## 设计文档

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [screen-designer-panels-architecture.md](./screen-designer-panels-architecture.md) | 进行中（2026-07-21 更新） | 面板系统架构与方法论。注册表驱动 / Schema 驱动渲染 / 命令描述符 / 单向数据流四条方法论 |
| [blueprint-canvas-integration-gaps.md](./blueprint-canvas-integration-gaps.md) | 进行中 | 蓝图与画布集成缺口分析 |
| [canvas-drag-optimization-plan.md](./canvas-drag-optimization-plan.md) | 待执行（2026-07-22 创建） | 画布拖拽性能优化方案（transform 定位 + Moveable 内置 snappable） |

## 规范文档

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [screen-designer-blackbox-test-cases.md](./screen-designer-blackbox-test-cases.md) | 进行中 | 大屏设计器黑盒测试用例 |

## 关联目录

- `.trae/archive/` - 已归档过程文档（浏览器默认行为冲突解决方案 / 画布交互审计报告）
- `.trae/rules/project_rules.md` - 项目级开发规则
- `.trae/skills/` - IDE skill 离线副本（cloudbase / playwright-cli / shadcn-ui / ui-ux-pro-max），由 skill 系统自动管理，请勿手动修改
