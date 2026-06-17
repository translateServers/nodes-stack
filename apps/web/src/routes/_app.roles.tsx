import { createFileRoute } from '@tanstack/react-router';
import { RolesPage } from '@/features/role';

export const Route = createFileRoute('/_app/roles')({
  component: RolesPage,
});
