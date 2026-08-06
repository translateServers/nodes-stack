# P Gate 交接

> 状态：已完成
> 最近更新：2026-08-03
> 任务：P0.4、P0.5

## 结论

已建立可复现基线并发布逐文件所有权、路线定向命令和临时目录。后续路线以本记录为执行前置；Web 的
TypeScript/build 与 Chromium E2E 已有基线失败，实施路线不得将其误判为新增回归。

## 前置检查

- 已读取 `tasks.md`、`spec.md`、`checklist.md`、`handoffs/README.md`、编码规范、前后端契约和开发指南。
- 运行时版本：Node.js `v22.22.3`、pnpm `9.15.0`，符合冻结版本。
- 基线开始时工作树包含文档、Docker/CI 和 `screen-sdk` 运行时代码的并发改动；未覆盖或回退任何改动。
- 本交接落盘前的工作树只包含已规划文档改动及旧规格/提示词删除；`git status --short` 不显示生成的
  `dist`、Playwright 报告或 E2E SQLite 文件。
- 执行前后检查 `3001`、`5174`、`5175`、`5176`，均没有监听进程。基线结束后端口再次为空闲状态。

## P0.4 基线

### 通过

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `pnpm --filter @nebula/screen-component-sdk test` | 通过 | 6 files、126 tests |
| `pnpm --filter @nebula/screen-editor-core test` | 通过 | 95 files、1,823 tests；需约 204 秒 |
| `pnpm --filter @nebula/screen-sdk test` | 通过 | 5 files、46 tests |
| `pnpm --filter @nebula/screen-dynamic-sdk test` | 通过 | 1 file、6 tests |
| `pnpm --filter @nebula/screen-component-sdk build` | 通过 | 生成组件 SDK 声明 |
| `pnpm --filter @nebula/screen-component-sdk verify:tarball` | 通过 | clean tarball consumer |
| `pnpm --filter @nebula/screen-sdk build` | 通过 | boundary/dist boundary 通过；第三方 `@daybrush/utils` pure annotation 警告不阻断构建 |
| `pnpm --filter @nebula/screen-sdk verify:tarball` | 通过 | Vanilla、React、Vue consumer 均通过 |
| `pnpm --filter @nebula/screen-dynamic-sdk build` | 通过 | boundary 与 declarations 通过 |
| `pnpm --filter @nebula/screen-dynamic-sdk verify:tarball` | 通过 | tarball 入口完整 |
| `pnpm --filter @nebula/web test -- src/features/screen` | 通过 | 7 files、63 tests |
| `$env:CI = '1'; pnpm --filter @nebula/screen-sdk-host e2e` | 通过 | Chromium 11 tests |
| `$env:CI = '1'; pnpm --filter @nebula/dynamic-sdk-vue-consumer e2e` | 通过 | Chromium 3 tests |

### 已知失败

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `pnpm --filter @nebula/web typecheck` | 失败 | `apps/web/src/features/screen/runtime/component-registry.ts:39` 无法解析 `@nebula-example/indicator-card-vanilla` |
| `pnpm --filter @nebula/web build` | 失败 | 同一 module-resolution 错误，在 `tsc -b` 阶段停止 |
| `$env:E2E_WEB_PORT = '5176'; pnpm --filter @nebula/web e2e` | 失败 | WebServer 在 Prisma schema 加载后等待 120 秒超时，未进入 Playwright 测试用例 |

Core 的第一次基线运行仅因默认两分钟工具超时被中止；使用十分钟超时重跑后通过，不能计作测试失败。

### 旧路径盘点

- `SCREEN_COMPONENT_API_VERSION_V2`、`ScreenComponentElementModelV2`、`DynamicScreenDocumentV3`、旧
  `schemaVersion` 仍出现在 `packages/screen-component-sdk/src/dynamic/**`、
  `packages/screen-editor-core/src/contracts/dynamic-document*`、`packages/screen-editor-core/src/dynamic/**`、
  `packages/screen-dynamic-sdk/**`、`apps/dynamic-sdk-vue-consumer/src/document.ts`、
  `apps/screen-sdk-host/src/fixtures.ts`、`packages/component-lab-host/src/component-lab.tsx`、
  `apps/web/src/features/screen/adapters/nebula-screen-host-adapter.ts` 与相关测试。
- 未发现活跃源码中的 `dataSource` 旧 `api`、`dataset` 或 `host/xj-metric` 字面量匹配；此结果不替代
  BUS-3 的完整 source/declaration/tarball 删除扫描。
- 仅枚举标识符与路径，未读取或输出开发/E2E 数据库内容。

## P0.5 文件所有权与命令

