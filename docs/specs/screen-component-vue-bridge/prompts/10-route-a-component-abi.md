# 提示词：路线 A，统一组件 ABI

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行路线 A。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`，然后读取
`docs/specs/screen-component-vue-bridge/handoffs/p-gate.md`。只有其状态为 `已完成` 才能实施；否则停止并
报告，不自行冻结接口。

## 任务与所有权

- 执行 `tasks.md` 的 A1-A4。
- 独占修改范围：`packages/screen-component-sdk/**`。
- 可以修改该包自己的 `package.json`，不得修改根 manifest、lockfile、core/shared/SDK/consumer 或 active 文档。
- `packages/screen-dynamic-sdk/**` 只读。
- 交接文件：`docs/specs/screen-component-vue-bridge/handoffs/route-a.md`。

## 实现要求

1. 先盘点 root、`./dynamic`、`./testing` exports、manifest/model/event/JSON validator 和现有测试。
2. 严格按 P handoff 冻结的签名建立唯一正式 Manifest 和 Element Model。
3. 正式 root API 不再接受或重导出 V2 marker/dynamic contract；旧文件只登记为 BUS-4 删除候选，不在本
   路线物理删除需要用于源码对照的旧 package。
4. `dataCapability`、`acceptedSources`、`hostResourceTypes` 条件校验必须 fail closed，并返回稳定 path。
5. model 必须包含冻结的 mode、interactive、dataCapability 和 dataState；成功数据只允许 JSON value。
6. 建立统一 detached plain JSON 边界，处理循环引用、非法原型、共享引用和 Vue reactive Proxy。
7. payload 大小使用 UTF-8 byte；clone/mapper 失败不得泄漏 payload/props。
8. 标准组件事件 detail 只使用 `{ name, payload? }`，修正该包中的 `eventId` 或双事件结构。
9. 不为未迁移消费者添加兼容重载、双 marker 或 deprecated alias。

## 测试与验证

- 为 manifest 自定义条件、JSON transform/clone、UTF-8 大小、Vue Proxy 和事件错误边界补测试。
- 运行：
  - `pnpm --filter @nebula/screen-component-sdk test`
  - `pnpm --filter @nebula/screen-component-sdk typecheck`
  - `pnpm --filter @nebula/screen-component-sdk lint`
  - `pnpm --filter @nebula/screen-component-sdk build`
  - `pnpm --filter @nebula/screen-component-sdk verify:tarball`
- 若并发路线正在执行依赖该包 build 的命令，避免同时写 `dist`，在 handoff 中将 build/tarball 标为 BUS 延后。

## 退出要求

使用 `apply_patch` 更新 `route-a.md`。只有 A1-A4 的实现、可安全运行的验证和下游签名摘要完整时写
`状态：已完成`。列出所有 BUS-4 删除候选和需 BUS 更新的跨包 barrel/lockfile，不修改 tasks/checklist。
