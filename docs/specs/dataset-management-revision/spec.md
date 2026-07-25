# 数据集管理规格文档修订 Spec

> 状态：设计中
> 最近更新：2026-07-25
> 定位：根据前后端对接失败反馈，修订 `docs/specs/dataset-management/` 下的规格文档，使其与已落地的契约方案（`docs/conventions/frontend-backend-contract.md` + `packages/shared/src/contracts/`）对齐。**只改文档，不动代码**。

## Why

前后端按 `docs/specs/dataset-management/` 独立开发后对接失败，根因是文档自身存在 5 类问题：
1. 阶段标记自相矛盾（architecture.md §2 vs §5.5）
2. projectId 关键字段的处理方式未明确
3. API 端点表只写路径与功能，未声明参数位置/必填性/缺失行为
4. 缺少"前后端契约对齐"章节
5. 文档与已落地的契约方案未建立引用关系

本次修订让规格文档与已落地的契约方案对齐，避免后续开发再次踩坑。**文件位置保持不变**：所有修改都在 `docs/specs/dataset-management/` 原目录内完成。

## What Changes

### 1. architecture.md 修订
- **BREAKING**（对规格语义）：明确 `POST /dataset/batch` 与 `datasource-connection` 模块均属于**第一阶段**（已落地实现），删除 §5.5 "Connection Module 属第二阶段"的过时表述
- §2 端点表新增"参数位置 / 必填性 / 缺失行为"三列
- §2.1 鉴权策略：补一句指向 `docs/conventions/frontend-backend-contract.md`
- §5.5 后端代理决策：删除"第一阶段 api 数据集的 connectionId 不启用"的过时表述（已与实际实现不符）
- 末尾新增 §6「前后端契约对齐」章节，引用 contract 注册表

### 2. data-model.md 修订
- §1 数据集 Schema：补一段说明，指向 `packages/shared/src/schemas/dataset.schema.ts` 中的 `CreateDatasetRequestSchema` / `ListDatasetQuerySchema` / `DatasetResponseSchema`（契约单一数据源）
- §4.1 作用域决策：明确 projectId 的传递方式与缺失行为（query/body 可选，未传时后端回退到默认项目）
- §5 业务码扩展：在"需同步扩展三处"基础上，**明确点名** `BizMessage` 映射必须扩展，否则 `getBizMessage(80001)` 回退到"未知错误"
- §6 字段映射复用：更新为引用 `packages/shared/src/schemas/field-mapping.schema.ts`（已抽离的独立文件，打破循环依赖）

### 3. overview.md 修订
- §5 与现有架构的兼容性：补一行指向 `docs/conventions/frontend-backend-contract.md`（前后端对接契约方案）

### 4. README.md（dataset-management 自身）修订
- 状态：`设计中` → `实施中（第一阶段 MVP 已完成，文档修订中对齐契约）`
- 最近更新：`2026-07-24` → `2026-07-25`
- 在「关联文档」列表新增一行：`docs/conventions/frontend-backend-contract.md`（前后端对接契约方案）

### 5. security-decisions.md / ui-design.md / testing-roadmap.md
- 仅更新顶部「最近更新」日期为 `2026-07-25`
- 不改内容（与契约方案无直接冲突）

## Impact

- **Affected specs**: `docs/specs/dataset-management/*` 全部 7 个文档
- **Affected code**: 无（纯文档修订）
- **Affected contracts**: 让规格文档与已落地的 `packages/shared/src/contracts/dataset.contract.ts` + `docs/conventions/frontend-backend-contract.md` 建立双向引用

## ADDED Requirements

### Requirement: 规格文档必须显式声明契约单一数据源
数据集管理规格文档在涉及 API 端点与字段定义时，SHALL 引用 `packages/shared/src/contracts/dataset.contract.ts` 作为契约单一数据源，并在文档末尾或对应章节注明"实现依据"指向 `docs/conventions/frontend-backend-contract.md`。

#### Scenario: 读者查找端点契约
- **WHEN** 开发者阅读 architecture.md §2 端点表
- **THEN** 能在表格或紧邻段落找到 contract 注册表的路径引用
- **AND** 能从 contract 注册表追溯到 Zod schema 定义

### Requirement: 规格文档必须明确 projectId 的传递与缺失行为
data-model.md 与 architecture.md SHALL 明确说明：
- projectId 在创建请求中可选（未传时后端回退到默认项目）
- projectId 在列表查询中可选（未传时返回所有项目的数据集）
- projectId 在响应中可选（前端 Zod strip 模式忽略）

#### Scenario: 前端无项目上下文时创建数据集
- **WHEN** 前端调用 POST /dataset 不传 projectId
- **THEN** 后端 service 层回退到数据库第一个项目作为默认 projectId
- **AND** 创建成功并返回数据集实体

### Requirement: 端点表必须声明参数位置与必填性
architecture.md §2 的端点表 SHALL 包含以下列：方法、路径、参数位置（path/query/body）、必填性、缺失行为、阶段标记。

#### Scenario: 前端开发者查看端点表
- **WHEN** 前端开发者查阅 architecture.md §2
- **THEN** 每个 GET 端点能从表中读出 query 参数名称与必填性
- **AND** 每个 POST/PATCH 端点能从表中读出 body schema 引用

## MODIFIED Requirements

### Requirement: 阶段标记一致性
architecture.md 内所有对"阶段"的描述 SHALL 保持一致：`POST /dataset/batch` 与 `datasource-connection` 模块均标记为**第一阶段**（已落地），删除 §5.5 "Connection Module 属第二阶段"的过时表述。

#### Scenario: 读者查找 batch 端点阶段
- **WHEN** 开发者阅读 architecture.md §2 端点表
- **THEN** `POST /dataset/batch` 标记为"第一阶段"
- **AND** §5.5 不再出现"Connection Module 属第二阶段"的表述

### Requirement: 文档元信息时效性
dataset-management 目录下所有 7 个文档顶部「最近更新」字段 SHALL 反映最近一次实际修改日期。文档状态字段 SHALL 反映当前实际状态（设计中 / 实施中 / 已完成）。

#### Scenario: 读者判断文档时效
- **WHEN** 读者打开任一文档
- **THEN** 顶部「最近更新」日期不超过实际最后修改日期
- **AND** 「状态」字段与代码实现进度一致

## REMOVED Requirements

### Requirement: 旧阶段划分（architecture.md §5.5）
**Reason**: §5.5 "Connection Module 属第二阶段" 与 §2 端点表列出 6 个 connection 端点矛盾，且与已落地实现不符（datasource-connection 模块已实现）。
**Migration**: 删除该表述，统一在端点表中以"第一阶段"标记。
