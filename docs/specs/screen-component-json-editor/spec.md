# 大屏组件 JSON 配置编辑器 Spec

> 状态：实施中
> 最近更新：2026-08-02
> 定位：定义在 Nebula Web 大屏设计器中使用 Monaco Editor 直接编辑选中组件完整可变配置的产品、架构、校验、补全和验收契约

> 实施状态：核心配置替换、Core 注入壳层、Web Monaco、同源 Worker、动态 Schema、自动化测试和 SDK 发布边界已落实；完整手工验收矩阵见 [checklist.md](./checklist.md)。

## 1. 背景

大屏设计器当前通过声明式属性面板编辑组件。该方式适合常规操作，但高级用户在以下场景中效率较低：

- 需要一次修改多个嵌套字段。
- 需要查看组件当前配置的完整结构。
- 需要删除 `dataSource`、`logic`、`interaction` 等可选配置。
- 外部组件通过 manifest 扩展后，希望直接按组件 Schema 编辑 `props`。
- 排查属性面板与实际持久化配置之间的差异。

现有“工具 → 代码编辑”仅提供占位入口，没有编辑、校验、历史记录或持久化能力。系统需要提供正式的组件 JSON 配置编辑器，并确保直接编辑不能绕过组件注册表、能力边界和项目历史栈。

## 2. 目标

- 允许用户直接编辑单个选中组件的完整可变配置。
- 使用 Monaco Editor 提供 JSON 高亮、搜索、折叠、格式化、代码补全、Hover 和实时诊断。
- 根据选中组件、当前 registry 和运行能力动态生成专属 JSON Schema。
- 对内置组件和宿主组件统一执行 manifest `propsSchema` 校验。
- 保护组件身份、分组关系和项目级事件蓝图不被组件 JSON 编辑破坏。
- 一次“应用”形成一次原子 Store 更新和一条撤销历史。
- Monaco 仅由 Nebula Web 按需加载，不进入可发布的 `@nebula/screen-sdk`。
- 保持现有保存、冲突检测、预览和发布接口不变。

## 3. 非目标

本规格不包含：

- 编辑整个项目文档、画布配置、全局变量或事件蓝图 JSON。
- 修改组件 `id`、`type` 或 `parentId`。
- 在 JSON 中声明或加载 `tagName`、`moduleUrl`、`script` 等可执行资源。
- 支持 JavaScript、CSS、自定义脚本或表达式执行。
- 支持 JSON5、注释、尾随逗号或其他非标准 JSON 语法。
- 将 Monaco 内置到 `@nebula/screen-sdk` 或对 SDK 宿主公开 Monaco 配置 API。
- 首期提供数据集名称、远程字段元数据、API 响应字段等异步业务值补全。
- 替代现有属性面板；表单编辑和 JSON 编辑长期并存。

## 4. 已确认决策

| 决策项 | 结论 |
| --- | --- |
| 编辑器实现 | Monaco Editor |
| 发布范围 | 仅 `apps/web`，不进入 `screen-editor-core` 依赖图或 `screen-sdk` 产物 |
| 编辑对象 | 单个选中组件 |
| 编辑范围 | `name`、`position`、`style`、`props`、`dataSource`、`logic`、`interaction`、`status`、`zIndex` |
| 受保护字段 | `id`、`type`、`parentId`，只读展示但不进入可编辑 JSON |
| 事件配置 | 继续由项目级 `blueprint` 管理 |
| 提交语义 | 校验后精确替换完整可变配置，不使用浅合并模拟删除 |
| 编辑历史 | Monaco 内部草稿历史与项目历史隔离；应用后项目历史只增加一条 |
| JSON 方言 | 严格 JSON |
| 后端影响 | 无新 API、无数据库迁移 |

## 5. 产品与交互规格

### 5.1 入口

Nebula Web 提供两个入口：

1. 右侧属性面板头部的 `Braces` 图标按钮，tooltip 为“编辑组件 JSON”。
2. “工具”菜单中的“组件 JSON...”命令。

入口规则：

- 单选组件时可用。
- 未选中或多选时，工具菜单命令禁用，属性面板不显示 JSON 按钮。
- 未注入 JSON 编辑器能力时不显示命令；因此 SDK 编辑器不展示该入口。
- 只读模式下命令显示为“查看组件 JSON...”，允许查看和复制，不允许修改或应用。

