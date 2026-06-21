# Univer 表格业务集成方案

## 背景

将 Univer Sheets（v0.25.0）集成到 Nebula monorepo，实现以下业务需求：
- 主从表：每行可关联文件，第一列展开/收起文件列表
- 单元格权限控制：控制哪些单元格可编辑
- 异步下拉选择框：下拉选项从后端 API 获取
- 基础 Excel 功能：公式、格式、排序等

技术栈：React 19 + Univer Preset + NestJS 文件上传 API

---

## Task 1: 前端安装 Univer 依赖

在 `apps/web/` 中安装以下 npm 包：

```bash
pnpm --filter @nebula/web add @univerjs/preset-sheets-core @univerjs/presets rxjs
```

关键依赖说明：
- `@univerjs/preset-sheets-core` — 核心表格功能 preset（含公式、格式、UI 等 14 个子包）
- `@univerjs/presets` — createUniver 入口，提供 LocaleType、mergeLocales 等工具
- `rxjs` — Univer 内部响应式依赖

---

## Task 2: 创建 Univer 表格页面组件

### 2.1 新建路由文件

创建 `apps/web/src/routes/_app.sheet.tsx`（TanStack Router 文件路由）：

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { SheetPage } from '@/features/sheet/sheet-page';

export const Route = createFileRoute('/_app/sheet')({
  component: SheetPage,
});
```

### 2.2 创建 Univer 容器组件

新建 `apps/web/src/features/sheet/univer-container.tsx`：

```tsx
import { useEffect, useRef } from 'react';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import '@univerjs/preset-sheets-core/lib/index.css';

interface UniverContainerProps {
  initialData?: Record<string, unknown>;
  onReady?: (api: ReturnType<typeof createUniver>['univerAPI']) => void;
}

export function UniverContainer({ initialData, onReady }: UniverContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { univerAPI } = createUniver({
      locale: LocaleType.ZH_CN,
      locales: { [LocaleType.ZH_CN]: mergeLocales(UniverPresetSheetsCoreZhCN) },
      presets: [UniverSheetsCorePreset({ container: containerRef.current })],
    });

    univerAPI.createWorkbook(initialData ?? {});
    onReady?.(univerAPI);

    return () => { univerAPI.dispose(); };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

### 2.3 创建业务页面

新建 `apps/web/src/features/sheet/sheet-page.tsx`，集成：
- UniverContainer（表格主体）
- 侧边文件面板（展开某行时显示关联文件）
- 工具栏（保存、导出、刷新）

---

## Task 3: 实现主从表（行关联文件列表）

**实现策略**：Univer 本身没有原生的 master-detail 行功能，采用「侧边面板」方案：
- 在第一列渲染自定义的「展开」按钮图标（通过 Univer 的自定义单元格渲染扩展）
- 点击展开按钮 → 在右侧弹出文件列表面板（React 组件，非 Univer 内部渲染）
- 没有关联文件的行不显示展开按钮

具体实现步骤：
1. 使用 `@univerjs/sheets-ui` 的 `IRenderManagerService` 注册自定义 cell renderer
2. 在第一列（A 列）检测行是否有文件关联，有则渲染展开图标
3. 点击时通过 Facade API 获取行号，触发 React 状态更新，打开右侧文件面板
4. 文件面板使用 shadcn Sheet 组件展示文件列表、上传入口

---

## Task 4: 实现单元格权限控制

使用 Univer 内置的 Range Protection API：

```ts
// 通过 Facade API 设置范围保护
const worksheet = univerAPI.getActiveWorkbook()?.getActiveSheet();
const permissionId = await worksheet.getWorksheetPermission()
  .createRangeProtection({
    ranges: [{ startRow: 0, startColumn: 1, endRow: 10, endColumn: 5 }],
    name: '只读区域',
    editPermission: ['user-admin-id'], // 可编辑用户列表
  });
```

- 默认大部分区域为只读
- 业务数据录入列（如 B、C 列）设为可编辑
- 权限规则从后端 API 获取，与用户角色关联

---

## Task 5: 实现异步下拉选择框

使用 Univer Data Validation API + 预加载策略：

1. 页面加载时，调用后端 API 获取下拉选项数据
2. 将数据写入 Univer 的 data validation list rule：

```ts
const options = await fetchDropdownOptions(); // 从后端获取
range.setDataValidationRule({
  type: 'list',
  formula1: options.map(o => o.label).join(','),
  showDropdown: true,
});
```

3. 当选项数据变化时（如联动筛选），通过 Facade API 动态更新 validation rule

---

## Task 6: 后端文件管理 API

在 `apps/nestjs-server/src/modules/files/` 新建文件管理模块：

### 数据模型（Prisma）

新增 `apps/nestjs-server/prisma/schema/file.prisma`：

```prisma
model File {
  id        String   @id @default(cuid())
  rowId     String   // 关联的业务行 ID
  fileName  String
  fileSize  Int
  mimeType  String
  filePath  String   // 服务器本地存储路径
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### API 端点

| Method | Path | 描述 |
|--------|------|------|
| POST | `/api/files/upload` | 上传文件（multipart/form-data） |
| GET | `/api/files?rowId=xxx` | 获取某行关联的文件列表 |
| GET | `/api/files/:id/download` | 下载文件 |
| DELETE | `/api/files/:id` | 删除文件 |

文件存储路径通过环境变量 `FILE_UPLOAD_DIR` 配置，默认 `./uploads/`。

---

## Task 7: 后端下拉数据源 API

在对应业务模块中新增 API，供前端下拉框获取选项：

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/sheet/dropdown-options` | 获取下拉选项（支持 type 参数区分字段） |

---

## Task 8: 侧边栏导航入口

在 `apps/web/src/components/layout/app-sidebar.tsx` 中添加「表格」导航入口，指向 `/sheet` 路由。

---

## 文件结构预览

```
apps/web/src/
├── features/sheet/
│   ├── sheet-page.tsx          # 业务页面（布局 + 状态管理）
│   ├── univer-container.tsx    # Univer 容器组件
│   ├── hooks/
│   │   ├── use-univer-permission.ts  # 权限控制 hook
│   │   ├── use-univer-dropdown.ts    # 异步下拉 hook
│   │   └── use-file-panel.ts         # 文件面板 hook
│   └── components/
│       ├── file-panel.tsx      # 右侧文件列表面板
│       └── expand-button.tsx   # 行展开按钮
├── routes/
│   └── _app.sheet.tsx          # 路由定义

apps/nestjs-server/src/modules/files/
├── files.module.ts
├── files.controller.ts
├── files.service.ts
└── dto/
    └── upload-file.dto.ts
```

---

## 执行顺序

1. Task 1 → Task 2（基础环境，能看到空白表格）
2. Task 6（后端文件 API，先有基础设施）
3. Task 3（主从表，核心业务功能）
4. Task 4（权限控制）
5. Task 5（异步下拉）
6. Task 7 + Task 8（数据源 API + 导航入口）
