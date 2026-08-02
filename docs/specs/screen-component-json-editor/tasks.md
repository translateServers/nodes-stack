# 大屏组件 JSON 配置编辑器 Tasks

> 状态：设计中
> 最近更新：2026-08-02
> 定位：将组件 JSON 编辑器规格拆分为可执行、可验证并可追溯到 Requirement 的实现任务

> 执行约束：用户当前仅要求产出规格文档。所有任务保持未开始，未经用户再次明确确认不得进入功能实现。

## P0：配置契约与安全边界

- [ ] Task 1：建立可编辑组件配置契约和纯函数管线
  - [ ] 定义 `EditableScreenComponentConfig`、受保护身份类型和稳定字段顺序
  - [ ] 实现组件配置序列化、严格 JSON 解析和结构等价比较
  - [ ] 建立 strict 公共配置 Schema，拒绝未知顶层和嵌套字段
  - [ ] 接入 JSON boundary、`ScreenComponentSchema`、registry 和 manifest `propsSchema` 校验
  - [ ] 区分 static/dynamic profile 与 built-in/host registration 能力
  - [ ] 输出包含路径、级别和用户可读消息的去重诊断
  - [ ] 为合法、非法和能力边界分支补充纯函数单测
  - _Requirements: R1, R3, R4, R9_

- [ ] Task 2：生成选中组件专属 Draft 7 JSON Schema
  - [ ] 从公共 Zod Schema 生成 Draft 7 JSON Schema
  - [ ] 将当前 manifest `propsSchema` 注入 `props` 节点
  - [ ] 从 `defaultProps` 补充缺失的默认值提示，不自动写入配置
  - [ ] 保留 manifest 的 title、description、enum、范围和 pattern 元数据
  - [ ] 根据 capability profile 过滤数据源分支
  - [ ] 根据 registration source 移除宿主组件不支持的配置建议
  - [ ] 为文本、柱状图、指标卡、static/dynamic 和 host 场景补充 Schema 快照或结构断言
  - _Requirements: R3, R4, R9_

- [ ] Task 3：新增原子组件配置替换 Store action
  - [ ] 定义 `ReplaceComponentConfigCommand` 和结果判别类型
  - [ ] 在 Store 内原子检查目标、只读状态、baseline 冲突和无变化
  - [ ] 保留 `id`、`type`、`parentId`，精确替换其余可编辑字段
  - [ ] 确保删除 optional 字段不会因浅合并而残留
  - [ ] 一次成功应用只进入一次 `withHistory`
  - [ ] 将 action 纳入只读 Store 包装器
  - [ ] 补充 updated/unchanged/conflict/missing/readonly、dirty 和 undo/redo 测试
  - _Requirements: R5, R6, R7_

## P1：Core 编辑器壳层

- [ ] Task 4：定义宿主可选的 JSON 编辑器注入能力
  - [ ] 在 `screen-editor-core` 定义编辑器 Props、诊断和组件类型契约
  - [ ] 为 `ScreenEditorWorkbenchProps` 增加可选 `componentJsonEditor`
  - [ ] 将能力沿 Workbench 内部链路传递，不引入 Monaco 类型或运行时代码
  - [ ] 未注入能力时隐藏工具菜单和属性面板入口
  - [ ] 将 Monaco 包加入 core/SDK boundary 禁止依赖清单
  - [ ] 补充依赖边界和能力显隐测试
  - _Requirements: R1, R2, R7, R9_

- [ ] Task 5：将占位 Sheet 改为正式组件 JSON 编辑器
  - [ ] 将通用“代码编辑”命名收敛为“组件 JSON”
  - [ ] 打开时固定 componentId、identity、baseline、草稿和 model session
  - [ ] 渲染组件名称、类型、ID、编辑器、诊断区和操作栏
  - [ ] 实现本地格式化、取消、应用和加载失败重试状态
  - [ ] 实现脏草稿关闭确认
  - [ ] 处理目标删除、registry 缺失、baseline conflict 和无变化应用
  - [ ] 只读模式允许查看复制，隐藏写操作
  - [ ] Sheet 打开期间挂起设计器快捷键
  - [ ] 使用假编辑器补充 Core 组件测试
  - _Requirements: R1, R4, R5, R6, R7, R10_

- [ ] Task 6：接入属性面板和工具菜单入口
  - [ ] 在单选组件的属性面板头部增加 `Braces` 图标按钮和 tooltip
  - [ ] 将工具菜单命令改为“组件 JSON...”
  - [ ] 明确未选中、多选、只读和能力缺失时的显示/禁用规则
  - [ ] 调整右侧面板头部操作布局，避免与折叠按钮重叠
  - [ ] 补充单选、多选、只读、能力缺失和可访问名称测试
  - _Requirements: R1, R7, R10_

## P2：Nebula Web Monaco 实现

