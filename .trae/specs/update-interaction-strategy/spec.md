# 前后端交互更新策略优化 Spec

## Why
当前项目的 React Query mutation hooks 采用简单的 `invalidateQueries` 策略，每次 mutation 成功后都会重新发起请求获取最新数据。这种方式虽然简单可靠，但存在以下问题：
1. **UI 延迟**：mutation 成功后需要等待服务端响应才能更新 UI，用户体验不够流畅
2. **不必要的网络请求**：对于创建、更新、删除等操作，服务端已经返回了最新数据，无需再次请求
3. **无错误回滚**：mutation 失败时，UI 状态没有自动恢复机制

## What Changes
- 所有 mutation hooks 改为**乐观更新**模式：mutation 成功后立即在本地缓存中更新数据，无需等待服务端响应
- 所有 mutation hooks 增加**错误回滚**机制：mutation 失败时自动将缓存回滚到变更前的状态
- 保留 `onSettled` 中的 `invalidateQueries` 作为后台重新验证，确保最终一致性
- 移除 `query-client.ts` 中的全局 `retry: 0` 配置，允许各 mutation hook 自行控制重试策略

## Impact
- Affected specs: 前端 API 交互层
- Affected code:
  - `apps/web/src/api/core/query-client.ts` - 默认 mutation 配置
  - `apps/web/src/api/modules/user/hooks.ts` - useCreateUser / useUpdateUser / useDeleteUser
  - `apps/web/src/api/modules/role/hooks.ts` - useCreateRole / useUpdateRole / useDeleteRole / useAssignRoleMenus
  - `apps/web/src/api/modules/dict/hooks.ts` - 字典类型和字典值的所有 mutation hooks
  - `apps/web/src/api/modules/menu/hooks.ts` - useCreateMenu / useUpdateMenu / useDeleteMenu

## ADDED Requirements

### Requirement: 乐观更新 (Optimistic Updates)
所有 mutation hooks 必须实现乐观更新：
- `onMutate` 中取消相关查询（`cancelQueries`）
- 快照当前缓存数据
- 立即更新本地缓存（`setQueryData`）
- 返回上下文对象包含快照数据

#### Scenario: 创建用户成功
- **WHEN** 用户调用 `useCreateUser` 提交新用户数据
- **THEN** 本地缓存立即插入新用户，UI 无需等待服务端响应即可显示新数据

#### Scenario: 更新用户成功
- **WHEN** 用户调用 `useUpdateUser` 更新用户信息
- **THEN** 本地缓存立即更新对应用户的数据，UI 立即反映变更

#### Scenario: 删除用户成功
- **WHEN** 用户调用 `useDeleteUser` 删除用户
- **THEN** 本地缓存立即移除对应用户，UI 立即移除该用户

### Requirement: 错误回滚 (Rollback on Error)
所有 mutation hooks 必须实现错误回滚：
- `onError` 中从上下文获取快照数据
- 将缓存恢复到快照状态

#### Scenario: Mutation 失败回滚
- **WHEN** mutation 失败（网络错误或业务错误）
- **THEN** 缓存自动回滚到 mutation 前的状态，UI 恢复原样

### Requirement: 后台重新验证
所有 mutation hooks 在 `onSettled` 中触发 `invalidateQueries`：
- 无论成功或失败，都重新验证相关数据
- 确保本地缓存与服务端最终一致

#### Scenario: 后台重新验证
- **WHEN** mutation 完成（成功或失败）
- **THEN** 自动触发 `invalidateQueries` 重新获取最新数据

## MODIFIED Requirements

### Requirement: Query Client 默认配置
`query-client.ts` 中的 `defaultOptions.mutations` 不再设置全局 `retry: 0`，由各 mutation hook 自行控制重试策略。

#### Scenario: 移除全局重试配置
- **WHEN** 查看 `query-client.ts` 配置
- **THEN** `defaultOptions.mutations` 中不包含 `retry: 0`

## REMOVED Requirements

无

---

## 技术实现要点

### 乐观更新模式
```typescript
export function useCreateXxx() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createXxx,
    onMutate: async (newItem) => {
      // 取消相关查询
      await queryClient.cancelQueries({ queryKey: ['xxx'] });
      
      // 快照当前数据
      const previousData = queryClient.getQueryData(['xxx']);
      
      // 乐观更新缓存
      queryClient.setQueryData(['xxx'], (old) => [...old, newItem]);
      
      // 返回上下文
      return { previousData };
    },
    onError: (_err, _newItem, context) => {
      // 回滚到快照状态
      if (context?.previousData) {
        queryClient.setQueryData(['xxx'], context.previousData);
      }
    },
    onSettled: () => {
      // 后台重新验证
      queryClient.invalidateQueries({ queryKey: ['xxx'] });
    },
  });
}
```

### 树形结构处理（菜单）
菜单模块需要特殊处理树形结构：
- 创建：在对应父节点的 children 中插入
- 更新：递归查找并更新节点
- 删除：递归查找并移除节点
