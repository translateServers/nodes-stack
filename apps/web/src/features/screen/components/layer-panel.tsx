import { useCallback } from 'react';
import { Type, BarChart3, Eye, EyeOff, Lock, Unlock, Image, Frame, Table, Box } from 'lucide-react';
import { useScreenEditorStore } from '../stores/editor-store';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Type,
  BarChart3,
  Image,
  Frame,
  Table,
  Box,
};

function getIconForType(type: string): React.ComponentType<{ className?: string }> {
  const def = ICON_MAP;
  const knownTypes: Record<string, string> = { text: 'Type', 'bar-chart': 'BarChart3' };
  return def[knownTypes[type]] ?? Box;
}

export function LayerPanel() {
  const project = useScreenEditorStore((s) => s.project);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const selectComponent = useScreenEditorStore((s) => s.selectComponent);
  const setLocked = useScreenEditorStore((s) => s.setLocked);
  const setHidden = useScreenEditorStore((s) => s.setHidden);
  const reorderToTop = useScreenEditorStore((s) => s.reorderToTop);
  const reorderToBottom = useScreenEditorStore((s) => s.reorderToBottom);

  const toggleSelect = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.ctrlKey || e.metaKey) {
        const store = useScreenEditorStore.getState();
        const ids = store.selectedComponentIds;
        if (ids.includes(id)) {
          store.selectComponents(ids.filter((sid) => sid !== id));
        } else {
          store.selectComponents([...ids, id]);
        }
      } else {
        selectComponent(id);
      }
    },
    [selectComponent],
  );

  if (!project) return null;

  const sorted = [...project.components].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
        图层 ({sorted.length})
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((comp) => {
          const Icon = getIconForType(comp.type);
          const isSelected = selectedComponentIds.includes(comp.id);
          return (
            <div
              key={comp.id}
              className={`flex cursor-pointer items-center gap-2 border-b border-border/60 px-3 py-2 text-sm transition-colors ${
                isSelected ? 'bg-primary/10' : 'hover:bg-accent'
              }`}
              onClick={(e) => toggleSelect(e, comp.id)}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
              <span
                className={`flex-1 truncate ${
                  comp.status.hidden ? 'text-muted-foreground/40' : 'text-foreground'
                }`}
              >
                {comp.name}
              </span>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                title={comp.status.hidden ? '显示' : '隐藏'}
                onClick={(e) => {
                  e.stopPropagation();
                  setHidden([comp.id], !comp.status.hidden);
                }}
              >
                {comp.status.hidden ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                title={comp.status.locked ? '解锁' : '锁定'}
                onClick={(e) => {
                  e.stopPropagation();
                  setLocked([comp.id], !comp.status.locked);
                }}
              >
                {comp.status.locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  className="rounded px-1 text-[10px] text-muted-foreground/70 hover:text-foreground"
                  title="置顶"
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderToTop(comp.id);
                  }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-[10px] text-muted-foreground/70 hover:text-foreground"
                  title="置底"
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderToBottom(comp.id);
                  }}
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
