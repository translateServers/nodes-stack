import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createLocalSnapshotAdapter } from '@/features/screen/adapters/local-snapshot-adapter';
import type { ScreenEditorHostAdapter } from '@/features/screen/adapters/screen-editor-host-adapter';
import { ScreenEditor } from '@/features/screen/components/screen-editor';
import { useUiStore } from '@/store';

function ScreenEditorRoute() {
  const appTheme = useUiStore((state) => state.theme);
  const setAppTheme = useUiStore((state) => state.setTheme);
  const hostAdapter = useMemo<ScreenEditorHostAdapter>(
    () => ({ snapshots: createLocalSnapshotAdapter(window.localStorage) }),
    [],
  );
  const theme =
    appTheme === 'system' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : appTheme === 'dark'
        ? 'dark'
        : 'light';
  return <ScreenEditor hostAdapter={hostAdapter} onThemeChange={setAppTheme} theme={theme} />;
}

export const Route = createFileRoute('/_app/screen/$id')({
  // 大屏编辑器是全屏工作台，隐藏 AppLayout 默认的侧边栏 / Header / Footer / 内边距
  staticData: {
    layout: { sidebar: false, header: false, footer: false, mainPadding: false },
  },
  component: ScreenEditorRoute,
});
