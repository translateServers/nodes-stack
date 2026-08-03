# 大屏统一组件契约与 React 19、Vue 3 注册桥接实施任务

> 状态：设计中
> 最近更新：2026-08-03
> 定位：在真实依赖评估基础上，将 [spec.md](./spec.md) 编排为组件契约、React/Vue 桥接、消费者与最终总线汇聚路线
> 实施状态：只读评估、决策与接口已冻结；可复现基线、精确文件/命令 owner 表和 P handoff 待完成

## 1. 评估结论

### 1.1 当前拓扑

- 当前不是一套 core 加两个轻量外壳，而是三条不同装配路径：
  - `@nebula/screen-sdk` 的静态 `<nebula-screen-editor>` 路径。
  - `apps/web` 直接组合 `screen-editor-core` 的路径。
  - `@nebula/screen-dynamic-sdk` 的独立 designer/viewer 与 V3 数据运行时路径。
- 当前至少存在三套文档表达：
  - `packages/shared` 的后端持久化文档。
  - `screen-editor-core` 的 Legacy/V1/V2 文档与 parser。
  - `screen-editor-core/dynamic` 的 V3 文档与 parser。
- Web Adapter 是后端持久化文档与 SDK 文档的实际转换点；只修改 core 契约无法完成统一。
- dynamic designer 不是完整 designer 的等价实现，缺少完整组件库、属性面板和蓝图闭环，不能直接作为
  canonical designer 迁入。
- Vue consumer 当前只是 Vue 宿主，注册的仍是手写 HTMLElement，不构成 Vue SFC bridge 验证证据。
- Web 当前是 React 宿主，但 registry 只注册 Vanilla Custom Element，不构成 React bridge 验证证据。

### 1.2 并行性判断

- 原“阶段 0 → 9”全串行计划过于保守，但把所有任务同时启动同样不安全。
- 契约决策冻结后，第一波最多安全并行以下工作：组件 ABI、唯一文档/持久化、Host 数据、SDK 外壳准备、
  React/Vue 包外壳准备。
- Core renderer、workbench 和蓝图集成必须消费冻结后的 Manifest、Element Model、Document 和 Adapter，
  不能与这些接口的反复改名并行。
- SDK Host、Vue consumer、Web 可在 canonical designer/viewer API 可用后分为三个互不写同一目录的子路线；
  Vue consumer 依赖 Vue bridge，Web 依赖 React bridge。
- 同一工作区内不得并行执行会写共享 `dist`、固定 5174 端口、固定 `test-e2e.db` 或 Playwright
  report 目录的 build/tarball/E2E；需要并行时必须使用隔离 worktree、端口、数据库和输出目录。

### 1.3 当前阻塞项

- P0.4 的定向测试、tarball 和 E2E 基线尚未运行，不能区分历史失败与后续路线回归。
- P0.5 当前只有逻辑所有权草案，尚未补齐逐文件清单、路线命令和隔离临时目录。
- `handoffs/p-gate.md` 尚未形成完整基线证据，因此任何实现路线仍不得启动。
- 基线执行前必须确认没有其他路线写共享 dist、5174 端口、E2E SQLite 或 Playwright 输出目录。
- 后续 BUS-4 若需要删除或重建 SQLite，仍需在执行时取得用户明确确认；当前规划不授权破坏性操作。

### 1.4 评估证据边界

- [x] 已完成源码、包依赖、测试资产、持久化路径、共享写入点和删除前置证据的只读评估。
- [ ] 尚未运行基线测试、构建、tarball verifier 或 E2E；不得把历史报告当作本次通过记录。
- [ ] P 总闸门尚未关闭；在 P0.4 与 `p-gate.md` 完成前，任何实现路线不得启动或补充兼容分支。

## 2. 执行模型

### 2.1 总体规则

- 先完成串行闸门 P，再按依赖启动路线 A-E、F-Vue、F-React 与 G1-G3，最后由唯一总线负责人执行
  BUS-0 至 BUS-5。
- 每条路线只修改自己的文件所有权范围；需要修改跨路线文件时，将需求交给第 3.1 节指定的 D、E 或 BUS
  owner，不能一律延后到总线。
- 单元测试跟随所属路线实现，不再集中到最后补写。
- 路线完成只代表局部交付，不代表可删除旧路径或发布。
- 项目不承担历史兼容义务，禁止新增 legacy parser、migration、deprecated alias 或 tag alias。
- 旧输入 fixture 应转换为拒绝性回归测试，不应随旧 parser 一并删除。
- 路线执行者不得直接勾选本文件或 [checklist.md](./checklist.md)；由总线负责人根据交接证据实时更新，
  避免并行修改同一文档。

### 2.2 共享写入与产物所有权

共享文件由第 3.1 节指定 owner 单写；未明确分配的根级与最终发布文件默认由 BUS 处理：

- 根 `package.json`、`pnpm-lock.yaml`、共享 Turbo/CI 配置。
- `screen-editor-core` 跨路线 barrel 与 `sdk-contracts.ts` 由 D 在 A/B/C handoff 完成后统一汇聚；BUS 只做最终审计。
- 路线只能生成自己独占包的 `dist`、声明和 tarball；P 基线与 BUS 可生成跨包产物。
- E 在 A-D 已停止写入后负责一次 screen SDK staging build，可由其 prebuild 刷新 A-D 的依赖产物。
- Prisma 开发/E2E 数据库文件、Playwright report 与 test-results；仅 P 基线或 BUS 可写入。
- 本文件、`checklist.md`、active ADR、架构文档和文档索引状态；仅 P 决策或 BUS 可修改。
- 全仓 `pnpm biome:fix`、带写入行为的 lint/fix 与 lockfile 更新。

