# Checklist

## P0：四大类统一分类基础

- [ ] PropertyTabId 注释更新，明确 4 个 tab 的语义边界
- [ ] section-renderer tab 容器策略修复：涉及 2+ tab 时始终启用 Tabs（含 customRender 分区）
- [ ] section-renderer.test.tsx 新增测试用例覆盖 customRender 分区的 tab 容器
- [ ] bar-chart BAR_CHART_SCHEMA 重组为按 tab 分布的多个分区
- [ ] bar-chart-config-sections.tsx 拆分为可独立渲染的子组件
- [ ] bar-chart 原有所有配置项仍可用（数据源/字段映射/API 测试/排序/标题/tooltip）
- [ ] bar-chart 现有测试通过
- [ ] LAYER_STATUS_SECTION 新增（名称/zIndex/锁定/隐藏）
- [ ] LAYER_STATUS_SECTION 接入 DEFAULT/TEXT/BAR_CHART_SCHEMA
- [ ] 锁定/隐藏状态与 editor-store 现有 API 数据一致

## P0：事件 Tab 派生视图

- [x] QuickEventEditor 组件创建，接收 componentId prop
- [x] 复用 filter-by-component.ts 派生规则列表
- [x] 渲染两组列表（触发器作为源 + 动作作为目标）
- [x] 「+ 添加触发器」按钮提供常见快速规则模板
- [x] 「删除规则」按钮正确删除 trigger 节点及下游
- [x] 「打开事件蓝图」按钮调用 editor-store.openBlueprintSheet({ focusComponentId })
- [x] editor-store.openBlueprintSheet API 支持 focusComponentId 参数
- [x] QuickEventEditor 接入 BAR_CHART_SCHEMA 与 DEFAULT_SCHEMA 的 events tab
- [x] quick-event-editor.test.tsx 单元测试覆盖派生视图与 CRUD 操作
- [x] 写操作走 editor-store 蓝图 API，历史栈三重快照正确

## P0：空状态与未选中视图

- [ ] 未选中组件时显示画布设置 + 全局变量入口占位
- [ ] 各组件 schema 的空 tab 显示空状态提示文案
- [ ] 空 tab 仍显示 tab 头，内容区显示提示

## P1：组件滤镜

- [x] ComponentStyleSchema 新增 filter 字段（6 个参数，含默认值）
- [x] screen.schema.test.ts 覆盖 filter 默认值与边界值
- [x] screen-canvas.tsx 渲染层将 style.filter 转换为 CSS filter 字符串
- [x] FILTER_SECTION 新增（6 个 number 控件）
- [x] FILTER_SECTION 接入 DEFAULT/TEXT/BAR_CHART_SCHEMA
- [x] 预览模式与发布模式滤镜均生效

## P1：文本细化配置

- [ ] ComponentStyleSchema 新增 letterSpacing / textStrokeWidth / textStrokeColor 字段
- [ ] TEXT_PROPS_SECTION 扩展 3 个字段
- [ ] text-component.tsx 渲染层应用 letter-spacing 与 -webkit-text-stroke
- [ ] text-component.test.tsx 含字间距与描边的渲染快照测试通过

## P1：全局变量机制

- [ ] GlobalVariableSchema 定义（id/name/type/value/apiConfig/expression）
- [ ] ScreenProjectSchema 新增 globalVariables 字段（默认空数组）
- [ ] editor-store 新增 addGlobalVariable / updateGlobalVariable / removeGlobalVariable API
- [ ] template-interpolation.ts 支持 {{globalVars.xxx}} 插值
- [ ] 数据源 API 配置字段支持插值（预览模式下生效）
- [ ] template-interpolation.test.ts 覆盖全局变量插值
- [ ] GlobalVariablesPanel 组件创建，渲染列表 + CRUD
- [ ] GlobalVariablesPanel 接入 property-panel 未选中分支
- [ ] 编辑表单根据类型动态显示字段
- [ ] global-variables-panel.test.tsx 覆盖 CRUD 操作

## P2：文档与质量门

- [ ] docs/architecture/screen-editor-architecture.md 属性面板章节更新
- [ ] docs/specs/screen-editor/README.md §7 与 §10 更新
- [ ] docs/architecture/blueprint-runtime-architecture.md 新增「右侧面板派生视图」章节
- [ ] 根目录 pnpm lint 零错误（含 web/shared/nestjs-server）
- [ ] 根目录 pnpm typecheck 零错误
- [ ] 根目录 pnpm test 无回归
