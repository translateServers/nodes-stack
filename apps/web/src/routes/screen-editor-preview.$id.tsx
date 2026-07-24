import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/store';
import { EditorPreviewScreen } from '@/features/screen/components/editor-preview-screen';

/**
 * 编辑器内预览路由（草稿版本）。
 *
 * 顶层路由（不在 _app 布局下），全屏渲染无编辑器外壳（侧边栏/顶栏/工具栏），
 * 但需要鉴权守卫（因为读取草稿端点 /api/screen/:id 需要登录态）。
 *
 * 与 /screen-preview/$id 的区别：
 * - /screen-preview/$id：匿名可访问，读取已发布版本
 * - /screen-editor-preview/$id：需登录，读取草稿，供编辑者预览当前编辑内容
 */
export const Route = createFileRoute('/screen-editor-preview/$id')({
  beforeLoad: () => {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/login' });
    }
  },
  component: EditorPreviewScreen,
});