路线可以修改自己独占包的 `package.json`，但不得运行会同时改写 `pnpm-lock.yaml` 的安装命令。

### 2.3 路线交接格式

每条路线必须按 [handoff 模板](./handoffs/README.md) 将报告持久化到独立文件，不能只留在会话聊天记录中。
报告必须包含：

- 已完成任务 ID 与未完成项。
- 实际修改文件清单及越界文件需求。
- 新增或变更的公共 API、运行时假设和错误语义。
- 已执行命令、结果和未执行原因。
- 仍需 D、E 或 BUS 解决的集成问题，并标明目标 owner。
- 可删除旧路径清单及对应替代测试证据。

### 2.4 执行入口

- 所有路线直接以本文对应任务段、[spec.md](./spec.md)、[checklist.md](./checklist.md) 和上游 handoff 为依据。
- `p-gate.md` 为 `已完成` 后才能启动 A/B/C；其余路线严格遵循第 14 节依赖图。
- 路线执行者只更新自己的 handoff，不修改本文件或 checklist。
- BUS 必须读取 P、A-E、F-Vue、F-React、G1-G3 的全部 handoff，并确认其他路线停止写入后再启动。

## 3. 串行闸门 P：评估、决策与冻结

- [x] P0.1 完成只读现状评估
  - 盘点 component contract、shared document、core V1/V2/V3、Adapter、runtime、SDK 和消费者调用链。
  - 盘点 tarball、E2E、数据库、active 文档和共享写入冲突。
  - 确认当前不具备删除 `screen-dynamic-sdk` 或 legacy parser 的证据。
  - _Requirements: R1, R2, R10, R11, R15_

- [x] P0.2 关闭架构决策
  - 决定唯一 wire `ScreenDocumentSchema` 的代码归属，禁止 shared/core 各保留一套。
  - 明确固定 marker 与历史同值输入的语义及拒绝矩阵。
  - 明确后端 canonical document 的 API DTO、Prisma 存储与开发数据重置方式。
  - 明确 host-resource 下的 dataset 引用所有权，不保留隐式旧 `dataset` 分支。
  - 明确 Web Monaco editor 的 designer 公开注入边界。
  - 冻结真实 React/Vue 指标卡的目录名与 npm package 名。
  - 统一本地、CI 和文档要求的 Node/pnpm 版本。
  - 新增 superseding ADR，并同步修正与目标冲突的 active ADR 状态。
  - _Requirements: R1, R2, R3, R10, R11, R15_

- [x] P0.3 冻结跨路线接口
  - 冻结 `ScreenComponentManifest`、`ScreenComponentElementModel` 和标准事件 detail。
  - 冻结 `ScreenDocument`、`static | host-resource`、registry-aware parser 输入输出和 JSON Schema 归属。
  - 冻结 `ScreenHostAdapter.data`、resource intent、context 生命周期、错误 reason 和响应边界。
  - 冻结 renderer 的 `mode`、`interactive`、`dataCapability`、`dataState` 必填语义。
  - 冻结 designer/viewer property、`whenReady`、registry 注入时序和 Monaco 扩展点。
  - 冻结 `defineReactScreenComponent()`、`defineVueScreenComponent()`、event map、Light/Shadow DOM 和生命周期语义。
  - _Requirements: R1-R9, R11-R15_

- [x] P0.4 建立可复现基线
  - 记录当前 Git 状态，不覆盖用户或其他路线的已有改动。
  - 运行现有 component SDK、core、screen SDK、dynamic SDK 的定向测试和 tarball baseline。
  - 运行 Web 当前大屏定向 Vitest、typecheck、build 与 Chromium E2E，记录 Monaco、保存发布、preview、
    component registry 和蓝图路径的已知失败。
  - 顺序运行现有 SDK Host、Vue consumer 与 Web E2E，隔离端口、数据库、report 和 test-results。
  - 只读盘点开发/E2E 数据中的旧 marker、旧字段和数据源，禁止输出敏感数据。
  - 将历史失败和本次新增回归分开记录。
  - _Requirements: R10, R11, R15_

- [x] P0.5 发布路线所有权表
  - 将下述逻辑范围映射为当前仓库的精确文件清单。
  - 为每个高冲突文件指定唯一 owner。
  - 为每条路线指定独立定向测试命令和允许使用的临时目录。
  - P0.2-P0.5 全部完成后才允许宣布“并行路线已启动”。
  - _Requirements: R11, R15_

### 3.1 P0.5 逻辑所有权草案

