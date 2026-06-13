import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from './api';
import { useAuthStore } from '@/store/auth';

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
      useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
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
      useAuthStore.getState().clearAuth();
      queryClient.clear();
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: authApi.getProfile,
    enabled: Boolean(useAuthStore.getState().accessToken),
  });
}
