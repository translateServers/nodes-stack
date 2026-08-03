# 无上下文并行执行提示词

> 状态：生效中
> 最近更新：2026-08-03
> 定位：为没有历史对话上下文、但可访问同一仓库的独立会话提供启动提示词

## 使用方法

1. 将目标提示词文件的全文作为新会话第一条消息发送。
2. 新会话必须能访问仓库 `C:\Archangel\nebula\nodes-stack`。
3. 每个会话会先读取 [共享执行协议](./00-shared-protocol.md)、Spec、tasks、checklist 和上游 handoff。
4. 路线会话不得修改 `tasks.md` 或 `checklist.md`，只写自己的独立 handoff 文件。
5. 总线会话在所有路线完成且没有路线仍在写文件后启动。

启动前先检查 `../handoffs/p-gate.md`：缺失或状态不是 `已完成` 时只能运行
[P 闸门提示词](./01-gate-p.md)；已完成时按下表启动。

## 推荐启动波次

| 波次 | 可启动会话 | 前置条件 | 是否可并行 |
| --- | --- | --- | --- |
| 0 | [P 闸门](./01-gate-p.md) | 无 | 否 |
| 1 | [A](./10-route-a-component-abi.md)、[B](./20-route-b-document-persistence.md)、[C](./30-route-c-host-data.md) | P handoff 已完成 | A/B/C 并行 |
| 2 | [F](./60-route-f-vue-bridge.md) | A handoff 已完成 | 可与 D 并行 |
| 2 | [D](./40-route-d-core-runtime.md) | A/B/C handoff 已完成 | 可与 F 并行 |
| 3 | [E](./50-route-e-screen-sdk.md) | A/B/C/D/F handoff 已完成 | 单路线 |
| 4 | [G1](./71-route-g1-sdk-host.md)、[G2](./72-route-g2-vue-consumer.md)、[G3](./73-route-g3-web.md) | E 完成；G2 还需 F；G3 还需 B/D | 源码迁移并行，E2E 不并行 |
| 5 | [总线](./90-bus-integration.md) | P、A-F、G1-G3 全部完成 | 否 |

路线 E/F 的 package 外壳理论上可以提前准备，但无上下文会话不推荐做部分路线，以免留下无法独立验收的
半成品。上述波次以“一次会话完整交付一条路线”为原则。

## 提示词清单

- [共享执行协议](./00-shared-protocol.md)
- [P：评估、决策与冻结](./01-gate-p.md)
- [A：统一组件 ABI](./10-route-a-component-abi.md)
- [B：唯一文档与持久化](./20-route-b-document-persistence.md)
- [C：Host 数据与协调器](./30-route-c-host-data.md)
- [D：统一 Core Runtime](./40-route-d-core-runtime.md)
- [E：合并为单一 Screen SDK](./50-route-e-screen-sdk.md)
- [F：Vue Bridge 与真实组件](./60-route-f-vue-bridge.md)
- [G1：SDK Host 与示例生态](./71-route-g1-sdk-host.md)
- [G2：Vue Consumer](./72-route-g2-vue-consumer.md)
- [G3：Web Consumer](./73-route-g3-web.md)
- [BUS：最终总线汇聚](./90-bus-integration.md)

## 交接文件

交接文件统一放在 [handoffs/](../handoffs/README.md)。状态只有以下三种：

- `阻塞`：前置条件或决策不满足，未实施。
- `部分完成`：已有实现，但路线退出条件未全部满足。
- `已完成`：路线范围、定向验证和交接信息完整，可以进入下游。

只有 `已完成` handoff 能满足下游启动条件。聊天中的“完成”描述不能替代仓库内 handoff。
