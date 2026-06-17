import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/store';
import { AppLayout } from '@/components/layout/app-layout';

export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/login' });
    }
  },
  component: AppLayout,
});
