import { createFileRoute } from '@tanstack/react-router';
import { DataTablePlaygroundPage } from '@/features/playground';

export const Route = createFileRoute('/_app/data-table-playground')({
  component: DataTablePlaygroundPage,
});
