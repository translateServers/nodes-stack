# 提示词：路线 C，Host 数据与协调器

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行路线 C。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`，然后读取
`docs/specs/screen-component-vue-bridge/handoffs/p-gate.md`。只有其状态为 `已完成` 才能实施。

## 任务与所有权

- 执行 `tasks.md` 的 C1-C4。
- 独占修改范围：
  - `packages/screen-editor-core/src/contracts/adapter.ts`
  - `packages/screen-editor-core/src/dynamic/**`
  - 上述模块的定向测试
- core contracts barrel、`sdk-contracts.ts` 由 BUS 更新。
- 不得修改 document parser、renderer、canvas、workbench、SDK、consumer、root manifest 或 lockfile。
- 交接文件：`docs/specs/screen-component-vue-bridge/handoffs/route-c.md`。

## 实现要求

1. 先按 P handoff 核对 `ScreenHostAdapter.data`、resource intent、context 和 error 的精确签名。
2. resource list、open/sync/close、execute 全部使用通用 `resourceType/resourceId/params/binding`，不得保留
   `host/xj-metric` wire 类型或宿主 URL/Token/SQL 结构。
3. 纯 static 文档不要求 data adapter；host-resource 文档缺失 data capability 时 fail closed。
4. Adapter 输入输出经过统一 JSON、响应大小和脱敏边界，`unknown` 不得直接进入组件 model。
5. 协调器保留 dedupe、AbortSignal、timeout 和 late result 防护，并区分普通重复请求与显式 refresh。
6. 使用 context generation 处理 close/reopen；旧请求的 finally 不得删除新请求记录。
7. openContext await 后复检 generation/disposed，并关闭卸载期间迟到打开的上下文。
8. static 映射 success；host-resource 映射 loading/success/error/aborted/timeout 的冻结状态。
9. 数据状态不写回 document/history，并阻止 `dataLoaded -> refreshData -> dataLoaded` 无界反馈。

## 测试与验证

- 覆盖 dedupe、refresh、abort、timeout、adapter error、late result、close/reopen、卸载和 static source。
- 新增/完善 data runtime 与 Adapter JSON/size/error 边界测试。
- 运行：
  - `pnpm --filter @nebula/screen-editor-core test -- src/dynamic/data-coordinator.test.ts`
  - 新增 data runtime/adapter 测试的定向命令
  - `pnpm --filter @nebula/screen-editor-core typecheck`
  - `pnpm --filter @nebula/screen-editor-core lint`
- 若 A/B 正在改冻结类型导致全包 typecheck 暂时失败，记录精确错误，先保证本路线测试不通过放宽类型绕过。

## 退出要求

使用 `apply_patch` 更新 `route-c.md`，明确 Adapter 签名、context/refresh 语义、错误 reason、验证结果和需要
BUS 更新的 public barrel。不得修改 tasks/checklist。
