/**
 * 编辑器右侧面板包装器（属性面板）
 *
 * - 宽度可拖拽调整（240~480px，默认 288px，localStorage 持久化，双击手柄复位）
 * - 可折叠为 48px 图标轨：点击图标展开
 */

import { memo, useState } from 'react';
import { PanelRightOpen, SlidersHorizontal } from 'lucide-react';
import { PropertyPanel } from './property-panel';
import { PanelResizeHandle, ToolbarButton, useResizablePanel } from './ui-primitives';
import { useScreenEditorPreferenceNamespace } from '../stores/editor-store';

// 性能优化：memo 化右侧面板。该组件不接收外部 props，ScreenEditor 重渲染时
// （如选中态变化、视口状态变化）完全跳过右侧面板子树（含 PropertyPanel），
// 避免不必要的重渲染（已有 contain: layout style paint 进一步隔离布局/绘制）。
interface EditorRightPanelProps {
  readonly?: boolean;
}

export const EditorRightPanel = memo(function EditorRightPanel({
  readonly = false,
}: EditorRightPanelProps) {
  const preferenceNamespace = useScreenEditorPreferenceNamespace();
  const [collapsed, setCollapsed] = useState(false);
  const { width, isDragging, handlePointerDown, handleDoubleClick } = useResizablePanel({
    defaultWidth: 288,
    minWidth: 240,
    maxWidth: 480,
    storageKey: `${preferenceNamespace}:right-panel-width`,
    direction: 'left',
  });

  // 折叠态：48px 图标轨
  if (collapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center gap-1 border-l border-border bg-card py-2">
        <ToolbarButton
          tooltip="属性"
          tooltipSide="left"
          onClick={() => setCollapsed(false)}
          aria-label="展开属性面板"
        >
          <SlidersHorizontal className="size-4" />
        </ToolbarButton>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ width, contain: 'layout style paint' }}>
      <PanelResizeHandle
        isDragging={isDragging}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      />
      <div className="flex h-full min-w-0 flex-1 flex-col border-l border-border bg-card">
        {/* 折叠按钮放在属性面板头部的右侧操作位 */}
        <div className="relative flex h-full min-h-0 flex-1 flex-col">
          <div className={readonly ? 'pointer-events-none h-full opacity-80' : 'h-full'}>
            <PropertyPanel />
          </div>
          <ToolbarButton
            tooltip="收起面板"
            tooltipSide="left"
            onClick={() => setCollapsed(true)}
            aria-label="收起右侧面板"
            className="absolute top-1.5 right-2 size-7"
          >
            <PanelRightOpen className="size-3.5" />
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
});
