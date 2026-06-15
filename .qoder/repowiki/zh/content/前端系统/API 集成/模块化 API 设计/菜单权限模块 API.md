# 菜单权限模块 API

<cite>
**本文引用的文件**
- [apps/web/src/api/modules/menu/api.ts](file://apps/web/src/api/modules/menu/api.ts)
- [apps/web/src/api/modules/role/api.ts](file://apps/web/src/api/modules/role/api.ts)
- [apps/web/src/api/modules/auth/api.ts](file://apps/web/src/api/modules/auth/api.ts)
- [apps/web/src/router/index.tsx](file://apps/web/src/router/index.tsx)
- [apps/web/src/store/auth.ts](file://apps/web/src/store/auth.ts)
- [apps/web/src/components/RequireAuth.tsx](file://apps/web/src/components/RequireAuth.tsx)
- [apps/web/src/layouts/MainLayout.tsx](file://apps/web/src/layouts/MainLayout.tsx)
- [apps/web/src/api/core/endpoints.ts](file://apps/web/src/api/core/endpoints.ts)
- [apps/web/src/pages/Menus.tsx](file://apps/web/src/pages/Menus.tsx)
- [packages/shared/src/index.ts](file://packages/shared/src/index.ts)
</cite>

## 更新摘要
**所做更改**
- 新增完整的菜单管理模块实现，包含树形结构支持和 CRUD 操作
- 新增角色管理模块实现，包含权限分配功能
- 更新路由配置，添加菜单和角色管理页面
- 增强布局导航，支持菜单和角色管理入口
- 完善认证状态管理，支持令牌持久化和自动恢复

## 目录

1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介

本文件面向前端"菜单权限模块"的 API 设计与实现，覆盖菜单树形结构、权限节点与角色分配的接口调用方式；阐述菜单权限的动态加载、权限验证与访问控制策略；提供菜单导航、权限判断与路由守卫的集成示例；并讨论 RBAC 权限模型在前端的落地与性能优化方案。

**更新** 新增完整的菜单管理模块和角色管理模块实现，提供从基础 CRUD 到复杂权限控制的完整解决方案。

## 项目结构

前端采用模块化组织，菜单与角色权限相关 API 分别位于独立模块中，并通过统一的端点常量进行集中管理。路由层使用 React Router v6 的嵌套路由与路由守卫，配合全局状态管理实现认证态与访问控制。

```mermaid
graph TB
subgraph "前端应用"
R["路由<br/>apps/web/src/router/index.tsx"]
L["布局与导航<br/>apps/web/src/layouts/MainLayout.tsx"]
RA["路由守卫<br/>apps/web/src/components/RequireAuth.tsx"]
AS["认证状态存储<br/>apps/web/src/store/auth.ts"]
E["端点常量<br/>apps/web/src/api/core/endpoints.ts"]
MAPI["菜单 API 模块<br/>apps/web/src/api/modules/menu/api.ts"]
RAPI["角色 API 模块<br/>apps/web/src/api/modules/role/api.ts"]
AUTHAPI["认证 API 模块<br/>apps/web/src/api/modules/auth/api.ts"]
MENUPAGE["菜单管理页面<br/>apps/web/src/pages/Menus.tsx"]
SHARED["@nebula/shared 导出<br/>packages/shared/src/index.ts"]
end
R --> RA
R --> L
RA --> AS
MAPI --> E
RAPI --> E
AUTHAPI --> E
MENUPAGE --> MAPI
MAPI --> SHARED
RAPI --> SHARED
AUTHAPI --> SHARED
```

**图表来源**
- [apps/web/src/router/index.tsx:1-53](file://apps/web/src/router/index.tsx#L1-L53)
- [apps/web/src/layouts/MainLayout.tsx:1-338](file://apps/web/src/layouts/MainLayout.tsx#L1-L338)
- [apps/web/src/components/RequireAuth.tsx:1-14](file://apps/web/src/components/RequireAuth.tsx#L1-L14)
- [apps/web/src/store/auth.ts:1-64](file://apps/web/src/store/auth.ts#L1-L64)
- [apps/web/src/api/core/endpoints.ts:1-21](file://apps/web/src/api/core/endpoints.ts#L1-L21)
- [apps/web/src/api/modules/menu/api.ts:1-33](file://apps/web/src/api/modules/menu/api.ts#L1-L33)
- [apps/web/src/api/modules/role/api.ts:1-32](file://apps/web/src/api/modules/role/api.ts#L1-L32)
- [apps/web/src/api/modules/auth/api.ts:1-45](file://apps/web/src/api/modules/auth/api.ts#L1-L45)
- [apps/web/src/pages/Menus.tsx:1-550](file://apps/web/src/pages/Menus.tsx#L1-L550)
- [packages/shared/src/index.ts:1-15](file://packages/shared/src/index.ts#L1-L15)

**章节来源**
- [apps/web/src/router/index.tsx:1-53](file://apps/web/src/router/index.tsx#L1-L53)
- [apps/web/src/layouts/MainLayout.tsx:1-338](file://apps/web/src/layouts/MainLayout.tsx#L1-L338)
- [apps/web/src/components/RequireAuth.tsx:1-14](file://apps/web/src/components/RequireAuth.tsx#L1-L14)
- [apps/web/src/store/auth.ts:1-64](file://apps/web/src/store/auth.ts#L1-L64)
- [apps/web/src/api/core/endpoints.ts:1-21](file://apps/web/src/api/core/endpoints.ts#L1-L21)
- [apps/web/src/api/modules/menu/api.ts:1-33](file://apps/web/src/api/modules/menu/api.ts#L1-L33)
- [apps/web/src/api/modules/role/api.ts:1-32](file://apps/web/src/api/modules/role/api.ts#L1-L32)
- [apps/web/src/api/modules/auth/api.ts:1-45](file://apps/web/src/api/modules/auth/api.ts#L1-L45)
- [apps/web/src/pages/Menus.tsx:1-550](file://apps/web/src/pages/Menus.tsx#L1-L550)
- [packages/shared/src/index.ts:1-15](file://packages/shared/src/index.ts#L1-L15)

## 核心组件

- **菜单 API 模块**：提供菜单列表、菜单树、创建、更新、删除等能力，返回类型由共享 Schema 校验。
- **角色 API 模块**：提供角色列表、创建、更新、为角色分配菜单等能力，返回类型由共享 Schema 校验。
- **认证 API 模块**：提供验证码、注册、登录、刷新令牌、登出、获取个人资料等能力。
- **路由与守卫**：通过 RequireAuth 实现受保护路由，结合全局认证状态决定是否放行。
- **布局与导航**：MainLayout 定义菜单分组与导航项，承载面包屑与侧边栏交互，包含菜单管理、角色管理入口。
- **菜单管理页面**：提供完整的菜单 CRUD 界面，支持树形结构展示和权限控制。
- **端点常量**：统一管理后端 API 基础路径与各模块端点，便于维护与替换。
- **共享类型**：通过 @nebula/shared 提供认证、用户、菜单、角色、字典等 Schema 与类型导出。

**更新** 新增菜单管理页面组件，提供完整的树形菜单编辑界面和权限控制功能。

**章节来源**
- [apps/web/src/api/modules/menu/api.ts:14-32](file://apps/web/src/api/modules/menu/api.ts#L14-L32)
- [apps/web/src/api/modules/role/api.ts:13-31](file://apps/web/src/api/modules/role/api.ts#L13-L31)
- [apps/web/src/api/modules/auth/api.ts:20-44](file://apps/web/src/api/modules/auth/api.ts#L20-L44)
- [apps/web/src/components/RequireAuth.tsx:4-12](file://apps/web/src/components/RequireAuth.tsx#L4-L12)
- [apps/web/src/layouts/MainLayout.tsx:34-48](file://apps/web/src/layouts/MainLayout.tsx#L34-L48)
- [apps/web/src/pages/Menus.tsx:1-550](file://apps/web/src/pages/Menus.tsx#L1-L550)
- [apps/web/src/api/core/endpoints.ts:3-20](file://apps/web/src/api/core/endpoints.ts#L3-L20)
- [packages/shared/src/index.ts:4-11](file://packages/shared/src/index.ts#L4-L11)

## 架构总览

下图展示菜单权限模块在前端的整体调用链路：路由层负责页面级访问控制，布局层负责菜单导航与面包屑，API 层负责与后端交互，状态层负责认证态与持久化。

```mermaid
sequenceDiagram
participant U as "用户"
participant R as "路由<br/>router/index.tsx"
participant G as "路由守卫<br/>RequireAuth"
participant S as "认证状态<br/>store/auth.ts"
participant L as "布局导航<br/>layouts/MainLayout"
participant M as "菜单 API<br/>menu/api.ts"
participant RAPI as "角色 API<br/>role/api.ts"
U->>R : 访问受保护路由
R->>G : 匹配到受保护路由
G->>S : 读取 isAuthenticated
alt 已认证
G-->>R : 放行
R-->>L : 渲染主布局
L->>M : 获取菜单树/列表
M-->>L : 返回菜单数据
L->>RAPI : 可选：获取角色/分配菜单
RAPI-->>L : 返回角色数据
else 未认证
G-->>U : 重定向至登录页
end
```

**图表来源**
- [apps/web/src/router/index.tsx:14-49](file://apps/web/src/router/index.tsx#L14-L49)
- [apps/web/src/components/RequireAuth.tsx:4-12](file://apps/web/src/components/RequireAuth.tsx#L4-L12)
- [apps/web/src/store/auth.ts:30-63](file://apps/web/src/store/auth.ts#L30-L63)
- [apps/web/src/layouts/MainLayout.tsx:34-48](file://apps/web/src/layouts/MainLayout.tsx#L34-L48)
- [apps/web/src/api/modules/menu/api.ts:14-20](file://apps/web/src/api/modules/menu/api.ts#L14-L20)
- [apps/web/src/api/modules/role/api.ts:13-27](file://apps/web/src/api/modules/role/api.ts#L13-L27)

## 详细组件分析

### 菜单 API 模块

- **接口职责**
  - 获取菜单列表：用于展示扁平菜单集合。
  - 获取菜单树：用于构建层级化的导航树。
  - 创建/更新/删除菜单：用于后台管理。
- **数据校验**
  - 使用共享 Schema 对请求参数与响应进行编译时与运行时校验，确保前后端契约一致。
- **错误处理**
  - 通过统一 HTTP 封装与错误拦截器处理网络异常与业务错误。

```mermaid
flowchart TD
Start(["调用菜单 API"]) --> Op{"操作类型"}
Op --> |获取列表| GetList["get(menus)"]
Op --> |获取树| GetTree["get(menus/tree)"]
Op --> |创建| Create["post(menus)"]
Op --> |更新| Update["patch(menus/:id)"]
Op --> |删除| Delete["del(menus/:id)"]
GetList --> Validate["Zod 校验响应"]
GetTree --> Validate
Create --> Validate
Update --> Validate
Delete --> Done(["完成"])
Validate --> Done
```

**图表来源**
- [apps/web/src/api/modules/menu/api.ts:14-32](file://apps/web/src/api/modules/menu/api.ts#L14-L32)
- [apps/web/src/api/core/endpoints.ts:17](file://apps/web/src/api/core/endpoints.ts#L17)
- [packages/shared/src/index.ts:6](file://packages/shared/src/index.ts#L6)

**章节来源**
- [apps/web/src/api/modules/menu/api.ts:14-32](file://apps/web/src/api/modules/menu/api.ts#L14-L32)
- [apps/web/src/api/core/endpoints.ts:17](file://apps/web/src/api/core/endpoints.ts#L17)
- [packages/shared/src/index.ts:6](file://packages/shared/src/index.ts#L6)

### 角色 API 模块

- **接口职责**
  - 获取角色列表：用于角色管理界面。
  - 创建/更新/删除角色：用于后台管理。
  - 为角色分配菜单：建立角色与菜单的授权关系。
- **数据校验**
  - 使用共享 Schema 对请求参数与响应进行编译时与运行时校验。

```mermaid
sequenceDiagram
participant UI as "角色管理界面"
participant API as "role/api.ts"
participant EP as "endpoints.ts"
participant SH as "@nebula/shared"
UI->>API : 调用 assignRoleMenus(roleId, menuIds)
API->>EP : 拼接 /roles/{id}/menus
API->>SH : 参数与响应 Schema 校验
API-->>UI : 返回成功/错误
```

**图表来源**
- [apps/web/src/api/modules/role/api.ts:25-27](file://apps/web/src/api/modules/role/api.ts#L25-L27)
- [apps/web/src/api/core/endpoints.ts:18](file://apps/web/src/api/core/endpoints.ts#L18)
- [packages/shared/src/index.ts:7](file://packages/shared/src/index.ts#L7)

**章节来源**
- [apps/web/src/api/modules/role/api.ts:13-31](file://apps/web/src/api/modules/role/api.ts#L13-L31)
- [apps/web/src/api/core/endpoints.ts:18](file://apps/web/src/api/core/endpoints.ts#L18)
- [packages/shared/src/index.ts:7](file://packages/shared/src/index.ts#L7)

### 菜单管理页面

- **功能特性**
  - 树形结构展示：支持多级菜单的层级化显示。
  - 完整 CRUD：支持菜单的创建、编辑、删除操作。
  - 权限控制：支持菜单类型的区分（目录、菜单、按钮）。
  - 父级关联：支持父子菜单关系的建立和管理。
- **界面组件**
  - 树形表格：展示菜单层级关系和基本信息。
  - 表单组件：提供菜单属性编辑界面。
  - 弹窗对话框：模态化处理菜单创建和编辑。
- **交互逻辑**
  - 展开/折叠：支持树形节点的展开和收起。
  - 搜索过滤：支持菜单名称的搜索和筛选。
  - 批量操作：支持多个菜单的批量删除。

**新增** 完整的菜单管理页面实现，提供可视化的菜单编辑界面和权限控制功能。

**章节来源**
- [apps/web/src/pages/Menus.tsx:1-550](file://apps/web/src/pages/Menus.tsx#L1-L550)

### 认证与路由守卫

- **路由守卫**
  - RequireAuth 读取全局认证状态，未认证则重定向至登录页。
- **认证状态存储**
  - 使用 Zustand 管理 accessToken、refreshToken、用户信息与认证态，并持久化部分字段。
- **登录/登出流程**
  - 登录成功后写入令牌与认证态；登出时清理状态并跳转登录页。

```mermaid
sequenceDiagram
participant R as "路由"
participant G as "RequireAuth"
participant S as "Zustand 认证状态"
participant A as "auth/api.ts"
R->>G : 进入受保护路由
G->>S : 读取 isAuthenticated
alt 未认证
G-->>R : 重定向 /login
else 已认证
G-->>R : 放行
R-->>A : 可选：获取个人资料/刷新令牌
end
```

**图表来源**
- [apps/web/src/components/RequireAuth.tsx:4-12](file://apps/web/src/components/RequireAuth.tsx#L4-L12)
- [apps/web/src/store/auth.ts:30-63](file://apps/web/src/store/auth.ts#L30-L63)
- [apps/web/src/api/modules/auth/api.ts:24-44](file://apps/web/src/api/modules/auth/api.ts#L24-L44)

**章节来源**
- [apps/web/src/components/RequireAuth.tsx:1-14](file://apps/web/src/components/RequireAuth.tsx#L1-L14)
- [apps/web/src/store/auth.ts:1-64](file://apps/web/src/store/auth.ts#L1-L64)
- [apps/web/src/api/modules/auth/api.ts:1-45](file://apps/web/src/api/modules/auth/api.ts#L1-L45)

### 布局与导航

- **菜单分组与导航项**
  - 通过静态配置定义"概览""系统管理"等分组与子项，支持图标与路径映射。
  - 新增菜单管理、角色管理入口，支持完整的权限管理功能。
- **面包屑**
  - 基于当前路径生成面包屑标签，提升导航体验。
- **侧边栏交互**
  - 支持移动端抽屉与桌面端折叠切换，保持一致的导航行为。

```mermaid
flowchart TD
Init["渲染 MainLayout"] --> BuildGroups["构建菜单分组"]
BuildGroups --> RenderNav["渲染导航项"]
RenderNav --> Breadcrumb["生成面包屑"]
Breadcrumb --> Interact["侧边栏折叠/展开"]
Interact --> Done["完成渲染"]
```

**图表来源**
- [apps/web/src/layouts/MainLayout.tsx:34-48](file://apps/web/src/layouts/MainLayout.tsx#L34-L48)
- [apps/web/src/layouts/MainLayout.tsx:51-74](file://apps/web/src/layouts/MainLayout.tsx#L51-L74)
- [apps/web/src/layouts/MainLayout.tsx:190-337](file://apps/web/src/layouts/MainLayout.tsx#L190-L337)

**章节来源**
- [apps/web/src/layouts/MainLayout.tsx:1-338](file://apps/web/src/layouts/MainLayout.tsx#L1-L338)

### 端点常量与共享类型

- **端点常量**
  - 统一管理后端基础地址与各模块端点，便于替换与测试。
  - 新增菜单和角色模块的端点定义。
- **共享类型**
  - 通过 @nebula/shared 导出认证、用户、菜单、角色、字典等 Schema 与类型，保证前后端一致性。

**章节来源**
- [apps/web/src/api/core/endpoints.ts:1-21](file://apps/web/src/api/core/endpoints.ts#L1-L21)
- [packages/shared/src/index.ts:1-15](file://packages/shared/src/index.ts#L1-L15)

## 依赖关系分析

- **模块内聚性**
  - 菜单与角色 API 各自封装，职责清晰，复用共享 Schema。
- **外部依赖**
  - 依赖 @nebula/shared 提供的类型与 Schema。
  - 依赖路由与状态管理库（React Router、Zustand）。
- **路由耦合**
  - 路由守卫与认证状态强耦合，确保受保护路由的安全性。
- **端点集中化**
  - 端点常量集中管理，降低硬编码风险，便于迁移。

```mermaid
graph LR
MAPI["menu/api.ts"] --> SH["@nebula/shared"]
RAPI["role/api.ts"] --> SH
AUTH["auth/api.ts"] --> SH
MENUPAGE["Menus.tsx"] --> MAPI
MAPI --> EP["endpoints.ts"]
RAPI --> EP
AUTH --> EP
RA["RequireAuth"] --> ST["store/auth.ts"]
R["router/index.tsx"] --> RA
L["MainLayout"] --> R
```

**图表来源**
- [apps/web/src/api/modules/menu/api.ts:1-10](file://apps/web/src/api/modules/menu/api.ts#L1-L10)
- [apps/web/src/api/modules/role/api.ts:1-10](file://apps/web/src/api/modules/role/api.ts#L1-L10)
- [apps/web/src/api/modules/auth/api.ts:8-18](file://apps/web/src/api/modules/auth/api.ts#L8-L18)
- [apps/web/src/pages/Menus.tsx:19](file://apps/web/src/pages/Menus.tsx#L19)
- [apps/web/src/api/core/endpoints.ts:1-21](file://apps/web/src/api/core/endpoints.ts#L1-L21)
- [apps/web/src/components/RequireAuth.tsx:1-14](file://apps/web/src/components/RequireAuth.tsx#L1-L14)
- [apps/web/src/store/auth.ts:1-64](file://apps/web/src/store/auth.ts#L1-L64)
- [apps/web/src/router/index.tsx:1-53](file://apps/web/src/router/index.tsx#L1-L53)
- [apps/web/src/layouts/MainLayout.tsx:1-338](file://apps/web/src/layouts/MainLayout.tsx#L1-L338)

**章节来源**
- [apps/web/src/api/modules/menu/api.ts:1-33](file://apps/web/src/api/modules/menu/api.ts#L1-L33)
- [apps/web/src/api/modules/role/api.ts:1-32](file://apps/web/src/api/modules/role/api.ts#L1-L32)
- [apps/web/src/api/modules/auth/api.ts:1-45](file://apps/web/src/api/modules/auth/api.ts#L1-L45)
- [apps/web/src/pages/Menus.tsx:1-550](file://apps/web/src/pages/Menus.tsx#L1-L550)
- [apps/web/src/api/core/endpoints.ts:1-21](file://apps/web/src/api/core/endpoints.ts#L1-L21)
- [apps/web/src/components/RequireAuth.tsx:1-14](file://apps/web/src/components/RequireAuth.tsx#L1-L14)
- [apps/web/src/store/auth.ts:1-64](file://apps/web/src/store/auth.ts#L1-L64)
- [apps/web/src/router/index.tsx:1-53](file://apps/web/src/router/index.tsx#L1-L53)
- [apps/web/src/layouts/MainLayout.tsx:1-338](file://apps/web/src/layouts/MainLayout.tsx#L1-L338)

## 性能考虑

- **状态持久化**
  - 认证状态仅持久化必要字段，避免存储敏感或冗余数据，减少本地存储压力。
- **路由守卫轻量化**
  - 守卫仅做布尔判断，不触发额外网络请求，降低首屏阻塞。
- **导航懒加载**
  - 页面组件按需加载，结合路由嵌套减少不必要的渲染。
- **缓存与去抖**
  - 在实际业务中建议对菜单树与角色数据进行缓存与去抖，避免频繁重复请求。
- **批量授权**
  - 角色分配菜单时尽量批量提交，减少往返次数。
- **树形结构优化**
  - 菜单树形结构采用虚拟滚动和懒加载，提升大数据量下的渲染性能。

**更新** 新增树形结构性能优化考虑，包括虚拟滚动和懒加载策略。

## 故障排查指南

- **无法进入受保护路由**
  - 检查认证状态是否已设置，确认令牌是否过期或被清理。
- **菜单树为空**
  - 确认后端菜单接口可用，检查网络请求与响应 Schema 是否匹配。
- **角色分配失败**
  - 校验传入的菜单 ID 列表是否有效，确认后端权限校验逻辑。
- **登录后仍提示未登录**
  - 检查本地持久化状态是否正确恢复，确认 onRehydrateStorage 回调执行情况。
- **菜单管理页面加载失败**
  - 检查菜单 API 是否正常响应，确认树形数据结构是否符合预期。

**更新** 新增菜单管理页面相关的故障排查指导。

**章节来源**
- [apps/web/src/components/RequireAuth.tsx:4-12](file://apps/web/src/components/RequireAuth.tsx#L4-L12)
- [apps/web/src/store/auth.ts:48-63](file://apps/web/src/store/auth.ts#L48-L63)
- [apps/web/src/api/modules/menu/api.ts:14-20](file://apps/web/src/api/modules/menu/api.ts#L14-L20)
- [apps/web/src/api/modules/role/api.ts:25-27](file://apps/web/src/api/modules/role/api.ts#L25-L27)
- [apps/web/src/pages/Menus.tsx:480-481](file://apps/web/src/pages/Menus.tsx#L480-L481)

## 结论

菜单权限模块通过清晰的模块划分、统一的端点管理与严格的类型校验，实现了菜单树形结构、权限节点与角色分配的完整闭环。结合路由守卫与状态持久化，提供了安全且可维护的前端权限体系。

**更新** 新增的菜单管理模块和角色管理模块进一步完善了权限管理体系，提供从基础 CRUD 到复杂权限控制的完整解决方案。通过树形结构支持和可视化编辑界面，大大提升了权限管理的易用性和效率。

## 附录

### API 端点一览（基于端点常量）

- **认证相关**
  - 获取验证码：GET /auth/captcha
  - 用户注册：POST /auth/register
  - 用户登录：POST /auth/login
  - 刷新令牌：POST /auth/refresh
  - 用户登出：POST /auth/logout
  - 获取个人资料：GET /auth/profile
- **菜单相关**
  - 获取菜单列表：GET /menus
  - 获取菜单树：GET /menus/tree
  - 新增菜单：POST /menus
  - 更新菜单：PATCH /menus/{id}
  - 删除菜单：DELETE /menus/{id}
- **角色相关**
  - 获取角色列表：GET /roles
  - 新增角色：POST /roles
  - 更新角色：PATCH /roles/{id}
  - 为角色分配菜单：POST /roles/{id}/menus
  - 删除角色：DELETE /roles/{id}

**更新** 新增菜单和角色模块的完整 API 端点列表。

**章节来源**
- [apps/web/src/api/core/endpoints.ts:3-20](file://apps/web/src/api/core/endpoints.ts#L3-L20)