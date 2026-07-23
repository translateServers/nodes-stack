# Baseline After — 阶段 0 实施后大屏测试基线

> 本文件为 `stabilize-screen-baseline` 阶段 0 任务 11.7 的最终交付记录，依据当前磁盘事实与阶段 0 各任务实测数据整理，不复制旧文档数字。
> 取证日期：2026-07-18
> 取证范围：`apps/nestjs-server/src/modules/screen/`、`apps/web/src/features/screen/`、`apps/web/e2e/`、`apps/nestjs-server/test/`
> 统计口径：以 `it(` 出现次数为可枚举用例数；前端 Playwright E2E 与后端 Jest E2E 以 `test(` / `it(` 出现次数为准。每个文件均通过 Grep 工具确认。
> 数据来源：阶段 0 各子任务实测记录（见 `tasks.md` 与 `verification.md`）。

## 1. 后端 screen 测试文件

后端测试目录：`apps/nestjs-server/src/modules/screen/`

| 序号 | 文件路径 | 可枚举用例数 |
| --- | --- | --- |
| 1 | `apps/nestjs-server/src/modules/screen/screen.controller.spec.ts` | 17 |
| 2 | `apps/nestjs-server/src/modules/screen/screen.service.spec.ts` | 26 |
| | **后端合计** | **43** |

### 1.1 `screen.controller.spec.ts`（17 个用例，较实施前 7 → 17，新增 10）

| # | describe 块 | 用例标题 |
| --- | --- | --- |
| 1 | `createProject` | should call service.createProject with dto |
| 2 | `findAllProjects` | should call service.findAllProjects |
| 3 | `findProjectById` | should call service.findProjectById with id |
| 4 | `updateProject` | should call service.updateProject with id and dto |
| 5 | `publishProject` | should call service.publishProject with id and dto |
| 6 | `removeProject` | should call service.removeProject with id |
| 7 | `previewProject` | should call service.findPublishedProjectById for preview |
| 8 | `previewProject` | should propagate BusinessException unchanged when draft preview fails |
| 9 | `previewProject` | should not leak draft content through response body for draft preview |
| 10-17 | `anonymous access metadata (@Public boundary)` | 8 个元数据断言用例（含 ScreenController 类与 6 个受保护方法 `IS_PUBLIC_KEY` 缺失断言 + `previewProject` `IS_PUBLIC_KEY=true` 断言） |

新增维度：公开预览专用查询调用、草稿异常透传、草稿内容不通过响应体泄露、`@Public` 元数据边界。

### 1.2 `screen.service.spec.ts`（26 个用例，较实施前 14 → 26，新增 12）

| # | describe 块 | 用例标题（节选关键新增） |
| --- | --- | --- |
| 1-3 | `createProject` | 创建默认画布 / 自定义画布 / 重名冲突（既有） |
| 4-5 | `findAllProjects` / `findProjectById` | 既有 |
| 6-7 | `findPublishedProjectById`（新增） | 已发布项目返回完整数据 / 草稿抛 SCREEN_NOT_FOUND / 不存在抛 SCREEN_NOT_FOUND |
| 8-9 | `findPublishedProjectById`（新增） | published 过滤使草稿数据不进入服务层 / 异常仅含 code+message 不带草稿字段 |
| 10 | `findPublishedProjectById`（新增） | 异常序列化后响应体不含 canvas/components/description/thumbnail |
| 11-14 | `updateProject` | 匹配基线返回新 updatedAt+draft / 版本冲突抛 SCREEN_SAVE_CONFLICT 不被覆盖 / 项目不存在抛 SCREEN_NOT_FOUND / 既有更新逻辑 |
| 15-19 | `publishProject`（新增） | 匹配基线发布成功返回新 updatedAt / 过期基线抛 SCREEN_SAVE_CONFLICT / 项目不存在抛 SCREEN_NOT_FOUND / 冲突时数据库不变 / 不存在时数据库不变 |
| 20-26 | `removeProject` 等 | 既有 + 数据库不变固化 |

新增维度：公开查询按 `id + published` 过滤、原子条件写入（`updateMany({ where: { id, updatedAt } })`）、冲突 vs 不存在区分（只读 `findUnique({ select: { id: true } })`）、冲突与不存在分支无条件写入方法均未被调用。

