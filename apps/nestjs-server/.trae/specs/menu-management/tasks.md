# Tasks

- [x] Task 1: 扩展 Prisma 数据模型
  - [x] SubTask 1.1: 创建 Role.prisma 模型文件（包含 id、name、description、isActive、createdAt、updatedAt 字段）
  - [x] SubTask 1.2: 创建 Menu.prisma 模型文件（包含自引用关系 parentId，支持无限层级嵌套，字段包含 name、title、path、icon、type、sort、isActive、permission、component）
  - [x] SubTask 1.3: 修改 User.prisma，添加与 Role 的多对多关系
  - [x] SubTask 1.4: 运行 pnpm prisma generate 生成 Prisma Client

- [x] Task 2: 扩展错误码和消息常量
  - [x] SubTask 2.1: 在 error-codes.constants.ts 中添加菜单和角色相关错误码（MENU_NOT_FOUND、ROLE_NOT_FOUND、PARENT_MENU_NOT_FOUND、MENU_ALREADY_EXISTS、ROLE_ALREADY_EXISTS、MENU_HAS_CHILDREN）
  - [x] SubTask 2.2: 在 messages.constants.ts 中添加对应的错误消息和成功消息

- [x] Task 3: 创建角色管理模块
  - [x] SubTask 3.1: 创建 dto/role.dto.ts（CreateRoleDto、UpdateRoleDto，使用 class-validator 验证）
  - [x] SubTask 3.2: 创建 dto/role-response.dto.ts（RoleResponseDto，使用 ApiProperty 和 TransformToDatetime）
  - [x] SubTask 3.3: 创建 role.service.ts（提供 create、findAll、findOne、update、remove、assignMenus、removeMenu 方法）
  - [x] SubTask 3.4: 创建 role.controller.ts（实现 REST API 接口，包含 Swagger 注解）
  - [x] SubTask 3.5: 创建 role.module.ts

- [x] Task 4: 创建菜单管理模块
  - [x] SubTask 4.1: 创建 dto/menu.dto.ts（CreateMenuDto、UpdateMenuDto，使用 class-validator 验证，包含枚举类型 MenuType）
  - [x] SubTask 4.2: 创建 dto/menu-response.dto.ts（MenuResponseDto，支持嵌套 children 字段）
  - [x] SubTask 4.3: 创建 menu.service.ts（提供 create、findAll、findTree、findOne、update、remove、findByRoleId 方法，实现树形结构转换逻辑）
  - [x] SubTask 4.4: 创建 menu.controller.ts（实现 REST API 接口，包含 Swagger 注解，支持按 roleId 过滤）
  - [x] SubTask 4.5: 创建 menu.module.ts

- [x] Task 5: 注册模块到应用
  - [x] SubTask 5.1: 在 app.module.ts 中导入 MenuModule 和 RoleModule

- [x] Task 6: 编写单元测试
  - [x] SubTask 6.1: 创建 src/modules/menu/menu.service.spec.ts（测试菜单的 CRUD 操作和树形结构转换）
  - [x] SubTask 6.2: 创建 src/modules/role/role.service.spec.ts（测试角色的 CRUD 操作和菜单权限分配）

# Task Dependencies

- [Task 2] depends on [Task 1]（错误码扩展依赖数据模型）
- [Task 3] depends on [Task 1]（角色模块依赖 Prisma 模型生成）
- [Task 4] depends on [Task 1]（菜单模块依赖 Prisma 模型生成）
- [Task 5] depends on [Task 3, Task 4]（模块注册依赖模块创建完成）
- [Task 6] depends on [Task 3, Task 4]（单元测试依赖模块实现完成）

**可并行执行的任务组:**
- [Task 3] 和 [Task 4] 可以并行执行（两者都依赖 Task 1 但互不依赖）
