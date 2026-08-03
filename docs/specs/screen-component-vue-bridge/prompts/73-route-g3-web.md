# 提示词：路线 G3，Web Consumer

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行路线 G3。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`，然后从
`docs/specs/screen-component-vue-bridge/handoffs/` 读取 `p-gate.md`、`route-b.md`、`route-d.md` 和
`route-e.md`。全部必须为 `状态：已完成`。

## 任务与所有权

- 执行 `tasks.md` 的 G3.1-G3.6。
- 独占修改范围：`apps/web/**` 中的大屏接入、Host Adapter、测试和 Docker workspace manifest 清单。
- 不得手工修改 `src/routeTree.gen.ts`。
- 不得修改后端/shared/core/SDK/Vue 包、root manifest 或 lockfile。
- 交接文件：`docs/specs/screen-component-vue-bridge/handoffs/route-g3.md`。

## 实现要求

1. 严格遵循 P handoff 对 Web 边界的决策：使用 canonical designer/viewer，或使用被明确冻结的内部组合
   边界。不得自行选择第三条路径。
2. 保留 Monaco component JSON editor、鉴权、React Query 保存发布、preview、冲突处理和现有编辑能力。
3. 若 P 决定通过 designer element 注入 Monaco，使用冻结的公开 port/property，不向 SDK 注入 React
   component 私有类型。
4. Web Host Adapter 直接读写 B 的 canonical document，不再临时投影 V2 或拆装另一套 DTO。
5. registry、Adapter、project/document 时序与 SDK Host 一致，registry 在 load 前设置。
6. 编辑、preview、发布查看使用同一 parser、events 和 interactive 语义。
7. 删除 active legacy/dynamic/V2/V3 import 和 normalize；旧源码候选登记给 BUS-4。
8. 更新 Web Dockerfile 的 workspace package manifest 缓存清单，使最终依赖图在容器安装阶段完整。
9. 不修改 route tree 生成物，不做无关 UI 重构。
10. 更新 Vitest/Playwright 场景：保存发布、preview、数据源、蓝图、JSON editor 和错误路径。

## 测试与验证

- 运行相关 Web Vitest 定向测试。
- 运行 `pnpm --filter @nebula/web typecheck` 和 `pnpm --filter @nebula/web lint`。
- 只有不会与其他路线写依赖 dist 时才运行 Web build。
- 不与 G1/G2 并行运行 E2E。默认将 Web E2E 交给 BUS 顺序执行，handoff 中列出必须运行的具体 spec。
- 检查 Web 源码不再构造 V2/V3 document，不直接导入 private core（P 明确保留的内部边界除外）。

## 退出要求

使用 `apply_patch` 更新 `route-g3.md`，记录 P 决策的落实方式、Monaco 保留证据、canonical persistence、
Docker 变化、验证结果和 BUS 延后 E2E。不得修改 tasks/checklist。
