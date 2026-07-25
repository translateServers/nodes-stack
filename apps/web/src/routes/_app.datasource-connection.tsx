import { createFileRoute } from '@tanstack/react-router';
import { ConnectionsPage } from '@/features/dataset';

export const Route = createFileRoute('/_app/datasource-connection')({
  component: ConnectionsPage,
});