### 5.2 浮动 Dialog

编辑器使用右上浮动 Dialog，不使用居中弹窗或底部 Sheet，布局如下：

```text
┌──────────────────────────────────────────────────────────────┐
│ 组件 JSON  组件名称 / 类型 / ID                         关闭 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                      Monaco Editor                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ 诊断摘要：路径 + 用户可读消息                                │
├──────────────────────────────────────────────────────────────┤
│ 格式化                                      取消       应用  │
└──────────────────────────────────────────────────────────────┘
```

稳定尺寸约束：

- 桌面端锚定在右上角，避开顶部工具栏；不使用 `top/left: 50%` 或居中 translate。
- 高度为 `min(72dvh, 48rem)`，宽度为 `min(46rem, calc(100vw - 2rem))`。
- 窄视口保留四周边距并从顶部开始展示，最大化可用编辑面积。
- Dialog 为非模态工具窗，不渲染编辑器遮罩层；画布保持可见和可交互。
- 主编辑器 Dialog 打开和关闭时不使用淡入、缩放或其他过渡动画。
- 标题栏提供拖拽手柄，拖拽位置限制在视口边距内。移动帧仅更新 GPU transform，松开时才提交最终位置，避免 Monaco 触发每帧 React 重渲染。
- 头部、诊断区和操作栏固定；Monaco 占据剩余空间。
- Monaco 启用 `automaticLayout`，跟随 Dialog 和视口尺寸变化。
- 不使用嵌套卡片，不在编辑器内容上叠加说明性遮罩。
- 主编辑器 Dialog 不使用 overlay；草稿放弃确认仍使用独立 AlertDialog。
- 在窄视口中操作按钮允许换行，但不得与标题、诊断或编辑器重叠。

### 5.3 视觉规格

- 视觉方向：工业化、工具化、紧凑，服从现有大屏设计器视觉体系。
- 外壳继续使用 shadcn/ui、现有语义色和 Geist Variable。
- Monaco 浅色模式使用 `light`，深色模式使用 `vs-dark`。
- 编辑区使用 Monaco 默认等宽字体，字间距固定为 `0`。
- 语法错误和业务错误均使用编辑器 marker；诊断区显示去重后的首要问题。
- 图标统一使用 Lucide，不新增自绘 SVG。

### 5.4 草稿与关闭行为

- 打开 Dialog 时捕获固定的 `componentId` 和配置 baseline。
- Dialog 打开后，即使外部选择状态变化，也不得静默切换编辑目标。
- Monaco 输入只更新本地草稿，不写 Store、不设置 `isDirty`、不进入项目历史。
- 草稿有变化时关闭 Dialog，系统必须要求确认是否放弃修改。
- 草稿无变化时可直接关闭。
- “格式化”只格式化本地草稿，不写 Store。
- “取消”放弃草稿并关闭。
- “应用”成功后关闭 Dialog；失败时保留草稿和诊断。

## 6. 编辑数据契约

### 6.1 可编辑配置

```ts
export type EditableScreenComponentConfig = Pick<
  ScreenComponent,
  | 'name'
  | 'position'
  | 'style'
  | 'props'
  | 'dataSource'
  | 'logic'
  | 'interaction'
  | 'status'
  | 'zIndex'
>;

export type ProtectedScreenComponentIdentity = Pick<
  ScreenComponent,
  'id' | 'type' | 'parentId'
>;
```

序列化规则：

- 使用 `JSON.stringify(config, null, 2)`。
- 可选字段值为 `undefined` 时不输出该字段。
- 属性顺序以固定的可编辑字段顺序输出，减少无意义 diff。
- `id`、`type`、`parentId` 只在 Dialog 头部展示，不进入 Monaco model。

### 6.2 精确替换命令

Store 新增原子命令，语义如下：

```ts
export interface ReplaceComponentConfigCommand {
  componentId: string;
  baseline: EditableScreenComponentConfig;
  next: EditableScreenComponentConfig;
}

export type ReplaceComponentConfigResult =
  | 'updated'
  | 'unchanged'
  | 'conflict'
  | 'missing'
  | 'readonly';
```

执行规则：

