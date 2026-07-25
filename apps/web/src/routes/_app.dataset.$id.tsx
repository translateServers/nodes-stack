import { createFileRoute } from '@tanstack/react-router';
import { DatasetEditorPage } from '@/features/dataset';

export const Route = createFileRoute('/_app/dataset/$id')({
  component: DatasetEditorPageWrapper,
});

function DatasetEditorPageWrapper() {
  const { id } = Route.useParams();
  return <DatasetEditorPage id={id} />;
}
