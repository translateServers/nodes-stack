# 非破坏性数据与交互分层 Spec

## Why

阶段 0 稳定了大屏项目的认证、保存、发布、预览、样式一致性和并发冲突边界，阶段 1 完成了单用户交互闭环，编辑器画布与工具行为已经可预测。当前的主要缺口在组件配置内部：图表数据直接塞在 `props.data` 中，属性面板用 JSON textarea 徒手编辑；`ScreenComponentSchema` 虽已预留可选 `dataSource` 字段，但前端完全未消费；没有字段映射、数据解析器、加载/错误/空状态机制；`updateCanvas` 不进入本地编辑历史，画布尺寸、背景和适配方式的修改无法撤销。

这造成两个直接后果：一是业务员调整标题、颜色等视觉配置时必须面对混有数据的 JSON，容易误改数据配置；二是开发者调整数据时缺少真实数据源（静态/API）链路，也无法独立于视觉配置演进数据配置。画布配置不可撤销同样破坏了阶段 0 以来"本地编辑历史"的完整性承诺。

本 Spec 是 `evolve-screen-design-platform` 阶段 2「非破坏性数据与交互分层」的独立实施规格。阶段 1 的 checklist、验证记录和关键回归全部有效是本阶段的强制进入条件；任一阶段 1 门禁失效时，阶段 2 不得开始或继续。实施采用"小步快跑"和"契约先行 → 纯函数解析 → 静态闭环 → API 闭环 → 状态与刷新 → 历史扩展 → 脱敏 → 端到端验证"的渐进策略，保留现有手写 SVG renderer、属性面板骨架和编辑器 Store 结构，不引入 ECharts/Recharts 等新图表库，不进行一次性面板重写。

## What Changes

- 在 `@nebula/shared` 建立"数据、逻辑、视觉、交互"四层配置的共享 Zod 契约，明确各层在 `ScreenComponentSchema` 中的字段位置：数据层为扩展后的 `dataSource`（含数据路径与字段映射），逻辑层为新增可选 `logic`（排序、条数限制），视觉层归约为现有 `props`/`style` 中的视觉配置，交互层为新增可选 `interaction`（bar-chart 悬停提示开关）。新字段全部可选以保持向后兼容。
- 实现数据解析器纯函数链路：原始数据 → 可选数据路径 → 字段映射 → 逻辑层处理 → 规范化图表数据，产出结构化结果（成功/错误/空），错误原因可区分。
- 改造 bar-chart renderer 为数据源驱动：编辑器与公开预览共用同一数据解析路径；保留 `props.data` 兼容读取，首次通过新 UI 编辑数据层时一次性迁移为数据层配置。
- 属性面板按四层分组组织图表组件配置：静态数据编辑与 Zod 校验反馈、字段映射下拉选择、逻辑层配置、交互层开关；替代 bar-chart 原有的数据 JSON textarea。
- 实现 GET API 数据源闭环：配置表单（URL、params、headers、refreshInterval）、请求测试、响应预览、数据路径与字段映射配置、画布真实请求渲染。
- 为数据源驱动组件提供加载、错误、空数据三态，编辑器与公开预览表现一致；错误态不导致组件消失或画布崩溃。
- 实现可取消的定时刷新：按 `refreshInterval` 周期请求，配置变更、组件删除、页面卸载时取消计时器与进行中请求，无浮动 Promise，旧响应不覆盖新数据。
- 服务端公开预览接口对敏感请求头执行脱敏（大小写不敏感的敏感键名识别规则前后端共享），受保护接口返回完整配置的行为不变。
- 本地编辑历史条目从"仅组件数组"扩展为"组件数组 + 画布配置"快照，`updateCanvas` 接入历史栈，画布尺寸、背景、适配方式修改可撤销重做。
- 本 Spec 只定义规格、任务和验收标准；获得批准前不修改产品代码。

## Impact

- Affected specs:
  - `evolve-screen-design-platform`：细化并实施阶段 2，完成后作为阶段 3 的进入条件。
  - `close-single-user-interactions`：保持阶段 1 的工具行为、交互状态机和编辑器 E2E 不回退。
  - `stabilize-screen-baseline`：保持阶段 0 的保存、发布、预览和冲突恢复行为不回退；公开预览数据范围仅在敏感请求头脱敏方向上收窄。
