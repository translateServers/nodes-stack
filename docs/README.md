# 大屏设计器文档索引

> 本目录存放项目级设计文档与执行计划。规格驱动的实施任务（spec/tasks/checklist 三件套）位于 `.trae/specs/`。
> 维护约定：每个文档顶部需带 `状态` 与 `最近更新` 字段；阶段完成后更新 checkbox 与状态。

## 长线规划

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [screen-designer-roadmap.md](./screen-designer-roadmap.md) | Phase 2 进行中（2026-07-21 更新） | 7 阶段长线任务追踪。Phase 1 已完成，Phase 2 基座夯实进行中，Phase 3-7 待开始 |
| [screen-designer-panels-architecture.md](./screen-designer-panels-architecture.md) | 进行中（2026-07-21 更新） | Phase 2 设计依据。注册表驱动 / Schema 驱动渲染 / 命令描述符 / 单向数据流四条方法论 |

## 执行计划

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [blueprint-interaction-consistency-plan.md](./blueprint-interaction-consistency-plan.md) | 待执行（2026-07-23 创建） | 事件蓝图与画布交互一致性缺口修复。3 个缺口：浏览器默认行为泄漏（P0）/ 快捷键 registry（P2）/ 框选手势不一致（P1） |
| [canvas-drag-optimization-plan.md](./canvas-drag-optimization-plan.md) | 待执行（2026-07-22 创建） | 画布拖拽性能优化。A+C 合并方案：transform 定位 + Moveable 内置 snappable 替代自定义 Smart Guides |

## 文档间引用关系

- `screen-designer-roadmap.md` 引用 `screen-designer-panels-architecture.md` 作为 Phase 2 设计依据
- `screen-designer-roadmap.md` 引用 `.trae/specs/event-blueprint/` 作为独立并行 spec
- `blueprint-interaction-consistency-plan.md` 修复对象为 `apps/web/src/features/screen/blueprint/` 与画布快捷键层
- `canvas-drag-optimization-plan.md` 改动范围为 `screen-canvas.tsx` 与 `component-container-style.ts`

## 关联目录

- `.trae/specs/event-blueprint/` — 唯一活跃 spec（M1 部分，M2/M3 待启动）
- `.trae/specs/archive/` — 5 个已完成归档 spec（stabilize-screen-baseline / close-single-user-interactions / layer-component-config / research-interaction-architecture / evolve-screen-design-platform）
- `.trae/archive/` — 4 个已归档过程文档（浏览器默认行为冲突方案及收尾 / 前端 API 集成方案 / 画布交互审计报告）
- `.trae/rules/project_rules.md` — 项目级开发规则
- `.trae/skills/` — IDE skill 离线副本（cloudbase / playwright-cli / shadcn-ui / ui-ux-pro-max），由 skill 系统自动管理，请勿手动修改