### 1.3 后端测试现状对比 spec 缺口（实施后）

- 公开预览独立查询：已覆盖（任务 1.1-1.4、10.1）。
- 草稿/不存在公开预览失败：已覆盖（任务 1.4、10.1）。
- `expectedUpdatedAt` 基线匹配与冲突：已覆盖（任务 6.1-6.5、10.2）。
- 原子条件写入：已覆盖（任务 6.1-6.4，所有用例以 `updateMany({ where: { id, updatedAt } })` 单次条件写入表达原子性）。
- 未认证受保护接口 401：已覆盖（任务 2.4 + E2E `screen-auth.e2e-spec.ts` 8 用例）。

## 2. 前端 screen 测试文件

前端测试目录：`apps/web/src/features/screen/`

| 序号 | 文件路径 | 可枚举用例数 | 状态 |
| --- | --- | --- | --- |
| 1 | `apps/web/src/features/screen/components/number-input.test.tsx` | 31 | 既有 22 + 新增 9 |
| 2 | `apps/web/src/features/screen/hooks/shortcuts-registry.test.ts` | 21 | 既有 |
| 3 | `apps/web/src/features/screen/hooks/use-interaction-state-machine.test.ts` | 39 | 既有 |
| 4 | `apps/web/src/features/screen/hooks/use-keyboard-shortcuts.test.ts` | 9 | 既有 |
| 5 | `apps/web/src/features/screen/lib/canvas-event-router.test.ts` | 59 | 既有 |
| 6 | `apps/web/src/features/screen/lib/smart-guides.test.ts` | 30 | 既有 |
| 7 | `apps/web/src/features/screen/registry/registry.test.ts` | 11 | 既有 |
| 8 | `apps/web/src/features/screen/stores/editor-store.test.ts` | 13 | 既有 9 + 新增 4（isDirty） |
| 9 | `apps/web/src/features/screen/api.test.ts` | 6 | 新增 |
| 10 | `apps/web/src/features/screen/hooks.test.tsx` | 16 | 新增 |
| 11 | `apps/web/src/features/screen/lib/is-save-conflict-error.test.ts` | 14 | 新增 |
| 12 | `apps/web/src/features/screen/registry/component-container-style.test.ts` | 16 | 新增 |
| 13 | `apps/web/src/features/screen/components/property-panel.test.tsx` | 7 | 新增 |
| 14 | `apps/web/src/features/screen/components/save-conflict-dialog.test.tsx` | 4 | 新增 |
| 15 | `apps/web/src/features/screen/components/screen-editor.test.tsx` | 18 | 新增 |
| 16 | `apps/web/src/features/screen/components/screen-preview.test.tsx` | 17 | 新增 |
| | **前端合计** | **311** | 既有 200 + 新增 111 |

### 2.1 新增前端测试文件覆盖维度

| 文件 | 用例数 | 覆盖维度 |
| --- | --- | --- |
| `api.test.ts` | 6 | 保存/发布请求体含 `expectedUpdatedAt`、原样传递 name、响应含服务端 updatedAt、发布请求体仅含 `expectedUpdatedAt`（不携带画布/组件） |
| `hooks.test.tsx` | 16 | `useUpdateScreenProject`/`usePublishScreenProject` 的 onSuccess 回写缓存与列表失效、第二次保存使用第一次响应新基线、任务 8.2 字段集合、任务 8.3 未保存阻止发布、任务 8.4 干净状态发布基线、任务 8.5 公开预览缓存失效 |
| `lib/is-save-conflict-error.test.ts` | 14 | 冲突业务错误识别、普通 409、非业务错误、未知错误、null/undefined 边界 |
| `registry/component-container-style.test.ts` | 16 | 默认值、非零旋转、负角度旋转、完整边框、透明度、溢出、位置尺寸、背景、组合场景 |
| `components/property-panel.test.tsx` | 7 | 切换选中对象重置输入上下文、画布变换提交后属性面板同步（拖拽/缩放/旋转） |
| `components/save-conflict-dialog.test.tsx` | 4 | open 状态显隐、按钮交互（重新加载/继续编辑） |
| `components/screen-editor.test.tsx` | 18 | 保存冲突打开对话框、本地内容不被覆盖、普通错误不显示冲突、发布冲突复用对话框、取消冲突处理、重新加载服务端版本、重新加载失败处理 |
| `components/screen-preview.test.tsx` | 17 | 隐藏组件过滤、不渲染选中态、不渲染辅助线、不渲染交互控件、加载与空态边界、公共样式解析（旋转强制断言） |
| `stores/editor-store.test.ts`（新增 4 用例） | +4 | isDirty 脏状态跟踪：加载后干净、修改后脏、保存成功后恢复干净、保存失败后保持脏 |
| `components/number-input.test.tsx`（新增 9 用例） | +9 | 外部 value 变更同步（3 用例）、单次提交（5 用例）、切换 syncKey 旧 draft 清除（1 用例） |