| Owner | 独占起始文件范围 | 跨路线请求与 BUS 事项 |
| --- | --- | --- |
| A | `packages/screen-component-sdk/**` | 将 core export 需求交给 D、SDK export 需求交给 E；root manifest/lockfile 交给 BUS |
| B | `packages/shared` screen/host-resource contracts、core document parser/JSON Schema、Nest screen persistence 与 host-resource gateway/resolvers、相关 Prisma/Dataset service/tests | 将 core contracts export 需求交给 D、SDK contracts export 需求交给 E；数据库实际重置/lockfile 交给 BUS |
| C | `screen-editor-core/src/contracts/adapter.ts`、`src/dynamic/**` 与定向测试 | 将 core contracts export 需求交给 D、SDK contracts export 需求交给 E |
| D | core registry renderer/event、host controller、workbench、canvas、preview、blueprint、component JSON dialog/Port、core public barrels、`sdk-contracts.ts` 及定向测试 | SDK public export 需求交给 E |
| E | `packages/screen-sdk/**` | root manifest、lockfile、旧 dynamic SDK 删除 |
| F-Vue | `packages/screen-component-vue/**`、`packages/indicator-card-vue/**` | root manifest、lockfile、Vue consumer 依赖 |
| F-React | `packages/screen-component-react/**`、`packages/indicator-card-react/**` | root manifest、lockfile、Web consumer 依赖 |
| G1 | `apps/screen-sdk-host/**`、`packages/indicator-card-vanilla/**`、`packages/component-lab-host/**` | root manifest、lockfile、最终 E2E |
| G2 | `apps/dynamic-sdk-vue-consumer/**` 的内容迁移 | BUS 重命名为 `apps/screen-sdk-vue-consumer` / `@nebula/screen-sdk-vue-consumer`，并更新 root scripts、lockfile、最终 E2E |
| G3 | `apps/web/**` 的大屏接入、Docker workspace manifest 清单和相关测试 | route tree 生成物、root manifest、lockfile、最终 E2E |
| BUS | root manifest、`pnpm-lock.yaml`、数据库重置、旧 package 删除、tasks/checklist/ADR/index 与最终 export 审计 | 无 |

## 4. 并行路线总览

| 路线 | 主要职责 | 独占范围 | 启动条件 | 完成交付 |
| --- | --- | --- | --- | --- |
| A | 组件 ABI | `packages/screen-component-sdk/**` | P 关闭 | 唯一 Manifest/Model/Event/JSON 边界 |
| B | 文档、持久化与资源网关 | shared screen schema、core parser、Nest persistence 与 host-resource gateway | P 关闭 | 唯一 wire document、持久化与安全资源执行闭环 |
| C | Host 数据 | core adapter 与 `src/dynamic/**` | P 关闭 | 通用 host-resource 与协调器 |
| D | Core Runtime | renderer、registry event、workbench、canvas、blueprint 集成 | A/B/C 接口可用 | 唯一 renderer 与完整 designer/viewer core |
| E | 单一 SDK | `packages/screen-sdk/**` | 完整路线等待 D/F-Vue/F-React；D 后接 runtime | canonical elements 与公开包入口 |
| F-Vue | Vue Bridge | 新 Vue bridge 包与真实 Vue 指标卡包 | P 后可建外壳；A 后接 ABI | Vue SFC plugin 与 tarball 证据 |
| F-React | React Bridge | 新 React bridge 包与真实 React 指标卡包 | P 后可建外壳；A 后接 ABI | React TSX plugin 与 tarball 证据 |
| G | 消费者 | SDK Host、Vue consumer、Web 三个独立子路线 | E 可用；G2 还需 F-Vue，G3 还需 F-React | 三类宿主纵向闭环 |

`packages/screen-dynamic-sdk/**` 在 BUS-4 前只读保留作为源码对照，可执行行为以 P0.4 基线为准。任何路线
都不得提前物理删除它。

## 5. 路线 A：统一组件 ABI

**文件所有权**：`packages/screen-component-sdk/**`。core export 需求交给 D，SDK export 需求交给 E。

- [ ] A1 合并 Manifest API
  - 正式 root API 不再接受或重导出 V2 marker 和 dynamic manifest。
  - 将旧 subpath、marker 和实现文件登记为 BUS-4 物理删除候选。
  - 为正式 Manifest 增加必填 `dataCapability`。
  - 实现 `acceptedSources` 与 `hostResourceTypes` 条件约束。
  - `validateManifest()` 只接受固定 component API marker。
  - 更新 diagnostic path、fixture 和 manifest JSON 边界。
  - _Requirements: R1, R3_

- [ ] A2 合并 Element Model
  - active renderer 和正式 exports 只消费唯一 model 与 element 接口。
  - 将 V2 model 和 dynamic element 文件登记为 BUS-4 物理删除候选。
  - 正式 model 包含 mode、interactive、dataCapability 和 dataState。
  - `dataState.success.data` 收紧为 `ScreenComponentJsonValue`。
  - 删除通过字段是否存在来选择 model 版本的公共 helper。
  - _Requirements: R1, R5, R13_

- [ ] A3 统一 detached JSON 与事件边界
  - plain JSON clone 稳定处理共享引用、循环引用、非法原型和 Vue Proxy。
  - model、data result 和 event payload 复用同一边界。
  - payload 上限按 UTF-8 byte 计算。
  - clone/mapper 失败转换为稳定、脱敏 diagnostic。
  - 标准事件只保留 `{ name, payload? }`。
  - _Requirements: R5, R6, R9, R13_

- [ ] A4 完成路线测试与交接
  - 覆盖 marker、data capability、JSON clone、UTF-8、Vue Proxy 和 event payload。
  - 验证 package build/typecheck 和 `screen-component-sdk` tarball。
  - 提交需由其他路线消费的精确声明和删除候选清单。
  - _Requirements: R1, R3, R5, R6, R9, R13_