- Affected code（实施阶段的预期影响面，本次不修改）:
  - `packages/shared/src/schemas/screen.schema.ts`：四层配置契约、字段映射、数据路径和敏感请求头识别规则的共享定义。
  - `apps/web/src/features/screen/lib/`：数据解析器纯函数（规范化模型、数据路径、字段映射、逻辑层处理）。
  - `apps/web/src/features/screen/hooks/`：组件数据加载 Hook（静态解析、API 请求、取消、定时刷新）。
  - `apps/web/src/features/screen/registry/components/bar-chart-component.tsx`：数据源驱动渲染与三态展示。
  - `apps/web/src/features/screen/registry/renderer.tsx`：renderer 数据注入边界。
  - `apps/web/src/features/screen/components/property-panel.tsx`：属性面板四层分组与数据源配置 UI。
  - `apps/web/src/features/screen/components/screen-preview.tsx`：公开预览接入数据解析路径。
  - `apps/web/src/features/screen/stores/editor-store.ts`：历史栈条目结构扩展与 `updateCanvas` 接入历史。
  - `apps/nestjs-server/src/modules/screen/`：公开预览响应的敏感请求头脱敏。
  - `apps/web/e2e/tests/`：静态/API 数据源、定时刷新、四层独立修改和画布配置历史 E2E。

## ADDED Requirements

### Requirement: 四层配置契约

系统 SHALL 将组件的"数据、逻辑、视觉、交互"四层配置建立为共享 Schema 中位置明确、边界清晰的稳定契约。

#### Scenario: 各层字段位置固定

- **WHEN** 查阅或校验一个图表组件配置
- **THEN** 数据层配置只存在于 `dataSource` 字段（含数据源类型、静态数据、API 配置、数据路径和字段映射）
- **AND** 逻辑层配置只存在于 `logic` 字段（排序与条数限制）
- **AND** 视觉层配置只存在于 `style` 与视觉类 `props`（如标题）
- **AND** 交互层配置只存在于 `interaction` 字段
- **AND** `position`、`zIndex`、`status`、`parentId` 属于布局与状态信息，不属于四层配置

#### Scenario: 修改任一层不影响其他层

- **GIVEN** 一个图表组件已包含数据、逻辑、视觉、交互四层配置
- **WHEN** 用户通过属性面板修改其中任意一层
- **THEN** 更新动作只写入目标层对应字段
- **AND** 其余三层配置的值与引用语义保持不变
- **AND** 修改形成一条可撤销的本地编辑历史

#### Scenario: 各层可独立校验

- **WHEN** 系统校验组件配置
- **THEN** 每一层配置可单独通过共享 Zod Schema 校验
- **AND** 某一层的校验错误不会掩盖其他层的校验结果
- **AND** 校验错误信息能定位到具体层与字段

### Requirement: 四层契约向后兼容

系统 SHALL 保证四层契约演进不破坏既有项目数据，旧项目可解析、可渲染、可保存。

#### Scenario: 旧项目数据可解析可渲染

- **GIVEN** 一个既有项目的 bar-chart 仅有 `props.data`，没有 `dataSource`、`logic` 或 `interaction`
- **WHEN** 项目被加载到编辑器或公开预览
- **THEN** 共享 Schema 解析成功
- **AND** 图表通过兼容读取路径使用 `props.data` 渲染
- **AND** 视觉表现与契约演进前一致

#### Scenario: 首次编辑数据层时一次性迁移

- **GIVEN** 一个仅有 `props.data` 的旧 bar-chart
- **WHEN** 用户首次通过数据层配置 UI 提交数据源配置
- **THEN** 系统将 `props.data` 迁移为数据层静态数据并应用新配置
- **AND** 迁移与新配置写入合并为一条本地编辑历史
- **AND** 迁移后 `props.data` 不再作为数据真值

#### Scenario: 未迁移组件保存不丢数据

- **WHEN** 用户未编辑数据层而直接保存包含旧 bar-chart 的项目
- **THEN** `props.data` 不被静默删除或改写
- **AND** 重新加载和公开预览渲染结果不变

### Requirement: 共享 Schema 分层校验

系统 SHALL 通过 `@nebula/shared` 中的 Zod Schema 校验各层配置，并保证前后端使用同一份契约。

#### Scenario: 数据层与逻辑层强校验

- **WHEN** 数据层或逻辑层配置被提交
- **THEN** 数据源类型、API 配置、数据路径、字段映射、排序和条数限制通过共享 Schema 校验
- **AND** 非法值（非法 URL、负数条数限制、未知排序方向）被拒绝并给出可读错误

