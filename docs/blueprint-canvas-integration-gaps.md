# 事件蓝图与画布/组件割裂分析（规格对照修正版）

> 状态：分析完成，含两项待办（缺口 A：P0；缺口 B：P2）
> 创建时间：2026-07-23
> 来源：产品视角割裂评审 + `.trae/specs/event-blueprint/`（spec.md / tasks.md / checklist.md）规格对照修正
> 关联文档：`docs/blueprint-interaction-consistency-plan.md`（交互一致性三缺口，主题不同、互不替代）

## 分析方法

以"事件蓝图是否与画布/组件割裂"为问题，先纯读代码形成初判，再对照 `.trae/specs/event-blueprint/` 三份规格文档逐条校准。结论分三类：

- **设计决策**：spec 明确规定的行为，不算割裂，不改动
- **路线图内未交付**：spec/tasks 已排期（M2/M3），属正常进度，不重复立项
- **真盲区**：规格与实现都缺，需要"先补规格、再补实现"

## 不割裂的部分（数据层耦合已成立）

- 蓝图存于 `project.blueprint`，与组件同一个 editor-store、同一套 undo/redo（`HistoryEntry` 三要素，任务 5.1）、同一条保存/发布链路（任务 5.3）
- 节点标签在渲染时从当前组件列表派生（`blueprint/sheet/blueprint-sheet.tsx:94` `getNodeLabel`），组件改名后蓝图节点标签自动跟随
- 组件被删后，编译器将引用节点标记为 dangling：红边框 + 问题面板条目（`blueprint/compiler/validate.ts:142`），非静默坏掉
- 预览运行时真实执行：`screen-preview.tsx:49` 接入 `useBlueprintPreviewRuntime`，组件点击、pageLoad、显隐/数据 override 均已生效
- 问题面板点击条目可定位并闪烁对应蓝图节点（`blueprint-sheet.tsx:566`）

## 初判修正表（以下不再是"割裂问题"）

| 初判 | 规格依据 | 修正结论 |
|---|---|---|
| 入口单一（仅项目菜单） | spec.md「可视化节点编辑器」："项目菜单入口保持不变"；checklist「入口与全屏弹层容器规格不变」 | 设计决策，不改 |
| 删除组件不级联清理蓝图节点 | spec.md「悬空组件引用」："节点与规则不被静默删除，用户可显式修复或清理" | 非破坏原则，设计决策；但删除时无引用警告仍是体验缺口 → 见缺口 B |
| 双向定位缺失（节点↔组件） | spec.md「双向联动与模板（M2）」+ tasks 9.1/9.2 | 路线图内未交付，不重复立项 |
| 编辑态画布不可试运行 | spec.md「编辑器画布不触发蓝图」+ tasks 8.1-8.3 模拟调试沙盒（M2） | 设计决策 + M2 已排期答案 |

## 缺口 A（P0）：节点绑定组件的 UI 缺失——规格级盲区

### 现状与证据链

代码侧：节点创建时 `componentId` / `targetComponentId` 一律为空串（`blueprint-sheet.tsx:267-283`），注释承诺"由后续属性面板填充"，但该面板不存在：

- trigger / action 节点是纯展示组件，无任何编辑控件（`nodes/trigger-node.tsx`、`nodes/action-node.tsx`）
- 搜索面板只选节点类型，不带组件选择（`panels/search-panel.tsx`）
- 问题面板只诊断、不提供修复入口（`panels/problems-panel.tsx`）
- Sheet 渲染树中没有配置面板（`blueprint-sheet.tsx:603-691`）

规格侧：spec 多处**假设参数会被填上**，但 tasks 没有对应任务：

- spec.md「空参数诊断」要求编译器对未选组件报 error —— 诊断的对象是"用户没填"，隐含"用户可以填"
- checklist「节点增删、连线增删、参数修改、布局拖拽结束各产生一条历史」+ 任务 5.2 实施记录均把"参数修改"列为既有编辑路径 —— 历史语义已就绪，触发它的 UI 不存在
- tasks 9.3 模板插入预绑定节点（未交付）—— 模板也需要绑定能力支撑
- 通读 tasks.md M1（4.x）、M2（8.x/9.x）、M3（10.x）全部任务，无任何"trigger/action 节点参数配置 UI"任务；10.2 表达式构建表单只管 condition 节点

