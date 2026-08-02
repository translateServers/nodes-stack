# 大屏组件 JSON 配置编辑器 Checklist

> 状态：设计中
> 最近更新：2026-08-02
> 定位：供产品验收、开发自验和发布评审使用的组件 JSON 编辑器检查清单

> 当前仅完成规格设计，以下实现与验收项均未执行。

## 规格确认

- [ ] 用户确认编辑范围为单个选中组件的完整可变配置
- [ ] 用户确认 `id`、`type`、`parentId` 受保护
- [ ] 用户确认事件继续由蓝图管理
- [ ] 用户确认编辑器使用 Monaco Editor
- [ ] 用户确认 Monaco 仅发布到 Nebula Web，不内置到 SDK
- [ ] 用户确认严格 JSON，不支持 JSON5、注释或脚本

## 入口与布局

- [ ] 单选组件时属性面板显示 `Braces` JSON 入口
- [ ] 工具菜单显示“组件 JSON...”命令
- [ ] 未选中和多选时无法打开组件 JSON 编辑器
- [ ] 未注入编辑器能力时不显示入口
- [ ] SDK 编辑器不显示组件 JSON 入口
- [ ] Sheet 头部显示组件名称、类型和 ID
- [ ] Monaco、诊断区和操作栏尺寸稳定且无重叠
- [ ] 桌面、窄视口、浅色和深色模式布局可用
- [ ] 图标、tooltip、按钮和对话框符合现有编辑器设计系统

## 编辑范围与身份保护

- [ ] JSON 包含 `name`
- [ ] JSON 包含 `position`
- [ ] JSON 包含 `style`
- [ ] JSON 包含 `props`
- [ ] JSON 支持可选 `dataSource`
- [ ] JSON 支持可选 `logic`
- [ ] JSON 支持可选 `interaction`
- [ ] JSON 包含 `status`
- [ ] JSON 包含 `zIndex`
- [ ] JSON 不包含 `id`
- [ ] JSON 不包含 `type`
- [ ] JSON 不包含 `parentId`
- [ ] JSON 不包含 `blueprint`
- [ ] 应用后组件 `id/type/parentId` 保持不变

## Monaco 功能

- [ ] JSON 语法高亮正常
- [ ] 行号、括号匹配、折叠和搜索正常
- [ ] Monaco 本地 undo/redo 正常
- [ ] 文档格式化正常且只修改本地草稿
- [ ] Monaco 默认的 `Ctrl+Space` 可打开补全
- [ ] 属性名和枚举值自动建议正常
- [ ] Hover 显示字段说明和约束
- [ ] 类型、必填、范围、pattern 和未知字段 marker 正常
- [ ] `wordBasedSuggestions` 关闭，不显示无关单词建议
- [ ] Monaco 随 Sheet 和视口自动布局
- [ ] Monaco 加载失败时可重试且不回退 CDN

## 动态 Schema 与组件提示

- [ ] 公共可编辑字段使用 strict Draft 7 JSON Schema
- [ ] 根对象和已定义嵌套对象拒绝未知字段
- [ ] `props` Schema 来自当前实例 registry manifest
- [ ] manifest title、description、default、enum、范围和 pattern 被保留
- [ ] `defaultProps` 可补充默认值提示但不自动写入 Store
- [ ] 文本组件补全 `content`
- [ ] 柱状图补全 `title`、`data` 和允许的数据配置
- [ ] 指标卡补全 `title`、`value`、`color`
- [ ] 指标卡负数 value 和错误 color 显示准确 marker
- [ ] static profile 不建议 API/dataset 数据源
- [ ] dynamic profile 只建议动态模式实际支持的分支
- [ ] host 组件不建议其 ABI 不支持的 `dataSource/logic/interaction`
- [ ] 两个并行编辑器的 Schema 不互相覆盖

## 权威校验

- [ ] 非法 JSON 被拒绝
- [ ] JSON 根值非 object 被拒绝
- [ ] `NaN`/`Infinity` 等非 JSON 数值被拒绝
- [ ] prototype pollution 键被拒绝
- [ ] 未知公共配置字段被拒绝且不被静默 strip
- [ ] 共享 `ScreenComponentSchema` 约束生效
- [ ] manifest `propsSchema` 约束生效
- [ ] registry 缺失组件定义时 fail closed
- [ ] static/dynamic capability 边界生效
- [ ] host registration capability 边界生效
- [ ] Worker 延迟或失败时最终同步校验仍生效
- [ ] 诊断包含路径和用户可读消息
- [ ] 诊断不包含完整原始数据、header 值或 Token
- [ ] 任一校验失败均不写 Store、不入历史、不置脏

## 草稿、提交与历史

