import { createFileRoute } from '@tanstack/react-router';
import DictsPage from '@/pages/Dicts';

export const Route = createFileRoute('/_app/dict')({
  component: DictsPage,
});
