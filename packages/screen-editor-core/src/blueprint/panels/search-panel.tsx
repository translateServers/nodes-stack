import type {
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, FileQuestion, Search, X } from 'lucide-react';

import {
  NODE_OPTIONS,
  isConnectableTarget,
  type NodeOption,
  type NodeOptionGroup,
  type PendingConnection,
  type SearchPanelMode,
} from './node-options.js';

export interface SearchPanelProps {
  readonly position: { readonly x: number; readonly y: number };
  readonly mode: SearchPanelMode;
  readonly pendingConnection?: PendingConnection;
  readonly options?: readonly NodeOption[];
  readonly onInsert: (option: NodeOption) => void;
  readonly onClose: () => void;
}

interface GroupMeta {
  readonly group: NodeOptionGroup;
  readonly label: string;
  readonly accentClass: string;
  readonly dotClass: string;
}

const groupMeta: readonly GroupMeta[] = [
  {
    group: 'canvas-component',
    label: '画布组件',
    accentClass: 'text-primary',
    dotClass: 'bg-primary',
  },
  {
    group: 'global',
    label: '全局节点',
    accentClass: 'text-amber-600 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  {
    group: 'logic',
    label: '逻辑节点',
    accentClass: 'text-sky-600 dark:text-sky-400',
    dotClass: 'bg-sky-500',
  },
];

const modeLabels: Record<SearchPanelMode, string> = {
  create: '创建节点',
  connect: '连接到新节点',
};

export function filterOptions(options: readonly NodeOption[], query: string): NodeOption[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.length === 0
    ? [...options]
    : options.filter((option) => {
        const haystack = `${option.label} ${option.description}`.toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      });
}

export function SearchPanel({
  position,
  mode,
  pendingConnection,
  options,
  onInsert,
  onClose,
}: SearchPanelProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);
  const effectiveOptions = useMemo(() => {
    const source = options ?? NODE_OPTIONS;
    return mode === 'connect' ? source.filter(isConnectableTarget) : source;
  }, [mode, options]);
  const filtered = useMemo(() => filterOptions(effectiveOptions, query), [effectiveOptions, query]);
  const groups = useMemo(
    () =>
      groupMeta.flatMap((meta) => {
        const items = filtered.flatMap((option, index) =>
          option.group === meta.group ? [{ option, index }] : [],
        );
        return items.length === 0 ? [] : [{ ...meta, items }];
      }),
    [filtered],
  );

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActiveIndex(0), [query]);
  useEffect(() => activeItemRef.current?.scrollIntoView({ block: 'nearest' }), [activeIndex]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option !== undefined) {
        onInsert(option);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % Math.max(filtered.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? Math.max(filtered.length - 1, 0) : index - 1));
    }
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void =>
    event.stopPropagation();

  return (
    <div
      className="fixed z-50 flex w-80 flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-md"
      style={{ left: position.x, top: position.y }}
      data-testid="blueprint-search-panel"
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{modeLabels[mode]}</span>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="关闭面板"
          onClick={onClose}
          data-testid="blueprint-search-panel-close"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="relative px-3 py-2">
        <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id={fieldId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索节点"
          aria-label="搜索节点"
          data-testid="blueprint-search-panel-input"
          className="w-full rounded-md border border-input bg-background py-1.5 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {mode === 'connect' && pendingConnection !== undefined && query === '' ? (
        <p className="mx-3 mb-2 rounded-md bg-amber-500/5 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
          选择目标节点后将自动完成连线
        </p>
      ) : null}
      <ul
        className="max-h-80 overflow-y-auto px-1.5 pb-1.5"
        role="listbox"
        data-testid="blueprint-search-panel-list"
      >
        {filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 px-2 py-6 text-center text-sm text-muted-foreground">
            <FileQuestion className="size-6" />
            无匹配节点
          </li>
        ) : (
          groups.map((group) => (
            <li key={group.group} className="mb-1.5 last:mb-0">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                <span className={`size-1.5 rounded-full ${group.dotClass}`} />
                <span className={group.accentClass}>{group.label}</span>
              </div>
              <ul>
                {group.items.map(({ option, index }) => {
                  const active = index === activeIndex;
                  return (
                    <li
                      key={option.id}
                      ref={active ? activeItemRef : undefined}
                      role="option"
                      aria-selected={active}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-md border-l-2 px-2 py-1.5 text-sm ${
                        active
                          ? 'border-l-primary bg-accent'
                          : 'border-l-transparent hover:bg-accent/50'
                      }`}
                      onClick={() => onInsert(option)}
                      data-testid="blueprint-search-panel-item"
                      data-option-id={option.id}
                    >
                      <span className={group.accentClass}>{option.icon}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{option.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))
        )}
      </ul>
      <div className="flex items-center justify-end gap-1.5 border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <CornerDownLeft className="size-3" /> Enter 插入
      </div>
    </div>
  );
}