## 6. 路线 B：唯一文档与持久化

**文件所有权**：P0.2 选定的 canonical wire schema、core document parser/JSON Schema、Nest screen
module/DTO/Prisma；不得修改 Adapter、renderer 或 SDK 包。

- [ ] B1 建立唯一 Screen Document wire schema
  - active 代码只消费一个 wire schema，停止从 shared/core 的重复定义导入。
  - 将重复定义和旧 parser 文件登记为 BUS-4 物理删除候选。
  - 使用 strict object 和固定 marker，组件状态统一为 `{ locked, hidden }`。
  - 全局变量只保留 static。
  - 数据源只保留 `static` 与 `host-resource`。
  - 固化 resourceType/resourceId 约束及 params/binding 递归 forbidden-key 规则。
  - 生成唯一 TypeScript 类型和 JSON Schema。
  - _Requirements: R1, R3, R10_

- [ ] B2 建立 registry-aware 单一 parser
  - 先执行 strict wire schema，再执行 registry 语义校验。
  - 校验组件 type、props、source kind、host resource type、事件、动作和悬空引用。
  - `refreshData` 只允许指向 host-resource 组件。
  - 旧契约专属 marker、字段和数据源稳定拒绝，不 strip、normalize 或 migrate。
  - 拒绝 host-resource 中的 URI resourceId 和任意深度请求/认证/SQL/script forbidden key。
  - 对与当前 shape 完全相同的历史数据按 P0.2 冻结语义处理，不作无法证明的来源判断。
  - _Requirements: R1, R3, R10_

- [ ] B3 收敛后端持久化
  - Screen API DTO、Service 和 Prisma 只读写 canonical document。
  - 删除后端 legacy 列读取、蓝图迁移和文档迁移路径。
  - 按 P0.2 结论处理 dataset 引用，不在新文档中恢复旧数据源分支。
  - 准备 canonical fixture、seed 与数据库重置清单；实际删除/重建 SQLite 只由 BUS-4 在用户确认后执行。
  - 明确 PATCH 中“缺省”与“清空”的行为，避免旧 blueprint 无法删除。
  - _Requirements: R3, R10, R11, R15_

- [ ] B4 实现 Nebula Web Host Resource Gateway
  - 在 shared contract 与 Nest Screen 模块实现 authenticated resource list/execute 和 public preview execute。
  - 建立固定 resolver registry；首个 metric resolver 将 resourceId 映射为 Dataset，并强制
    `Dataset.projectId === path projectId`，不得恢复 DatasetReference 索引。
  - 每个 resolver 使用 strict Zod intent schema，校验 params/binding allowlist、类型、数量和长度。
  - authenticated 路径执行 JWT/RBAC；public 路径验证项目已发布并配置独立限流。
  - contextId/componentId 只用于审计，不参与授权；真实 URL/header/Token/SQL 只从服务端配置解析并脱敏。
  - 覆盖跨项目 resourceId、未发布项目、未知 resourceType/字段、超限响应和匿名滥用拒绝测试。
  - _Requirements: R3, R11, R15_

- [ ] B5 完成路线测试与交接
  - 覆盖 strict wire、registry 语义、host-resource、悬空引用和旧输入拒绝矩阵。
  - 覆盖后端保存、读取、发布、清空字段和数据引用分支。
  - 验证 Prisma schema、shared、core contracts、Nest screen persistence 与 host-resource gateway 定向测试。
  - _Requirements: R1, R3, R10, R11, R15_

## 7. 路线 C：Host 数据与协调器

**文件所有权**：`screen-editor-core/src/contracts/adapter.ts`、`src/dynamic/**` 及对应测试；公共
contracts export 需求交给 D/E。

- [ ] C1 合并 Host Adapter
  - 正式 `ScreenHostAdapter` 增加可选 `data: ScreenHostDataAdapter`。
  - resource list、context open/sync/close 和 execute 使用通用 host-resource intent。
  - Adapter 输入输出经过统一 JSON、脱敏边界和 UTF-8 1 MiB execute result 上限。
  - 明确纯 static 文档不要求 `adapter.data`，host-resource 文档缺失能力时 fail closed。
  - _Requirements: R3_

- [ ] C2 加固数据协调器
  - 保留请求去重、AbortSignal、超时和迟到结果防护。
  - 冻结普通重复请求与显式 refresh 的不同语义。
  - 使用 context generation 防止 close/reopen 后旧请求覆盖或删除新请求。
  - openContext 完成后复检 generation/disposed，并关闭卸载期间迟到打开的上下文。
  - 区分 timeout、aborted 和 adapter error 的稳定 reason。
  - _Requirements: R3, R7_

- [ ] C3 统一数据状态流
  - static source 直接映射为 success 状态。
  - host-resource 只产生模型已定义的 loading/success/error 状态；timeout/aborted 使用 error.reason 表达，
    因 supersede、删除或卸载导致的 abort 不再写入已失效组件。
  - 删除组件、替换文档和卸载 viewer 时取消请求并忽略迟到结果。
  - 数据状态不得写回持久化文档或创建编辑历史。
  - 防止 `dataLoaded -> refreshData -> dataLoaded` 反馈循环绕过运行时深度保护。
  - _Requirements: R3, R5, R7, R13_