后果闭环是死的：空参数 → 编译器报 `empty-param` error（`validate.ts:134`）→ 规则虽产出但运行时按 componentId 匹配，`''` 永不命中真实组件 → **用户在界面上不可能做出一条可执行的交互**。当前能跑的蓝图只存在于测试与种子数据。这不是"M2 还没到"，是排期里就没有。

### 修复方向（先补规格，再补实现）

1. 规格补遗：`spec.md` 增加"节点参数配置"Requirement；`tasks.md` 新增对应任务（建议作为 M1 补遗插入，优先级高于 M2 全部内容——没有它，M2 的模拟调试、模板、双向联动都没有可作用的对象）；`checklist.md` 同步加验收项
2. 实现分两阶段：
   - **阶段 1（最小闭环，本次）**：蓝图内节点配置面板。选中/双击单个节点时展示，按节点 kind 与 config.type 渲染表单，组件选择项从 `project.components` 派生（显示 name、绑定 id）
   - **阶段 2（随 M2 联动评估）**：画布右键组件"添加事件"→ 自动创建预绑定该组件的 trigger 节点并打开蓝图。与 tasks 9.1/9.2 双向联动天然衔接，届时单独立项

### 执行步骤（阶段 1）

1. 规格：spec.md 增加 Requirement「节点参数配置」；tasks.md 在 §4 后补任务条目（含结果/验证/依赖）；checklist.md「可视化编辑器」区加勾选项
2. `apps/web/src/features/screen/blueprint/panels/node-config-panel.tsx`（新建）：
   - 输入：选中的 RF Node + `project.components`
   - 按 `config.type` 渲染字段：componentClick → 组件单选；setVisibility → 组件单选 + show/hide/toggle；navigate → URL 输入 + target；scrollToComponent / refreshDataSource → 组件单选；pageLoad / comment → 无组件字段（comment 为文本域）
   - 组件下拉显示组件 name、值为 id；当前 id 不在组件列表时显示 dangling 态并保留原值（不静默清空，遵守非破坏原则）
   - 写回：经 `setNodes` 更新该节点 `data.config`，由既有 `useEffect[nodes,edges]` 同步到 `updateBlueprint`，天然单条历史
3. `blueprint/sheet/blueprint-sheet.tsx`：单选节点时展示面板（位置参考右侧浮动或底部问题面板上方，样式复用 `components/ui-primitives/` 的 PanelSection）；多选或选中边时不展示
4. 无需改动 shared Schema（config 契约已存在）与编译器
5. 测试：
   - `node-config-panel.test.tsx`（新建）：各 config.type 表单渲染、选择组件后 config 更新、dangling 值保留
   - `blueprint-sheet.test.tsx`：选中节点出现面板、修改参数后 blueprint 同步、产生单条历史（可复用 editor-store 手势测试的断言方式）

### 验收

- [ ] 新建 componentClick trigger → 面板选择组件 → 节点标签变为"点击：<组件名>"，`empty-param` 诊断与节点标记消失
- [ ] setVisibility / scrollToComponent / refreshDataSource / navigate 参数均可编辑，非法 URL 被 Schema 拒绝
- [ ] 每次参数修改产生且仅产生一条历史，undo/redo 正确恢复
- [ ] 组件被删后面板中该引用显示 dangling 态且原 id 保留，不被清空
- [ ] 保存后重新打开项目，绑定关系仍在；公开预览点击被绑定组件实际触发链路
- [ ] spec.md / tasks.md / checklist.md 三文档同步更新，条目可互相对应
- [ ] `pnpm --filter @nebula/web test` 通过

## 缺口 B（P2）：删除组件时无蓝图引用警告

### 现状

`removeComponent` / `removeSelectedComponents` 只过滤组件数组，不检查蓝图引用（`stores/editor-store.ts:415-442`）。删除后靠 dangling 诊断兜底——非破坏是 spec 设计（见修正表），但"删除瞬间告知引用关系"spec 未覆盖，用户在不知情的情况下制造悬空节点。

