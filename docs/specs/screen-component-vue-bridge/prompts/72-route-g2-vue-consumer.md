# 提示词：路线 G2，Vue Consumer

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行路线 G2。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`，然后从
`docs/specs/screen-component-vue-bridge/handoffs/` 读取 `p-gate.md`、`route-e.md` 和 `route-f.md`。
全部必须为 `状态：已完成`。

## 任务与所有权

- 执行 `tasks.md` 的 G2.1-G2.6。
- 独占修改范围：`apps/dynamic-sdk-vue-consumer/**`。
- 在现有目录内完成源码和 package manifest 迁移；最终目录/package 重命名及 root script 由 BUS 统一处理。
- 不得修改 SDK、Vue bridge、真实组件包、core/shared、root manifest 或 lockfile。
- 交接文件：`docs/specs/screen-component-vue-bridge/handoffs/route-g2.md`。

## 实现要求

1. consumer 只从 `@nebula/screen-sdk`、`@nebula/screen-component-vue` 和真实 Vue 组件包公开入口导入。
2. 删除对 `@nebula/screen-dynamic-sdk`、core private/dynamic entry 和手写 XJ HTMLElement 的 active 依赖。
3. 通过 template ref 设置 registry、Adapter、project/document；registry 必须最先注入。
4. 配置 Vue `isCustomElement`，不使用 app.use 注册 Nebula elements。
5. designer 保存与 viewer 查看同一 canonical document，不在 consumer 内做 V2/V3 normalize。
6. fake adapter 使用通用 host-resource，fixture 至少包含 `resourceType='metric'` 和字符串 resourceId。
7. 覆盖 resource list、context open/sync/close、execute、abort、timeout、error 和 late result。
8. fixture 不得包含真实 XJ URL、Token、headers、SQL 或内部请求结构。
9. 使用 F 的真实 Vue SFC plugin，验证默认 Props、mapModel、Light DOM 样式和 `valueClick` 事件。
10. 添加/更新 Chromium 场景：拖入、编辑、保存、viewer、loading/success/error、interactive=false、删除和卸载。
11. 清理仅由旧 dynamic SDK external 策略要求的 React 类型/运行时依赖，但不得影响实际仍需要的构建依赖。

## 测试与验证

- 尝试运行 `pnpm --filter @nebula/dynamic-sdk-vue-consumer typecheck`，包重命名后将命令登记给 BUS 更新。
- 若新增 workspace 包因 lockfile/node_modules 尚未由 BUS 同步而无法解析，可以标为 BUS 延后；必须记录精确
  module resolution 错误，不能添加临时 alias、private import 或手工 symlink。
- 只有 E/F dist 可用且无并发写入时才运行 consumer build。
- 不与 G1/G3 并行运行 E2E；默认将当前 `e2e` 命令交给 BUS，并记录新 package 名后的目标命令。
- 检查源码没有 private core、dynamic SDK 或旧 contract import。

## 退出要求

使用 `apply_patch` 更新 `route-g2.md`，记录最终建议目录/package 名、公开 imports、fake adapter 行为、E2E
场景、验证结果及 BUS 需要执行的目录重命名、root script、lockfile 和顺序 E2E。不得修改 tasks/checklist。
