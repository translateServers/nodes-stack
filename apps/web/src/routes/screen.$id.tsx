import { createFileRoute } from '@tanstack/react-router';
import { ScreenEditor } from '@/features/screen/components/screen-editor';

export const Route = createFileRoute('/screen/$id')({
  component: ScreenEditor,
});
