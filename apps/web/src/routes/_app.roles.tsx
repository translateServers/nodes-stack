import { createFileRoute } from '@tanstack/react-router';
import RolesPage from '@/pages/Roles';

export const Route = createFileRoute('/_app/roles')({
  component: RolesPage,
});
