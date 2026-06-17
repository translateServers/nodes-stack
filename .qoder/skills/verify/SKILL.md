---
name: verify
description: 运行全量类型检查、ESLint 检查和测试，验证代码变更的正确性。在用户要求验证代码、确认修改正确、或在完成较大改动后使用。
---

## /verify

运行完整的验证流水线，确认代码变更没有引入类型错误、lint 问题或测试失败。

### 步骤

1. **类型检查** — 运行 `pnpm typecheck`，检查所有包的 TypeScript 类型错误
2. **ESLint 检查** — 运行 `pnpm lint`，检查代码规范和潜在问题
3. **测试** — 运行 `pnpm test`，执行所有包的单元测试（turbo 会先构建依赖）

### 行为规则

- 按顺序执行：typecheck → lint → test，任一步骤失败时立即报告错误，不继续后续步骤
- 如果 typecheck 或 lint 失败，展示具体的错误信息并建议修复方案
- 如果 test 失败，展示失败的测试用例和错误详情
- 全部通过时，简要报告验证结果（通过数量、耗时）
- 如果只想验证特定包，可以接受参数：`/verify web` 或 `/verify server`
  - `web` → `pnpm --filter @nebula/web typecheck && pnpm --filter @nebula/web lint && pnpm --filter @nebula/web test`
  - `server` → `pnpm --filter @nebula/nestjs-server typecheck && pnpm --filter @nebula/nestjs-server lint && pnpm --filter @nebula/nestjs-server test`
