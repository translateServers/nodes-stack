import { createFileRoute } from '@tanstack/react-router';
import { SheetPage } from '@/features/sheet';

export const Route = createFileRoute('/_app/sheet')({
  component: SheetPage,
});