1. 根据 `componentId` 读取当前组件。
2. 目标不存在时返回 `missing`，不得入历史。
3. 只读状态返回 `readonly`，不得入历史。
4. 当前可编辑配置与 `baseline` 不一致时返回 `conflict`，不得覆盖外部更新。
5. `next` 与当前配置结构等价时返回 `unchanged`，不得入历史或置脏。
6. 更新时保留当前组件的 `id`、`type`、`parentId`，精确替换其余可编辑字段。
7. 更新成功只调用一次 `withHistory`，返回 `updated`。

结构比较必须忽略对象键顺序，但不得忽略数组顺序或有效值差异。

### 6.3 编辑器注入契约

`screen-editor-core` 不依赖 Monaco，只定义宿主可选注入契约：

```ts
export interface ComponentJsonEditorDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: ReadonlyArray<string | number>;
  startLineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
}

export interface ComponentJsonEditorProps {
  ariaLabel: string;
  jsonSchema: Readonly<Record<string, ScreenComponentJsonValue>>;
  modelUri: string;
  readOnly: boolean;
  theme: 'light' | 'dark';
  value: string;
  onChange: (value: string) => void;
  onDiagnosticsChange: (diagnostics: readonly ComponentJsonEditorDiagnostic[]) => void;
}

export type ComponentJsonEditorComponent = ComponentType<ComponentJsonEditorProps>;
```

`ScreenEditorWorkbenchProps` 增加可选的 `componentJsonEditor`。只有传入该能力时，Workbench 才显示入口并允许打开 Dialog。

## 7. 动态 JSON Schema 与代码补全

### 7.1 Schema 组成

每次打开组件 JSON 编辑器时，系统根据以下输入生成一份 Draft 7 JSON Schema：

```text
可编辑公共配置 Schema
  + 当前 capability profile 的数据源限制
  + 当前 registry registration/source
  + 当前 manifest.propsSchema
  + manifest.defaultProps 提供的默认值提示
  = 当前 Monaco model 的最终 JSON Schema
```

公共 Schema 必须为 strict object，`additionalProperties=false`。嵌套的 `position`、`style`、`dataSource`、`logic`、`interaction`、`status` 同样不得依赖 Zod 默认 strip 静默删除未知字段。

### 7.2 补全范围

| 上下文 | 补全与提示 |
| --- | --- |
| 根对象 | 所有可编辑字段名称、字段说明、必填状态 |
| `position` | `x/y/width/height/rotation`、数值类型和正数约束 |
| `style` | 已支持样式字段、枚举值、范围和说明 |
| `props` | 当前组件 manifest `propsSchema` 中的属性、类型、默认值、枚举、范围、pattern 和 description |
| `dataSource` | 根据 static/dynamic profile 提示允许的判别分支和条件字段 |
| `logic` | 排序字段、排序方向、limit 约束 |
| `interaction` | 当前共享交互字段及布尔值 |
| `status` | `locked/hidden` 布尔值 |
| `id/type/parentId` | 不补全、不允许写入 |

宿主组件规则：

- `props` 完全由其 manifest `propsSchema` 驱动。
- `source='host'` 时不建议 `dataSource`、`logic`、`interaction`，并在用户手工写入时报告不支持。
- manifest 中已有 `title`、`description`、`default`、`enum` 等元数据时必须保留。
- manifest 未声明 `default` 但 `defaultProps` 存在对应值时，可将其作为补全默认值提示，不得自动写入 Store。

### 7.3 示例：指标卡

选择 `example.indicator-card/v1` 后，`props` 应提供：

| 字段 | Monaco 提示 |
| --- | --- |
| `title` | string，最大 64 字符，标题说明 |
| `value` | number，最小值 0，数值说明 |
| `color` | string，匹配 `^#[0-9a-fA-F]{6}$`，主色说明 |

删除必填字段、输入负数或错误颜色时，Monaco 必须在对应位置显示错误 marker，最终应用校验也必须拒绝该草稿。

### 7.4 Monaco 建议配置

```ts
const editorOptions = {
  acceptSuggestionOnCommitCharacter: false,
  automaticLayout: true,
  formatOnPaste: true,
  formatOnType: true,
  minimap: { enabled: false },
  quickSuggestions: false,
  scrollBeyondLastLine: false,
  stickyScroll: { enabled: false },
  suggestOnTriggerCharacters: true,
  tabCompletion: 'on',
  tabSize: 2,
  wordBasedSuggestions: 'off',
  wordWrap: 'on',
} as const;
```

