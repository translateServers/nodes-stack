# 提示词：P 闸门，评估、决策与冻结

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行“大屏统一组件契约与 Vue 3 注册桥接”的
串行开工闸门 P。当前会话没有任何历史对话上下文，必须完全依赖仓库文件恢复上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md` 的强制开场和安全规则。

## 目标

完成 `tasks.md` 的 P0.2-P0.5，使路线 A、B、C 可以安全并行启动。P0.1 的只读评估已经完成，但你必须
核对其结论是否仍符合最新工作树。不得在本会话实现路线 A-G 的业务代码。

## 允许修改

- `docs/specs/screen-component-vue-bridge/spec.md`
- `docs/specs/screen-component-vue-bridge/tasks.md`
- `docs/specs/screen-component-vue-bridge/checklist.md`
- `docs/specs/screen-component-vue-bridge/handoffs/p-gate.md` 与必要的 prompt 导航
- `docs/decisions/**` 及其索引
- 因决策变化必须同步的 active 架构/规格索引

不得修改业务源码、package manifest、lockfile 或数据库文件。P0.4 基线命令可以生成 disposable `dist`、
tarball 和 Playwright 结果，但必须先记录既有产物状态，不得把它们提交为实现交付或删除他人产物。

## 执行步骤

1. 读取 P0.1 评估结论、现行 ADR、shared/core 文档契约、Screen Service、Web Adapter、Monaco 注入点、
   Node/CI 配置和各 package scripts，确认七个未决项的最新证据。
2. 对以下决策逐项给出推荐方案、替代方案和影响，并向用户取得明确确认：
   - 唯一 wire `ScreenDocumentSchema` 的代码归属。
   - 固定 marker 与旧 V1 同值输入的语义和拒绝矩阵。
   - canonical document 的 API DTO、Prisma 存储和开发/E2E 数据重置方式。
   - host-resource 下的 dataset 引用所有权。
   - Web Monaco editor 的 designer 注入边界。
   - 真实 Vue 指标卡的目录名与 npm package 名。
   - 本地、CI、文档统一采用的 Node/pnpm 版本。
3. 未得到用户确认前，不得猜测或把推荐方案写成生效决策。可以把 handoff 写为 `阻塞` 并准确记录问题。
4. 确认后更新 Spec，新增 superseding ADR，更新冲突 ADR 状态和对应索引。不得改变用户未确认的产品范围。
5. 在文档中冻结以下精确签名和行为：Manifest、Element Model、Document、Host Adapter、renderer ABI、
   designer/viewer properties、`whenReady`、Vue bridge API、JSON/错误边界。
6. 发布精确文件 owner 表，至少覆盖路线 A-G、跨路线 barrel、root manifest、lockfile、数据库和 E2E 产物。
7. 建立基线。先确认没有其他路线正在运行，再顺序执行当前存在的定向命令：
   - `pnpm --filter @nebula/screen-component-sdk test`
   - `pnpm --filter @nebula/screen-editor-core test`
   - `pnpm --filter @nebula/screen-sdk test`
   - `pnpm --filter @nebula/screen-dynamic-sdk test`
   - 依次 build component SDK、screen SDK、dynamic SDK，再分别运行其 `verify:tarball`；不得复用未知来源的
     既有 `dist`
   - `pnpm --filter @nebula/screen-sdk-host e2e`
   - `pnpm --filter @nebula/dynamic-sdk-vue-consumer e2e`
8. E2E 必须顺序执行并隔离其输出。执行前检查 Playwright `reuseExistingServer`，使用 `CI=1` 或等效方式
   强制启动当前工作树服务，并确认目标端口空闲；端口被占用时不得擅自终止未知进程。不得修改或输出敏感
   环境变量。失败要区分历史基线失败和环境失败。
9. 记录 `node --version`、`pnpm --version`、端口/数据库限制及未运行原因。不得为了让基线变绿而修改业务代码。
10. 只有决策、接口、owner 和基线都有证据时，才能勾选 P0.2-P0.5 与 checklist 第 0 节对应项。
11. 使用 `apply_patch` 创建或更新
    `docs/specs/screen-component-vue-bridge/handoffs/p-gate.md`。

## 完成标准

- `p-gate.md` 状态为 `已完成`，并包含全部冻结决策、接口摘要、owner、基线命令和结果。
- Spec/ADR/tasks/checklist 相互一致。
- 没有业务源码改动，没有临时兼容方案，没有伪报测试通过。
- `git diff --check` 通过；最终回复列出仍需用户处理的外部环境问题。
