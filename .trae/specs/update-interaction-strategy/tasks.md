# Tasks

- [ ] Task 1: 更新 query-client.ts 默认 mutation 配置
  - [ ] SubTask 1.1: 移除全局 `retry: 0` 配置，允许各 mutation hook 自行控制重试策略

- [ ] Task 2: 改造 user 模块 mutation hooks（乐观更新 + 回滚）
  - [ ] SubTask 2.1: 改造 `useCreateUser`：onMutate 快照 + 乐观插入，onError 回滚，onSettled 重新验证
  - [ ] SubTask 2.2: 改造 `useUpdateUser`：onMutate 快照 + 乐观更新单条数据，onError 回滚，onSettled 重新验证
  - [ ] SubTask 2.3: 改造 `useDeleteUser`：onMutate 快照 + 乐观删除，onError 回滚，onSettled 重新验证

- [ ] Task 3: 改造 role 模块 mutation hooks（乐观更新 + 回滚）
  - [ ] SubTask 3.1: 改造 `useCreateRole`：onMutate 快照 + 乐观插入，onError 回滚，onSettled 重新验证
  - [ ] SubTask 3.2: 改造 `useUpdateRole`：onMutate 快照 + 乐观更新单条数据，onError 回滚，onSettled 重新验证
  - [ ] SubTask 3.3: 改造 `useDeleteRole`：onMutate 快照 + 乐观删除，onError 回滚，onSettled 重新验证
  - [ ] SubTask 3.4: 改造 `useAssignRoleMenus`：onMutate 快照 + 乐观更新，onError 回滚，onSettled 重新验证

- [ ] Task 4: 改造 dict 模块 mutation hooks（乐观更新 + 回滚）
  - [ ] SubTask 4.1: 改造 `useCreateDictType` / `useUpdateDictType` / `useDeleteDictType`
  - [ ] SubTask 4.2: 改造 `useCreateDictValue` / `useUpdateDictValue` / `useDeleteDictValue`

- [ ] Task 5: 改造 menu 模块 mutation hooks（乐观更新 + 回滚）
  - [ ] SubTask 5.1: 改造 `useCreateMenu` / `useUpdateMenu` / `useDeleteMenu`（菜单为树形结构，需注意树形数据的乐观更新逻辑）

- [ ] Task 6: 验证
  - [ ] SubTask 6.1: 运行 `pnpm typecheck` 确保无类型错误
  - [ ] SubTask 6.2: 运行 `pnpm lint` 确保代码规范

# Task Dependencies

- [Task 1] 无依赖，可独立执行
- [Task 2] 依赖 [Task 1]
- [Task 3] 依赖 [Task 1]
- [Task 4] 依赖 [Task 1]
- [Task 5] 依赖 [Task 1]
- [Task 6] 依赖 [Task 2, 3, 4, 5]
