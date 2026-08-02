# 开发指南

> 状态：生效中
> 最近更新：2026-08-02
> 定位：step-by-step 操作手册。涵盖最常见的三类扩展场景：新增大屏组件、新增后端模块、新增 API 端点

## 1. 环境配置与本地调试

### 1.1 前置要求

- **Node.js 24+**（项目 `@types/node ^24`）
- **pnpm 9.15.0**（`packageManager` 字段锁定，不要用其他版本）

### 1.2 安装与启动

```bash
pnpm install              # 安装依赖
pnpm dev                  # 同时启动前后端（Turbo 编排）
pnpm dev:web              # 仅前端（端口 5173）
pnpm dev:server           # 仅后端（端口 3000）
```

Vite 代理：前端 `/api` 请求代理到 `http://localhost:3000`，开发时无需处理跨域。

### 1.3 数据库

```bash
cd apps/nestjs-server
pnpm prisma migrate dev   # 创建迁移
pnpm prisma generate      # 生成 client
pnpm prisma studio        # 可视化管理
```

Prisma 多文件 schema（Prisma 7 特性）：根 `schema.prisma` 仅含 generator/datasource，业务模型在 `prisma/schema/*.prisma`。

### 1.4 调试技巧

- 前端：浏览器 DevTools，编辑器状态通过 `window.__screenEditorStore` 访问
- 后端：`pnpm --filter @nebula/nestjs-server start:debug` 启用 inspector
- React DevTools + TanStack Query DevTools 已集成

### 1.5 质量门禁

提交前必须通过：

```bash
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # ESLint 类型感知规则
pnpm biome:check  # Biome 格式 + 基础 lint
pnpm test         # 单元测试
```

详见 [conventions/coding-standards.md](../conventions/coding-standards.md)。

## 2. 新增大屏组件

新增可复用组件优先走大屏组件 SDK：组件作者实现 Web Component + manifest，宿主通过 `@nebula/screen-sdk/components` 创建 registry 并注入 `<nebula-screen-editor>`。不要再新增 `registerComponent(ComponentModule)` 生产路径。

### 2.1 步骤总览

1. 在组件包中声明 `ScreenComponentManifest` 和 Custom Element
2. 用 `ScreenComponentPlugin` 暴露 `manifest + define()`
3. 宿主调用 `createScreenComponentRegistry({ components })`
4. 在首次 load 前给 `<nebula-screen-editor>` 赋值 `componentRegistry`
5. 使用 `ScreenHostAdapter` 保存 `schemaVersion: 2` 正式文档
6. 编写 manifest、renderer、属性、事件、tarball consumer 测试

### 2.2 第 1 步：实现组件包

参考 [组件作者与宿主注册指南](../specs/screen-component-sdk/component-author-guide.md)。组件只接收 `model` property，渲染用原生 HTML/SVG/Web Component API，不访问编辑器 Store、Adapter、Router、Token 或 Cookie。

### 2.3 第 2 步：注册到宿主

宿主从 `@nebula/screen-sdk/components` 导入 `createScreenComponentRegistry()`，将组件 plugin 显式传入，并在设置 `adapter/projectId` 前设置 `componentRegistry`。

### 2.4 第 3 步：持久化正式文档

外部组件使用 `ScreenHostAdapter`。文档只保存 `type` 与 JSON `props`，不保存 `tagName`、模块 URL、构造函数或脚本。组件 API 的 TypeScript 名称不带版本后缀；`apiVersion`、外部 `type` 和 `tagName` 的 `/v1`、`-v1` 是稳定 wire 值。

### 2.5 第 4 步：编写测试

至少覆盖：manifest 校验、registry 构建、组件库拖入、renderer model、属性面板、事件 payload、load/save/import/export/snapshot round-trip、tarball consumer。

### 2.6 历史文档迁移

新代码只读写正式 `ScreenDocument`。历史持久化记录只可通过 `Legacy*` parser 和迁移函数读取，迁移成功后必须在下次保存前写回正式文档；不要在业务组件、Adapter 或 SDK 公共 API 中引入版本别名。

### 2.8 验证

```bash
pnpm --filter @nebula/web typecheck
pnpm --filter @nebula/screen-component-sdk test
pnpm --filter @nebula/screen-sdk verify:tarball
pnpm --filter @nebula/web lint
pnpm biome:check
```

启动 SDK Host 或 Web 编辑器，从组件库拖入组件，验证渲染、属性面板、预览和保存重载。

## 3. 新增后端模块

以新增一个"通知"模块为例。

### 3.1 步骤总览

1. 创建模块目录结构
2. 定义 Prisma model
3. 定义 Zod schema（DTO）
4. 实现 service / controller
5. 注册到 app.module.ts
6. 编写测试