- [ ] Task 7：建立 Web-only Monaco 懒加载与 Worker 运行时
  - [ ] 仅在 `apps/web` 添加 `monaco-editor` 与 `@monaco-editor/react` 运行时依赖
  - [ ] 新增 Web Monaco 适配器并通过 `React.lazy` 注入 Workbench
  - [ ] 配置本地 ESM Monaco，禁止默认 CDN loader
  - [ ] 仅配置 JSON Worker 和 Editor Worker
  - [ ] 为 Monaco 加载、失败、重试和主题切换提供稳定状态
  - [ ] 确认未打开 Sheet 时不请求 Monaco 资产
  - _Requirements: R2, R7, R9, R10_

- [ ] Task 8：实现 Monaco model、Schema 与诊断生命周期
  - [ ] 为每次会话生成唯一 `inmemory://` model URI
  - [ ] 实现活动 JSON Schema 协调器，支持同页多实例注册与注销
  - [ ] 将最终 Schema 绑定到精确 `fileMatch`
  - [ ] 配置 JSON 补全、Hover、marker、搜索、折叠、格式化和本地 undo
  - [ ] 将 Monaco marker 转为 Core 通用诊断类型
  - [ ] 关闭时 dispose model、Schema 注册、listener 和 ResizeObserver 相关资源
  - [ ] 补充协调器、多实例、注销、主题和 marker 转换测试
  - _Requirements: R3, R4, R8, R10_

- [ ] Task 9：完善内置与外部组件提示质量
  - [ ] 为公共配置字段提供中文 title 和 description
  - [ ] 确认内置 manifest props 字段具有足够的类型和约束提示
  - [ ] 对缺失 metadata 的内置字段补充必要说明
  - [ ] 验证指标卡 title/value/color 补全、Hover 和错误 marker
  - [ ] 验证未知 props 不进入建议且被实时和最终校验拒绝
  - _Requirements: R3, R4_

## P3：端到端验证与发布边界

- [ ] Task 10：补充 Web 浏览器级闭环测试
  - [ ] 创建独立的 `screen-component-json-editor.spec.ts`
  - [ ] 验证 Monaco 首次打开前后网络请求差异
  - [ ] 验证无 Monaco CDN 请求且 Worker 同源
  - [ ] 验证指标卡专属补全和非法值 marker
  - [ ] 验证合法配置应用后画布即时变化
  - [ ] 验证 optional 字段删除、项目 undo/redo、保存和重载
  - [ ] 验证草稿关闭确认、并发冲突、目标删除和只读场景
  - [ ] 验证浅色、深色、桌面和窄视口无布局重叠
  - _Requirements: R2, R3, R4, R5, R6, R7, R10_

- [ ] Task 11：验证 Web 构建和 SDK 隔离
  - [ ] 构建 Web 并确认 Monaco、JSON Worker、Editor Worker 为按需资产
  - [ ] 检查 Web 产物不存在 CDN 地址和不必要 language worker
  - [ ] 构建 SDK 并检查源码、产物和 sourcemap 不包含 Monaco
  - [ ] 运行 SDK size 门并保持现有 `976.6 KiB gzip` 上限
  - [ ] 运行 SDK tarball consumer 验证
  - [ ] 记录 Monaco 懒加载资产体积，不以提高 SDK 门槛掩盖依赖泄漏
  - _Requirements: R2, R8, R9_

- [ ] Task 12：同步现状文档并完成质量门
  - [ ] 实现完成后更新 `docs/specs/screen-editor/README.md`
  - [ ] 实现完成后更新 `docs/architecture/screen-editor-architecture.md`
  - [ ] 更新本目录 `checklist.md` 和文档状态
  - [ ] 运行 Biome、core/web 测试、typecheck、lint、Web build、SDK build/size/tarball 和定向 E2E
  - [ ] 完成浏览器手动验收并记录未验证项
  - _Requirements: R1-R10_

## Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 可与 Task 2 并行，但必须使用 Task 1 的配置类型和结构比较语义。
- Task 4 依赖 Task 1 的通用编辑器数据契约。
- Task 5 依赖 Task 1、Task 3、Task 4。
- Task 6 依赖 Task 4、Task 5。
- Task 7 依赖 Task 4，且不得反向向 Core 引入 Monaco。
- Task 8 依赖 Task 2、Task 7。
- Task 9 依赖 Task 2、Task 8。
- Task 10 依赖 Task 5-Task 9。
- Task 11 依赖 Task 7-Task 9。
- Task 12 依赖全部功能和验证任务。

## Increment Checkpoints

- **Checkpoint A（契约）**：纯函数、动态 Schema 和 Store 原子替换通过单测，不涉及 Monaco。
- **Checkpoint B（Core）**：假编辑器可完成入口、草稿、校验、应用、历史、冲突和只读闭环。
- **Checkpoint C（Web）**：真实 Monaco 支持选中组件专属补全、Hover、marker 和同源 Worker。
- **Checkpoint D（发布）**：Web E2E 完成，SDK 不含 Monaco 且 size 门通过，文档与实现一致。
