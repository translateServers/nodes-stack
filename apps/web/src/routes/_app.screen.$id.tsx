import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createLocalSnapshotAdapter } from '@/features/screen/adapters/local-snapshot-adapter';
import type { ScreenEditorHostAdapter } from '@/features/screen/adapters/screen-editor-host-adapter';
import { ScreenEditor } from '@/features/screen/components/screen-editor';

function ScreenEditorRoute() {
  const hostAdapter = useMemo<ScreenEditorHostAdapter>(
    () => ({ snapshots: createLocalSnapshotAdapter(window.localStorage) }),
    [],
  );
  return <ScreenEditor hostAdapter={hostAdapter} />;
}

export const Route = createFileRoute('/_app/screen/$id')({
  // 大屏编辑器是全屏工作台，隐藏 AppLayout 默认的侧边栏 / Header / Footer / 内边距
  staticData: {
    layout: { sidebar: false, header: false, footer: false, mainPadding: false },
  },
  component: ScreenEditorRoute,
});
