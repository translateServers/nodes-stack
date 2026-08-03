# 提示词：路线 B，唯一文档与持久化

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行路线 B。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`，然后读取
`docs/specs/screen-component-vue-bridge/handoffs/p-gate.md`。只有其状态为 `已完成` 才能实施。

## 任务与所有权

- 执行 `tasks.md` 的 B1-B4。
- 以 P handoff 的精确 owner 表为准，逻辑范围包括：
  - canonical shared screen wire schema、相关 schema 测试和 shared 自有 exports。
  - core document/parser/JSON Schema/diagnostic 实现；跨路线 barrel 交给 BUS。
  - NestJS screen module、DTO、Screen Prisma schema，以及 P 决策要求的 dataset reference 代码。
- 不得修改 `adapter.ts`、core renderer/workbench、screen SDK、Vue 包、消费者或 lockfile。
- 不得修改实际 `.db` 文件；开发/E2E 数据重置由 BUS 执行。
- 交接文件：`docs/specs/screen-component-vue-bridge/handoffs/route-b.md`。

## 实现要求

1. 先确认 P 冻结的唯一 wire schema 归属，不保留 shared/core 两套正式类型。
2. canonical document 使用 strict object、固定 marker、`{ locked, hidden }`、static 全局变量，以及
   `static | host-resource` 数据源。
3. host-resource 的 `resourceType/resourceId/params/binding` 必须符合 JSON 和白名单边界，不允许 URL、Token、
   headers、SQL 或 script 泄漏到文档。
4. parser 先做 wire 校验，再做 registry 语义校验；覆盖 type、props、source capability、events、actions、
   blueprint 引用和 `refreshData` 目标。
5. 旧契约专属 marker、字段和数据源必须明确拒绝，不 strip、normalize 或 migrate。对于 shape 完全相同的
   历史输入，遵循 P handoff 的 marker 语义，不宣称能识别来源。
6. Screen API DTO、Service 和 Prisma 只读写 canonical document。停止 active legacy 读取/迁移路径并登记
   BUS-4 删除候选。
7. 明确 PATCH 缺省与清空语义。按 P 决策处理 dataset reference，不恢复直接 dataset 数据源。
8. 不创建数据迁移脚本、兼容 parser 或离线转换工具。

## 测试与验证

- 为 strict wire、registry 语义、host-resource、悬空引用、旧输入拒绝矩阵和 PATCH 清空补测试。
- 覆盖 Nest Screen 保存、读取、发布、错误处理和 dataset reference 决策分支。
- 运行适用命令：
  - `pnpm --filter @nebula/shared test`
  - `pnpm --filter @nebula/shared typecheck`
  - `pnpm --filter @nebula/screen-editor-core test -- src/contracts`
  - `pnpm --filter @nebula/screen-editor-core typecheck`
  - `pnpm --filter @nebula/nestjs-server exec jest --runInBand src/modules/screen/screen.service.spec.ts`
  - P 决策涉及 dataset reference 时，用同一 positional path 方式运行对应 service spec。
  - `pnpm --filter @nebula/nestjs-server typecheck`
  - `pnpm --filter @nebula/nestjs-server exec prisma validate`
- 不运行会修改全仓文件的 Nest lint `--fix`；留给 BUS。

## 退出要求

使用 `apply_patch` 更新 `route-b.md`。记录 canonical schema 的唯一 import 路径、parser API、后端存储语义、
实际数据库重置要求、验证结果和 BUS-4 删除候选。不得修改 tasks/checklist。