#### Scenario: 视觉层与交互层校验

- **WHEN** 阶段 2 范围内的 bar-chart 视觉 props 或交互层配置被提交
- **THEN** 视觉 props（标题）与交互层配置（悬停提示开关）通过共享 Schema 校验
- **AND** `style` 继续由既有 `ComponentStyleSchema` 校验
- **AND** 其他组件类型的 props 强类型契约不属于本阶段范围

#### Scenario: 服务端使用同一契约

- **WHEN** 服务端接收包含四层配置的项目保存请求
- **THEN** 服务端使用 `@nebula/shared` 同一 Schema 校验
- **AND** 非法四层配置不会写入数据库

### Requirement: 数据解析器

系统 SHALL 提供纯函数数据解析器，将原始数据解析为规范化图表数据，并产出结构化结果。

#### Scenario: 解析管线

- **WHEN** 数据解析器接收原始数据、可选数据路径、字段映射和逻辑层配置
- **THEN** 依次执行数据路径提取、字段映射、逻辑层处理（排序、条数限制）
- **AND** 输出规范化图表数据（`{ name, value }` 条目列表）
- **AND** 解析器为纯函数，不发起 IO，不产生副作用

#### Scenario: 非法输入产出结构化错误

- **WHEN** 原始数据不是数组、数据路径不存在、映射字段缺失或映射值无法转为数值
- **THEN** 解析器返回结构化错误结果，错误原因可区分
- **AND** 不抛出未捕获异常
- **AND** 错误信息面向用户可读，不泄露原始数据全文

#### Scenario: 空结果与错误可区分

- **WHEN** 原始数据为合法空数组
- **THEN** 解析器返回空结果而非错误
- **AND** 渲染层可将空结果与错误结果区分展示

#### Scenario: 逻辑层处理不修改原始数据

- **WHEN** 逻辑层配置要求排序或限制条数
- **THEN** 处理作用于映射结果的副本
- **AND** 数据源中的原始数据引用保持不变
- **AND** 未配置字段映射时按约定默认规则（`name`→维度、`value`→数值）推断

### Requirement: 静态数据源绑定闭环

系统 SHALL 支持用户为图表配置静态数据源与字段映射，图表使用数据解析结果渲染。

#### Scenario: 静态数据驱动渲染

- **GIVEN** 用户选中一个 bar-chart
- **WHEN** 用户在数据层配置静态数据和字段映射并提交
- **THEN** 画布中的图表使用解析后的数据渲染
- **AND** 不再要求用户把数据直接塞入 `props.data`
- **AND** 修改逻辑层或视觉层配置不会重置数据层配置

#### Scenario: 静态数据校验反馈

- **WHEN** 用户提交的静态数据不是合法 JSON 或不符合数据结构要求
- **THEN** 配置 UI 给出明确校验错误提示
- **AND** 非法数据不写入组件配置
- **AND** 画布保持上一份有效配置的渲染结果

#### Scenario: 保存重载一致

- **WHEN** 配置静态数据源的项目被保存并重新加载
- **THEN** 数据层配置完整保留
- **AND** 图表渲染结果与保存前一致
- **AND** 公开预览渲染同一解析结果

### Requirement: API 数据源绑定闭环

系统 SHALL 支持用户为图表配置 GET API 数据源，并提供请求测试、响应预览、字段映射和画布渲染闭环。

#### Scenario: 配置与请求测试

- **GIVEN** 用户选中一个 bar-chart 并选择 API 数据源
- **WHEN** 用户填写 URL、查询参数、请求头并执行请求测试
- **THEN** 系统从浏览器发起 GET 请求并展示响应状态码与响应预览（截断展示）
- **AND** 请求失败时展示可读错误（网络错误、CORS、非 2xx）
- **AND** 请求测试不写入组件配置，不产生本地编辑历史

#### Scenario: 基于响应样本配置映射

- **GIVEN** 请求测试已成功返回响应
- **WHEN** 用户配置数据路径与字段映射
- **THEN** 可选字段来自响应样本推断
- **AND** 提交后画布图表使用真实 API 数据渲染
- **AND** 请求由浏览器直接发起，系统不提供服务端代理

#### Scenario: 不支持的方法安全失败

