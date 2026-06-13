# 菜单管理系统规范

## Why
当前系统缺少菜单管理和基于角色的权限控制功能，需要建立一套完整、可扩展的菜单管理系统，支持菜单的CRUD操作、层级结构维护、权限控制、排序和状态管理，为前端提供灵活的路由和菜单配置能力。

## What Changes
- 新增 Role 模型和 RolePermission 关联模型
- 新增 Menu 模型，支持无限层级嵌套（自引用关系）
- 新增 MenuRole 关联模型，实现菜单与角色的多对多权限控制
- 新增 menu 模块（Service、Controller、DTO、Module）
- 新增 role 模块（Service、Controller、DTO、Module）
- 扩展 User 模型，添加与 Role 的多对多关系
- 提供完整的 REST API 接口，支持 Swagger 文档自动生成

## Impact
- Affected specs: menu-management, role-management
- Affected code:
  - `prisma/schema/` - 新增 Menu.prisma, Role.prisma 模型文件
  - `src/modules/menu/` - 新增菜单管理模块
  - `src/modules/role/` - 新增角色管理模块
  - `prisma/schema/User.prisma` - 扩展 User 模型添加角色关系

## ADDED Requirements

### Requirement: 菜单数据模型
系统 SHALL 提供菜单数据模型，包含以下字段：
- id: UUID 主键
- parentId: 可选的父菜单ID（用于层级嵌套）
- name: 菜单名称（唯一标识）
- title: 显示标题
- path: 路由路径
- icon: 图标标识
- type: 菜单类型（menu | button | link）
- sort: 排序号（数字越小越靠前）
- isActive: 启用状态（默认 true）
- permission: 权限标识（如 'user:create'）
- component: 组件路径
- createdAt: 创建时间
- updatedAt: 更新时间

#### Scenario: 创建子菜单
- **WHEN** 用户创建菜单时指定 parentId
- **THEN** 系统建立父子关系，支持无限层级嵌套

### Requirement: 角色数据模型
系统 SHALL 提供角色数据模型，包含以下字段：
- id: UUID 主键
- name: 角色名称（唯一）
- description: 角色描述
- isActive: 启用状态（默认 true）
- createdAt: 创建时间
- updatedAt: 更新时间

#### Scenario: 创建角色
- **WHEN** 用户提供角色名称和描述
- **THEN** 系统创建角色，可后续关联菜单权限

### Requirement: 菜单权限控制
系统 SHALL 支持通过角色控制菜单访问权限：
- 一个角色可以关联多个菜单
- 一个菜单可以被多个角色访问
- 通过 MenuRole 中间表维护多对多关系

#### Scenario: 分配菜单权限给角色
- **WHEN** 管理员为角色分配菜单权限
- **THEN** 系统在 MenuRole 表中建立关联记录

### Requirement: 用户角色关联
系统 SHALL 支持用户与角色的多对多关系：
- 一个用户可以拥有多个角色
- 一个角色可以分配给多个用户

#### Scenario: 为用户分配角色
- **WHEN** 管理员为用户分配角色
- **THEN** 系统建立用户与角色的关联关系

### Requirement: 菜单层级查询
系统 SHALL 提供获取完整菜单树的能力：
- 返回嵌套的树形结构数据
- 仅返回 isActive=true 的菜单
- 支持按角色过滤可见菜单

#### Scenario: 获取菜单树
- **WHEN** 请求获取菜单树
- **THEN** 系统返回完整的层级结构，子菜单嵌套在 parent 的 children 字段中

### Requirement: 菜单排序
系统 SHALL 支持自定义菜单显示顺序：
- sort 字段为数字，数字越小排序越靠前
- 同一层级内的菜单按 sort 排序
- 查询时自动应用排序

#### Scenario: 更新菜单排序
- **WHEN** 管理员修改菜单的 sort 值
- **THEN** 菜单在查询结果中的位置相应改变

### Requirement: 菜单状态管理
系统 SHALL 支持菜单的启用/禁用：
- isActive=false 的菜单不参与查询结果
- 禁用父菜单时，其子菜单也不可见

#### Scenario: 禁用菜单
- **WHEN** 管理员禁用某个菜单
- **THEN** 该菜单及其子菜单不再出现在查询结果中

### Requirement: REST API 接口
系统 SHALL 提供标准化的 REST API：

菜单接口：
- POST /api/menus - 创建菜单
- GET /api/menus - 获取菜单树（可选 roleId 过滤）
- GET /api/menus/:id - 获取单个菜单
- PATCH /api/menus/:id - 更新菜单
- DELETE /api/menus/:id - 删除菜单

角色接口：
- POST /api/roles - 创建角色
- GET /api/roles - 获取所有角色
- GET /api/roles/:id - 获取单个角色
- PATCH /api/roles/:id - 更新角色
- DELETE /api/roles/:id - 删除角色
- POST /api/roles/:id/menus - 为角色分配菜单权限
- DELETE /api/roles/:id/menus/:menuId - 移除角色的菜单权限

#### Scenario: 调用菜单接口
- **WHEN** 发送 HTTP 请求到菜单接口
- **THEN** 系统返回标准响应格式，包含 code、data、message、success 字段

## MODIFIED Requirements

### Requirement: User 模型扩展
**当前**: User 模型仅包含基本信息和 refreshTokens 关系
**修改后**: User 模型新增 roles 关系，与 Role 建立多对多关联

**Migration**: 通过 Prisma migration 添加用户角色关联表，不影响现有用户数据