适配器基于当前 model 的最终 Schema 注册属性建议；输入 `{`、`,` 或 `"` 会触发建议，用户也可通过 Monaco 默认的 `Ctrl+Space` 打开建议。关闭 `acceptSuggestionOnCommitCharacter`，避免连续输入或粘贴 JSON 时意外接受建议。格式化仅作用于本地草稿。

## 8. Monaco Web 集成边界

### 8.1 依赖归属

运行时依赖只添加到 `apps/web/package.json`：

```json
{
  "@monaco-editor/react": "^4.7.0",
  "jsonc-parser": "^3.3.1",
  "monaco-editor": "^0.56.0"
}
```

禁止将上述依赖添加到：

- `packages/screen-editor-core/package.json`
- `packages/screen-sdk/package.json`
- `packages/shared/package.json`

### 8.2 懒加载

- Web Monaco 适配器必须通过 `React.lazy` 或等价动态导入加载。
- 访问大屏编辑器但未打开组件 JSON Dialog 时，不得请求 Monaco 主 chunk 或 Worker。
- 打开 Dialog 后显示明确加载状态；加载失败时显示可重试错误，不得退回 CDN。
- 关闭 Dialog 后销毁当前 model 和注册资源，但 Monaco 模块本身可由浏览器模块缓存复用。

### 8.3 Worker 与离线边界

仅打包两类 Worker：

- `monaco-editor/esm/vs/editor/editor.worker?worker`
- `monaco-editor/esm/vs/language/json/json.worker?worker`

规则：

- 通过 `self.MonacoEnvironment.getWorker` 分发 Worker。
- 使用 Vite 本地 loader shim 的 `loader.config({ monaco })` 强制使用本地 ESM Monaco；不得让 `@monaco-editor/loader` 的 CDN fallback 进入产物。
- 不加载 CSS、HTML、TypeScript 等无关 language worker。
- 所有 Monaco 和 Worker 请求必须为当前站点同源请求。
- 生产产物不得包含 jsDelivr、unpkg 或其他 Monaco CDN URL。
- 部署 CSP 至少需要允许 `worker-src 'self'`；实现不得要求 `unsafe-eval`。

### 8.4 多实例隔离

每次编辑会话创建唯一 model URI：

```text
inmemory://nebula-screen/<editor-instance>/<component-id>/<session-id>.json
```

Monaco JSON diagnostics 是全局配置，Web 适配层必须使用协调器维护活动 Schema：

1. 以 model URI 为 key 注册 `{ uri, fileMatch, schema }`。
2. 每次注册/注销后，用所有活动项刷新 `jsonDefaults.setDiagnosticsOptions`。
3. 卸载编辑器时注销当前项并 dispose model。
4. 不得覆盖同页其他编辑器实例的 Schema。

### 8.5 SDK 体积边界

当前 `@nebula/screen-sdk` 产物为 `893.0 KiB gzip`，现有门槛为 `976.6 KiB`。本功能必须满足：

- SDK 源码与产物不包含 `monaco-editor` 或 `@monaco-editor/react`。
- SDK 未注入编辑器能力时不显示占位或不可用入口。
- `pnpm --filter @nebula/screen-sdk size` 继续通过现有门槛。
- SDK boundary 脚本应将两个 Monaco 包列为 core/SDK 禁止依赖，防止后续回归。

## 9. 权威校验管线

Monaco Schema 用于编辑体验，不能替代应用边界的权威校验。点击“应用”时按顺序执行：

1. 使用严格 `JSON.parse` 解析草稿。
2. 确认根值是 plain object。
3. 使用 `checkJsonValue` 拒绝非有限数和 prototype pollution 键。
4. 使用 strict 可编辑配置 Schema 校验公共字段、未知字段和嵌套结构。
5. 将 baseline 的 `id`、`type`、`parentId` 与草稿配置组合为完整候选组件。
6. 使用 `ScreenComponentSchema` 校验共享组件约束。
7. 从当前实例 registry 获取 registration；缺失时 fail closed。
8. 使用 `validateValueAgainstSchema` 校验完整 `props`。
9. 校验 capability profile：static 模式不得引入 dynamic-only 配置。
10. 校验 registration source：宿主组件不得引入其 ABI 不支持的层。
11. 通过 Store 原子命令检查 baseline 冲突、无变化短路并提交。