- **WHEN** 组件配置中出现阶段 2 未实现的请求方法（如 POST）
- **THEN** 系统返回结构化的"不支持"状态而非发起请求
- **AND** 配置 UI 不暴露未实现方法的入口

### Requirement: 加载、错误与空数据状态

系统 SHALL 为数据源驱动组件提供明确的加载、错误、空数据三态，编辑器与公开预览表现一致。

#### Scenario: 加载态不阻塞画布

- **WHEN** API 数据源请求进行中
- **THEN** 对应图表展示加载态
- **AND** 画布选择、拖拽、缩放等其他交互不受影响
- **AND** 加载态组件尺寸不发生变化

#### Scenario: 错误态可读且不破坏画布

- **WHEN** 请求失败、响应解析失败或配置不支持
- **THEN** 图表区域展示可读错误信息
- **AND** 组件不从画布消失，不导致画布崩溃
- **AND** 属性面板仍可正常编辑该组件配置
- **AND** 配置修正后图表自动恢复渲染

#### Scenario: 空数据与错误区分

- **WHEN** 数据源解析成功但结果为零条
- **THEN** 图表展示空数据态而非错误态
- **AND** 编辑器与公开预览的空态表现一致

### Requirement: 定时刷新可取消

系统 SHALL 支持按配置的刷新间隔定时刷新 API 数据源，刷新可取消且不产生浮动 Promise。

#### Scenario: 按间隔刷新

- **GIVEN** 组件 API 数据源配置了大于零的刷新间隔
- **WHEN** 图表处于编辑器画布或公开预览中
- **THEN** 系统按间隔重新请求并更新渲染
- **AND** 未配置或间隔为零时不启动定时刷新

#### Scenario: 取消与清理

- **WHEN** 组件被删除、数据源配置变更、数据源类型切换或页面卸载
- **THEN** 定时器被取消，进行中的请求被中止
- **AND** 不再产生后续请求与状态更新
- **AND** 不存在未处理的 Promise rejection

#### Scenario: 竞态防护

- **GIVEN** 上一次请求尚未返回时触发新请求
- **WHEN** 旧响应晚于新响应到达
- **THEN** 旧响应不覆盖新数据
- **AND** 所有异步路径均有明确完成、取消或错误处理，无浮动 Promise

### Requirement: 敏感请求头保护

系统 SHALL 防止敏感请求头以明文方式暴露在公开预览数据中。

#### Scenario: 公开预览脱敏

- **GIVEN** 组件 API 数据源配置了包含敏感键名（如 authorization、cookie、x-api-key，大小写不敏感）的请求头
- **WHEN** 任意访问者通过公开预览接口获取已发布项目
- **THEN** 响应中敏感请求头的值不携带明文
- **AND** 非敏感请求头不受影响
- **AND** 敏感键名识别规则由 `@nebula/shared` 统一定义，前后端一致

#### Scenario: 受保护接口行为不变

- **WHEN** 已认证用户通过受保护项目接口读取自己的项目
- **THEN** 请求头配置完整返回，可继续编辑
- **AND** 脱敏不影响保存、发布和冲突恢复的既有语义

#### Scenario: 预览运行时降级

- **WHEN** 公开预览因脱敏缺少必需请求头而导致 API 请求失败
- **THEN** 图表进入错误态展示
- **AND** 预览不会使用占位值伪造请求头
- **AND** 编辑器内请求不受脱敏影响

### Requirement: 画布配置进入本地编辑历史

系统 SHALL 将画布尺寸、背景和适配方式修改纳入本地编辑历史，可撤销和重做。

#### Scenario: 画布修改可撤销重做

- **WHEN** 用户修改画布宽度、高度、背景颜色、背景图片或缩放适配模式
- **THEN** 修改进入本地编辑历史
- **AND** 执行撤销后画布配置恢复到修改前
- **AND** 执行重做后画布配置恢复到修改后
- **AND** 本地编辑历史不再只覆盖组件数组

#### Scenario: 历史条目覆盖组件与画布

- **WHEN** 任一入历史的编辑操作发生
- **THEN** 历史条目同时记录组件数组与画布配置快照
- **AND** 撤销/重做同时恢复两者，不出现组件回退而画布未回退的错配

#### Scenario: 历史语义不膨胀

- **WHEN** 用户通过连续型输入（数值微调、颜色选择）调整画布配置
- **THEN** 一次业务修改只产生一条历史记录
- **AND** 无实际变化的提交不产生空历史记录
- **AND** 既有组件编辑历史行为不回退

