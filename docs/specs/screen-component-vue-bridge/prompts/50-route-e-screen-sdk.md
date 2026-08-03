# 提示词：路线 E，合并为单一 Screen SDK

你正在仓库 `C:\Archangel\nebula\nodes-stack` 中执行路线 E。当前会话没有历史上下文。

先完整执行
`docs/specs/screen-component-vue-bridge/prompts/00-shared-protocol.md`，然后从
`docs/specs/screen-component-vue-bridge/handoffs/` 读取 `p-gate.md`、`route-a.md`、`route-b.md`、
`route-c.md`、`route-d.md`、`route-f.md`。全部必须为 `状态：已完成`。

## 任务与所有权

- 执行 `tasks.md` 的 E1-E4。
- 独占修改范围：`packages/screen-sdk/**`。
- `packages/screen-dynamic-sdk/**` 只读，不得删除、改名或修改。
- 不得修改 core/component/shared/Vue/consumer、root manifest 或 lockfile。
- 交接文件：`docs/specs/screen-component-vue-bridge/handoffs/route-e.md`。

## 实现要求

1. 先审计静态 SDK 与 dynamic SDK 的 element、base element、runtime loader、styles、events、contracts、
   testing 和 bundle 策略，建立逐入口替代映射。
2. 在 screen SDK 中只公开 `<nebula-screen-designer>` 与 `<nebula-screen-viewer>`。
3. designer/viewer 挂载 D 的完整 canonical runtime，不迁入简化 designer 或 no-op 方法。
4. element property、registry/Adapter/project/document 注入顺序、`whenReady`、save/publish 和错误事件严格遵循
   P/D handoff。
5. SDK 保持对 Vue 零依赖，并延续可独立安装的实现打包策略，不在产物中留下 private core 裸 import。
6. root、`auto-register`、`components`、`contracts`、`testing` 形成唯一公开入口。
7. `auto-register` 只注册 canonical elements；`testing` fixture 不进入正常 runtime chunk。
8. contracts 只重导出 B 的唯一 schema/Zod/JSON Schema，不复制实现。
9. active SDK 不再提供 `<nebula-screen-editor>` alias，但旧文件的物理删除登记给 BUS-4。
10. 不修改 dynamic SDK 来让测试通过；以 P baseline 和源码映射作为替代核对依据。

## 测试与验证

- 覆盖 element define、loader、properties、`whenReady`、双实例、卸载和 public exports。
- 运行不会写其他路线产物的命令：
  - `pnpm --filter @nebula/screen-sdk check:boundaries`
  - `pnpm --filter @nebula/screen-sdk test`
  - `pnpm --filter @nebula/screen-sdk typecheck`
  - `pnpm --filter @nebula/screen-sdk lint`
- E 是 staging build owner。确认 A-D/F 已完成且停止写入后，执行 `pnpm --filter @nebula/screen-sdk build`；
  该命令会 prebuild shared/component/core，执行期间不得与其他 build 并行。
- staging build 通过后运行 dist boundary、size 和 `verify:tarball`；BUS 仍会基于最终 lockfile 重跑。
- 不运行 consumer E2E。

## 退出要求

使用 `apply_patch` 更新 `route-e.md`，记录 canonical elements、公共 exports、打包边界、每个 dynamic SDK
入口的替代位置、staging build/验证结果和 BUS 重跑命令。staging build 未通过时不得写 `状态：已完成`。
不得修改 tasks/checklist。
