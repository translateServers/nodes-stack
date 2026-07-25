# Checklist

> 用于验证修订后的规格文档是否与已落地的契约方案对齐

## architecture.md 验证

- [x] 顶部「最近更新」日期为 2026-07-25
- [x] §2 端点表包含 14 个端点，每个端点都有「方法 / 路径 / 参数位置 / 必填性 / 缺失行为 / 阶段」六列
- [x] §2 `POST /dataset/batch` 标记为「第一阶段」
- [x] §2 6 个 `/datasource-connection` 端点均标记为「第一阶段」
- [x] §2 端点表下方有「契约单一数据源」段落，引用 `packages/shared/src/contracts/dataset.contract.ts`
- [x] §2.1 末尾引用 `docs/conventions/frontend-backend-contract.md`
- [x] §5.5 不再出现「Connection Module 属第二阶段」表述
- [x] §5.5 不再出现「第一阶段 api 数据集的 connectionId 不启用」表述
- [x] 末尾新增 §6「前后端契约对齐」章节，含 contract 引用与 phase=1 端点清单

## data-model.md 验证

- [x] 顶部「最近更新」日期为 2026-07-25
- [x] §1 末尾有「契约 schema 引用」段落，引用 `CreateDatasetRequestSchema` / `ListDatasetQuerySchema` / `DatasetResponseSchema`
- [x] §4.1 明确 projectId 三处规则（创建请求可选 / 列表查询可选 / 响应可选）
- [x] §5 「需同步扩展三处」描述中明确点名 `BizMessage` 映射必须扩展
- [x] §6 字段映射复用引用 `packages/shared/src/schemas/field-mapping.schema.ts`

## README.md 验证

- [x] 顶部「状态」从「设计中」改为「实施中」相关表述
- [x] 顶部「最近更新」日期为 2026-07-25
- [x] 「关联文档」列表包含 `docs/conventions/frontend-backend-contract.md`

## overview.md 验证

- [x] 顶部「最近更新」日期为 2026-07-25
- [x] §5 兼容性表格末尾引用 `docs/conventions/frontend-backend-contract.md`

## 其余 3 个文档验证

- [x] security-decisions.md 顶部「最近更新」日期为 2026-07-25
- [x] ui-design.md 顶部「最近更新」日期为 2026-07-25
- [x] testing-roadmap.md 顶部「最近更新」日期为 2026-07-25

## 跨文档一致性验证

- [x] Grep `docs/specs/dataset-management/` 不再出现「Connection Module 属第二阶段」表述
- [x] Grep `docs/specs/dataset-management/` 14 个端点均在 architecture.md §2 表格中查到
- [x] Grep `frontend-backend-contract.md` 在 README.md / overview.md / architecture.md §6 中均能查到
- [x] Grep `dataset.contract.ts` 在 architecture.md 与 data-model.md 中均能查到
- [x] 所有文档顶部「最近更新」均为 2026-07-25（无遗漏）

## 约束验证

- [x] 修订未迁移任何文件位置（dataset-management/ 下仍是原 7 个文档）
- [x] 修订未改动任何代码文件
- [x] 修订未引入新的文档（除本规格自身的 spec.md / tasks.md / checklist.md）
