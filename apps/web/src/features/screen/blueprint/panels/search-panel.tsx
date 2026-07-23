/**
 * 搜索节点面板（任务 4.4）
 *
 * 在两种场景下呼出：
 * 1. 双击空白处：插入独立节点（onInsert 只传节点类型）
 * 2. 连线松手落空白：插入节点 + 自动完成连线（onInsert 传节点类型 + pendingConnection）
 *
 * 交互：
 * - 模糊搜索：按节点类型名/描述过滤
 * - 键盘：ArrowDown/ArrowUp 选择、Enter 插入、Esc 关闭
 * - 鼠标：点击列表项插入
 *
 * 列表项不区分场景，由调用方根据 pendingConnection 是否存在决定后续动作。
 */

import type {
  KeyboardEvent as ReactKeyboardEvent,
  JSX,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Eye,
  FileText,
  GitBranch,
  MessageSquare,
  MousePointerClick,
  Navigation,
  RefreshCw,
} from 'lucide-react';

/** 可插入的节点类型选项 */
export interface NodeOption {
  /** 唯一标识（用于去重与键控） */
  id: string;
  /** 节点 kind（与 schema 对齐） */
  kind: 'trigger' | 'action' | 'comment' | 'condition';
  /** 节点类型子标识（trigger.type / action.type） */
  subtype: string;
  /** 显示名称 */
  label: string;
  /** 描述（用于模糊匹配与提示） */
  description: string;
  /** 图标 */
  icon: JSX.Element;
}

/** 全部可插入节点选项（M1 + 10.2） */
export const NODE_OPTIONS: readonly NodeOption[] = [
  {
    id: 'trigger.componentClick',
    kind: 'trigger',
    subtype: 'componentClick',
    label: '组件点击触发',
    description: '当用户点击指定组件时触发执行',
    icon: <MousePointerClick className="size-4" />,
  },
  {
    id: 'trigger.pageLoad',
    kind: 'trigger',
    subtype: 'pageLoad',
    label: '页面加载触发',
    description: '当页面加载完成时触发执行',
    icon: <FileText className="size-4" />,
  },
  {
    id: 'action.setVisibility',
    kind: 'action',
    subtype: 'setVisibility',
    label: '设置可见性',
    description: '显示/隐藏/切换目标组件的可见状态',
    icon: <Eye className="size-4" />,
  },
  {
    id: 'action.navigate',
    kind: 'action',
    subtype: 'navigate',
    label: '导航跳转',
    description: '跳转到指定 URL（仅 http/https）',
    icon: <Navigation className="size-4" />,
  },
  {
    id: 'action.scrollToComponent',
    kind: 'action',
    subtype: 'scrollToComponent',
    label: '滚动定位',
    description: '滚动到指定组件位置',
    icon: <Crosshair className="size-4" />,
  },
  {
    id: 'action.refreshDataSource',
    kind: 'action',
    subtype: 'refreshDataSource',
    label: '刷新数据源',
    description: '重新拉取并更新目标组件的数据',
    icon: <RefreshCw className="size-4" />,
  },
  {
    id: 'condition',
    kind: 'condition',
    subtype: 'condition',
    label: '条件分支',
    description: '根据条件表达式选择 then / else 分支执行',
    icon: <GitBranch className="size-4" />,
  },
  {
    id: 'comment',
    kind: 'comment',
    subtype: 'comment',
    label: '注释',
    description: '注释节点，不参与执行流',
    icon: <MessageSquare className="size-4" />,
  },
];

/** 待完成连线的源信息（连线松手场景） */
export interface PendingConnection {
  sourceNodeId: string;
  sourceHandle: 'out' | 'then' | 'else';
}

/** 面板呼出场景 */
export type SearchPanelMode = 'create' | 'connect';

interface SearchPanelProps {
  /** 面板位置（屏幕坐标） */
  position: { x: number; y: number };
  /** 呼出场景：create=双击空白创建独立节点；connect=连线松手后自动完成连线 */
  mode: SearchPanelMode;
  /** 连线松手场景下的待完成连线（mode=connect 时有值） */
  pendingConnection?: PendingConnection;
  /** 选择节点回调 */
  onInsert: (option: NodeOption) => void;
  /** 关闭回调（Esc 或点击外部） */
  onClose: () => void;
}

/**
 * 模糊搜索过滤函数。
 *
 * 匹配规则：query 拆分为多个 token，每个 token 必须在 label 或 description 中命中（忽略大小写）。
 */
export function filterOptions(options: readonly NodeOption[], query: string): NodeOption[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [...options];
  }
  return options.filter((option) => {
    const haystack = `${option.label} ${option.description}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

/** 搜索节点面板组件 */
export function SearchPanel({
  position,
  mode,
  pendingConnection,
  onInsert,
  onClose,
}: SearchPanelProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // mount 时自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // query 变化时重置 activeIndex
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const filtered = useMemo(() => filterOptions(NODE_OPTIONS, query), [query]);

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
        if (option) {
          onInsert(option);
        }
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

  function handleOptionClick(option: NodeOption): void {
    onInsert(option);
  }

  // 阻止面板内的指针事件冒泡（避免触发画布的空白点击关闭）
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    event.stopPropagation();
  }

  const scenarioLabel =
    mode === 'connect' ? (pendingConnection ? `从源节点连接到新节点` : '创建新节点') : '创建新节点';

  return (
    <div
      className="fixed z-50 w-72 rounded-md border border-border bg-popover p-2 shadow-lg"
      style={{ left: position.x, top: position.y }}
      data-testid="search-panel"
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
          data-testid="search-panel-close"
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
        data-testid="search-panel-input"
      />
      <ul ref={listRef} className="max-h-60 overflow-y-auto" data-testid="search-panel-list">
        {filtered.length === 0 ? (
          <li className="px-2 py-3 text-center text-xs text-muted-foreground">无匹配项</li>
        ) : (
          filtered.map((option, index) => (
            <li
              key={option.id}
              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${
                index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              }`}
              onClick={() => handleOptionClick(option)}
              data-testid="search-panel-item"
              data-option-id={option.id}
              data-active={index === activeIndex}
            >
              <span className="text-muted-foreground">{option.icon}</span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{option.label}</span>
                <span className="truncate text-xs text-muted-foreground">{option.description}</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
