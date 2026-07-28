# 数据集管理 · 实现检查清单

> 状态：生效中
> 最近更新：2026-07-28
> 定位：对照 [testing-roadmap.md](./testing-roadmap.md) §2 实施路线图的验收清单，勾选状态以代码库实际落地为准（2026-07-28 首次核对建立）

## 第一阶段（MVP）：核心数据集管理

- [x] 共享 Schema（dataset + connection）（`packages/shared/src/schemas/dataset.schema.ts`）
- [x] Prisma 模型 + 迁移（`prisma/schema/Dataset.prisma`：Dataset / DataSourceConnection / DatasetReference）
- [x] Dataset Module（CRUD + execute + test）（`apps/nestjs-server/src/modules/dataset/`，端点契约见 `packages/shared/src/contracts/dataset.contract.ts`）
- [x] StaticExecutor + ApiExecutor（`executors/static.executor.ts`、`executors/api.executor.ts`）
- [x] DatasetCacheService（内存缓存）（`dataset-cache.service.ts`）
- [x] DatasetFilterService（JSONata 表达式）（`dataset-filter.service.ts`）
- [x] DatasetReference 引用索引（项目保存时重建）（`dataset-reference.service.ts`）
- [x] ApiExecutor SSRF 防护 + 独立限流（`utils/ssrf-guard.ts`）
- [x] 业务码扩展三处（`BizCode` + `BIZ_CODE_TO_HTTP_STATUS` + `BizMessage`，80xxx 段）
- [x] 前端 features/dataset 模块（`apps/web/src/features/dataset/`）
- [x] 管理页（列表 + 编辑）（`datasets-page.tsx`、`dataset-editor-page.tsx`）
- [x] 编辑器内 dataset-config-section（`dataset-config-section.tsx`，接入 bar-chart 数据源配置）
- [x] useDatasetSource hook（`apps/web/src/features/screen/hooks/use-dataset-source.ts`）
- [x] DataSourceConfig 扩展 'dataset' 分支（`screen.schema.ts` 判别联合第三分支）
- [ ] 图形化字段映射编辑器（当前仅基础 dimension/value 映射，图形化编辑器未落地）
- [x] 测试面板（原始 + 解析后）（`components/dataset-test-panel.tsx`）

## 第二阶段：增强能力

- [x] DataSourceConnection Module（已提前至第一阶段落地，`apps/nestjs-server/src/modules/datasource-connection/`；见 dataset-management-revision 修订说明）
- [ ] SqlExecutor（`executors/` 下尚无 SQL 执行器，`websocket`/`sql` 类型走 `unsupported.executor.ts` 返回 80007）
- [ ] Mock 配置（部分：`static` 与 `echo-params` 生成器已落地；`faker-template` 待实现，当前返回未支持错误）
- [ ] 蓝图 refreshDataset 动作（现有 `refreshDataSource` 为组件级动作，数据集级刷新未实现）
- [ ] 提取为数据集（组件现有 api/static 配置提取为数据集）
- [ ] Redis 缓存（多实例部署支持，当前为内存缓存）

## 第三阶段：实时与高级

- [ ] WebSocket 数据源
- [ ] 预览页批量执行
- [ ] 后端推送更新
- [ ] 数据集版本管理
- [ ] 项目级权限模型
- [ ] JS filter（可选，isolated-vm）
- [ ] filter 模板库
- [ ] 数据 schema 推断
