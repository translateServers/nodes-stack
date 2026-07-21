import { useCallback, useMemo, useState } from 'react';
import { Type, BarChart3, Image, Frame, Table, Box, Search, SearchX } from 'lucide-react';
import { useScreenEditorStore } from '../stores/editor-store';
import type { ScreenComponent } from '@nebula/shared';
import { COMPONENT_DEFINITIONS, CATEGORY_LABELS, createComponentInstance } from '../registry';
import { PanelSection } from './ui-primitives';
import { Input } from '@/components/ui/input';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Type,
  BarChart3,
  Image,
  Frame,
  Table,
  Box,
};

// 静态常量，避免每次 render 重新计算
const CATEGORIES = [...new Set(COMPONENT_DEFINITIONS.map((d) => d.category))];

export function ComponentLibrary() {
  const [keyword, setKeyword] = useState('');

  const handleDragStart = useCallback((e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('component-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // 按名称/类型过滤（大小写不敏感）
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return COMPONENT_DEFINITIONS;
    return COMPONENT_DEFINITIONS.filter(
      (d) => d.name.toLowerCase().includes(kw) || d.type.toLowerCase().includes(kw),
    );
  }, [keyword]);

  const visibleCategories = CATEGORIES.filter((category) =>
    filtered.some((d) => d.category === category),
  );

  return (
    <div className="flex flex-col">
      {/* 搜索框 */}
      <div className="relative p-2">
        <Search className="pointer-events-none absolute top-1/2 left-4.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="搜索组件..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="h-7 pl-7 text-xs"
          aria-label="搜索组件"
        />
      </div>

      {visibleCategories.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
          <SearchX className="size-6 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">未找到匹配「{keyword.trim()}」的组件</p>
        </div>
      ) : (
        visibleCategories.map((category) => (
          <PanelSection key={category} title={CATEGORY_LABELS[category] ?? category}>
            <div className="flex flex-col gap-1">
              {filtered
                .filter((d) => d.category === category)
                .map((def) => {
                  const Icon = ICON_MAP[def.icon ?? 'Box'] ?? Box;
                  return (
                    <div
                      key={def.type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, def.type)}
                      title={`拖拽「${def.name}」到画布`}
                      className="group flex cursor-grab items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-primary/30 hover:bg-accent active:cursor-grabbing"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted transition-colors group-hover:bg-primary/10">
                        <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                      </span>
                      <span className="truncate text-xs text-foreground">{def.name}</span>
                    </div>
                  );
                })}
            </div>
          </PanelSection>
        ))
      )}
    </div>
  );
}

export function useCanvasDrop() {
  const project = useScreenEditorStore((s) => s.project);
  const addComponent = useScreenEditorStore((s) => s.addComponent);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('component-type');
      if (!type || !project) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / canvasScale);
      const y = Math.round((e.clientY - rect.top) / canvasScale);
      const maxZ = project.components.reduce(
        (max: number, c: ScreenComponent) => Math.max(max, c.zIndex),
        0,
      );

      const instance = createComponentInstance(type, x, y, maxZ + 1, project.components);
      if (instance) {
        addComponent(instance);
      }
    },
    [project, addComponent, canvasScale],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return { handleDrop, handleDragOver };
}