- [ ] C4 完成路线测试与交接
  - 覆盖 dedupe、refresh、abort、timeout、late result、close/reopen 和静态数据。
  - 新增 data runtime 与 Adapter 输出边界测试。
  - 提交给 D/E 的 context 生命周期和 dataState 接口证据。
  - _Requirements: R3, R5, R7, R13_

## 8. 路线 D：统一 Core Runtime

**文件所有权**：core registry renderer、Custom Element renderer、host controller、workbench、canvas、
preview、blueprint 集成文件、core public barrels 与 `sdk-contracts.ts`；不得修改 A-C 的声明源。

- [ ] D1 统一 Custom Element Renderer
  - design、preview、viewer 构造同一种 model。
  - 显式传递 mode 与 interactive，删除默认值造成的模式降级。
  - props/style/size/dataState 更新复用同一个 Custom Element。
  - 实际元素使用稳定 block/100% 尺寸和 box sizing。
  - 删除 model V1/V2 条件分流。
  - _Requirements: R5, R7, R11, R13-R15_

- [ ] D2 在 core 强制事件总闸门
  - listener 每次读取当前可信 interactive 状态。
  - `interactive=false` 时在 payload 校验和蓝图执行前短路。
  - 保留 manifest allowlist、可信 component id 与脱敏日志。
  - 修复 preview 未显式传递 mode/interactive 的现状。
  - 覆盖 design、交互调试、preview 和 viewer。
  - _Requirements: R6, R13_

- [ ] D3 统一完整 designer/viewer core
  - 以完整 `ScreenEditorWorkbench` 能力为 canonical designer，不迁入简化 dynamic designer 的空实现。
  - designer 与 viewer 复用唯一 document、registry、Adapter、renderer 和数据状态流。
  - 保存、发布、导入导出、快照和查看经过同一 parser。
  - 删除 static/dynamic runtime profile 的文档版本分流。
  - 冻结 `whenReady` 至少等待 registry、文档解析、render 和所需 data context。
  - 保持 registry 实例隔离、属性面板和蓝图动作闭环。
  - _Requirements: R1, R2, R3, R11, R15_

- [ ] D4 完成路线测试与交接
  - 覆盖 mode、interactive、稳定实例、host size、数据状态和清理。
  - 覆盖 viewer 事件 Provider、蓝图事件、refreshData 和反馈循环。
  - 新增 host controller/workbench 的直接集成测试。
  - 汇聚 A/B/C 的正式 core exports 并通过 core 全包 typecheck，禁止把 export 修复延后到 BUS。
  - _Requirements: R3, R5-R7, R11, R13-R15_

## 9. 路线 E：合并为单一 Screen SDK

**文件所有权**：`packages/screen-sdk/**`。旧 dynamic SDK 只读；删除由 BUS-4 执行。

- [ ] E1 准备 canonical SDK 外壳
  - 建立 designer/viewer element、runtime loader、公共事件和稳定 property 契约。
  - SDK 继续采用可独立安装的实现打包策略，不向消费者泄漏 private core import。
  - 保持 SDK 不依赖 React/Vue bridge；内部 React editor runtime 继续由 SDK 自包含打包。
  - 此任务可在 P 关闭后与 A-C 并行，但只能使用冻结接口。
  - _Requirements: R2, R9_

- [ ] E2 接入统一 Core Runtime
  - `<nebula-screen-designer>` 与 `<nebula-screen-viewer>` 挂载 D 的完整 canonical runtime。
  - runtime loader 正确处理 registry、Adapter、project/document 和卸载。
  - `whenReady`、保存、发布、viewer 切换和错误事件符合冻结契约。
  - 不迁入 dynamic designer 的 no-op undo/redo。
  - _Requirements: R2, R11, R15_

- [ ] E3 重建 SDK 公共入口
  - root 导出 designer/viewer 定义和公共类型。
  - `auto-register` 只注册 canonical elements。
  - `components` 导出 registry factory。
  - `contracts` 重导出唯一 schema、Zod 和 JSON Schema。
  - `testing` 导出 fixture 且不进入正常 runtime chunk。
  - 删除 `<nebula-screen-editor>` 的公开 alias 需求，但暂不在本路线物理删除旧对照包。
  - _Requirements: R1, R2, R9_

- [ ] E4 完成路线测试与交接
  - 覆盖 element 定义、runtime loader、双实例、卸载和公共 exports。
  - 验证 boundary、bundle size 和 clean tarball consumer。
  - 提交旧 dynamic SDK 每个入口的替代映射表。
  - _Requirements: R2, R9, R11, R15_

## 10. 路线 F-Vue：Vue Bridge 与真实组件

**文件所有权**：新 `packages/screen-component-vue/**` 与 P0.2 冻结命名后的真实 Vue 指标卡包。

- [ ] FV1 创建 `@nebula/screen-component-vue`
  - 建立 package、tsconfig、ESLint、Vitest、build 和独立 tarball verifier。
  - 只依赖 `screen-component-sdk`，Vue `^3.5.0` 为 peer dependency。
  - boundary test 禁止依赖 screen-sdk、core、React、Router、Pinia、i18n 和 UI 库。
  - package 外壳可在 P 后准备，正式实现等待 A 的 ABI 可用。
  - _Requirements: R4, R9_