- [ ] Monaco 输入仅更新本地草稿
- [ ] 未应用草稿不会更新画布
- [ ] 未应用草稿不会设置 `isDirty`
- [ ] 未应用草稿不会增加项目历史
- [ ] 脏草稿关闭时出现放弃确认
- [ ] 无变化关闭或取消不产生副作用
- [ ] 无变化应用不入历史且不置脏
- [ ] 合法应用只产生一条历史
- [ ] 合法应用后 `isDirty=true`
- [ ] 编辑画布立即反映新配置
- [ ] 删除 optional 字段后字段真正消失
- [ ] 项目 undo 恢复整次应用前配置
- [ ] 项目 redo 恢复整次应用后配置
- [ ] 保存请求包含应用后的组件配置
- [ ] 保存并重载后配置保持一致

## 并发与异常状态

- [ ] Sheet 打开后不会因外部选择变化静默切换目标
- [ ] 目标组件被删除时禁用应用且不写 Store
- [ ] 当前配置偏离 baseline 时返回 conflict
- [ ] conflict 不覆盖外部配置且保留用户草稿
- [ ] registry 变化或缺失时显示明确错误
- [ ] model、Schema 和订阅在关闭时释放
- [ ] 重复打开关闭不会持续增加 Monaco model

## 只读与安全

- [ ] 只读模式可查看和复制 JSON
- [ ] 只读 Monaco 无法修改内容
- [ ] 只读模式不显示应用操作
- [ ] Store 写入边界拒绝只读替换命令
- [ ] JSON 内容不会被日志或错误上报记录
- [ ] JSON 字符串不会被执行
- [ ] JSON 不可声明或加载脚本/module URL
- [ ] 本功能不新增公开路由、后端 API 或数据库字段

## Web-only Monaco 边界

- [ ] Monaco 依赖只存在于 `apps/web/package.json`
- [ ] `screen-editor-core` 不导入 Monaco 包或类型
- [ ] `screen-sdk` 不声明 Monaco 依赖
- [ ] Web 未打开 Sheet 时不请求 Monaco 主 chunk
- [ ] Web 首次打开 Sheet 后按需请求 Monaco
- [ ] 仅输出 JSON Worker 和 Editor Worker
- [ ] Monaco 与 Worker 请求均为同源
- [ ] Web 产物不包含 Monaco CDN URL
- [ ] SDK boundary 将 Monaco 包列为禁止依赖
- [ ] SDK 源码、产物和 sourcemap 不包含 Monaco
- [ ] SDK gzip size 保持在现有 `976.6 KiB` 门槛内
- [ ] SDK tarball consumer 验证通过

## 自动化测试

- [ ] 纯函数测试覆盖序列化、解析、Schema 和全部校验分支
- [ ] Store 测试覆盖五种替换结果、history、dirty 和 undo/redo
- [ ] Core Sheet 测试使用假编辑器覆盖完整状态流
- [ ] 属性面板和工具菜单测试覆盖所有入口状态
- [ ] Web Monaco 适配测试覆盖 loader、model、Schema、marker 和 dispose
- [ ] Web E2E 覆盖懒加载、补全、非法配置和合法应用
- [ ] Web E2E 覆盖 optional 删除、undo/redo、保存和重载
- [ ] Web E2E 覆盖无 CDN、同源 Worker、只读和并发冲突
- [ ] SDK boundary、build、size 和 tarball 回归通过

## 质量门

- [ ] `pnpm biome:fix` 已执行
- [ ] `pnpm biome:check` 通过
- [ ] `pnpm --filter @nebula/screen-editor-core test` 通过
- [ ] `pnpm --filter @nebula/screen-editor-core typecheck` 通过
- [ ] `pnpm --filter @nebula/screen-editor-core lint` 通过
- [ ] `pnpm --filter @nebula/web test` 通过
- [ ] `pnpm --filter @nebula/web typecheck` 通过
- [ ] `pnpm --filter @nebula/web lint` 通过
- [ ] `pnpm --filter @nebula/web build` 通过
- [ ] `pnpm --filter @nebula/screen-sdk build` 通过
- [ ] `pnpm --filter @nebula/screen-sdk size` 通过
- [ ] `pnpm --filter @nebula/screen-sdk verify:tarball` 通过
- [ ] 定向 Playwright E2E 通过

## 手动验收路径

- [ ] 选择文本组件，补全并修改 `props.content`，应用后画布立即更新
- [ ] 选择指标卡，在空 `props` 中触发补全并检查 title/value/color 提示
- [ ] 输入负数 value，确认 Monaco 和应用校验均拒绝
- [ ] 输入合法指标卡配置，确认一次应用只增加一条历史
- [ ] 删除已有 optional 配置，确认应用、undo 和 redo 行为正确
- [ ] 输入草稿后关闭，确认放弃修改提示
- [ ] 打开期间模拟外部更新，确认 conflict 且不覆盖
- [ ] 保存并刷新页面，确认配置持久化
- [ ] 切换浅色/深色主题，确认 Monaco 与外壳可读
- [ ] 在窄视口检查标题、诊断和操作栏无重叠
- [ ] 在只读模式查看并复制 JSON，确认无法写入
- [ ] 在 SDK Host 检查组件 JSON 入口不存在且 SDK 体积门通过