### 3.2 第 1 步：目录结构

```
apps/nestjs-server/src/modules/notification/
├── notification.module.ts
├── notification.controller.ts
├── notification.service.ts
├── dto/
│   ├── create-notification.dto.ts    Zod schema
│   └── update-notification.dto.ts
└── __tests__/
    ├── notification.service.spec.ts
    └── notification.controller.spec.ts
```

### 3.3 第 2 步：Prisma model

`apps/nestjs-server/prisma/schema/Notification.prisma`：

```prisma
model Notification {
  id        String   @id @default(uuid())
  title     String
  content   String
  read      Boolean  @default(false)
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@map("notifications")
}
```

然后：

```bash
cd apps/nestjs-server
pnpm prisma migrate dev --name add-notification
pnpm prisma generate
```

### 3.4 第 3 步：Zod schema（DTO）

`dto/create-notification.dto.ts`：

```ts
import { z } from 'zod';

export const CreateNotificationSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  userId: z.string().uuid(),
});

export type CreateNotificationDto = z.infer<typeof CreateNotificationSchema>;
```

**关键约束**（见 [coding-standards.md](../conventions/coding-standards.md) 第 9 节）：
- **统一用 Zod + nestjs-zod**，**禁用 class-validator**
- 共享 schema 放 `@nebula/shared`，后端与前端共用

### 3.5 第 4 步：service / controller

`notification.service.ts`：

```ts
@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateNotificationDto) {
    return this.prisma.notification.create({ data });
  }

  async findAll() {
    return this.prisma.notification.findMany();
  }

  // ...
}
```

`notification.controller.ts`：

```ts
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Post()
  @UseZodGuardians('body', CreateNotificationSchema)
  create(@Body() dto: CreateNotificationDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
```

**关键约束**：
- **不要手动包装响应**，直接返回 `data`，`TransformInterceptor` 自动包装为 `{ code, data, message }`
- 公开端点加 `@Public()` 装饰器

### 3.6 第 5 步：注册模块

`apps/nestjs-server/src/app.module.ts` 的 imports 追加 `NotificationModule`。

### 3.7 第 6 步：BizCode

如果新增业务错误码，在 `@nebula/shared` 的 `BizCode` 与 `BizMessage` 中同步添加，分配新段位（如 80xxx）。

### 3.8 第 7 步：测试

后端单测用 Jest，覆盖率阈值 80%。

```bash
pnpm --filter @nebula/nestjs-server test -- notification
```

### 3.9 验证

启动后端，访问 Swagger 文档 `http://localhost:3000/api/docs`，验证端点与 schema。

## 4. 新增 API 端点（前端）

后端模块就绪后，前端需要封装 API client 与 TanStack Query hook。

### 4.1 步骤总览

1. 在 `endpoints.ts` 添加端点常量
2. 创建 feature 的 `hooks.ts` 封装 TanStack Query hook
3. 在 `api/index.ts` re-export

### 4.2 第 1 步：端点常量

`apps/web/src/api/core/endpoints.ts` 的 `ENDPOINTS` 追加：

```ts
export const ENDPOINTS = {
  // ...existing
  notifications: '/notifications',
} as const;
```

如需分组可参照现有 `auth: { ... }` 嵌套结构。

### 4.3 第 2 步：TanStack Query hook

在对应 feature 目录（如 `features/notification/hooks.ts`）：

```ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { get, post } from '@/api';
import { ENDPOINTS } from '@/api/core/endpoints';
import { NotificationSchema } from '@nebula/shared';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => get(ENDPOINTS.notifications, {
      meta: { responseSchema: NotificationSchema.array() },
    }),
  });
}

export function useCreateNotification() {
  return useMutation({
    mutationFn: (data: CreateNotificationDto) =>
      post(ENDPOINTS.notifications, { body: data }),
  });
}
```

**关键约束**（见 [coding-standards.md](../conventions/coding-standards.md) 第 10 节）：
- 用 `meta.responseSchema` 做 Zod 运行时校验
- **不要**在业务代码里手动处理 401，统一交给拦截器
- 响应拦截器自动剥壳 `{ code, data, message }`，返回 `data`

### 4.4 第 3 步：re-export

`apps/web/src/api/index.ts` 追加：

```ts
export * from '@/features/notification/hooks';
```

### 4.5 验证

```bash
pnpm --filter @nebula/web typecheck
pnpm --filter @nebula/web lint
```

## 5. 新增页面与导航

### 5.1 创建路由文件

TanStack Router 文件系统路由，在 `apps/web/src/routes/` 新建：

