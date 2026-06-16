# Checklist

- [ ] query-client.ts 中移除了全局 `retry: 0` 配置
- [ ] user 模块的 useCreateUser / useUpdateUser / useDeleteUser 均实现了乐观更新 + 错误回滚
- [ ] role 模块的 useCreateRole / useUpdateRole / useDeleteRole / useAssignRoleMenus 均实现了乐观更新 + 错误回滚
- [ ] dict 模块的 useCreateDictType / useUpdateDictType / useDeleteDictType / useCreateDictValue / useUpdateDictValue / useDeleteDictValue 均实现了乐观更新 + 错误回滚
- [ ] menu 模块的 useCreateMenu / useUpdateMenu / useDeleteMenu 均实现了乐观更新 + 错误回滚（树形结构正确处理）
- [ ] 所有 mutation hooks 的 onSettled 中均调用 invalidateQueries 进行后台重新验证
- [ ] 所有 mutation hooks 的 onError 中均实现了缓存回滚逻辑
- [ ] `pnpm typecheck` 通过无错误
- [ ] `pnpm lint` 通过无错误
