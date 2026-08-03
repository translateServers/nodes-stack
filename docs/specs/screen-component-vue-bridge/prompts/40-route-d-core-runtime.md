# 提示词：路线 D，统一 Core Runtime

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行路线 D。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`，然后从
`docs/specs/screen-component-vue-bridge/handoffs/` 读取以下 handoff：

- `p-gate.md`
- `route-a.md`
- `route-b.md`
- `route-c.md`

四个文件都必须为 `状态：已完成`。缺少任一项时停止，不复制临时类型到 core。

## 任务与所有权

- 执行 `tasks.md` 的 D1-D4。
- 以 P owner 表为准，逻辑范围包括 core registry renderer、Custom Element renderer、registry event、host
  controller、host/editor workbench、canvas、preview 和 blueprint runtime 集成文件及测试。
- 不得修改 A-C 的契约声明源、screen SDK、Vue 包、consumer、root manifest 或 lockfile。
- 交接文件：`docs/specs/screen-component-vue-bridge/handoffs/route-d.md`。

## 实现要求

1. 先读取 A/B/C handoff 中的唯一 Model、Document、Adapter、dataState 和错误语义，不重新定义同名接口。
2. design、preview、viewer 都构造同一种 model，显式传递 mode 与 interactive。
3. props/style/size/mode/interactive/dataState 更新复用同一 Custom Element；实际节点稳定填满容器。
4. 删除 active renderer 中按 API 版本、document 版本或字段存在性分流的逻辑，旧文件只登记 BUS-4 候选。
5. core listener 在 payload 校验和蓝图执行前读取当前可信 interactive；false 时必须短路。
6. 保留可信 component id、manifest event allowlist、detached JSON 和脱敏日志。
7. 修复 preview 未显式传 mode/interactive，以及 viewer 缺事件 Provider 导致标准事件不工作的路径。
8. 以完整 `ScreenEditorWorkbench` 为 canonical designer；不得迁入 dynamic designer 的 no-op undo/redo。
9. designer/viewer 复用唯一 parser、registry、Adapter、renderer 和 data coordinator。
10. `whenReady` 按 P 决策等待 registry、document parse、render 和所需 data context，不提前 resolve。
11. 保存、发布、快照、导入导出和 viewer 使用同一 document；runtime dataState 不写入 document/history。
12. 保持 registry 实例隔离、属性面板和蓝图动作闭环，并加固 dataLoaded/refreshData 反馈循环。

## 测试与验证

- 覆盖 mode、interactive、stable element、host size、dataState、清理、viewer event 和双 registry。
- 新增 host controller/workbench 直接集成测试，不只依赖 E2E。
- 运行适用的定向测试：
  - `pnpm --filter @nebula/screen-editor-core test -- src/registry/custom-element-renderer.test.tsx`
  - registry factory/instance/derive 测试
  - blueprint component event/runtime deps 测试
  - 新增 host controller/workbench 测试
  - `pnpm --filter @nebula/screen-editor-core typecheck`
  - `pnpm --filter @nebula/screen-editor-core lint`
- 不运行 screen SDK build 或 consumer E2E，这些属于 E/G/BUS。

## 退出要求

使用 `apply_patch` 更新 `route-d.md`，记录 renderer ABI、`whenReady`、事件总闸门、完整 designer/viewer
装配点、验证结果和 BUS-4 删除候选。不得修改 tasks/checklist。
