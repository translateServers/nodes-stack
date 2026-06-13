# 清理未使用代码规范

## Why
随着项目迭代（菜单管理、角色权限、认证、配置管理等模块陆续接入），代码库中可能累积了未被引用的函数、变量、类、导入语句以及历史调试用注释代码。这些冗余代码会降低可读性、增加维护成本、拖慢 lint/typecheck 速度，并带来潜在的类型安全风险。本规范旨在系统化地识别并安全移除未使用代码，提升项目整洁度与可维护性。

## What Changes
- 静态扫描整个 `src/` 目录（包括 `common/`、`config/`、`modules/`、`prisma/`）的未使用代码
- 识别未使用的：导入语句、变量、函数、方法、类、接口、类型别名、enum 成员、Prisma 字段映射、注释代码块
- 区分"真未使用"和"通过反射/装饰器/动态调用隐式引用"两类，避免误删
- 安全删除确认无用的代码，并同步更新相关的 barrel 导出（`index.ts`）
- 同步更新项目级注释、README 模块说明（如有）以反映代码结构变化
- 运行 lint、typecheck、单元测试、E2E 测试确保无回归

## Impact
- Affected specs: cleanup-unused-code（本次新增）
- Affected code: `src/` 全量代码，主要包括：
  - `src/common/`（decorators、guards、interceptors、filters、utils、dto、enums、exceptions、interfaces、schemas、constants）
  - `src/config/`（schemas、config-loader、typed-config.service、types）
  - `src/modules/`（auth、cache、health、logger、user 等模块的 controllers / services / dto）
  - `src/prisma/`
  - `src/app.module.ts`、`src/main.ts`
  - `test/` 相关测试文件
  - `README.md`、`BARRELSBY_README.md`（仅在引用了被移除模块时同步）

## ADDED Requirements

### Requirement: 未使用代码扫描
系统 SHALL 提供系统化的未使用代码扫描流程：
- 第一阶段：使用 TypeScript 编译器（`tsc --noEmit`）+ ESLint（`no-unused-vars`、`@typescript-eslint/no-unused-vars`）进行自动化扫描
- 第二阶段：使用 `ts-prune` 或等效工具扫描导出但未被消费的符号
- 第三阶段：人工复核扫描结果，识别装饰器元数据、Prisma 字段映射、字符串字面量反射调用等"假阳性"项

#### Scenario: 扫描未使用导入
- **WHEN** 执行 `pnpm run lint` 或 `ts-prune` 命令
- **THEN** 系统输出所有未使用的导入语句清单（含文件路径与行号）

#### Scenario: 扫描未使用导出符号
- **WHEN** 执行 `ts-prune` 命令
- **THEN** 系统输出所有未被其他文件引用的导出符号（含导出文件路径与符号名）

### Requirement: 未使用代码分类记录
系统 SHALL 将扫描结果分类记录为可审计清单：
- 类别 A：未使用的 import 语句
- 类别 B：未使用的局部变量 / 函数参数
- 类别 C：未使用的私有方法 / 私有类
- 类别 D：未被消费的 export（模块/类/函数/常量/类型）
- 类别 E：注释掉的代码块（含 `//`、`/* */`）
- 类别 F：未使用的 Prisma 字段（仅当确认业务未访问时）
- 每条记录 SHALL 包含：文件路径、行号、代码片段、分类标签、复核结论（保留/删除）

#### Scenario: 生成扫描清单
- **WHEN** 完成扫描阶段
- **THEN** 在 `.trae/specs/cleanup-unused-code/audit.md` 中生成结构化清单

### Requirement: 装饰器与反射代码安全识别
系统 SHALL 在人工复核阶段识别以下"伪未使用"代码，避免误删：
- 被 NestJS 装饰器（`@Controller`、`@Injectable`、`@Module`、`@Get`、`@Post` 等）标注的类/方法
- 被 Swagger 装饰器（`@ApiProperty`、`@ApiTags` 等）标注的字段
- 被 `class-validator` 装饰器（`@IsString`、`@IsNotEmpty` 等）消费的字段
- 被 Prisma 客户端动态调用的方法（如 `prisma.user.findUnique`）
- 通过字符串路径在配置/路由表中引用的 controller 名称
- 通过 `Reflect.getMetadata` 等反射 API 访问的元数据 key

#### Scenario: 识别装饰器消费代码
- **WHEN** 扫描到带有 `@Controller('xxx')` 装饰器但未在代码中显式 import 的类
- **THEN** 人工复核阶段将其标记为"保留"（由 NestJS DI 容器反射消费）

### Requirement: 安全删除流程
系统 SHALL 遵循"分批、小步、可回滚"的安全删除流程：
- 按模块/目录分批处理（common → config → modules/auth → modules/user → ...）
- 每批删除后立即运行 `pnpm run lint && pnpm run typecheck`
- 单批失败时 SHALL 通过 `git checkout` 回滚该批变更
- 全部完成后运行完整测试套件（`pnpm test`）和 E2E 测试

#### Scenario: 单批验证失败回滚
- **WHEN** 删除某批代码后 `pnpm run typecheck` 报错
- **THEN** 立即执行 `git checkout -- <affected-path>` 回滚该批，然后修复识别规则

#### Scenario: 全量测试通过
- **WHEN** 所有未使用代码被移除
- **THEN** `pnpm run lint && pnpm run typecheck && pnpm test` 全部通过，无新增失败用例

### Requirement: 文档同步更新
系统 SHALL 在代码结构变化后同步更新相关文档：
- `README.md`：移除已删除模块的引用（如有）
- `BARRELSBY_README.md`：移除已删除 barrel 的说明（如有）
- `.trae/documents/`：移除对已删除模块的引用
- 删除前 SHALL 检查所有 `.md` 文件是否提及被删代码/模块

#### Scenario: README 模块引用更新
- **WHEN** 移除了某个模块的导出
- **THEN** 检查并更新 README 与架构文档中对该模块的引用

## MODIFIED Requirements
无（本规范为新增清理任务，不修改现有业务功能需求）

## REMOVED Requirements
无（本规范不主动移除功能需求，仅清理未被引用的实现代码）
