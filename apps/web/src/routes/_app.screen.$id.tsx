import { createFileRoute } from '@tanstack/react-router';
import { ScreenEditor } from '@/features/screen/components/screen-editor';

export const Route = createFileRoute('/_app/screen/$id')({
  component: ScreenEditor,
});
