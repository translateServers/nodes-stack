# 提示词：路线 G1，SDK Host 与示例生态

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行路线 G1。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`，然后从
`docs/specs/screen-component-vue-bridge/handoffs/` 读取 `p-gate.md`、`route-a.md` 和 `route-e.md`。
全部必须为 `状态：已完成`。

## 任务与所有权

- 执行 `tasks.md` 的 G1.1-G1.5。
- 独占修改范围：
  - `apps/screen-sdk-host/**`
  - `packages/indicator-card-vanilla/**`
  - `packages/component-lab-host/**`
- 可以修改这些包自己的 manifest，不得修改 root manifest、lockfile、SDK/core/shared/Vue 包或其他 consumer。
- 交接文件：`docs/specs/screen-component-vue-bridge/handoffs/route-g1.md`。

## 实现要求

1. 将 SDK Host 从旧 editor API 迁移到 canonical designer/viewer 公开入口。
2. registry 必须在 Adapter、project 或 document 触发 load 前设置；不得依赖偶然的 module import 顺序。
3. Host 的 load/save/publish/viewer/whenReady 与 E handoff 一致，并保留双实例隔离。
4. 将 Vanilla 指标卡和 component lab 迁移到唯一 Manifest/Model/Event，移除 active dynamic/V2 假设。
5. registry 仍负责 Custom Element 全局 commit；同 tag/同构造器可复用，不同构造器 fail closed。
6. 保持 Vanilla 与 component lab 对 Vue 零依赖，不为方便测试引入 Vue。
7. 不直接导入 core private entry，不复制 SDK element 类型。
8. 添加/更新 E2E 场景：组件库、拖入、属性更新、保存、viewer、事件和双实例 registry。

## 测试与验证

- 运行 Vanilla/component lab 的现有 test/typecheck/lint（以实际 package scripts 为准）。
- 运行 `pnpm --filter @nebula/screen-sdk-host typecheck`。
- 只有 E 已提供可用 dist 且不会与其他会话写同一产物时才运行 Host build。
- G1/G2/G3 源码可并行，但三套 E2E 不得在共享端口/输出上并行。默认把
  `pnpm --filter @nebula/screen-sdk-host e2e` 交给 BUS 顺序执行，并在 handoff 记录。
- clean Vanilla consumer 的最终“未安装 Vue”验证由 BUS 使用最终 screen SDK tarball 执行。

## 退出要求

使用 `apply_patch` 更新 `route-g1.md`，记录 Host API 使用、registry 时序、示例包迁移、验证结果和 BUS 延后
的 build/E2E/tarball 项。不得修改 tasks/checklist。
