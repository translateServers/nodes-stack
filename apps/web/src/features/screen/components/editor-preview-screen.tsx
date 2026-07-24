import { useParams } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useScreenProject } from '../hooks';
import { PreviewCanvas } from './screen-preview-canvas';

/**
 * 编辑器内预览页（草稿版本）。
 *
 * 路由：/screen-editor-preview/$id（顶层路由，但需鉴权守卫）
 * 数据：GET /api/screen/:id（与编辑器相同的草稿端点，含未保存修改的最新保存版本）
 *
 * 与公开预览（ScreenPreview）的区别：
 * - 本页读取草稿版本，需登录鉴权，供编辑者预览当前编辑内容在真实页面的渲染效果
 * - 公开预览读取已发布版本，匿名可访问，对外展示
 * 两者共享 PreviewCanvas 渲染层，仅数据来源不同。
 *
 * 不存在态文案："大屏项目不存在" — 草稿端点无论是否发布都返回数据，
 * 仅在项目被删除或无权限访问时返回空。
 *
 * 语义说明：
 * 本页读取的是后端已保存的草稿（最新一次保存的结果），而非编辑器内存中的未保存修改。
 * 用户需先在编辑器保存后再预览，才能看到最新修改的渲染效果。
 */
export function EditorPreviewScreen() {
  const { id } = useParams({ from: '/screen-editor-preview/$id' });
  const { data: project, isLoading } = useScreenProject(id);

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
        大屏项目不存在
      </div>
    );
  }

  return <PreviewCanvas project={project} />;
}
