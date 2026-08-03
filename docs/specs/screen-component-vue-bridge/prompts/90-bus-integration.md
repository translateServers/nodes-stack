# 提示词：BUS 最终总线汇聚

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行最终总线 BUS-0 至 BUS-5。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`。BUS 是共享文件唯一负责人，可以在完成
审计后修改 root manifest、lockfile、跨路线 barrel、tasks/checklist、ADR、active 文档和 BUS-4 删除范围。

## 强制前置

从 `docs/specs/screen-component-vue-bridge/handoffs/` 完整读取以下 handoff：

- `p-gate.md`
- `route-a.md`
- `route-b.md`
- `route-c.md`
- `route-d.md`
- `route-e.md`
- `route-f.md`
- `route-g1.md`
- `route-g2.md`
- `route-g3.md`

全部必须为 `状态：已完成`，且确认其他路线会话已经停止写文件。任一缺失、阻塞或部分完成时，不实施
总线，不替路线补做隐藏工作；准确报告缺失项。

## BUS-0：收集与审计

1. 读取最新 Git 状态和全部相关源码，不能只相信 handoff 摘要。
2. 核对每条路线的文件所有权、公共 API、测试结果、BUS 延后项和删除候选。
3. 识别并保留用户或其他执行者的无关改动；同一文件发生冲突时先理解再整合，不还原。
4. 拒绝临时兼容层、重复公共类型、private source import、双 marker/parser/runtime 和未记录越界修改。
5. 根据证据实时更新 `tasks.md` 和 `checklist.md`，不要一次性提前全勾选。

## BUS-1：契约与包图汇聚

1. 先汇聚 A/B/C 的正式 exports，确认只存在一个 Manifest、Model、Document 和 Host Adapter。
2. 更新 core contracts barrel、`sdk-contracts.ts`、SDK contracts 重导出和 JSON Schema 生成入口。
3. 汇聚 D/E/F 的包 manifests 和 public exports，检查 Vue 只作为 bridge peer，不进入 Vanilla/SDK 依赖图。
4. 落地 G2 的目录/package 重命名和所有 root scripts/workspace references。
5. 统一更新 root/package manifests 后执行初次 workspace/lockfile 同步，使新增包和 G2 依赖可解析；不手工
   编辑 `pnpm-lock.yaml`。
6. 检查 Node/pnpm 与 P 决策一致；不静默切换工具版本。
7. 运行 component SDK、shared、core、Nest screen、Vue bridge、screen SDK 的定向 typecheck/test。

## BUS-2：运行时与消费者汇聚

1. 验证 designer/viewer 共用唯一 parser、registry、Adapter、renderer 和 data coordinator。
2. 验证 registry 在 document/project load 前注入，`whenReady` 不在 parse/render/data context 前成功。
3. 验证后端、Web Adapter、SDK Host 和 Vue consumer 读写同一种 canonical document。
4. 验证 Web Monaco、鉴权、保存发布、preview 和冲突处理没有丢失。
5. 修复只在跨路线组合时出现的问题，但不得扩展 Spec 或恢复旧兼容入口。

## BUS-3：替代证据

1. 完成 Vanilla、React Host、Vue Host clean consumer 矩阵；Vanilla consumer 不安装 Vue。
2. 完成 design/preview/viewer、interactive、static/host-resource、event/action、save/reload 矩阵。
3. 完成 delete/unmount/reconnect、abort/timeout/late result 和双实例 registry 矩阵。
4. 将旧 marker、字段和数据源 fixture 保留为 strict parser 负向回归测试。
5. 扫描源码、生成声明和 tarball，确认新入口不引用 dynamic SDK、旧 subpath 或 private core 源路径。
6. 每条旧路径必须有新路径测试证据；证据不足时返回对应路线，不进入 BUS-4。

## BUS-4：物理删除与开发数据重置

1. 删除 component SDK dynamic subpath、V2 API/model、版本 validator 分支和对应 active aliases。
2. 删除 core Legacy/V1/V2/V3 parser、normalization、migration、dynamic entry 和 runtime profile 分流。
3. 删除 `@nebula/screen-dynamic-sdk`、旧 consumer dependency、构建任务和 lockfile reference。
4. 删除旧 `<nebula-screen-editor>` 公开实现和 tag alias。
5. 按 P handoff 确认的“重置而非迁移”策略处理开发/E2E fixture、snapshot 和数据库。
6. 任何会删除/重建 SQLite 文件或执行破坏性 Prisma 操作的命令，必须已有用户明确确认；不得触碰生产数据。
7. 不创建迁移脚本。若发现已发布数据或外部消费者兼容义务，立即停止并更新 Spec/ADR。
8. 删除旧 package 后再次生成最终 lockfile，并扫描 active 源码、exports、声明和 tarball 的旧引用。

## BUS-5：最终质量门与文档

按顺序执行并记录真实结果：

1. 检查工作树是否含本 feature 之外的用户改动。存在时先请求用户授权全仓写型检查，或在仅含本 feature
   变更的隔离 worktree 执行；不得直接格式化无关改动。
2. 冻结安装和 Prisma generate/validate。
3. `pnpm biome:fix`
4. `pnpm biome:check`
5. `pnpm typecheck`
6. `pnpm lint`
7. lint 有写入时再次运行 `pnpm biome:fix` 与 `pnpm biome:check`。
8. `pnpm test`
9. `pnpm build`
10. `pnpm --filter @nebula/screen-sdk size`
11. 顺序运行 component SDK、Vue bridge、screen SDK 的 `verify:tarball`。
12. 使用隔离端口、数据库和 report，顺序运行 SDK Host、Vue consumer、Web Chromium E2E。
13. 运行删除扫描、tarball 内容扫描、`git diff --check` 和 `git status --short`。

任一失败必须修复并从受影响门重新执行。不要因为失败来自“历史代码”就忽略，除非 P baseline 已明确记录且
本变更没有扩大影响；这种残余风险必须由用户确认。

最后更新组件作者指南、架构、开发指南、superseding ADR、规格索引、tasks/checklist 和 Spec 状态。只有全部
验收项真实通过时才能改为“生效中”。

使用 `apply_patch` 创建
`docs/specs/screen-component-vue-bridge/handoffs/bus.md`，记录最终文件、质量门结果、删除扫描、残余风险和
工作树状态。除非用户明确要求，不 commit 或 push。
