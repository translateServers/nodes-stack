import { useParams } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useScreenPreview } from '../hooks';
import { PreviewCanvas } from './screen-preview-canvas';

/**
 * 公开预览页（已发布版本）。
 *
 * 路由：/screen-preview/$id（顶层路由，匿名可访问，无鉴权守卫）
 * 数据：GET /api/screen/:id/preview（后端返回已发布版本快照）
 *
 * 与编辑器内预览（EditorPreviewScreen）的区别：
 * - 本页读取已发布版本，对外公开访问
 * - 编辑器内预览读取草稿，需登录鉴权
 * 两者共享 PreviewCanvas 渲染层，仅数据来源不同。
 *
 * 不存在态文案："大屏项目不存在或未发布" — 因为 preview 端点仅在已发布时返回数据。
 */
export function ScreenPreview() {
  const { id } = useParams({ from: '/screen-preview/$id' });
  const { data: project, isLoading } = useScreenPreview(id);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        大屏项目不存在或未发布
      </div>
    );
  }

  return <PreviewCanvas project={project} />;
}