### 2.2 前端测试现状对比 spec 缺口（实施后）

- 共享组件容器样式解析：已覆盖（任务 3.2/3.5/10.3）。
- NumberInput 外部值更新与同字段外部变化使旧草稿失效：已覆盖（任务 4.1/4.2/10.4）。
- 属性面板切换选中对象重置输入上下文：已覆盖（任务 4.4/10.4）。
- 画布变换后属性面板同步：已覆盖（任务 4.5/10.4）。
- 保存/发布 API 携带 `expectedUpdatedAt`：已覆盖（任务 7.1/10.5）。
- 保存/发布回写新基线：已覆盖（任务 7.3/7.4/10.5）。
- 本地脏状态判断：已覆盖（任务 8.1/10.5）。
- 发布边界（脏状态阻止发布）：已覆盖（任务 8.3/8.4/10.5）。
- 公开预览缓存失效：已覆盖（任务 8.5/10.5）。
- 冲突识别与冲突 UI：已覆盖（任务 9.1-9.7/10.5）。

## 3. screen E2E 文件

E2E 目录：`apps/web/e2e/tests/` 与 `apps/nestjs-server/test/`

### 3.1 前端 Playwright E2E（screen 相关）

| 序号 | 文件路径 | 可枚举用例数 | 状态 |
| --- | --- | --- | --- |
| 1 | `apps/web/e2e/tests/screen-auth-preview.spec.ts` | 3 | 新增（任务 10.6） |
| 2 | `apps/web/e2e/tests/screen-save-publish.spec.ts` | 2 | 新增（任务 10.7） |
| 3 | `apps/web/e2e/tests/screen-conflict.spec.ts` | 1 | 新增（任务 10.8） |
| | **Playwright screen E2E 合计** | **6** | 新增 3 文件 / 6 用例 |

#### 3.1.1 用例清单

| 文件 | 用例标题 |
| --- | --- |
| `screen-auth-preview.spec.ts` | ① 未认证用户访问 /screen/:id 重定向到登录页；② 未认证用户访问 /screen-preview/:id（已发布项目）可以查看；③ 未认证用户访问 /screen-preview/:id（草稿项目）显示不可用提示 |
| `screen-save-publish.spec.ts` | ① 认证用户保存已发布项目后，匿名预览变为不可用；② 再次发布后，匿名预览展示新保存内容与共享样式（rotation=30deg） |
| `screen-conflict.spec.ts` | ① 双客户端基于同一 updatedAt 提交，先保存者成功，后保存者冲突 UI + 取消 + 重新加载 + 再次保存成功 |

### 3.2 后端 Jest E2E（screen 相关）

| 序号 | 文件路径 | 可枚举用例数 | 状态 |
| --- | --- | --- | --- |
| 1 | `apps/nestjs-server/test/screen-auth.e2e-spec.ts` | 8 | 新增（任务 2.4） |
| | **后端 screen E2E 合计** | **8** | 新增 1 文件 / 8 用例 |

#### 3.2.1 用例清单

| 文件 | 用例标题 |
| --- | --- |
| `screen-auth.e2e-spec.ts` | 6 个受保护端点匿名返回 401（`GET /screen`、`GET /screen/:id`、`POST /screen`、`PATCH /screen/:id`、`POST /screen/:id/publish`、`DELETE /screen/:id`，对应 service 方法未被调用）+ 2 个公开预览端点（已发布 200、草稿/不存在 404） |

