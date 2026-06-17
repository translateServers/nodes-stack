import { createFileRoute } from '@tanstack/react-router';
import { UsersPage } from '@/features/user';

export const Route = createFileRoute('/_app/users')({
  component: UsersPage,
});
