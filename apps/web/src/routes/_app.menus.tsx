import { createFileRoute } from '@tanstack/react-router';
import { MenusPage } from '@/features/menu';

export const Route = createFileRoute('/_app/menus')({
  component: MenusPage,
});