### Requirement: 属性面板四层组织

系统 SHALL 在属性面板中按"数据、逻辑、视觉、交互"分组组织图表组件配置。

#### Scenario: 四层分组展示

- **GIVEN** 用户选中一个 bar-chart
- **WHEN** 查看属性面板
- **THEN** 数据、逻辑、视觉、交互四层配置以可区分的分组展示
- **AND** 业务员修改视觉层配置无需接触数据层控件
- **AND** 开发者修改数据层配置无需接触视觉层控件

#### Scenario: 未配置数据源的引导

- **WHEN** 选中的图表组件尚未配置数据源
- **THEN** 数据层分组提供明确的配置入口与引导
- **AND** 不将裸 JSON textarea 作为唯一数据编辑手段

#### Scenario: 各层修改独立成史

- **WHEN** 用户分别修改数据层、逻辑层、视觉层或交互层配置
- **THEN** 每次有效提交产生一条本地编辑历史
- **AND** 撤销任一层的修改不影响其他层的当前值

## MODIFIED Requirements

### Requirement: bar-chart 数据真值迁移

bar-chart 的数据真值 SHALL 从 `props.data` 迁移到数据层配置；`props.data` 仅作为未迁移旧组件的兼容读取来源。

#### Scenario: 数据层优先

- **GIVEN** 组件同时存在数据层静态数据与遗留 `props.data`
- **WHEN** 图表渲染
- **THEN** 数据层配置为唯一生效数据源
- **AND** 遗留 `props.data` 不参与渲染

### Requirement: 本地编辑历史条目结构扩展

本地编辑历史条目 SHALL 从"仅组件数组"扩展为"组件数组 + 画布配置"快照，撤销/重做语义保持既有约定。

#### Scenario: 既有组件历史不回退

- **WHEN** 历史条目结构扩展后
- **THEN** 组件的新增、删除、修改、拖拽、缩放、旋转、成组和图层操作的撤销/重做行为与扩展前一致
- **AND** 历史容量限制与 `loadProject` 清空历史的语义不变

### Requirement: 阶段 0 与阶段 1 行为不回退

系统 SHALL 在引入四层契约与数据源链路时保持阶段 0、阶段 1 全部已验收行为。

#### Scenario: 可靠性基线不回退

- **WHEN** 阶段 2 修改 Schema、Store、属性面板或预览链路
- **THEN** 认证、公开预览发布状态隔离、保存发布、冲突恢复、属性同步和编辑预览样式一致性继续通过既有测试

#### Scenario: 交互闭环不回退

- **WHEN** 阶段 2 修改画布 renderer 或属性面板
- **THEN** 阶段 1 的工具行为、交互状态机仲裁和关键组合交互 E2E 继续通过
- **AND** 数据源加载中的组件仍可被正常选择、移动、缩放和删除

## REMOVED Requirements

### Requirement: 属性面板 bar-chart 数据 JSON textarea

属性面板 SHALL 移除以 JSON textarea 直接编辑 `props.data` 的方式，由数据层配置 UI 替代。

#### Scenario: 旧组件编辑路径

- **GIVEN** 一个仅有 `props.data` 的旧 bar-chart
- **WHEN** 用户需要修改其数据
- **THEN** 通过数据层配置 UI 完成（触发一次性迁移）
- **AND** 不再提供直接编辑 `props.data` 的 JSON textarea

## Out of Scope

- POST、PUT、DELETE 等写请求方法与请求体编辑；WebSocket 等其他数据源类型。
- ECharts、Recharts 等图表库引入与主题体系；阶段 2 保留手写 SVG renderer，图表库评估留待后续阶段。
- 多系列、聚合、分组、下钻、图表联动等复杂数据分析能力。
- 表格等其他组件类型的数据源接入；阶段 2 只完成 bar-chart 一个图表的完整闭环。
- 服务端 API 代理、跨域转发、数据源凭证托管与密钥管理。
- 全局共享数据源管理与跨组件数据源复用。
- 服务端修订版（revision）、项目分支、实时多人同步、AI 推荐。
- 角色工作区与按角色的面板裁剪（阶段 4）；阶段 2 只做面板四层分组，不做角色差异化。
- 为所有组件类型建立 props 强类型契约；阶段 2 只覆盖 bar-chart 视觉 props 校验。
