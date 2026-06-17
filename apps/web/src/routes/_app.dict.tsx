import { createFileRoute } from '@tanstack/react-router';
import { DictsPage } from '@/features/dict';

export const Route = createFileRoute('/_app/dict')({
  component: DictsPage,
});
