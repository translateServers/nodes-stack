import { createFileRoute } from '@tanstack/react-router';
import { ScreenPreview } from '@/features/screen/components/screen-preview';

export const Route = createFileRoute('/screen-preview/$id')({
  component: ScreenPreview,
});
