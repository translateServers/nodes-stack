/**
 * 快捷键帮助面板
 *
 * 渲染 SHORTCUTS_REGISTRY 内容，按 category 分组展示。
 * 画布快捷键（scope: global/canvas）与蓝图快捷键（scope: blueprint）分区展示。
 * 受控组件：open + onOpenChange，由 screen-editor.tsx 控制。
 * 触发键：Ctrl/Cmd + /（在 use-keyboard-shortcuts.ts 和 use-blueprint-shortcuts.ts 中注册）
 */

import { memo, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SHORTCUTS_REGISTRY,
  SHORTCUT_CATEGORY_LABELS,
  formatKeys,
  type ShortcutCategory,
  type ShortcutDefinition,
  type ShortcutScope,
} from '../hooks/shortcuts-registry';

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KeyBadge({ keyName }: { keyName: string }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
      {keyName}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: ShortcutDefinition }) {
  const keys = formatKeys(shortcut.keys);
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <KeyBadge key={`${shortcut.id}-${k}-${i}`} keyName={k} />
        ))}
      </div>
    </div>
  );
}

/** 按作用域分组，再按 category 分组，保持注册表顺序；过滤 hidden 条目 */
function groupByScope(scope: ShortcutScope): Array<[ShortcutCategory, ShortcutDefinition[]]> {
  const map = new Map<ShortcutCategory, ShortcutDefinition[]>();
  for (const s of SHORTCUTS_REGISTRY) {
    if (s.hidden) continue;
    if (s.scope !== scope) continue;
    const list = map.get(s.category) ?? [];
    list.push(s);
    map.set(s.category, list);
  }
  return Array.from(map.entries());
}

export const ShortcutsHelpDialog = memo(function ShortcutsHelpDialog({
  open,
  onOpenChange,
}: ShortcutsHelpDialogProps) {
  // 画布快捷键（global + canvas 合并展示）
  const canvasGrouped = useMemo(() => {
    const map = new Map<ShortcutCategory, ShortcutDefinition[]>();
    for (const s of SHORTCUTS_REGISTRY) {
      if (s.hidden) continue;
      if (s.scope !== 'global' && s.scope !== 'canvas') continue;
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries());
  }, []);

  // 蓝图快捷键
  const blueprintGrouped = useMemo(() => groupByScope('blueprint'), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
          <DialogDescription>大屏编辑器支持的键盘快捷键</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">画布编辑器</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {canvasGrouped.map(([category, shortcuts]) => (
                <div key={category} className="space-y-1">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {SHORTCUT_CATEGORY_LABELS[category]}
                  </h3>
                  {shortcuts.map((s) => (
                    <ShortcutRow key={s.id} shortcut={s} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          {blueprintGrouped.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">事件蓝图</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {blueprintGrouped.map(([category, shortcuts]) => (
                  <div key={category} className="space-y-1">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {SHORTCUT_CATEGORY_LABELS[category]}
                    </h3>
                    {shortcuts.map((s) => (
                      <ShortcutRow key={s.id} shortcut={s} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
