/**
 * V2 蓝图搜索节点面板
 *
 * 与 V1 SearchPanel 平行存在，使用 V2NodeOption 类型。
 *
 * 在两种场景下呼出：
 * 1. 双击空白处：插入独立节点（onInsert 只传节点类型）
 * 2. 连线松手落空白：插入节点 + 自动完成连线（onInsert 传节点类型 + pendingConnection）
 *
 * 交互与 V1 一致：模糊搜索、键盘导航、点击插入。
 *
 * UX 设计参考（ui-ux-pro-max）：
 * - Data-Dense Dashboard 风格：分组分区、最大数据可见性
 * - Keyboard Navigation：Tab 顺序合理、focus ring 可见、active item 自动滚动
 * - Focus States：用主题变量 ring-primary 替代硬编码 blue-500
 * - No Results：空状态给出建议而非纯文字
 * - Hover States：颜色 / 透明度过渡（无 layout shift）
 * - Accessibility：role=listbox/option、aria-selected、aria-label
 */

import type {
  KeyboardEvent as ReactKeyboardEvent,
  JSX,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, FileQuestion, Search, X } from 'lucide-react';
import {
  V2_NODE_OPTIONS,
  type V2NodeOption,
  type V2NodeOptionGroup,
  type V2PendingConnection,
  type V2SearchPanelMode,
  isV2ConnectableTarget,
} from './v2-node-options';

interface V2SearchPanelProps {
  /** 面板位置（屏幕坐标） */
  position: { x: number; y: number };
  /** 呼出场景 */
  mode: V2SearchPanelMode;
  /** 连线松手场景下的待完成连线 */
  pendingConnection?: V2PendingConnection;
  /** 可选的节点选项列表（默认 V2_NODE_OPTIONS；connect 模式下调用方过滤） */
  options?: readonly V2NodeOption[];
  /** 选择节点回调 */
  onInsert: (option: V2NodeOption) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/** 模糊搜索过滤（与 V1 filterOptions 同语义） */
function filterV2Options(options: readonly V2NodeOption[], query: string): V2NodeOption[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...options];
  return options.filter((option) => {
    const haystack = `${option.label} ${option.description}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

/** 分组显示元信息（顺序、标题、徽章颜色） */
const GROUP_META: {
  group: V2NodeOptionGroup;
  label: string;
  /** 分组标题前的徽章颜色（Tailwind text-* 类） */
  accentClass: string;
  /** 分组标题左侧的小圆点背景色（Tailwind bg-* 类） */
  dotClass: string;
}[] = [
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

/** 模式徽章元信息（区分 create / connect 场景） */
const MODE_BADGE: Record<V2SearchPanelMode, { label: string; className: string }> = {
  create: {
    label: '创建节点',
    className: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
  },
  connect: {
    label: '连接到新节点',
    className:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20',
  },
};

export function V2SearchPanel({
  position,
  mode,
  pendingConnection,
  options,
  onInsert,
  onClose,
}: V2SearchPanelProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);

  // connect 模式下自动过滤为可连线目标
  const effectiveOptions = useMemo(() => {
    const base = options ?? V2_NODE_OPTIONS;
    if (mode === 'connect') {
      return base.filter(isV2ConnectableTarget);
    }
    return base;
  }, [options, mode]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const filtered = useMemo(
    () => filterV2Options(effectiveOptions, query),
    [effectiveOptions, query],
  );

  /**
   * 按分组渲染 filtered 选项。
   *
   * - 仅渲染非空分组（无内容的分组不显示标题）
   * - 每个选项仍使用 filtered 中的全局 index 作为 activeIndex，
   *   保证键盘 ArrowUp/ArrowDown + Enter 的导航行为与平铺时一致
   * - 分组标题不可点击、不可聚焦，仅作视觉分区
   */
  const groupedItems = useMemo(() => {
    const groups: {
      group: V2NodeOptionGroup;
      label: string;
      accentClass: string;
      dotClass: string;
      items: { option: V2NodeOption; index: number }[];
    }[] = [];
    for (const meta of GROUP_META) {
      const items: { option: V2NodeOption; index: number }[] = [];
      filtered.forEach((option, index) => {
        if (option.group === meta.group) {
          items.push({ option, index });
        }
      });
      if (items.length > 0) {
        groups.push({ ...meta, items });
      }
    }
    return groups;
  }, [filtered]);

  // 键盘导航时自动将 active item 滚动到视口内
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 < 0 ? Math.max(filtered.length - 1, 0) : prev - 1));
        break;
      }
      case 'Enter': {
        event.preventDefault();
        const option = filtered[activeIndex];
        if (option) onInsert(option);
        break;
      }
      case 'Escape': {
        event.preventDefault();
        onClose();
        break;
      }
      default:
        break;
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    event.stopPropagation();
  }

  const modeBadge = MODE_BADGE[mode];
  const showConnectHint =
    mode === 'connect' && pendingConnection !== undefined && query.length === 0;

  return (
    <div
      className="fixed z-50 flex w-80 flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-md"
      style={{ left: position.x, top: position.y }}
      data-testid="v2-search-panel"
      data-mode={mode}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      {/* Header：模式徽章 + 关闭按钮 */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${modeBadge.className}`}
          data-testid="v2-search-panel-mode-badge"
        >
          {modeBadge.label}
        </span>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
          aria-label="关闭面板"
          data-testid="v2-search-panel-close"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* 搜索输入框 */}
      <div className="relative px-3 py-2">
        <Search
          className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索节点（名称或描述）..."
          aria-label="搜索节点"
          aria-controls="v2-search-panel-list"
          aria-expanded="true"
          aria-activedescendant={
            filtered[activeIndex] ? `v2-option-${filtered[activeIndex].id}` : undefined
          }
          className="w-full rounded-md border border-input bg-background py-1.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          data-testid="v2-search-panel-input"
        />
      </div>