### 3.3 E2E 现状对比 spec 缺口（实施后）

- spec 10.6（认证与预览 E2E）：已覆盖（3 用例）。
- spec 10.7（保存后发布 E2E）：已覆盖（2 用例，含共享样式 rotation 强制断言）。
- spec 10.8（双客户端保存冲突 E2E）：已覆盖（1 用例，含取消 + 重新加载 + 再次保存完整流程）。
- spec 2.4 后端匿名访问验证：已覆盖（8 用例 E2E）。

## 4. 全量测试统计（阶段 11.4 实测）

> 数据来源：阶段 0 任务 11.4 实测记录，2026-07-18。

| 维度 | 文件数 | 通过 | 失败 | 跳过 | 总用例 | 退出码 |
| --- | --- | --- | --- | --- | --- | --- |
| `pnpm --filter @nebula/shared test` | 10 | 120 | 0 | 0 | 120 | 0 |
| `pnpm --filter @nebula/nestjs-server test` | 23 | 285 | 0 | 0 | 285 | 0 |
| `pnpm --filter @nebula/web test` | 27 | 394 | 0 | 0 | 394 | 0 |
| **全量合计** | **60** | **799** | **0** | **0** | **799** | **0** |

说明：

- 实施前 0.2 基线 `shared` 9 文件 / 108 通过；当前 10 文件 / 120 通过（新增 `screen.schema.test.ts` 含 12 用例，对应任务 5.1/5.2/5.3 共享契约）。
- 实施前 0.2 基线后端 screen 2 文件 / 24 通过；当前 2 文件 / 43 通过（service 26 + controller 17）。
- 实施前 0.2 基线前端 screen 8 文件 / 203 用例（201 通过 + 1 失败 + 1 跳过）；当前 16 文件 / 311 用例全部通过（任务 4.1 预期失败由 4.2 修复，跳过用例由 4.2 启用）。
- 后端覆盖率（`pnpm --filter @nebula/nestjs-server test:cov`）：Stmts 91.55% / Branch 76.82% / Funcs 91.41% / Lines 91.46%；Branch 未达 80% 阈值（`test:cov` 退出码 1），但任务要求命令 `test` 退出码 0，不阻塞验收。

## 5. E2E 统计（阶段 11.5 实测）

> 数据来源：阶段 0 任务 11.5 实测记录，2026-07-18。