### 修复方案

删除动作前检查 `project.blueprint` 中引用待删组件的节点数；>0 时弹确认对话框："该组件被 N 个蓝图节点引用，删除后这些节点将成为悬空引用，需手动修复"。不级联删除、不阻止删除，仅告知。

### 执行步骤

1. `blueprint/lib/`（或 compiler）新增纯函数 `countBlueprintReferences(blueprint, componentIds): number`，引用提取逻辑与 `isNodeDangling` 保持一致（trigger.componentId + action.targetComponentId）
2. 三处删除入口统一前置检查：
   - 键盘 Delete/Backspace（`components/screen-editor.tsx:109/119`）
   - 画布右键菜单"删除选中"（`components/canvas-context-menu.tsx:162`）
   - 属性面板删除按钮（`components/property-panel.tsx:246`）
   建议收敛为一个 `requestRemoveComponents(ids)` 流程函数，三处调用，避免警告逻辑三份拷贝
3. 确认对话框复用 AlertDialog（参考 `components/publish-confirm-dialog.tsx`）
4. 测试：`countBlueprintReferences` 纯函数用例（trigger/action/无引用/多选合并）；删除流程组件测试（有引用弹警告、确认后删除、dangling 出现；无引用不弹）

### 验收

- [ ] 删除被引用组件：弹出警告并显示引用节点数；确认后删除，对应蓝图节点呈 dangling 标记
- [ ] 删除无引用组件：不出现警告，直接删除（不打扰）
- [ ] 取消/ Esc：不删除
- [ ] 键盘、右键菜单、属性面板三处入口行为一致
- [ ] 多选删除时引用数合并统计
- [ ] `pnpm --filter @nebula/web test` 通过

## 附观察：error 级诊断触发器运行时未按 spec 收口

spec.md「诊断与保存发布的关系」要求"错误级诊断对应的触发器在预览运行时不执行"，checklist 对应条目未勾选。代码侧 `compile.ts:73-83` 只排除环 trigger，empty-param 规则仍正常产出；目前靠 `componentId: ''` 匹配不上真实组件"碰巧不执行"，但 `navigate` 空 URL 等 error 节点的运行时行为未显式收口。建议随缺口 A 一并处理（绑定 UI 落地后空参数不再是常态，但仍需在 compile 或 runtime 层显式排除带 error 诊断的规则，落实 spec 语义）。

## 排期建议

| 优先级 | 事项 | 理由 |
|---|---|---|
| P0 | 缺口 A（先规格补遗，再实现节点配置面板） | 主链路断裂：没有它，蓝图功能对用户等于未上线，M2 全部内容失去作用对象 |
| P0 | 附观察（error 规则运行时收口） | spec 已有要求、实现未跟上，改动小，随缺口 A 一起 |
| P2 | 缺口 B（删除引用警告） | 体验缺口，不阻塞主链路，可随时插入 |

## 关联文件清单

| 文件 | 涉及缺口 | 改动类型 |
|---|---|---|
| `.trae/specs/event-blueprint/spec.md` / `tasks.md` / `checklist.md` | A | 规格补遗（Requirement + 任务 + 验收项） |
| `apps/web/src/features/screen/blueprint/panels/node-config-panel.tsx` | A | 新建节点配置面板 |
| `apps/web/src/features/screen/blueprint/sheet/blueprint-sheet.tsx` | A | 选中接线、面板挂载 |
| `apps/web/src/features/screen/blueprint/compiler/compile.ts`（或 runtime） | 附观察 | error 诊断规则排除 |
| `apps/web/src/features/screen/blueprint/lib/` | B | `countBlueprintReferences` 纯函数 |
| `apps/web/src/features/screen/components/screen-editor.tsx` / `canvas-context-menu.tsx` / `property-panel.tsx` | B | 三处删除入口收敛前置检查 |
| 对应 `*.test.ts(x)` | A、B | 新增/更新用例 |

**不改动**：蓝图图结构契约、编译器拓扑/环/悬空语义、运行时动作语义、历史三要素结构、预览接线、M2/M3 已排期任务的既定范围。
