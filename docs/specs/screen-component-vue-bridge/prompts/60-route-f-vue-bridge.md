# 提示词：路线 F，Vue Bridge 与真实组件

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行路线 F。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`，然后从
`docs/specs/screen-component-vue-bridge/handoffs/` 读取 `p-gate.md` 和 `route-a.md`。两者必须为
`状态：已完成`。确认 P 已冻结真实 Vue 指标卡包名；未冻结时停止询问，不自行命名。

## 任务与所有权

- 执行 `tasks.md` 的 F1-F5。
- 独占修改范围：
  - 新 `packages/screen-component-vue/**`
  - P handoff 指定的真实 Vue 指标卡包目录
- 可以修改这两个包自己的 manifest，但不得修改 root manifest、lockfile、screen SDK、core 或 consumer。
- 交接文件：`docs/specs/screen-component-vue-bridge/handoffs/route-f.md`。

## 实现要求

1. 先读取 component SDK 的实际公开 ABI，不导入 private 源路径或已退出 active API 的 dynamic subpath。
2. `@nebula/screen-component-vue` 只依赖 component SDK；Vue `^3.5.0` 必须是 peer dependency。
3. boundary 禁止 screen SDK、core、React、Router、Pinia、i18n 和 UI 组件库。
4. `defineVueScreenComponent()` 接收冻结的 manifest、Vue Component、mapModel、events 和 shadowRoot。
5. 使用 Vue `defineCustomElement()`，不手写 createApp 生命周期，不调用 `customElements.define()`。
6. helper 只创建一次构造器，重复 `plugin.define()` 返回同一引用；注册 commit 仍由 registry 负责。
7. 默认映射仅把 `model.props` 作为业务 SFC props；mapModel 可读完整 readonly model。
8. 首个 model 前不渲染业务组件，后续更新保持同一 Vue 实例和 Custom Element。
9. event map key 必须来自 manifest；支持同名、别名、零参数、单参数和显式多参数 mapper。
10. mapper 输出复用 A 的 detached JSON/UTF-8/error 边界，派发标准 `{ name, payload? }` 事件。
11. 默认 Light DOM，验证普通 SFC scoped CSS；Shadow DOM 显式启用并支持 `.ce.vue` 或 styles。
12. 验证 disconnect、同步 move、reconnect、onUnmounted，以及卸载后不再派发事件或处理数据。
13. 创建真实普通 `.vue` 指标卡，覆盖 Props、mapModel、static/metric host-resource 和 `valueClick` 事件。
14. 画布组件使用原生 HTML/SVG/CSS，不引入 shadcn/ui。

## 测试与验证

- 使用真实 Vue component 覆盖 constructor、Props、mapModel、events、Light/Shadow DOM 和 lifecycle。
- 验证公共声明无 `any`、private Vue 类型和 private core 路径。
- 运行两个新包各自的 test/typecheck/lint/build。
- 运行 `pnpm --filter @nebula/screen-component-vue verify:tarball`；consumer 必须显式安装 Vue peer。
- 不更新 lockfile。若当前 lock 无法解析新 workspace 包，记录为 BUS 延后，不执行 install。

## 退出要求

使用 `apply_patch` 更新 `route-f.md`，记录 package 名、bridge API、事件/样式/生命周期语义、真实 SFC
插件、验证结果和 BUS 所需 manifest/lockfile 动作。不得修改 tasks/checklist。
