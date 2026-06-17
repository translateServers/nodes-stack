import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/features/auth';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});
