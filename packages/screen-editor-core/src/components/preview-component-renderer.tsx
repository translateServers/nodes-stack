/**
 * 预览页组件渲染器包装（任务 3.5）
 *
 * 从 BlueprintPreviewContext 读取该组件的 apiRawDataOverride（refreshDataSource 完成后写入），
 * 传给底层 ComponentRenderer。
 *
 * 独立预览页使用此包装；编辑器画布直接把同一 Context 中的 override 传给
 * ComponentRenderer。Context 为 null 时回退到 undefined。
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