失败规则：

- 任一阶段失败，项目保持不变。
- 不产生历史记录，不设置 `isDirty`。
- 诊断必须包含路径和用户可读消息。
- 诊断不得输出完整原始数据、请求头值或其他潜在敏感内容。
- 不得使用 `as any`、`@ts-ignore` 或静默 catch 绕过边界。

## 10. 历史、保存与预览

### 10.1 历史语义

- Monaco 本地输入和本地撤销不进入项目 history。
- Dialog 打开期间设计器快捷键挂起，`Ctrl/Cmd+Z` 由 Monaco 消费。
- 成功应用后项目 history.past 只增加一个应用前快照。
- 项目级 undo/redo 可恢复整次 JSON 配置替换。
- 删除可选字段后，undo 必须恢复被删除字段，redo 必须再次删除。

### 10.2 保存语义

- 应用只更新本地 Store，不自动保存。
- 成功应用后 `isDirty=true`，现有保存状态徽标显示未保存修改。
- 用户继续通过现有保存命令提交完整 `components`。
- 保存冲突继续使用 `expectedUpdatedAt` 与既有 409 流程。
- 本功能不修改后端 DTO、Service 或数据库结构。

### 10.3 预览语义

- 应用后编辑画布立即使用新配置渲染。
- 动态 Web 预览仍读取已保存草稿，因此未保存修改不应出现在独立预览页。
- 保存并重新加载后，组件配置必须保持一致。
- 发布和公开预览继续使用现有项目文档契约。

## 11. 并发、只读与异常状态

| 状态 | 行为 |
| --- | --- |
| 编辑目标被删除 | 显示目标不存在，禁用应用，关闭不写 Store |
| 当前配置偏离 baseline | 返回 conflict，保留草稿，要求关闭重开后重新编辑 |
| registry 中类型缺失 | fail closed，显示组件定义不可用 |
| Monaco 加载失败 | 显示重试，不回退 CDN，不写 Store |
| Worker 不可用 | 显示诊断服务不可用；应用仍必须走同步权威校验 |
| 只读模式 | Monaco `readOnly=true`，隐藏应用和格式化写操作，允许选择与复制 |
| 组件 Schema 更新 | 新打开会话使用新 Schema；已打开会话不静默切换目标或规则 |

## 12. 安全与隐私

- JSON 内容仅在当前浏览器内存中编辑，应用前不发送网络请求。
- 不记录 Monaco 内容、完整组件配置、API header 值或 Token。
- 错误上报只能包含诊断 code、路径和脱敏消息。
- 编辑器不得执行 JSON 中的字符串或加载 JSON 声明的模块。
- 组件 JSON 权限与现有大屏编辑页面权限一致，不新增公开路由。
- 只读状态必须由 Workbench 环境和 Store 写入边界共同保证，不能只依赖按钮禁用。

## 13. Requirements

### R1：单组件编辑范围

系统 SHALL 仅对单个选中组件提供完整可变配置 JSON 编辑，并保护组件身份与分组关系。

#### Scenario：打开组件 JSON

- **GIVEN** 用户在 Nebula Web 中单选一个组件
- **WHEN** 用户执行“编辑组件 JSON”
- **THEN** 系统打开该组件的 JSON Dialog
- **AND** JSON 包含全部可编辑字段
- **AND** `id`、`type`、`parentId` 只读展示且不出现在可编辑 JSON 中
- **AND** `blueprint` 不出现在组件 JSON 中

#### Scenario：无有效单选

- **GIVEN** 用户未选择组件或选择多个组件
- **WHEN** 用户查看 JSON 编辑入口
- **THEN** 系统不得允许打开组件 JSON 编辑器

### R2：Monaco 按需加载

系统 SHALL 仅在 Nebula Web 首次打开组件 JSON Dialog 时加载本地 Monaco 和必要 Worker。

#### Scenario：未打开编辑器

- **WHEN** 用户进入大屏编辑页但未打开组件 JSON
- **THEN** 页面不得请求 Monaco 主 chunk、JSON Worker 或 Editor Worker

#### Scenario：首次打开编辑器

- **WHEN** 用户首次打开组件 JSON
- **THEN** 系统从当前站点加载 Monaco 和必要 Worker
- **AND** 不访问任何 Monaco CDN

