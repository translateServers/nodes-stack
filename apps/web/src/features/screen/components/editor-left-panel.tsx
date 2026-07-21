/**
 * 编辑器左侧面板（组件库 / 图层）
 *
 * - 顶部 shadcn Tabs 切换两个面板
 * - 宽度可拖拽调整（200~400px，默认 240px，localStorage 持久化，双击手柄复位）
 * - 可折叠为 48px 图标轨：点击图标展开并定位到对应 Tab
 */

import { useState } from 'react';
import { Layers, Package, PanelLeftClose } from 'lucide-react';
import { ComponentLibrary } from './component-library';
import { LayerPanel } from './layer-panel';
import { PanelResizeHandle, ToolbarButton, useResizablePanel } from './ui-primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type LeftPanelTab = 'library' | 'layers';

export function EditorLeftPanel() {
  const [tab, setTab] = useState<LeftPanelTab>('library');
  const [collapsed, setCollapsed] = useState(false);
  const { width, isDragging, handlePointerDown, handleDoubleClick } = useResizablePanel({
    defaultWidth: 240,
    minWidth: 200,
    maxWidth: 400,
    storageKey: 'screen-editor:left-panel-width',
    direction: 'right',
  });

  const expandTo = (target: LeftPanelTab) => {
    setTab(target);
    setCollapsed(false);
  };

  // 折叠态：48px 图标轨
  if (collapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center gap-1 border-r border-border bg-card py-2">
        <ToolbarButton
          tooltip="组件库"
          tooltipSide="right"
          onClick={() => expandTo('library')}
          aria-label="展开组件库面板"
        >
          <Package className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="图层"
          tooltipSide="right"
          onClick={() => expandTo('layers')}
          aria-label="展开图层面板"
        >
          <Layers className="size-4" />
        </ToolbarButton>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ width }}>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as LeftPanelTab)}
        className="flex h-full min-w-0 flex-1 flex-col border-r border-border bg-card"
      >
        <div className="flex items-center gap-1 border-b border-border p-1.5">
          <TabsList className="h-8 flex-1">
            <TabsTrigger value="library" className="text-xs">
              <Package className="size-3.5" />
              组件库
            </TabsTrigger>
            <TabsTrigger value="layers" className="text-xs">
              <Layers className="size-3.5" />
              图层
            </TabsTrigger>
          </TabsList>
          <ToolbarButton
            tooltip="收起面板"
            tooltipSide="right"
            onClick={() => setCollapsed(true)}
            aria-label="收起左侧面板"
            className="size-7"
          >
            <PanelLeftClose className="size-3.5" />
          </ToolbarButton>
        </div>
        <TabsContent value="library" className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'library' && <ComponentLibrary />}
        </TabsContent>
        <TabsContent value="layers" className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'layers' && <LayerPanel />}
        </TabsContent>
      </Tabs>
      <PanelResizeHandle
        isDragging={isDragging}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}
