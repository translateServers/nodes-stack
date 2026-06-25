import { useRef } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import type { Row, Table } from '@tanstack/react-table';
import type { DataTableFeature } from '../types';

/** 默认行高（与 TableCell 的 h-9 = 36px 一致） */
const DEFAULT_ESTIMATE_SIZE = 36;

/** 默认预渲染行数 */
const DEFAULT_OVERSCAN = 10;

/** 虚拟滚动配置 */
export interface VirtualScrollOptions {
  /** 滚动容器高度（px 或 CSS 字符串），默认 400 */
  height?: number | string;
  /** 行高估算值（px），默认 36 */
  estimateSize?: number;
  /** 预渲染行数，默认 10 */
  overscan?: number;
}

/**
 * 虚拟滚动 Feature 插件工厂。
 * 插件本身不注入 tableOptions，虚拟化渲染逻辑通过 useVirtualScroll Hook + 主组件条件渲染实现。
 */
export function createVirtualScrollFeature<TData>(): DataTableFeature<TData> {
  return {
    id: 'virtual-scroll',
  };
}

/**
 * 虚拟滚动 Hook。
 * 基于 @tanstack/react-virtual 实现表格行的虚拟化渲染。
 *
 * @param table TanStack Table 实例
 * @param enabled 是否启用虚拟滚动
 * @param options 虚拟滚动配置
 * @returns parentRef（需附加到滚动容器）、virtualizer 实例、当前行数据
 */
export function useVirtualScroll<TData>(
  table: Table<TData>,
  enabled: boolean,
  options: VirtualScrollOptions = {},
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const { estimateSize = DEFAULT_ESTIMATE_SIZE, overscan = DEFAULT_OVERSCAN } = options;

  const virtualizer = useVirtualizer({
    count: enabled ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return { parentRef, virtualizer, rows };
}

/** 虚拟化实例的最小接口约束（用于辅助函数参数类型） */
interface VirtualizerLike {
  getVirtualItems(): readonly VirtualItem[];
  getTotalSize(): number;
}

/**
 * 虚拟滚动行渲染辅助函数。
 * 计算 padding-top / padding-bottom 的 spacer 高度，用于保持表格总高度。
 *
 * @param virtualizer 虚拟化实例
 * @returns paddingTop、paddingBottom、virtualItems
 */
export function getVirtualScrollMetrics(virtualizer: VirtualizerLike) {
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  return { paddingTop, paddingBottom, virtualItems };
}

/**
 * 获取虚拟滚动容器的样式。
 */
export function getVirtualScrollContainerStyle(height?: number | string): React.CSSProperties {
  return {
    maxHeight: height ?? 400,
    overflow: 'auto',
  };
}

export type { Row };
