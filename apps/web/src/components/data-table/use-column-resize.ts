import { type ColumnSizingState, type OnChangeFn } from '@tanstack/react-table';
import { useState, useCallback } from 'react';

interface UseColumnResizeOptions {
  initialColumnSizing?: ColumnSizingState;
}

interface UseColumnResizeReturn {
  columnSizing: ColumnSizingState;
  setColumnSizing: OnChangeFn<ColumnSizingState>;
  resetColumnSizing: () => void;
}

/**
 * 列宽调整 hook
 * 封装 @tanstack/react-table 的列宽调整状态管理
 */
export function useColumnResize(options: UseColumnResizeOptions = {}): UseColumnResizeReturn {
  const { initialColumnSizing = {} } = options;
  const [columnSizing, setColumnSizingState] = useState<ColumnSizingState>(initialColumnSizing);

  const setColumnSizing: OnChangeFn<ColumnSizingState> = useCallback((updater) => {
    setColumnSizingState((prev) => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return updater;
    });
  }, []);

  const resetColumnSizing = useCallback(() => {
    setColumnSizingState(initialColumnSizing);
  }, [initialColumnSizing]);

  return {
    columnSizing,
    setColumnSizing,
    resetColumnSizing,
  };
}
