/**
 * 快捷键徽章组件
 *
 * 用于在菜单项右侧展示快捷键提示，与 shortcuts-help-dialog 共享 formatKeys 实现。
 *
 * 例：<ShortcutBadge keys="mod+s" /> → [Ctrl][S]
 */

import { formatKeys } from '../hooks/shortcuts-registry';

interface ShortcutBadgeProps {
  /** 快捷键表达式（来自 shortcuts-registry 的 keys 字段），如 'mod+shift+z' */
  keys: string;
}

export function ShortcutBadge({ keys }: ShortcutBadgeProps) {
  const parts = formatKeys(keys);
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
      {parts.map((p, i) => (
        <kbd
          key={`${p}-${i}`}
          className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] font-medium text-foreground"
        >
          {p}
        </kbd>
      ))}
    </span>
  );
}
