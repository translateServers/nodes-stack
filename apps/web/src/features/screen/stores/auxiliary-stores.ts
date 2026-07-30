import type { StoreApi } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { AlignmentLine, AlignmentRect } from '../lib/smart-guides';

export interface DimensionInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  visible: boolean;
  mode?: string;
}

export interface DimensionState {
  dimension: DimensionInfo;
  setDimension: (updater: (dimension: DimensionInfo) => DimensionInfo) => void;
}

export type DimensionStore = StoreApi<DimensionState>;

export function createDimensionStore(): DimensionStore {
  return createStore<DimensionState>((set) => ({
    dimension: { x: 0, y: 0, w: 0, h: 0, rotate: 0, visible: false, mode: undefined },
    setDimension: (updater) => set((state) => ({ dimension: updater(state.dimension) })),
  }));
}

export interface AlignmentLinesState {
  lines: AlignmentLine[];
  movedRect: AlignmentRect | null;
  setLines: (lines: AlignmentLine[], movedRect: AlignmentRect | null) => void;
  clear: () => void;
}

export type AlignmentLinesStore = StoreApi<AlignmentLinesState>;

export function createAlignmentLinesStore(): AlignmentLinesStore {
  return createStore<AlignmentLinesState>((set) => ({
    lines: [],
    movedRect: null,
    setLines: (lines, movedRect) => set({ lines, movedRect }),
    clear: () => set({ lines: [], movedRect: null }),
  }));
}
