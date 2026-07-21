/**
 * 编辑器右侧面板包装器（属性面板）
 *
 * - 宽度可拖拽调整（240~480px，默认 288px，localStorage 持久化，双击手柄复位）
 * - 可折叠为 48px 图标轨：点击图标展开
 */

import { useState } from 'react';
import { PanelRightOpen, SlidersHorizontal } from 'lucide-react';
import { PropertyPanel } from './property-panel';
import { PanelResizeHandle, ToolbarButton, useResizablePanel } from './ui-primitives';

export function EditorRightPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const { width, isDragging, handlePointerDown, handleDoubleClick } = useResizablePanel({
    defaultWidth: 288,
    minWidth: 240,
    maxWidth: 480,
    storageKey: 'screen-editor:right-panel-width',
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
    <div className="flex h-full" style={{ width }}>
      <PanelResizeHandle
        isDragging={isDragging}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      />
      <div className="flex h-full min-w-0 flex-1 flex-col border-l border-border bg-card">
        {/* 折叠按钮放在属性面板头部的右侧操作位 */}
        <div className="relative flex h-full min-h-0 flex-1 flex-col">
          <PropertyPanel />
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
}
