import { useEffect, useRef } from 'react';
import type {
  ColumnSizingState,
  ColumnOrderState,
  PaginationState,
  SortingState,
  Table,
  TableState,
  VisibilityState,
} from '@tanstack/react-table';
import type { DataTableFeature, StatePersistenceConfig } from '../types';

/** 可持久化的状态切片类型 */
export type PersistableState =
  | 'sorting'
  | 'columnVisibility'
  | 'columnSizing'
  | 'columnOrder'
  | 'pagination';

/** 默认持久化的状态切片 */
const DEFAULT_INCLUDE: PersistableState[] = [
  'sorting',
  'columnVisibility',
  'columnSizing',
  'columnOrder',
  'pagination',
];

/** localStorage 读取的序列化结构 */
interface PersistedState {
  sorting?: SortingState;
  columnVisibility?: VisibilityState;
  columnSizing?: ColumnSizingState;
  columnOrder?: ColumnOrderState;
  pagination?: PaginationState;
}

/**
 * 从存储中加载持久化状态。
 * 在 useReactTable 初始化前调用，返回值作为 initialState 合并。
 */
export function loadPersistedState(
  config: StatePersistenceConfig | undefined,
): Partial<TableState> {
  if (!config) return {};

  const include = config.include ?? DEFAULT_INCLUDE;
  const raw = readFromStorage(config);

  if (!raw) return {};

  const result: Partial<TableState> = {};

  if (include.includes('sorting') && raw.sorting) result.sorting = raw.sorting;
  if (include.includes('columnVisibility') && raw.columnVisibility) {
    result.columnVisibility = raw.columnVisibility;
  }
  if (include.includes('columnSizing') && raw.columnSizing) {
    result.columnSizing = raw.columnSizing;
  }
  if (include.includes('columnOrder') && raw.columnOrder) {
    result.columnOrder = raw.columnOrder;
  }
  if (include.includes('pagination') && raw.pagination) {
    result.pagination = raw.pagination;
  }

  return result;
}

/** 从 localStorage 或 URL 读取序列化状态 */
function readFromStorage(config: StatePersistenceConfig): PersistedState | null {
  if (config.storage === 'localStorage') {
    try {
      const raw = localStorage.getItem(config.key);
      if (!raw) return null;
      return JSON.parse(raw) as PersistedState;
    } catch {
      return null;
    }
  }

  if (config.storage === 'url') {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get(config.key);
      if (!raw) return null;
      return JSON.parse(raw) as PersistedState;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * 状态持久化 Feature 插件工厂。
 * 插件本身不注入 tableOptions，持久化逻辑通过 useTableStatePersistence Hook 实现。
 * 初始状态通过 loadPersistedState() 在组件初始化时加载。
 */
export function createStatePersistenceFeature<TData>(): DataTableFeature<TData> {
  return {
    id: 'state-persistence',
  };
}

/**
 * 表格状态持久化 Hook。
 * 监听表格状态变化，debounce（500ms）写入存储。
 */
export function useTableStatePersistence<TData>(
  table: Table<TData>,
  config: StatePersistenceConfig | undefined,
): void {
  const state = table.getState();
  const { sorting, columnVisibility, columnSizing, columnOrder, pagination } = state;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!config) return;

    const include = config.include ?? DEFAULT_INCLUDE;

    // debounce 写入，避免频繁 IO
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      const payload: PersistedState = {};

      if (include.includes('sorting')) payload.sorting = sorting;
      if (include.includes('columnVisibility')) payload.columnVisibility = columnVisibility;
      if (include.includes('columnSizing')) payload.columnSizing = columnSizing;
      if (include.includes('columnOrder')) payload.columnOrder = columnOrder;
      if (include.includes('pagination')) payload.pagination = pagination;

      writeToStorage(config, payload);
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [config, sorting, columnVisibility, columnSizing, columnOrder, pagination]);
}

/** 写入 localStorage 或 URL */
function writeToStorage(config: StatePersistenceConfig, payload: PersistedState): void {
  const serialized = JSON.stringify(payload);

  if (config.storage === 'localStorage') {
    try {
      localStorage.setItem(config.key, serialized);
    } catch {
      console.error('Failed to persist table state to localStorage');
    }
    return;
  }

  if (config.storage === 'url') {
    try {
      const params = new URLSearchParams(window.location.search);
      params.set(config.key, serialized);
      window.history.replaceState(null, '', `?${params.toString()}`);
    } catch {
      console.error('Failed to persist table state to URL');
    }
  }
}

/** 清除指定 key 的持久化状态 */
export function clearPersistedState(config: StatePersistenceConfig): void {
  if (config.storage === 'localStorage') {
    localStorage.removeItem(config.key);
    return;
  }

  if (config.storage === 'url') {
    const params = new URLSearchParams(window.location.search);
    params.delete(config.key);
    const search = params.toString();
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
  }
}
