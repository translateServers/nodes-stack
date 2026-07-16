import { useCallback, useMemo } from 'react';
import {
  Type,
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Image,
  Frame,
  Table,
  Box,
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react';
import { useScreenEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Type,
  BarChart3,
  Image,
  Frame,
  Table,
  Box,
};

const KNOWN_TYPE_TO_ICON: Record<string, string> = {
  text: 'Type',
  'bar-chart': 'BarChart3',
};

function getIconForType(type: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[KNOWN_TYPE_TO_ICON[type]] ?? Box;
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

  // Memo 化：仅在 components 引用变化时重新排序；选中状态用 Set 做 O(1) 查询
  const sorted = useMemo(
    () => (project ? [...project.components].sort((a, b) => b.zIndex - a.zIndex) : []),
    [project],
  );
  const selectedIdSet = useMemo(() => new Set(selectedComponentIds), [selectedComponentIds]);

  if (!project) return null;

  return (
    <TooltipProvider>
      <div className="flex flex-col">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
          图层 ({sorted.length})
        </div>
        <div className="flex-1 overflow-y-auto">
          {sorted.map((comp) => {
            const Icon = getIconForType(comp.type);
            const isSelected = selectedIdSet.has(comp.id);
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={comp.status.hidden ? '显示' : '隐藏'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHidden([comp.id], !comp.status.hidden);
                      }}
                    >
                      {comp.status.hidden ? <EyeOff /> : <Eye />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{comp.status.hidden ? '显示' : '隐藏'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={comp.status.locked ? '解锁' : '锁定'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocked([comp.id], !comp.status.locked);
                      }}
                    >
                      {comp.status.locked ? <Lock /> : <Unlock />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{comp.status.locked ? '解锁' : '锁定'}</TooltipContent>
                </Tooltip>
                <div className="flex gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="置顶"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderToTop(comp.id);
                        }}
                      >
                        <ChevronsUp />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>置顶</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="置底"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderToBottom(comp.id);
                        }}
                      >
                        <ChevronsDown />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>置底</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