      {/* 连线场景提示（connect 模式 + 无 query 时显示） */}
      {showConnectHint ? (
        <div className="mx-3 mb-2 rounded-md bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          选择目标节点后将自动完成连线
        </div>
      ) : null}

      {/* 选项列表 */}
      <ul
        ref={listRef}
        id="v2-search-panel-list"
        role="listbox"
        aria-label="可选节点"
        className="max-h-80 overflow-y-auto px-1.5 pb-1.5"
        data-testid="v2-search-panel-list"
      >
        {filtered.length === 0 ? (
          <li className="flex flex-col items-center gap-2 px-2 py-6 text-center">
            <FileQuestion className="size-6 text-muted-foreground/60" aria-hidden="true" />
            <div className="text-sm text-muted-foreground">无匹配节点</div>
            <button
              type="button"
              className="text-[11px] text-primary underline-offset-2 hover:underline"
              onClick={() => setQuery('')}
            >
              清空搜索词
            </button>
          </li>
        ) : (
          groupedItems.map((group) => (
            <li key={group.group} className="mb-1.5 last:mb-0">
              {/* 分组标题 */}
              <div
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80"
                data-testid="v2-search-panel-group-label"
                data-group={group.group}
              >
                <span className={`size-1.5 rounded-full ${group.dotClass}`} aria-hidden="true" />
                <span className={group.accentClass}>{group.label}</span>
                <span className="text-muted-foreground/60">({group.items.length})</span>
              </div>
              {/* 分组下的选项 */}
              <ul>
                {group.items.map(({ option, index }) => {
                  const isActive = index === activeIndex;
                  return (
                    <li
                      key={option.id}
                      id={`v2-option-${option.id}`}
                      ref={isActive ? activeItemRef : undefined}
                      role="option"
                      aria-selected={isActive}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-md border-l-2 px-2 py-1.5 text-sm transition-colors ${
                        isActive
                          ? 'border-l-primary bg-accent text-accent-foreground'
                          : 'border-l-transparent hover:bg-accent/50'
                      }`}
                      onClick={() => onInsert(option)}
                      data-testid="v2-search-panel-item"
                      data-option-id={option.id}
                      data-group={option.group}
                      data-active={isActive}
                    >
                      <span className={`shrink-0 ${group.accentClass}`} aria-hidden="true">
                        {option.icon}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{option.label}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))
        )}
      </ul>

      {/* Footer：键盘快捷键提示 */}
      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans">↑↓</kbd>
          <span>选择</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CornerDownLeft className="size-3" aria-hidden="true" />
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans">Enter</kbd>
          <span>插入</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans">Esc</kbd>
          <span>关闭</span>
        </div>
      </div>
    </div>
  );
}
