import { createFileRoute } from '@tanstack/react-router';
import { DatasetsPage } from '@/features/dataset';

export const Route = createFileRoute('/_app/dataset/')({
  component: DatasetsPage,
});
