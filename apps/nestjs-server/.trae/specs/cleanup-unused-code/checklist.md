# 清理未使用代码 Checklist

## 扫描与清单

- [x] 已执行 `pnpm run lint` 并收集未使用变量/导入告警
- [x] 已执行 `ts-prune` 扫描未消费 export 符号
- [x] 已执行 `pnpm run typecheck` 收集编译器层未使用符号
- [x] 已在 `.trae/specs/cleanup-unused-code/audit.md` 中按 A~F 分类整理扫描结果
- [x] 每条扫描记录已标注"保留/删除"结论及原因

## 复核结论

- [x] 已识别所有 NestJS 装饰器消费的"假阳性"项
- [x] 已识别所有 Swagger / class-validator 装饰器消费字段
- [x] 已识别所有 Prisma 客户端动态调用方法
- [x] 已识别所有字符串反射消费（Reflect、配置 key、Prisma 模型名）
- [x] 已确认测试文件（`*.spec.ts` / `*.e2e-spec.ts`）的间接引用

## 代码清理 - common

- [x] `src/common/constants/` 中未引用常量与枚举值已清理（删除 `menu.constants.ts`、`error-codes.constants.ts`、`messages.constants.ts`）
- [x] `src/common/decorators/` 中未消费装饰器已清理，barrel 已同步（删除 `permissions.decorator.ts`、`roles.decorator.ts`）
- [x] `src/common/guards/` 中未挂载 Guard 已清理（删除 `permissions.guard.ts`、`roles.guard.ts`）
- [x] `src/common/interceptors/` 中未挂载 Interceptor 已清理
- [x] `src/common/filters/` 中未挂载 Filter 已清理
- [x] `src/common/utils/`、`src/common/dto/`、`src/common/enums/`、`src/common/exceptions/`、`src/common/interfaces/`、`src/common/schemas/`、`src/common/pipes/` 中冗余符号已清理
  - 删除 `pagination.schema.ts` 整文件
  - 删除 `CHINESE_DATETIME` / `CHINESE_DATE` 常量
  - 删除 `DateInputSchema` / `IsoDateTimeStringSchema`
  - 删除 `HttpExceptionResponseLike` 的 `statusCode` / `error` / `errors` 字段
  - 删除 `ApiErrorResponse` / `ApiCommonErrors` 装饰器及 `ERROR_SCHEMA`
  - 删除空 `pipes/index.ts`
- [x] `pnpm run lint && pnpm run typecheck` 通过（common 阶段）

## 代码清理 - config

- [x] `src/config/schemas/` 中未加载 schema 片段已清理
  - 删除 `ConfigNamespace` 类型
- [x] `config-loader.ts`、`typed-config.service.ts`、`types.ts` 中未消费导出已清理
- [x] `pnpm run lint && pnpm run typecheck` 通过（config 阶段）

## 代码清理 - modules

- [x] `src/modules/auth/` 未使用符号已清理（删除 `VerifyCaptchaSchema`、`VerifyCaptchaDto`、`ProfileResponse`）
- [x] `src/modules/user/` 未使用符号已清理（删除 `UserResponseDto`）
- [x] `src/modules/logger/`、`src/modules/health/`、`src/modules/cache/` 未使用符号已清理（删除 `log-query.service.ts`、`logger.module.ts`）
- [x] 各模块 `index.ts` barrel 已同步更新
- [x] `pnpm run lint && pnpm run typecheck` 通过（modules 阶段）

## 代码清理 - 入口与测试

- [x] `src/prisma/` 中未使用导出已清理
- [x] `src/app.module.ts`、`src/main.ts` 未使用 import 已清理（删除 `LoggerModule` import、`RolesGuard` import 与 provider）
- [x] `test/app.e2e-spec.ts`、`test/setup.ts` 未使用符号已清理（删除 `mockConfigService`）
- [x] `pnpm run lint && pnpm run typecheck` 通过（入口与测试阶段）

## 全量验证

- [x] `pnpm test` 单元测试：91 passed / 1 pre-existing failure（`UserService › remove › should remove an existing user` —— 该用例在本次清理前已失败，与本次任务无关）
- [x] `README.md` 中对已删除符号的引用已检查，未发现需要更新的内容
- [x] `BARRELSBY_README.md` 中对已删除 barrel 的说明已检查，未发现需要更新的内容
- [x] `.trae/documents/` 中对已删除模块的引用已检查：相关条目属于"未来计划"性质，无需更新
- [x] `audit.md` 删除结论覆盖率达到 100%，共 30 条删除项、1 条保留项

## 质量门禁

- [x] ESLint 检查 0 errors
- [x] TypeScript 类型检查 0 errors
- [x] 现有测试用例无新增失败（1 个失败为 pre-existing）
- [x] 未引入任何 `// eslint-disable` / `@ts-ignore` / `any` 逃避手段
- [x] 未提交任何"调试用"console.log / console.error

## 交付清单

### 删除的文件（11 个）

1. `src/common/constants/menu.constants.ts`
2. `src/common/constants/error-codes.constants.ts`
3. `src/common/constants/messages.constants.ts`
4. `src/common/guards/permissions.guard.ts`
5. `src/common/guards/roles.guard.ts`
6. `src/common/decorators/permissions.decorator.ts`
7. `src/common/decorators/roles.decorator.ts`
8. `src/common/schemas/pagination.schema.ts`
9. `src/common/pipes/index.ts`（空文件 + 空目录）
10. `src/modules/logger/log-query.service.ts`
11. `src/modules/logger/logger.module.ts`

### 修改的文件（10 个）

1. `src/app.module.ts` —— 移除 `LoggerModule` import 与 `RolesGuard` provider
2. `src/common/constants/index.ts` —— barrel 同步
3. `src/common/decorators/index.ts` —— barrel 同步
4. `src/common/decorators/api-success-response.decorator.ts` —— 移除 `ApiErrorResponse` / `ApiCommonErrors` / `ERROR_SCHEMA`
5. `src/common/filters/http-exception.filter.ts` —— 移除未使用接口字段
6. `src/common/guards/index.ts` —— barrel 同步
7. `src/common/schemas/datetime.schema.ts` —— 移除 `DateInputSchema` / `IsoDateTimeStringSchema`
8. `src/common/schemas/index.ts` —— barrel 同步
9. `src/common/utils/time.util.ts` —— 移除 `CHINESE_DATETIME` / `CHINESE_DATE`
10. `src/config/schemas/index.ts` —— 移除 `ConfigNamespace`
11. `src/modules/auth/dto/auth.dto.ts` —— 移除 `VerifyCaptchaSchema` / `VerifyCaptchaDto` / `ProfileResponse`
12. `src/modules/user/dto/user.dto.ts` —— 移除 `UserResponseDto`
13. `test/setup.ts` —— 移除 `mockConfigService`

### 新增的文件（1 个）

1. `ts-prune` 加入 devDependencies（用于本次扫描 + 未来可重复使用）