- [ ] FV2 实现 `defineVueScreenComponent()` 与 Props 映射
  - 接收 manifest、Vue Component、mapModel、events 和 shadowRoot。
  - 使用 Vue `defineCustomElement()`，不手写 createApp 生命周期。
  - helper 只创建一次构造器，plugin.define 始终返回同一引用。
  - 不调用 `customElements.define()`。
  - 默认把 `model.props` 作为业务 SFC props；mapModel 可读取完整 model。
  - 首个 model 前不渲染，更新时保持同一 Vue 实例。
  - _Requirements: R4, R5, R8_

- [ ] FV3 实现事件、样式和生命周期桥接
  - event map key 来自 manifest events。
  - 支持同名、别名、零参数、单参数和显式多参数 mapper。
  - mapper 输出经过 A 的 detached JSON 边界并派发标准事件。
  - 默认 Light DOM，Shadow DOM 显式启用并支持 `.ce.vue` 或 styles。
  - 验证 disconnect、同步 move、reconnect、onUnmounted 和卸载后静默。
  - _Requirements: R6, R7_

- [ ] FV4 创建真实 Vue 指标卡包
  - 目录为 `packages/indicator-card-vue`，包名为 `@nebula-example/indicator-card-vue`。
  - 提供独立 tarball verifier，验证 packed example 只解析公开 bridge/component SDK 入口。
  - 使用普通 `.vue` SFC，不手写 HTMLElement。
  - manifest 声明 props、属性面板、events、static 与 metric host-resource capability。
  - 默认 Props 展示配置，mapModel 展示 mode/size/loading/success/error。
  - emit `value-click` 并映射为 `valueClick` 标准 payload。
  - 默认 SFC scoped CSS 在 Light DOM 中实际生效。
  - _Requirements: R4, R5, R6, R7_

- [ ] FV5 完成路线测试与交接
  - 使用真实 Vue component 覆盖 stable constructor、Props、events、styles 和 lifecycle。
  - tarball consumer 独立安装 Vue peer，不依赖 workspace private 源路径。
  - 公共声明不存在 `any`、private Vue 类型或 private core 路径。
  - _Requirements: R4-R9, R11_

## 11. 路线 F-React：React Bridge 与真实组件

**文件所有权**：新 `packages/screen-component-react/**` 与 P0.2 冻结命名后的真实 React 指标卡包。

- [ ] FR1 创建 `@nebula/screen-component-react`
  - 建立 package、tsconfig、ESLint、Vitest、build 和独立 tarball verifier。
  - 只依赖 `screen-component-sdk`，React/React DOM `^19.1.0` 为 peer dependencies 并在 build 中 external。
  - boundary test 禁止依赖 screen-sdk、core、Vue、Router、TanStack Query、状态管理和 UI 库。
  - package 外壳可在 P 后准备，正式实现等待 A 的 ABI 可用。
  - _Requirements: R9, R12_

- [ ] FR2 实现 `defineReactScreenComponent()`、Props 映射与稳定 Root
  - 接收 manifest、React ComponentType、mapModel、events 和 shadowRoot。
  - 使用最小 HTMLElement 子类与 `createRoot()`；不复用宿主 root/Context，不包裹 StrictMode。
  - helper 只创建一次构造器，plugin.define 始终返回同一引用且不调用 `customElements.define()`。
  - 默认把 `model.props` 作为业务 props；mapModel 可读取完整 model，callback props 最后合并。
  - 首个 model 前不创建 root，更新时保持同一 root、组件类型、hook state 和 effect。
  - _Requirements: R8, R12, R13_

- [ ] FR3 实现 Callback Props、样式和生命周期桥接
  - event map key 来自 manifest events；callback prop 缺省按 `valueClick -> onValueClick` 转换。
  - callback prop 非空且唯一，bridge-owned callback 覆盖同名 document/mapModel 值。
  - 支持零参数、单参数和显式多参数 mapper，输出经过 A 的 detached JSON/UTF-8 边界。
  - 默认 Light DOM；Shadow DOM 显式启用并由组件提供 inline、`<style>` 或明确安装的 stylesheet。
  - 永久 disconnect 在 microtask 复检后 unmount，同步 move 不卸载，reconnect 与卸载后静默有测试。
  - _Requirements: R13, R14_

- [ ] FR4 创建真实 React 指标卡包
  - 目录为 `packages/indicator-card-react`，包名为 `@nebula-example/indicator-card-react`。
  - 提供独立 tarball verifier，验证 packed example 只解析公开 bridge/component SDK 入口。
  - 使用普通 `.tsx` 函数组件，不继承 HTMLElement，不直接调用 `createRoot()`。
  - manifest 声明 props、属性面板、events、static 与 metric host-resource capability，并使用独立 type/tagName。
  - 默认 Props 展示配置，mapModel 展示 mode/size/loading/success/error。
  - 可选 `onValueClick` callback 映射为 `valueClick` 标准 payload。
  - 包内 CSS 在 Light DOM 中实际生效，画布组件不依赖 Web/shadcn 样式。
  - _Requirements: R12-R15_

- [ ] FR5 完成路线测试与交接
  - 使用真实 React component 覆盖 constructor、Props、callbacks、styles、root identity 和 effect cleanup。
  - tarball consumer 显式安装 React peers，验证没有重复 React runtime 或 workspace private 源路径。
  - 公共声明不存在 `any`、private React root 类型或 private core 路径。
  - _Requirements: R8, R9, R12-R15_

## 12. 路线 G：消费者并行迁移

