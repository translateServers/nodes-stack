# Tasks

- [x] Task 1: 扫描未使用代码并生成清单
  - [x] SubTask 1.1: 执行 `pnpm run lint` 收集所有 `no-unused-vars` / `@typescript-eslint/no-unused-vars` 警告与错误
  - [x] SubTask 1.2: 安装并执行 `ts-prune`（如未安装）扫描未消费的 export 符号
  - [x] SubTask 1.3: 执行 `pnpm run typecheck` 收集编译器层未使用符号
  - [x] SubTask 1.4: 在 `.trae/specs/cleanup-unused-code/audit.md` 中按"类别 A~F"分类整理扫描结果（含文件路径、行号、代码片段）

- [x] Task 2: 人工复核扫描清单
  - [x] SubTask 2.1: 识别装饰器消费类"假阳性"（NestJS/Swagger/class-validator/Prisma 反射调用）
  - [x] SubTask 2.2: 识别字符串反射消费（如 `Reflect.getMetadata`、配置路径 key、Prisma 模型名）
  - [x] SubTask 2.3: 识别测试文件（`*.spec.ts`、`*.e2e-spec.ts`）中的工具函数是否被间接消费
  - [x] SubTask 2.4: 在 `audit.md` 中为每条记录标注"保留 / 删除"结论

- [x] Task 3: 清理 `src/common/` 目录未使用代码
  - [x] SubTask 3.1: 移除 `src/common/constants/` 中未被引用的常量与枚举值
  - [x] SubTask 3.2: 移除 `src/common/decorators/` 中未被消费的装饰器及同步更新 `index.ts` barrel
  - [x] SubTask 3.3: 移除 `src/common/guards/`、`src/common/interceptors/`、`src/common/filters/` 中未挂载的实现
  - [x] SubTask 3.4: 移除 `src/common/utils/`、`src/common/dto/`、`src/common/enums/`、`src/common/exceptions/`、`src/common/interfaces/`、`src/common/schemas/`、`src/common/pipes/` 中的冗余符号
  - [x] SubTask 3.5: 单批完成后运行 `pnpm run lint && pnpm run typecheck` 验证

- [x] Task 4: 清理 `src/config/` 目录未使用代码
  - [x] SubTask 4.1: 移除 `src/config/schemas/` 中未被加载的 schema 片段
  - [x] SubTask 4.2: 移除 `config-loader.ts`、`typed-config.service.ts`、`types.ts` 中未消费的导出
  - [x] SubTask 4.3: 同步运行 `pnpm run lint && pnpm run typecheck` 验证

- [x] Task 5: 清理 `src/modules/` 目录未使用代码
  - [x] SubTask 5.1: 清理 `src/modules/auth/`（controller、service、strategies、dto、captcha）未使用符号
  - [x] SubTask 5.2: 清理 `src/modules/user/` 未使用符号
  - [x] SubTask 5.3: 清理 `src/modules/logger/`、`src/modules/health/`、`src/modules/cache/` 未使用符号
  - [x] SubTask 5.4: 同步更新各模块 `index.ts` barrel
  - [x] SubTask 5.5: 单批完成后运行 `pnpm run lint && pnpm run typecheck` 验证

- [x] Task 6: 清理 `src/prisma/`、`src/app.module.ts`、`src/main.ts` 未使用代码
  - [x] SubTask 6.1: 清理 `src/prisma/index.ts`、`prisma.module.ts`、`prisma.service.ts` 未使用导出
  - [x] SubTask 6.2: 清理 `src/app.module.ts`、`src/main.ts` 未使用 import
  - [x] SubTask 6.3: 运行 `pnpm run lint && pnpm run typecheck` 验证

- [x] Task 7: 清理 `test/` 目录未使用代码
  - [x] SubTask 7.1: 清理 `test/app.e2e-spec.ts`、`test/setup.ts` 未使用 import / 变量
  - [x] SubTask 7.2: 同步运行 `pnpm run lint && pnpm run typecheck` 验证

- [x] Task 8: 全量验证与文档同步
  - [x] SubTask 8.1: 执行 `pnpm test` 确认无回归
  - [x] SubTask 8.2: 检查 `README.md`、`BARRELSBY_README.md`、`.trae/documents/` 中是否存在对已删除符号的引用，必要时更新
  - [x] SubTask 8.3: 复核 `audit.md` 删除结论的覆盖率，确保 0 遗漏

# Task Dependencies

- [Task 2] depends on [Task 1]（人工复核依赖扫描结果）
- [Task 3] depends on [Task 2]（清理依赖复核结论）
- [Task 4] depends on [Task 3]（config 依赖 common 清理完成）
- [Task 5] depends on [Task 4]（modules 依赖 config 清理完成）
- [Task 6] depends on [Task 5]（入口文件依赖 modules 清理完成）
- [Task 7] depends on [Task 6]（测试文件依赖入口文件清理完成）
- [Task 8] depends on [Task 7]（文档同步依赖全部代码清理完成）

**可并行执行的任务组:**

- 本清理任务按"自底向上"分层执行，**无真正可并行的任务**（必须逐层验证以避免跨层引用错误）
- 同一 Task 内的多个 SubTask 在确认无文件交叉时，可在确认依赖的前提下合并执行
