# Tasks

> 修订对象：`docs/specs/dataset-management/` 下 7 个文档
> 约束：只改文档，不动代码；文件位置保持不变

## Task 1: 修订 architecture.md（核心）

- [x] Task 1: 修订 architecture.md，对齐契约方案
  - [x] SubTask 1.1: 更新顶部「最近更新」日期为 2026-07-25
  - [x] SubTask 1.2: §2 端点表重做，新增「参数位置」「必填性」「缺失行为」「阶段」四列，确保 14 个端点全部覆盖（含 batch 与 6 个 connection 端点）
  - [x] SubTask 1.3: §2 端点表下方补一段「契约单一数据源」说明，引用 `packages/shared/src/contracts/dataset.contract.ts`
  - [x] SubTask 1.4: §2.1 鉴权策略末尾补一句指向 `docs/conventions/frontend-backend-contract.md`
  - [x] SubTask 1.5: §5.5 删除「Connection Module 属第二阶段」与「第一阶段 api 数据集的 connectionId 不启用」两处过时表述
  - [x] SubTask 1.6: 末尾新增 §6「前后端契约对齐」章节，内容包括：(a) 引用 contract 注册表 (b) 引用 frontend-backend-contract.md (c) 列出 phase=1 端点清单（参考 `PHASE_1_ENDPOINTS` 常量）

## Task 2: 修订 data-model.md（核心）

- [x] Task 2: 修订 data-model.md，对齐契约 schema
  - [x] SubTask 2.1: 更新顶部「最近更新」日期为 2026-07-25
  - [x] SubTask 2.2: §1 数据集 Schema 末尾补一段「契约 schema 引用」，指向 `packages/shared/src/schemas/dataset.schema.ts` 中的 `CreateDatasetRequestSchema` / `ListDatasetQuerySchema` / `DatasetResponseSchema`
  - [x] SubTask 2.3: §4.1 作用域决策中明确 projectId 三处规则：创建请求可选（未传回退默认项目）、列表查询可选（未传返回全部）、响应可选（前端 Zod strip 忽略）
  - [x] SubTask 2.4: §5 业务码扩展中"需同步扩展三处"的描述明确点名 `BizMessage` 映射必须扩展，否则 `getBizMessage(80001)` 回退到"未知错误"
  - [x] SubTask 2.5: §6 字段映射复用更新为引用 `packages/shared/src/schemas/field-mapping.schema.ts`（已抽离独立文件，打破循环依赖）

## Task 3: 修订 README.md / overview.md（次要）

- [x] Task 3: 修订 README.md 与 overview.md，建立契约方案引用
  - [x] SubTask 3.1: README.md 顶部「状态」从"设计中"改为"实施中（第一阶段 MVP 已完成，文档修订中对齐契约）"
  - [x] SubTask 3.2: README.md 顶部「最近更新」从 2026-07-24 改为 2026-07-25
  - [x] SubTask 3.3: README.md 「关联文档」列表新增一行：`docs/conventions/frontend-backend-contract.md`（前后端对接契约方案）
  - [x] SubTask 3.4: overview.md 顶部「最近更新」改为 2026-07-25
  - [x] SubTask 3.5: overview.md §5「与现有架构的兼容性」表格末尾补一行：`docs/conventions/frontend-backend-contract.md` → 前后端对接契约方案（轻量落地）

## Task 4: 修订其余 3 个文档（仅元信息）

- [x] Task 4: 更新 security-decisions.md / ui-design.md / testing-roadmap.md 的元信息
  - [x] SubTask 4.1: security-decisions.md 顶部「最近更新」改为 2026-07-25
  - [x] SubTask 4.2: ui-design.md 顶部「最近更新」改为 2026-07-25
  - [x] SubTask 4.3: testing-roadmap.md 顶部「最近更新」改为 2026-07-25

## Task 5: 验证文档内部一致性

- [x] Task 5: 验证修订后所有文档内部一致性
  - [x] SubTask 5.1: Grep 检查 `docs/specs/dataset-management/` 下是否还有"第二阶段"或"第三阶段"且与端点表冲突的表述 → No matches found（已删除）
  - [x] SubTask 5.2: Grep 检查所有端点（14 个）是否在 architecture.md §2 表格中均能查到 → 15 行端点全部查到
  - [x] SubTask 5.3: Grep 检查 `frontend-backend-contract.md` 关键词是否在 README.md / overview.md / architecture.md §6 中均能查到 → 4 个文档均查到
  - [x] SubTask 5.4: Grep 检查 `dataset.contract.ts` 关键词是否在 architecture.md / data-model.md 中均能查到 → 4 个文档均查到

# Task Dependencies

- Task 2 可与 Task 1 并行（核心文档互不依赖）
- Task 3 可与 Task 1/2 并行
- Task 4 可与 Task 1/2/3 并行（纯元信息更新）
- Task 5 必须在 Task 1-4 全部完成后执行
