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
 */

import type {
  KeyboardEvent as ReactKeyboardEvent,
  JSX,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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

/** 分组显示元信息（顺序与标题） */
const GROUP_META: { group: V2NodeOptionGroup; label: string }[] = [
  { group: 'canvas-component', label: '画布组件' },
  { group: 'global', label: '全局节点' },
  { group: 'logic', label: '逻辑节点' },
];

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

  const scenarioLabel =
    mode === 'connect' ? (pendingConnection ? '从源节点连接到新节点' : '创建新节点') : '创建新节点';

  return (
    <div
      className="fixed z-50 w-72 rounded-md border border-border bg-popover p-2 shadow-lg"
      style={{ left: position.x, top: position.y }}
      data-testid="v2-search-panel"
      data-mode={mode}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{scenarioLabel}</span>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="关闭"
          data-testid="v2-search-panel-close"
        >
          ×
        </button>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索节点类型..."
        className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-blue-500"
        data-testid="v2-search-panel-input"
      />
      <ul className="max-h-60 overflow-y-auto" data-testid="v2-search-panel-list">
        {filtered.length === 0 ? (
          <li className="px-2 py-3 text-center text-xs text-muted-foreground">无匹配项</li>
        ) : (
          groupedItems.map((group) => (
            <li key={group.group} className="mb-1 last:mb-0">
              <div
                className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
                data-testid="v2-search-panel-group-label"
                data-group={group.group}
              >
                {group.label}
              </div>
              <ul>
                {group.items.map(({ option, index }) => (
                  <li
                    key={option.id}
                    className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${
                      index === activeIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => onInsert(option)}
                    data-testid="v2-search-panel-item"
                    data-option-id={option.id}
                    data-group={option.group}
                    data-active={index === activeIndex}
                  >
                    <span className="text-muted-foreground">{option.icon}</span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{option.label}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
