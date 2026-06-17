import { createFileRoute } from '@tanstack/react-router';
import MenusPage from '@/pages/Menus';

export const Route = createFileRoute('/_app/menus')({
  component: MenusPage,
});
