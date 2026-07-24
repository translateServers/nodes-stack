# 规范文档

> 定位：所有开发者都要遵守的约定与标准。**编码前必读**，保证代码一致性。

## 核心定位

conventions 是**编码前的必读规范**。与 `.trae/rules/project_rules.md` 的关系：`project_rules.md` 是 AI 专用规则（机器读），本目录是人类协作者规范（人读），两者内容对应但本目录可包含更多解释与示例。

## 文档清单

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [_structure.md](../_structure.md) | 生效中（2026-07-24） | 文档编写规范（格式、元信息、命名） |
| [coding-standards.md](./coding-standards.md) | 生效中（2026-07-24） | 编码规范总集。代码质量三件套、TypeScript 配置、UI 组件选型边界、React Flow 约定、数据层约定、状态管理、工具系统、画布交互、后端编码、前端 API 客户端、测试约定、提交规范、路由与导航 |
| _待创建_ | — | API 设计规范（命名、响应格式、错误码、BizCode 段位分配）— 已在 coding-standards.md 第 9-10 节覆盖，可独立细化 |
| _待创建_ | — | 测试规范（何时写测试、覆盖率、命名、mock 约定）— 已在 coding-standards.md 第 11 节覆盖，可独立细化 |

## 现有规则来源

以下文件包含已有的开发约定，conventions 文档已将其内容结构化沉淀：

| 来源文件 | 内容 | 对应 conventions 文档 |
|---|---|---|
| `.trae/rules/project_rules.md` | TypeScript/ESLint/Biome/测试/工作流规范 | coding-standards.md |
| `AGENTS.md` | 项目结构、常用命令、AI agent 指导 | architecture/system-overview.md + development-guide.md |
| `packages/eslint-config/` | 共享 ESLint 配置（类型感知规则） | coding-standards.md 第 1 节 |
| `biome.json` | Biome 格式化与基础 lint 配置 | coding-standards.md 第 1 节 |

## 关键约定速查

以下约定已在项目中执行，详见 [coding-standards.md](./coding-standards.md)：

- **Biome 负责格式化**与基础 lint，ESLint 负责 TypeScript 类型感知规则，ESLint 不启用 `prettier/prettier`
- **编辑器外壳**必须用 shadcn/ui，**Canvas 渲染组件**禁止用 shadcn/ui
- React Flow 目标 Handle 必须有 `id="in"`，`@xyflow/react/dist/style.css` 必须在使用处导入
- `DataSourceConfig` 使用 `z.discriminatedUnion('type', [...])`，新增类型添加新分支
- 组件配置四层分层：数据层 / 逻辑层 / 视觉层 / 交互层
- 工具能力驱动 Moveable/Selecto，不要硬编码
- 工具切换必须用 `setToolWithCleanup` 清理交互状态
- 画布定位用 `transform: translate()`，不用 `left/top`
- 后端统一用 Zod + nestjs-zod，禁用 class-validator
- 后端响应由 `TransformInterceptor` 自动包装，不要手动包装
- 前端 API 用 `meta.responseSchema` 做 Zod 运行时校验，401 统一交拦截器处理

## 归属规则

- 文档是"所有开发者都要遵守的约定" → 放本目录
- 文档是"系统架构" → 放 `architecture/`
- 文档是"某个功能的设计" → 放 `specs/`

## 受众

所有开发者。
