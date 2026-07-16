import { useEffect, useState, useCallback } from 'react';
import { Copy, Trash2, Lock, Unlock, EyeOff, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import { useScreenEditorStore } from '../stores/editor-store';
import type { ScreenComponent } from '@nebula/shared';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  componentId: string | null;
}

const initialState: ContextMenuState = { visible: false, x: 0, y: 0, componentId: null };

function getComponentIdFromEvent(e: MouseEvent): string | null {
  let target = e.target as HTMLElement | null;
  while (target) {
    const id = target.getAttribute('data-component-id');
    if (id) return id;
    target = target.parentElement;
  }
  return null;
}

export function CanvasContextMenu({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [menu, setMenu] = useState<ContextMenuState>(initialState);

  const selectComponent = useScreenEditorStore((s) => s.selectComponent);
  const duplicateSelected = useScreenEditorStore((s) => s.duplicateSelected);
  const removeSelectedComponents = useScreenEditorStore((s) => s.removeSelectedComponents);
  const setLocked = useScreenEditorStore((s) => s.setLocked);
  const setHidden = useScreenEditorStore((s) => s.setHidden);
  const reorderToTop = useScreenEditorStore((s) => s.reorderToTop);
  const reorderToBottom = useScreenEditorStore((s) => s.reorderToBottom);

  const close = useCallback(() => setMenu(initialState), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleContextMenu = (e: MouseEvent) => {
      const compId = getComponentIdFromEvent(e);
      if (compId) {
        e.preventDefault();
        selectComponent(compId);
        setMenu({ visible: true, x: e.clientX, y: e.clientY, componentId: compId });
      }
    };

    el.addEventListener('contextmenu', handleContextMenu);
    return () => el.removeEventListener('contextmenu', handleContextMenu);
  }, [containerRef, selectComponent]);

  useEffect(() => {
    if (!menu.visible) return;
    const handleClick = () => close();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [menu.visible, close]);

  if (!menu.visible || !menu.componentId) return null;

  const id = menu.componentId;
  const project = useScreenEditorStore.getState().project;
  const comp = project?.components.find((c: ScreenComponent) => c.id === id);

  const items = [
    {
      label: '复制',
      icon: Copy,
      action: () => {
        selectComponent(id);
        duplicateSelected();
      },
    },
    {
      label: '删除',
      icon: Trash2,
      action: () => {
        selectComponent(id);
        removeSelectedComponents();
      },
    },
    { type: 'divider' as const },
    {
      label: comp?.status.locked ? '解锁' : '锁定',
      icon: comp?.status.locked ? Unlock : Lock,
      action: () => setLocked([id], !comp?.status.locked),
    },
    {
      label: '隐藏',
      icon: EyeOff,
      action: () => setHidden([id], true),
    },
    { type: 'divider' as const },
    {
      label: '置于顶层',
      icon: ArrowUpToLine,
      action: () => reorderToTop(id),
    },
    {
      label: '置于底层',
      icon: ArrowDownToLine,
      action: () => reorderToBottom(id),
    },
  ];

  return (
    <div
      className="fixed z-[10000] min-w-40 rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        if ('type' in item && item.type === 'divider') {
          return <div key={`div-${i}`} className="my-1 border-t border-border" />;
        }
        const menuItem = item as {
          label: string;
          icon: React.ComponentType<{ className?: string }>;
          action: () => void;
        };
        const Icon = menuItem.icon;
        return (
          <button
            key={menuItem.label}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              menuItem.action();
              close();
            }}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            {menuItem.label}
          </button>
        );
      })}
    </div>
  );
}