### 5.1 前端 Playwright E2E

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm --filter @nebula/web e2e -- --grep "screen"` |
| 浏览器项目 | chromium 1.61.0 |
| 退出码 | 0 |
| 文件数 | 3 |
| 通过 | 6 |
| 失败 | 0 |
| 跳过 | 0 |
| 总用例 | 6 |
| 耗时 | 15.5s |

各文件结果：

| 文件 | 用例数 | 结果 | 耗时 |
| --- | --- | --- | --- |
| `screen-auth-preview.spec.ts` | 3 | 全部通过 | 1.3s + 1.9s + 4.9s |
| `screen-save-publish.spec.ts` | 2 | 全部通过 | 11.7s + 13.3s |
| `screen-conflict.spec.ts` | 1 | 全部通过 | 13.2s |

### 5.2 后端 Jest E2E

| 项 | 值 |
| --- | --- |
| 命令 | `pnpm --filter @nebula/nestjs-server test:e2e` |
| 退出码 | 0 |
| 文件数 | 2 |
| 通过 | 12 |
| 失败 | 0 |
| 跳过 | 0 |
| 总用例 | 12 |
| 耗时 | 3.202s |

各文件结果：

| 文件 | 用例数 | 结果 |
| --- | --- | --- |
| `screen-auth.e2e-spec.ts` | 8 | 全部通过（screen 相关） |
| `app.e2e-spec.ts` | 4 | 全部通过（非 screen 相关） |

### 5.3 E2E 首轮失败与修复

首轮 4 个 Playwright 用例失败（`screen-auth-preview:89`、`screen-save-publish:12`、`screen-save-publish:87`、`screen-conflict:97`），均因 `POST/PATCH /screen/:id` 返回 409 `SCREEN_SAVE_CONFLICT`。

- 根因：`DateTimeStringSchema` 使用 `dayjs(val).format('YYYY-MM-DD HH:mm:ss')` 将 Prisma `@updatedAt` 的毫秒精度截断到秒，客户端回传的 `expectedUpdatedAt`（.000 毫秒）与数据库值（非零毫秒）不匹配。
- 修复：在 `ScreenService` 的 `createProject`/`updateProject`/`publishProject` 中显式将 `updatedAt` 截断到秒精度（新增 `truncateToSeconds` 私有方法），覆盖 Prisma `@updatedAt` 的毫秒默认值，确保数据库存储的 `updatedAt` 始终为 .000 毫秒。
- 修复后：screen 单元测试 43 通过、screen 后端 E2E 12 通过、Playwright 大屏 E2E 6 通过。
- 修复文件：`apps/nestjs-server/src/modules/screen/screen.service.ts`、`apps/nestjs-server/src/modules/screen/screen.service.spec.ts`。
- 运行环境说明：Playwright `webServer` 配置 `reuseExistingServer: !process.env.CI`，运行前临时清空 `CI` 变量以复用现有 dev 服务。

## 6. 实施前后对比

| 维度 | 实施前（0.1/0.2 基线） | 实施后（11.4/11.5 基线） | 差异 |
| --- | --- | --- | --- |
| 后端 screen 测试 文件 / 用例 | 2 / 21 | 2 / 43 | +0 文件 / +22 用例 |
| 前端 screen 测试 文件 / 用例 | 8 / 200 | 16 / 311 | +8 文件 / +111 用例 |
| screen E2E（Playwright + 后端）文件 / 用例 | 0 / 0 | 4 / 14 | +4 文件 / +14 用例 |
| shared 全量 文件 / 通过 | 9 / 108 | 10 / 120 | +1 文件 / +12 通过 |
| 后端全量 文件 / 通过 | - | 23 / 285 | 阶段 11.4 实测 |
| 前端全量 文件 / 通过 | - | 27 / 394 | 阶段 11.4 实测 |
| Playwright 大屏 E2E 文件 / 通过 | 0 / 0 | 3 / 6 | +3 文件 / +6 通过 |
| 后端 E2E 文件 / 通过 | - | 2 / 12 | 阶段 11.5 实测（含 1 screen 文件 + 1 app 文件） |
| 实施前失败/跳过用例 | 1 失败 + 1 跳过（4.1 预期失败） | 0 失败 + 0 跳过 | 全部通过 |
| `pnpm typecheck` 退出码 | 未运行 | 0 | 通过 |
| `pnpm lint` 退出码 | 未运行 | 0 | 通过（1 个 warn：`no-explicit-any`） |
| `pnpm biome:check` 退出码 | 未运行 | 0 | 通过（375 文件） |

## 7. 新增功能能力清单

阶段 0 实施期间新增的功能能力（按任务维度）：

### 7.1 公开预览隔离（任务 1.x）

- `ScreenService.findPublishedProjectById(id)`：按 `id + status: 'published'` 单独查询的公开预览入口，不复用受保护详情方法。
- `ScreenController.previewProject` 切换到专用公开查询，草稿/不存在项目统一返回 404 `SCREEN_NOT_FOUND`，响应体仅含 `{ code, message }` 不泄露草稿内容。

### 7.2 认证路由边界（任务 2.x）

- 大屏列表/编辑器路由纳入 `_app` 受保护布局，`beforeLoad` 校验 `accessToken` 缺失即重定向登录页。
- 公开预览路由 `screen-preview.$id.tsx` 独立于 `_app` 布局，不依赖访问令牌。
- `@Public` 元数据边界：6 个受保护端点无 `IS_PUBLIC_KEY`，`previewProject` 标记 `IS_PUBLIC_KEY=true`。

### 7.3 共享组件容器样式（任务 3.x）

- `resolveComponentContainerStyle(component)`：将组件位置/尺寸/层级/旋转/透明度/边框/背景/圆角/溢出转换为 React 样式的纯函数。
- 编辑器 `CanvasComponentWrapper` 与预览 `ScreenPreview` 共用同一解析函数；旋转通过 `transform: rotate(<rotation>deg)` 强制断言。
- 预览过滤 `status.hidden=true` 组件，不渲染选中态、辅助线、Moveable/Selecto 交互控件。

### 7.4 属性同步（任务 4.x）

- `NumberInput` 外部值优先策略：未聚焦跟随 `value`、编辑中保留 draft、同字段外部变化使旧 draft 失效、`syncKey` 切换清除旧 draft。
- 单次显式提交最多触发一次 `onChange`（`skipNextBlurCommitRef` 保证 Enter 后 Blur 不重复提交）。
- 属性面板切换选中对象重置输入上下文；画布变换（拖拽/缩放/旋转）提交 Store 后属性面板同步最新值。

### 7.5 expectedUpdatedAt 乐观锁共享契约（任务 5.x）

- `BizCode.SCREEN_SAVE_CONFLICT` 业务码，HTTP 状态映射 409。
- `UpdateScreenProjectSchema` 必需 `expectedUpdatedAt`（日期时间字符串契约）。
- `PublishScreenProjectSchema` 独立 Schema，仅含 `expectedUpdatedAt`，不接收画布/组件内容。

### 7.6 服务端原子乐观锁（任务 6.x）

- `ScreenService.updateProject` 与 `publishProject` 使用 `updateMany({ where: { id, updatedAt: new Date(dto.expectedUpdatedAt) }, data: ... })` 单次条件写入，不先读后无条件 update。
- `count===0` 时通过 `findUnique({ where: { id }, select: { id: true } })` 只读 id 字段区分冲突与不存在，分别抛 `SCREEN_SAVE_CONFLICT` / `SCREEN_NOT_FOUND`，冲突与不存在分支均不执行覆盖写入。
- `updateProject` 成功后状态置为 `draft`；`publishProject` 成功后状态置为 `published`。
- `truncateToSeconds` 私有方法显式截断 `updatedAt` 到秒精度，确保与 `DateTimeStringSchema` 格式一致。

### 7.7 前端保存基线接入（任务 7.x）

- `updateScreenProject` / `publishScreenProject` API 客户端携带 `expectedUpdatedAt`，响应继续返回服务端 `updatedAt`。
- `usePublishScreenProject` mutation 输入类型由 `(id: string)` 改为 `(input: { id; expectedUpdatedAt })`，调用方不再能以只有项目 ID 的方式发布。
- 保存/发布 `onSuccess` 用响应回写详情缓存与 Store，仅以 `exact: true` 失效列表查询，下次保存/发布使用上次响应的新基线。

### 7.8 保存与发布前端边界（任务 8.x）

- `ScreenEditorData.isDirty: boolean`：加载后为 false，进入历史栈的修改自动标记为 true（覆盖 addComponent/updateComponent/updateCanvas/undo/redo 等多路径），保存成功后由 `loadProject` 恢复 false。
- 保存请求只提交可编辑字段（name/description/canvas/components/expectedUpdatedAt），不提交 status；已发布项目保存后 Store/缓存回写为 draft。
- 脏状态下发布被阻止：`toast.warning('请先保存修改后再发布')` 后 return，不发送发布请求。
- 干净状态下发布使用当前保存基线，成功/失败/冲突均不误报结果。
- 发布成功后失效公开预览查询 `['screen-preview', id]`，确保发布后匿名预览立即拉取最新已发布内容。

### 7.9 冲突 UI（任务 9.x）

- `isSaveConflictError(error)` 纯函数：通过 `BizCode.SCREEN_SAVE_CONFLICT` 稳定识别冲突，不依赖错误消息文本。
- `SaveConflictDialog` 阻塞式 AlertDialog：标题/描述/两个按钮（继续编辑 / 重新加载），可访问性由 radix-ui 提供，不依赖 Toast。
- 保存/发布 mutation `onError` 通过 `isSaveConflictError` 分流，冲突时打开对话框且不调用 `loadProject`（保持本地 Store/历史/基线不变），非冲突错误由全局错误拦截器处理。
- `api-error.ts` 跳过 `SCREEN_SAVE_CONFLICT` 的全局 Toast，错误仍正常抛出供 mutation `onError` 接收。
- 取消冲突：仅关闭对话框，不修改 Store/历史/基线，用户可继续编辑，再次保存仍使用旧基线并可再次触发冲突。
- 重新加载服务端版本：`refetch()` 获取服务端最新项目，成功时 `loadProject(result.data)` 整体替换 Store 项目/基线/选中态/历史，关闭对话框并 `isDirty=false`；失败时 `toast.error('重新加载失败，请重试')` 后 return，不调用 `loadProject`/不关闭对话框，用户可重试或取消。

### 7.10 自动化测试闭环（任务 10.x）

- 后端回归测试：公开预览隔离、乐观锁原子条件写入、`@Public` 元数据边界、HTTP E2E 401 边界。
- 前端回归测试：共享样式解析、属性同步、NumberInput 外部值更新、保存基线与冲突 UI。
- Playwright E2E：未认证编辑器重定向、匿名已发布预览、草稿预览不可用、保存后匿名预览不可用、再次发布后预览展示新内容与共享样式、双客户端保存冲突完整流程。

## 8. 验收命令实测结果（阶段 11.x）

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `pnpm typecheck`（修复 dist 同步后） | 0 | 4 successful, 4 total，耗时 8.822s |
| `pnpm lint` | 0 | 3 successful, 3 total，耗时 13.598s（1 个 warn：`no-explicit-any`） |
| `pnpm biome:check` | 0 | Checked 375 files in 176ms. No fixes applied. |
| `pnpm --filter @nebula/shared test` | 0 | 10 文件 / 120 通过 / 0 失败 / 0 跳过 |
| `pnpm --filter @nebula/nestjs-server test` | 0 | 23 文件 / 285 通过 / 0 失败 / 0 跳过 |
| `pnpm --filter @nebula/web test` | 0 | 27 文件 / 394 通过 / 0 失败 / 0 跳过 |
| `pnpm --filter @nebula/web e2e -- --grep "screen"` | 0 | 3 文件 / 6 通过 / 0 失败 / 0 跳过 |
| `pnpm --filter @nebula/nestjs-server test:e2e` | 0 | 2 文件 / 12 通过 / 0 失败 / 0 跳过 |

### 8.1 修复明细（不绕过类型检查）

- `pnpm typecheck` 首次失败根因为 `@nebula/shared` 的 `dist` 与源码不同步（任务 5.2/5.3 新增 `expectedUpdatedAt` 字段后未重建产物），修复方式为 `pnpm --filter @nebula/shared build` 重建 dist，未使用 `@ts-ignore`/`@ts-nocheck`/`as any` 绕过。
- `pnpm lint` 修复 33 个 `@nebula/web` ESLint error（删除未用 import/变量、`unknown` 类型收窄后调用 `String()`、`void` 标记保留未用形参、调整 async/await 结构），未使用绕过手段；`no-explicit-any` warn 在 ESLint 配置中明确为 warn 级别，任务约定可接受。
- `pnpm biome:check` 退出码 0，未对生成物和忽略项进行任何格式化修复。
- Playwright E2E 首轮 4 用例失败，根因为 `DateTimeStringSchema` 秒精度与 Prisma `@updatedAt` 毫秒精度不匹配，修复方式为 `ScreenService` 新增 `truncateToSeconds` 私有方法显式截断 `updatedAt` 到秒精度，未修改 Spec 范围。

## 9. 取证方法

- 文件枚举：通过 `Glob` 工具按 `apps/nestjs-server/src/modules/screen/**/*.spec.ts`、`apps/web/src/features/screen/**/*.{test,spec}.{ts,tsx}`、`apps/web/e2e/tests/screen-*.spec.ts`、`apps/nestjs-server/test/screen-*.e2e-spec.ts` 模式匹配。
- 用例计数：对每个测试文件运行 `Grep` 工具，匹配模式 `^\s*it\(`（Jest/Vitest）或 `^\s*test\(`（Playwright），取计数结果。
- 全量测试统计：来自阶段 0 任务 11.4 实测记录（详见 `tasks.md` 11.4 节与 `verification.md`）。
- E2E 统计：来自阶段 0 任务 11.5 实测记录（详见 `tasks.md` 11.5 节与 `verification.md`）。
- 数据对比：与 `baseline-before.md`（任务 0.1/0.2 取证）逐项对照。
- Spec 范围：未修改 `spec.md` 任何范围条目，所有失败用例均通过真实修复（重建 dist、修复类型、修复毫秒精度）解决，未以"预存问题"为由跳过。