路线 G 在 E 的 canonical elements 可用后拆为三个独立子路线。G1、G2、G3 不得互相修改目录；E2/E3
尚未完成时，只能准备 fixture 和测试，不得复制临时公共 API。

### G1：SDK Host 与示例生态

**文件所有权**：`apps/screen-sdk-host/**`、`packages/indicator-card-vanilla/**`、
`packages/component-lab-host/**`。

- [ ] G1.1 迁移 SDK Host 到 designer/viewer。
- [ ] G1.2 迁移 Vanilla plugin 与 component lab 到唯一 Manifest/Model。
- [ ] G1.3 registry 必须在 Adapter/project/document load 前设置。
- [ ] G1.4 覆盖组件库、拖入、属性更新、保存、viewer 和双实例 registry E2E。
- [ ] G1.5 Vanilla clean consumer 不安装 React、React DOM 或 Vue 仍能 build/typecheck。
- _Requirements: R1, R2, R8, R9_

### G2：Vue Consumer

**文件所有权**：在 `apps/dynamic-sdk-vue-consumer/**` 内完成源码迁移；总线最终重命名为
`apps/screen-sdk-vue-consumer` / `@nebula/screen-sdk-vue-consumer` 并更新 root script。

- [ ] G2.1 只从 `screen-sdk` 与 `screen-component-vue` 公开入口导入。
- [ ] G2.2 使用 template ref 注入 registry、Adapter 和 project/document。
- [ ] G2.3 配置 `isCustomElement`，不通过 Vue app.use 注册 Nebula 元素。
- [ ] G2.4 fake adapter 使用 `resourceType='metric'` 和字符串 resourceId。
- [ ] G2.5 覆盖 list、context、execute、abort、timeout、错误和迟到结果。
- [ ] G2.6 覆盖真实 Vue SFC 拖入、样式、保存、viewer、事件和卸载 E2E。
- _Requirements: R2-R9, R11_

### G3：Web Consumer

**文件所有权**：`apps/web/**` 中大屏接入文件；不得修改 B 的后端/schema 或 D 的 core 文件。

- [ ] G3.1 迁移 Web 到 `@nebula/screen-sdk` 的 canonical designer/viewer，不保留直接组合 private core 的生产路径。
- [ ] G3.2 只从 React bridge 与真实 React 指标卡公开入口导入，并将 plugin 注入 Web registry。
- [ ] G3.3 保留 Monaco JSON editor、鉴权、React Query 保存发布和 preview 现有能力。
- [ ] G3.4 Web Host Adapter 不再投影另一套 V2 文档，直接消费 canonical document。
- [ ] G3.5 Web data adapter 只调用 B4 的 host-resource gateway，不直接执行任意 URL 或调用通用代理。
- [ ] G3.6 组件 registry、Adapter 和文档加载时序与 SDK Host 一致。
- [ ] G3.7 更新 Web Docker workspace manifest 缓存清单与 package 公开依赖。
- [ ] G3.8 覆盖 React 指标卡拖入、Props、保存/viewer、host-resource、callback/蓝图、
  `interactive=false`、map/render failure、同步 move、永久卸载和 JSON editor E2E。
- _Requirements: R1-R3, R8, R9, R12-R15_

## 13. 总线汇聚

总线由单一负责人顺序执行。任何路线局部通过都不能跳过前一项总线门。

### BUS-0：收集与审计

- [ ] 收集 A-E、F-Vue、F-React、G1-G3 全部交接报告，核对任务 ID、文件所有权、测试证据和未完成项。
- [ ] 拒绝包含临时兼容层、重复公共类型、private source import 或未声明跨路线修改的交接。
- [ ] 重新读取最新工作区，识别并保留用户或其他执行者的并发改动。
- [ ] 更新本文件和 checklist 的真实状态，不根据计划或口头声明勾选。

### BUS-1：契约与包图汇聚

- [ ] 先汇聚 A、B、C，确认全仓只存在一个 Manifest、Model、Document 和 Host Adapter。
- [ ] 审计 D 已汇聚的 core public barrel 与 `sdk-contracts.ts`，修复只在最终包图出现的 export 问题。
- [ ] 汇聚 D、E、F-Vue、F-React，再更新各包 manifest、root scripts 和 workspace references。
- [ ] 由总线执行初次 workspace/lockfile 同步，使新增包和消费者依赖可解析；禁止手工编辑锁文件。
- [ ] 运行组件 SDK、shared、core、React bridge、Vue bridge、screen SDK 定向 typecheck/test。

### BUS-2：运行时与消费者汇聚

- [ ] 验证 designer/viewer 共用唯一 parser、registry、Adapter、renderer 和 data coordinator。
- [ ] 验证 registry 在 document/project load 前完成注入，`whenReady` 不提前成功。
- [ ] 汇聚 G1、G2、G3，修复仅在跨路线组合时出现的问题，不扩展规格范围。
- [ ] 验证后端、Web Adapter、SDK Host 和 Vue consumer 读写同一种 document。
- [ ] 验证 Web registry 使用 F-React 的真实 TSX plugin，Vue consumer 使用 F-Vue 的真实 SFC plugin。
- [ ] 验证 Web Monaco 扩展点及其他既有 Web 能力没有因 SDK 接入丢失。

### BUS-3：建立替代证据

