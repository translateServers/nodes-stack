import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, dictApi, healthApi, menuApi, roleApi, userApi } from '@/api';
import { clearTokens, getAccessToken, setAccessToken, setRefreshToken } from '@/api/token';

type UpdateUserMutationParams =
  Parameters<typeof userApi.updateUser> extends [infer TId, infer TParams]
    ? { id: TId; params: TParams }
    : never;

export function useCaptcha() {
  return useQuery({
    queryKey: ['captcha'],
    queryFn: authApi.getCaptcha,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (tokens) => {
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: authApi.register,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearTokens();
      queryClient.clear();
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: authApi.getProfile,
    enabled: Boolean(getAccessToken()),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: userApi.getUsers,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => userApi.getUserById(id),
    enabled: Boolean(id),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.createUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, params }: UpdateUserMutationParams) => userApi.updateUser(id, params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.deleteUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: healthApi.checkHealth,
    refetchInterval: 30_000,
  });
}

export function useMenus() {
  return useQuery({
    queryKey: ['menus'],
    queryFn: menuApi.getMenus,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: roleApi.getRoles,
  });
}

export function useDictTypes() {
  return useQuery({
    queryKey: ['dict-types'],
    queryFn: dictApi.getDictTypes,
  });
}

export function useDictValues(typeCode: string) {
  return useQuery({
    queryKey: ['dict-values', typeCode],
    queryFn: () => dictApi.getDictValues(typeCode),
    enabled: Boolean(typeCode),
  });
}