### R3：选中组件专属补全

系统 SHALL 使用当前组件 registry manifest 与公共配置 Schema 为 Monaco 提供专属补全和提示。

#### Scenario：编辑宿主指标卡 props

- **GIVEN** 当前组件类型为 `example.indicator-card/v1`
- **WHEN** 用户在 `props` 对象请求补全
- **THEN** Monaco 建议 `title`、`value`、`color`
- **AND** 建议详情显示对应类型、约束和说明
- **AND** 不建议其他未声明 props

#### Scenario：能力相关补全

- **GIVEN** 当前编辑器使用 static capability profile
- **WHEN** 用户编辑 `dataSource`
- **THEN** Monaco 只建议 static 模式允许的结构
- **AND** 不建议 API 或 dataset 分支

### R4：实时诊断与最终校验

系统 SHALL 同时提供 Monaco 实时诊断和独立的最终应用校验，并以最终校验作为写入边界。

#### Scenario：输入非法值

- **WHEN** 用户输入类型错误、未知字段、缺少必填字段或违反 manifest 约束的值
- **THEN** Monaco 在对应位置显示诊断
- **AND** 应用操作拒绝草稿
- **AND** Store、历史和 `isDirty` 保持不变

#### Scenario：Worker 诊断延迟或不可用

- **WHEN** Monaco 尚未返回 marker 或 Worker 不可用
- **AND** 用户执行应用
- **THEN** 同步权威校验仍然拒绝非法草稿

### R5：原子替换与历史

系统 SHALL 将一次合法应用作为一个原子项目修改提交，并支持项目级撤销和重做。

#### Scenario：应用合法配置

- **WHEN** 用户应用与当前配置不同的合法 JSON
- **THEN** 组件可变配置被精确替换
- **AND** `id`、`type`、`parentId` 保持不变
- **AND** 历史只增加一条记录
- **AND** `isDirty=true`
- **AND** 编辑画布立即反映新配置

#### Scenario：删除可选字段

- **WHEN** 用户从 JSON 删除已有 `dataSource`、`logic` 或 `interaction`
- **THEN** 应用后对应字段从组件配置中真正移除
- **AND** undo/redo 可恢复和再次删除该字段

#### Scenario：无变化应用

- **WHEN** 草稿与当前配置结构等价
- **THEN** 系统不新增历史、不设置脏状态

### R6：草稿隔离与冲突保护

系统 SHALL 在 Dialog 内隔离草稿，并阻止草稿覆盖打开后发生的外部组件更新。

#### Scenario：未应用草稿

- **WHEN** 用户在 Monaco 中编辑但尚未应用
- **THEN** Store、画布、保存状态和项目历史保持不变

#### Scenario：外部配置变化

- **GIVEN** Dialog 打开后当前组件配置已被其他来源修改
- **WHEN** 用户应用原草稿
- **THEN** Store 原子命令返回 conflict
- **AND** 系统保留草稿并提示重新打开
- **AND** 不覆盖外部修改

### R7：只读模式

系统 SHALL 允许只读用户查看和复制组件 JSON，但不得修改项目。

#### Scenario：只读查看

- **GIVEN** Workbench 处于只读状态且单选组件
- **WHEN** 用户打开组件 JSON
- **THEN** Monaco 以只读模式显示配置
- **AND** 不显示应用操作
- **AND** Store 写入边界继续拒绝替换命令

### R8：多实例和资源清理

系统 SHALL 隔离同页多个 Monaco model 的 Schema，并在编辑器关闭或卸载时释放资源。

#### Scenario：两个编辑器实例

- **GIVEN** 同页存在两个 Nebula Web 编辑器并分别打开不同组件 JSON
- **WHEN** 两个 Monaco model 同时活动
- **THEN** 每个 model 只接收与自身 URI 匹配的 Schema
- **AND** 一个实例关闭不会移除另一个实例的 Schema

#### Scenario：关闭 Dialog

- **WHEN** 用户关闭组件 JSON Dialog
- **THEN** 当前 model、Schema 注册和事件订阅被释放
- **AND** 不存在持续增长的 model 或 listener

### R9：SDK 包边界

系统 SHALL 保持 Monaco 为 Web-only 实现，不改变 SDK 的依赖和体积边界。

#### Scenario：构建 SDK