- [ ] 完成 Vanilla Host、React Host + React plugin、Vue Host + Vue plugin 三类 clean consumer 矩阵。
- [ ] 完成 design、preview、viewer、interactive、static、host-resource、event、action 矩阵。
- [ ] 完成属性更新、保存重载、发布查看、删除、卸载、重连和双实例 registry 矩阵。
- [ ] 将旧 marker、字段、数据源 fixture 转为 strict parser 负向测试。
- [ ] 扫描源码、声明和 tarball，确认新入口不引用 dynamic SDK 或旧 subpath。
- [ ] 只有每条旧路径都有新路径回归证据后，BUS-4 才可开始。

### BUS-4：删除旧实现与重置数据

- [ ] 删除 `screen-component-sdk/dynamic`、V2 model/API marker 和版本 validator 分支。
- [ ] 删除 core Legacy/V1/V2/V3 parser、normalization、migration 和版本化 runtime profile。
- [ ] 删除 `@nebula/screen-dynamic-sdk` package、构建任务和 consumer 依赖。
- [ ] 删除旧 package 后再次生成最终 lockfile，确认旧 importer/reference 消失。
- [ ] 删除旧 `<nebula-screen-editor>` 公共实现和 tag alias。
- [ ] 重置开发/E2E 数据、fixture 和 snapshot，只保留 canonical document 示例。
- [ ] 不创建运行时或离线迁移工具；如发现已发布数据兼容义务，立即触发范围停止条件。
- [ ] 使用内容扫描确认 active 源码、exports、声明和 tarball 无旧实现引用。

### BUS-5：发布质量门与文档

- [ ] 确认 Node/pnpm 版本与 P0.2 决策一致。
- [ ] 在最终 lockfile 上执行冻结安装和 Prisma generate/validate。
- [ ] 依次运行 `pnpm biome:fix`、`pnpm biome:check`、`pnpm typecheck`、`pnpm lint`。
- [ ] lint 如产生写入，再运行 `pnpm biome:fix` 与 `pnpm biome:check`。
- [ ] 运行 `pnpm test`、`pnpm build` 和 screen SDK size 门。
- [ ] 顺序运行 component SDK、React bridge、React example、Vue bridge、Vue example、screen SDK tarball verifier。
- [ ] 使用隔离端口/数据库/报告目录，顺序运行 SDK Host、Vue consumer、Web Chromium E2E。
- [ ] 更新组件作者指南、架构、开发指南、superseding ADR 和 active 文档中的标准事件字段。
- [ ] 更新文档索引与状态，将 Spec 转为“生效中”。
- [ ] 最后运行删除扫描、`git diff --check` 与 `git status --short`，确认无意外生成物。
- [ ] 任一失败修复后从受影响门重新执行，不交付已知失败。
  - _Requirements: R1-R15_

## 14. 依赖图

```text
只读评估（已完成）
        ↓
串行闸门 P：决策 + 接口冻结 + 基线 + 文件 owner
        ↓
第一波流水并行
  ├─ A 组件 ABI ───────┬────────→ F-Vue Bridge
  │                    ├────────→ F-React Bridge
  │                    └────┐
  ├─ B 文档/持久化 ─────────┼────→ D Core Runtime
  ├─ C Host 数据 ───────────┘
  └─ E1 SDK 外壳准备
                              ↓
第二波：D、F-Vue、F-React 完成并停止共享构建写入
                              ↓
第三波：E2/E3 单一 SDK + staging build
                              ↓
第四波消费者并行
  ├─ G1 SDK Host（依赖 E）
  ├─ G2 Vue Consumer（依赖 E + F-Vue）
  └─ G3 Web/React Consumer（依赖 E + F-React + B/D）
                              ↓
总线 BUS-0 → BUS-1 → BUS-2 → BUS-3 → BUS-4 → BUS-5
```

关键硬依赖：

- A、B、C 可以在 P 关闭后并行，但不得修改彼此的声明源。
- D 可以准备测试与调用点，完整 typecheck 必须等待 A、B、C 接口可用。
- F-Vue/F-React 的 package 外壳可并行提前准备，两个 bridge 实现都必须等待 A，且互不写同一目录。
- E 的 element/loader 外壳理论上可提前准备；完整路线等待 D/F-Vue/F-React，避免 staging build
  改写共享依赖产物时与 bridge 验证竞态。
- G1 等待 E；G2 等待 E 与 F-Vue；G3 等待 E、F-React 及 B/D 的 Web 接口。
- BUS-4 永远晚于 BUS-3 的替代证据，不允许“先删再修”。

## 15. 范围停止条件

出现以下情况时停止实现路线，由总线先更新 Spec/ADR 和任务依赖：

- 发现需要兼容已发布消费者或迁移生产数据。
- 唯一文档代码归属、marker 语义、dataset 引用或 Monaco 扩展点无法按 P0.2 冻结。
- 需要从远程 URL、项目文档或组件市场加载组件代码。
- 需要把宿主 React/Vue App、React root、Router、QueryClient、Pinia、i18n 或认证状态注入组件。
- 需要自定义 React/Vue 属性面板 renderer。
- 需要支持 React 18 及以下、React Server Components 或 Vue 2。
- 需要恢复 API/dataset/SQL/script 作为 document 直接数据源。
- 需要不受信任组件沙箱。
- 需要同页运行同一 tagName 的不同构造器。
- 需要通过兼容 alias、双 parser 或迁移脚本才能让总线通过。