- 鉴权页：`_app.notifications.tsx`（路径 `/notifications`）
- 公开页：`notifications.tsx`（路径 `/notifications`，无鉴权布局）

```tsx
// _app.notifications.tsx
import { createFileRoute } from '@tanstack/react-router';
import { NotificationsPage } from '@/features/notification/notifications-page';

export const Route = createFileRoute('/_app/notifications')({
  component: NotificationsPage,
});
```

### 5.2 添加导航项

`apps/web/src/config/navigation.ts` 的 `menuGroups` 同步添加：

```ts
{
  label: '业务功能',
  items: [
    // ...existing
    { text: '通知', icon: Bell, path: '/notifications' },
  ],
}
```

同时在 `pathLabels` 添加路径标签（用于面包屑/标题）。

### 5.3 自动生成路由树

保存路由文件后，Vite 插件自动生成 `routeTree.gen.ts`。**禁止手改**此文件。

## 6. 新增工具（大屏编辑器）

### 6.1 步骤

1. 在 `tool-registry.ts` 的 `EditorTool` 联合类型添加新工具 ID
2. 在 `TOOL_REGISTRY` 添加定义（id/name/icon/shortcutId/cursor/capabilities/implemented）
3. 在 `shortcuts-registry.ts` 添加对应快捷键（shortcutId 匹配）
4. 在 `screen-canvas.tsx` 的 `handlePanStart` 添加工具分发逻辑
5. 编写测试

### 6.2 关键约束

- 能力（capabilities）驱动 Moveable/Selecto，**不要**硬编码启用状态
- 必须用 `setToolWithCleanup` 切换工具，不要直接 `setTool`
- 快捷键 `browserConflict='overridable'` 必须搭配 `preventDefault='always'`

详见 [coding-standards.md](../conventions/coding-standards.md) 第 7 节。

## 7. 新增蓝图节点/动作

### 7.1 新增动作类型

1. 在 `@nebula/shared` 的 `BlueprintActionConfig` 添加新动作类型分支
2. 在 `nodes/action-node.tsx` 添加节点渲染
3. 在 `runtime/executor.ts` 的 `executeAction` 添加分支实现
4. 在 `nodes/node-config-panel/` 添加配置 UI
5. 在 `lib/template-interpolation.ts` 确认插值支持（如需要）
6. 编写编译器与执行器测试

### 7.2 新增触发器类型

1. 在 `@nebula/shared` 的 `BlueprintTriggerConfig` 添加新触发器分支
2. 在 `nodes/trigger-node.tsx` 添加节点渲染
3. 在 `runtime/matcher.ts` 添加匹配逻辑
4. 在 `runtime/use-blueprint-preview-runtime.ts` 添加事件派发接入
5. 编写测试

详见 [blueprint-runtime-architecture.md](./blueprint-runtime-architecture.md) 第 14 节。

## 8. 共享包变更

`@nebula/shared` 被前后端共同依赖，变更流程：

1. 修改 `packages/shared/src/` 下的 schema/types/utils
2. 运行 `pnpm --filter @nebula/shared build` 重新构建
3. 前后端的 typecheck 会自动读取新产物
4. 同步更新前后端使用方代码
5. 运行 `pnpm typecheck`（全仓库）确保类型对齐

**关键约束**：`@nebula/shared` 的变更必须前后端同步，BizCode 与 BizMessage 必须两端对齐。

## 9. 常见问题

### 9.1 Biome 通过但 lint 失败

Biome 不负责类型感知规则。运行 `pnpm lint` 检查 `no-floating-promises` 等规则。

### 9.2 React Flow 节点渲染黑块

忘记导入 `@xyflow/react/dist/style.css`。在使用 React Flow 的文件顶部导入。

### 9.3 边无法连接

目标 Handle 缺少 `id="in"`。见 [coding-standards.md](../conventions/coding-standards.md) 第 4 节。

### 9.4 Selecto 框选失效

工具切换未清理交互状态。用 `setToolWithCleanup` 而非 `setTool`。

### 9.5 拖拽时画布抖动

可能是用了 `left/top` 而非 `transform: translate()`，或在组件内创建了新的 SNAP_DIRECTIONS 引用。见 [coding-standards.md](../conventions/coding-standards.md) 第 8 节。

### 9.6 路由文件改了但不生效

`routeTree.gen.ts` 自动生成，确保 Vite 插件正常工作。重启 dev server。

## 10. 关联文档

- [系统总览](./system-overview.md)
- [大屏设计器架构](./screen-editor-architecture.md)
- [蓝图运行时架构](./blueprint-runtime-architecture.md)
- [编码规范](../conventions/coding-standards.md)
