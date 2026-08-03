# 并行路线共享执行协议

以下规则适用于 P、A-G 和 BUS 的所有无上下文执行会话。

## 仓库与目标

- 仓库根目录：`C:\Archangel\nebula\nodes-stack`
- 总目标：按 `docs/specs/screen-component-vue-bridge/spec.md` 收敛唯一组件/文档/Adapter/runtime 契约，
  合并为单一 `@nebula/screen-sdk`，并提供普通 Vue 3 SFC 注册桥接。
- 项目处于未发布建设阶段，不承担历史兼容义务；禁止新增 legacy parser、migration、deprecated alias、
  tag alias 或临时双轨公共 API。

## 每个会话的强制开场

在分析或编辑前依次完成：

1. 确认当前工作目录和 Git 工作树状态。
2. 读取根 `AGENTS.md`。
3. 读取 `docs/README.md` 与 `docs/conventions/coding-standards.md`。
4. 读取本共享协议。
5. 完整读取：
   - `docs/specs/screen-component-vue-bridge/spec.md`
   - `docs/specs/screen-component-vue-bridge/tasks.md`
   - `docs/specs/screen-component-vue-bridge/checklist.md`
6. 读取当前路线提示词要求的前置 handoff 和相关源码。
7. 验证前置 handoff 的状态为 `已完成`。缺失、`阻塞` 或 `部分完成` 时停止实施，不猜接口。

## 工作树与并发规则

- 假设用户和其他会话正在同一工作树并发修改文件。
- 不得还原、覆盖、格式化或删除不属于本路线的改动。
- 发现无关并发改动时继续本路线；发现同一所有权文件冲突时停止并报告。
- 只使用 `apply_patch` 手工编辑文件。
- 不执行 `git reset --hard`、`git checkout --`、`git clean` 或其他破坏性命令。
- 不 commit、amend、push、创建 PR，除非用户在当前会话明确要求。
- 不读取、输出或记录 `.env.local` 中的 Token。

## 文件所有权与共享文件

- 严格遵守路线提示词中的独占范围。
- 路线会话不得修改：
  - 根 `package.json`、`pnpm-lock.yaml`、共享 Turbo/CI 配置。
  - 其他路线的实现文件。
  - `tasks.md`、`checklist.md`、active ADR、架构索引。
  - 其他路线的 handoff。
- 路线可以修改自己独占包的 `package.json`，但不得运行会更新 lockfile 的安装命令。
- `screen-editor-core` 的跨路线 barrel、`sdk-contracts.ts` 和最终公共 export 聚合由 BUS 处理。
- `packages/screen-dynamic-sdk/**` 在 BUS-4 前只读；路线不得提前删除或修改。

## 实现与验证规则

- 先读现有实现，沿用仓库模式，不根据提示词臆造不存在的 API。
- TypeScript 保持 strict，不使用 `any`、`@ts-ignore`、`@ts-nocheck` 或不安全断言绕过类型系统。
- 业务约束、转换、判别联合、生命周期和错误分支按 `AGENTS.md` 要求补测试。
- 每条路线运行自己的定向测试和 typecheck；不得运行全仓 `biome:fix`、全仓 lint 或全量质量门。
- 路线只能生成自己独占包/应用的 `dist`、声明和 tarball。E 是唯一例外：A-D 全部停止写入后，E 可执行
  screen SDK staging build 及其 prebuild。
- 不并行运行会写共享 `dist`、占用同一端口、写同一 SQLite 数据库或 Playwright 输出目录的命令。
- 无法安全运行的 build/tarball/E2E 必须在 handoff 标为“BUS 延后验证”，不能伪报通过。
- 测试失败必须先判断是本路线回归、上游未完成还是并发写入；不得通过放宽断言掩盖失败。

## Handoff 规则

- 每条路线只维护提示词指定的 handoff 文件。
- 开始实施后可写 `部分完成`；前置条件不足时可写 `阻塞`；退出条件全部满足后才写 `已完成`。
- handoff 必须遵循 `docs/specs/screen-component-vue-bridge/handoffs/README.md` 模板。
- 至少记录：任务 ID、修改文件、公共 API、验证命令与结果、BUS 延后项、删除候选和风险。
- 最终回复只总结本路线结果、验证和 handoff 路径，不宣称整个规格完成。
