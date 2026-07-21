/**
 * 预览页组件渲染器包装（任务 3.5）
 *
 * 从 BlueprintPreviewContext 读取该组件的 apiRawDataOverride（refreshDataSource 完成后写入），
 * 传给底层 ComponentRenderer。
 *
 * 仅在公开预览页使用；编辑器画布使用 ComponentRenderer（不读取 Context，行为不变）。
 * Context 为 null 时（编辑器场景）回退到 undefined，组件行为与阶段 2 一致。
 */

import { memo } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import { ComponentRenderer } from '../registry/renderer';
import { useBlueprintPreview } from '../blueprint/runtime/blueprint-preview-context';

interface PreviewComponentRendererProps {
  component: ScreenComponent;
}

export const PreviewComponentRenderer = memo(function PreviewComponentRenderer({
  component,
}: PreviewComponentRendererProps) {
  const ctx = useBlueprintPreview();
  const apiRawDataOverride = ctx?.apiDataOverrides.get(component.id);
  return <ComponentRenderer component={component} apiRawDataOverride={apiRawDataOverride} />;
});
