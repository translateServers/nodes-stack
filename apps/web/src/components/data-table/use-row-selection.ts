import { type RowSelectionState, type OnChangeFn } from '@tanstack/react-table';
import { useState, useCallback } from 'react';

interface UseRowSelectionOptions {
  initialRowSelection?: RowSelectionState;
}

interface UseRowSelectionReturn {
  rowSelection: RowSelectionState;
  setRowSelection: OnChangeFn<RowSelectionState>;
  resetRowSelection: () => void;
}

/**
 * 行选择 hook
 * 封装 @tanstack/react-table 的行选择状态管理
 */
export function useRowSelection(options: UseRowSelectionOptions = {}): UseRowSelectionReturn {
  const { initialRowSelection = {} } = options;
  const [rowSelection, setRowSelectionState] = useState<RowSelectionState>(initialRowSelection);

  const setRowSelection: OnChangeFn<RowSelectionState> = useCallback((updater) => {
    setRowSelectionState((prev) => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return updater;
    });
  }, []);

  const resetRowSelection = useCallback(() => {
    setRowSelectionState(initialRowSelection);
  }, [initialRowSelection]);

  return {
    rowSelection,
    setRowSelection,
    resetRowSelection,
  };
}
