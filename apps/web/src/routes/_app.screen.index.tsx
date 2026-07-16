import { createFileRoute } from '@tanstack/react-router';
import { ScreenListPage } from '@/features/screen/components/screen-list-page';

export const Route = createFileRoute('/_app/screen/')({
  component: ScreenListPage,
});