| Owner | 独占路径 | 定向命令 | 临时目录 |
| --- | --- | --- | --- |
| A | `packages/screen-component-sdk/**` | `pnpm --filter @nebula/screen-component-sdk test` | `%TEMP%/opencode/screen-bridge/A` |
| B | `packages/shared/src/{index.ts,schemas/screen.schema.ts,schemas/screen.schema.test.ts,schemas/screen-migration.test.ts,schemas/index.ts,contracts/**}`；`apps/nestjs-server/src/modules/screen/**`；`apps/nestjs-server/src/modules/dataset/{dataset.service*,dataset-reference.service*,dataset.module.ts,dto/dataset.dto.ts}`；`apps/nestjs-server/prisma/{schema/Screen.prisma,schema/Dataset.prisma,migrations/**}`；`packages/screen-editor-core/src/contracts/{document.ts,dynamic-document.ts,dynamic-document.test.ts,json-schema.ts,diagnostics.ts}` | shared/Nest/core document 定向 test、typecheck | `%TEMP%/opencode/screen-bridge/B` |
| C | `packages/screen-editor-core/src/contracts/adapter.ts`；`packages/screen-editor-core/src/dynamic/**` | `pnpm --filter @nebula/screen-editor-core test` | `%TEMP%/opencode/screen-bridge/C` |
| D | `packages/screen-editor-core/{package.json,src/contracts/index.ts,src/index.ts,src/internal.ts,src/experimental.ts,src/dynamic-entry.ts,src/sdk-contracts.ts,src/sdk-public.ts}`；core `src/**` 中排除 B/C 范围的文件 | `pnpm --filter @nebula/screen-editor-core test` | `%TEMP%/opencode/screen-bridge/D` |
| E | `packages/screen-sdk/**` | `pnpm --filter @nebula/screen-sdk test` | `%TEMP%/opencode/screen-bridge/E` |
| F-Vue | `packages/{screen-component-vue,indicator-card-vue}/**` | 对应 package test/build/tarball | `%TEMP%/opencode/screen-bridge/F-Vue` |
| F-React | `packages/{screen-component-react,indicator-card-react}/**` | 对应 package test/build/tarball | `%TEMP%/opencode/screen-bridge/F-React` |
| G1 | `apps/screen-sdk-host/**`；`packages/{indicator-card-vanilla,component-lab-host}/**` | `pnpm --filter @nebula/screen-sdk-host e2e` | `%TEMP%/opencode/screen-bridge/G1` |
| G2 | `apps/dynamic-sdk-vue-consumer/**` | `pnpm --filter @nebula/dynamic-sdk-vue-consumer e2e` | `%TEMP%/opencode/screen-bridge/G2` |
| G3 | `apps/web/{package.json,Dockerfile,vite.config.ts,vitest.config.ts,e2e/**,src/features/screen/**,src/lib/monaco-loader.ts,src/types/monaco-json-register.d.ts,src/routes/_app.screen.$id.tsx,src/routes/_app.screen.index.tsx,src/routes/screen-preview.$id.tsx,src/routes/screen-editor-preview.$id.tsx}` | `pnpm --filter @nebula/web test -- src/features/screen` | `%TEMP%/opencode/screen-bridge/G3` |
| BUS | root manifest/lockfile/workflows；`packages/screen-dynamic-sdk/**` 删除；E2E SQLite/reports；规范、ADR 与文档索引 | 全仓质量门、顺序 tarball/E2E | `%TEMP%/opencode/screen-bridge/BUS` |

共享构建输出为 `packages/{shared,screen-component-sdk,screen-editor-core,screen-sdk,screen-dynamic-sdk}/dist/**`；只能由
P 基线、E staging build 或 BUS 在没有并行写入时生成。Web E2E 独占 `3001`、`5174`、
`apps/nestjs-server/test-e2e.db`、`apps/web/e2e/{playwright-report,test-results}`；SDK Host 独占 `5174` 与自身报告目录；
Vue consumer 独占 `5175` 与自身报告目录。E2E 必须顺序执行。

## 修改文件

- `docs/specs/screen-component-framework-bridges/handoffs/p-gate.md`：P0.4/P0.5 基线与所有权证据。
- `docs/specs/screen-component-framework-bridges/tasks.md`：标记 P0.4/P0.5 完成。
- `docs/specs/screen-component-framework-bridges/checklist.md`：标记实际基线和 owner 表已发布。

## 公共接口与行为

- 无。本闸门不修改运行时代码或公共 API。

## 验证

`P0.4 基线` 中的命令和结果即本路线完整验证记录。

## BUS 延后项

- Web 基线失败的修复、最终 E2E 数据库重置、全仓 build/tarball/E2E 和 lockfile 同步。
- 旧动态 SDK/marker/parser 的物理删除及删除后扫描。

## 删除候选

- 上述旧路径盘点文件。仅登记，后续必须完成 BUS-3 替代测试矩阵后才允许在 BUS-4 删除。

## 风险与阻塞

- Web 的 module-resolution 和 WebServer 启动失败为已知基线失败，G3/BUS 必须修复并重新验证。
- 工作树可能继续接收用户或其他执行者的并发改动。每条路线编辑前必须重新检查状态，并保留不属于自身路径的修改。

## 下游与总线动作

- A、B、C 现在可以按各自文件范围启动；D 在其接口可用后汇聚 core exports；E 汇聚 SDK exports。
- F-Vue、F-React 可以先创建独占 package 外壳，完整 ABI 实现等待 A。
- G1/G2/G3 仍遵循 `tasks.md` 第 14 节依赖图，不能以当前 Web 基线失败为由创建临时公共兼容 API。
- BUS 负责 root manifest、lockfile、目录重命名、数据库重置、文档最终状态与最终质量门。