- **WHEN** 构建并检查 `@nebula/screen-sdk`
- **THEN** SDK 源码和产物不包含 Monaco 包引用
- **AND** SDK size 门继续通过
- **AND** SDK 编辑器不显示组件 JSON 入口

### R10：可访问性与响应式

系统 SHALL 使组件 JSON Dialog 可通过键盘和辅助技术操作，并在支持的设计器视口内保持布局稳定。

#### Scenario：键盘编辑

- **WHEN** 焦点位于 Monaco
- **THEN** 设计器全局快捷键被挂起
- **AND** Monaco 搜索、补全、撤销和编辑快捷键正常工作
- **AND** 焦点不会无故跳回画布

#### Scenario：视口变化

- **WHEN** 浏览器尺寸或右侧面板状态变化
- **THEN** Monaco 自动重新布局
- **AND** 标题、编辑器、诊断和操作按钮不重叠

## 14. 测试策略

| 层级 | 必测内容 |
| --- | --- |
| 纯函数单测 | 序列化顺序、严格 JSON、根对象、未知字段、Infinity、污染键、manifest props、static/dynamic、host capability、诊断路径、Schema 生成 |
| Store 单测 | 精确替换、可选字段删除、无变化、missing、conflict、readonly、一条历史、undo/redo、dirty |
| Core 组件测试 | 能力注入、单选入口、草稿隔离、格式化、取消、放弃确认、错误展示、目标删除、并发变化、只读 |
| Web 适配测试 | 本地 loader 配置、唯一 model URI、Schema 注册/注销、主题切换、marker 转换、资源 dispose |
| Web E2E | 懒加载、补全可见、非法指标卡配置、合法应用、画布更新、撤销重做、保存、重载、无 CDN 请求 |
| SDK 回归 | boundary、build、size、tarball、SDK UI 无组件 JSON 入口 |
| 视觉检查 | 桌面与窄视口 Dialog 截图、无重叠、浅色/深色 Monaco、加载和错误状态 |

测试原则：

- 测业务约束和安全边界，不测试 Monaco 或 Zod 框架自身能力。
- Core 组件测试使用假编辑器实现，不在 jsdom 中启动真实 Monaco Worker。
- 真实 Monaco、Worker、补全和懒加载行为由 Web Playwright 覆盖。

## 15. 质量门

实现完成后至少执行：

```bash
pnpm biome:fix
pnpm biome:check
pnpm --filter @nebula/screen-editor-core test
pnpm --filter @nebula/screen-editor-core typecheck
pnpm --filter @nebula/screen-editor-core lint
pnpm --filter @nebula/web test
pnpm --filter @nebula/web typecheck
pnpm --filter @nebula/web lint
pnpm --filter @nebula/web build
pnpm --filter @nebula/screen-sdk build
pnpm --filter @nebula/screen-sdk size
pnpm --filter @nebula/screen-sdk verify:tarball
pnpm --filter @nebula/web e2e -- screen-component-json-editor.spec.ts
```

构建后还必须确认：

- Web 初始编辑器路由未预加载 Monaco。
- Web 产物仅包含需要的 Monaco/JSON/editor Worker 资产。
- Web 产物不包含 Monaco CDN 地址。
- SDK 产物不包含 `monaco` 字符串或相关模块。

## 16. 验收边界

以下全部满足后，本功能方可从“设计中”转为“生效中”：

1. 单选组件可打开 Monaco 并编辑完整可变配置。
2. Monaco 补全和 Hover 随当前组件类型变化，外部指标卡字段准确。
3. 非法 JSON 和违反 manifest/能力边界的配置无法进入 Store。
4. 合法应用形成一条历史，支持可选字段删除、undo/redo、保存和重载。
5. 草稿、并发变化、目标删除和只读状态均 fail closed。
6. Monaco 仅在 Web 打开 Dialog 后按需加载，全部资源同源。
7. SDK 不包含 Monaco，现有 size 门通过。
8. 自动化测试、浏览器验收和文档同步全部完成。

## 17. 关联文档

- [大屏编辑器功能规格](../screen-editor/README.md)
- [大屏设计器架构](../../architecture/screen-editor-architecture.md)
- [大屏组件作者指南](../screen-component-sdk/component-author-guide.md)
- [编码规范](../../conventions/coding-standards.md)
- [任务分解](./tasks.md)
- [验收清单](./checklist.md)
