import { createFileRoute } from '@tanstack/react-router';
import { ScreenEditor } from '@/features/screen/components/screen-editor';

export const Route = createFileRoute('/_app/screen/$id')({
  // 大屏编辑器是全屏工作台，隐藏 AppLayout 默认的侧边栏 / Header / Footer / 内边距
  staticData: {
    layout: { sidebar: false, header: false, footer: false, mainPadding: false },
  },
  component: ScreenEditor,
});
