/**
 * 蓝图视口控制 Hook（任务 4.6）
 *
 * 封装 React Flow 视口控制：
 * - 缩放范围：0.25x – 2x
 * - 滚轮以光标为中心缩放：React Flow 默认支持，通过 panOnScroll=false + zoomOnScroll=true + zoomOnPinch=true 启用
 * - Space+拖拽平移：通过 useKeyPress 监听 Space，动态切换 panOnDrag
 * - Fit View：调用 reactFlowInstance.fitView
 * - 缩放到选区：调用 reactFlowInstance.fitView({ nodes: selectedIds })
 * - 缩放按钮：zoomIn / zoomOut / zoomTo
 *
 * 全局快捷键挂起由 Task 5.4 在 Sheet 快捷键分层处理。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useKeyPress,
  useReactFlow,
  useViewport,
  type OnMoveEnd,
  type Viewport,
} from '@xyflow/react';

/** 缩放下限（M1 规格：0.25x） */
export const MIN_ZOOM = 0.25;
/** 缩放上限（M1 规格：2x） */
export const MAX_ZOOM = 2;
/** 单次缩放步长（zoomIn / zoomOut 按钮） */
export const ZOOM_STEP = 0.2;

/**
 * 模块级 viewport 缓存：跨 BlueprintSheet 挂载/卸载周期保留视口位置。
 *
 * BlueprintSheet 在 open=false 时直接 return null 卸载整棵树，
 * ReactFlow 实例随之销毁，viewport 状态丢失。
 * 用模块级变量在卸载前快照、挂载后恢复，避免每次打开都回到 {0,0,1}。
 */
let cachedViewport: Viewport | null = null;

export interface UseBlueprintViewportOptions {
  /** 初始是否启用 Space 平移（默认 true） */
  enableSpacePan?: boolean;
  /** 缩放步长（默认 0.2） */
  zoomStep?: number;
  /** 缩放下限（默认 0.25） */
  minZoom?: number;
  /** 缩放上限（默认 2） */
  maxZoom?: number;
}

export interface UseBlueprintViewportResult {
  /** 传给 <ReactFlow /> 的 props */
  config: {
    minZoom: number;
    maxZoom: number;
    defaultZoom: number;
    panOnScroll: false;
    zoomOnScroll: true;
    zoomOnPinch: true;
    panOnDrag: boolean | number[];
    zoomOnDoubleClick: boolean;
    preventScrolling: boolean;
    /** 裸拖框选（Space 未按下时启用，与平移互斥） */
    selectionOnDrag: boolean;
  };
  /** 当前缩放级别（响应式） */
  zoom: number;
  /** Space 是否按下 */
  spacePressed: boolean;
  /** Fit View：将所有节点适配到视口 */
  fitView: () => Promise<boolean>;
  /** 缩放到选区：将指定节点适配到视口 */
  fitViewToNodes: (nodeIds: string[]) => Promise<boolean>;
  /** 放大一级 */
  zoomIn: () => Promise<boolean>;
  /** 缩小一级 */
  zoomOut: () => Promise<boolean>;
  /** 缩放到指定级别（限制在 min/max 范围内） */
  zoomTo: (zoomLevel: number) => Promise<boolean>;
  /** 重置视口到 1x 并居中 */
  resetViewport: () => Promise<boolean>;
  /** ReactFlow onMoveEnd 回调：视口变化结束后缓存快照 */
  onMoveEnd: OnMoveEnd;
  /** 恢复上次缓存的视口（组件挂载后调用） */
  restoreViewport: () => void;
}

/**
 * 蓝图视口控制 Hook。
 *
 * 用法：
 * ```tsx
 * const { config, zoom, fitView, zoomIn, zoomOut } = useBlueprintViewport();
 * return <ReactFlow {...config} />
 * ```
 */
export function useBlueprintViewport(
  options: UseBlueprintViewportOptions = {},
): UseBlueprintViewportResult {
  const {
    enableSpacePan = true,
    zoomStep = ZOOM_STEP,
    minZoom = MIN_ZOOM,
    maxZoom = MAX_ZOOM,
  } = options;

  const reactFlow = useReactFlow();
  const viewport = useViewport();

  // 标记是否已恢复过缓存的视口（仅恢复一次，避免覆盖用户操作）
  const restoredRef = useRef(false);

  // Space 平移：监听 Space 按键，按下时切换 panOnDrag
  const spacePressed = useKeyPress('Space', { actInsideInputWithModifier: false });
  const [isSpacePanning, setIsSpacePanning] = useState(false);

  useEffect(() => {
    if (!enableSpacePan) {
      setIsSpacePanning(false);
      return;
    }
    setIsSpacePanning(spacePressed);
  }, [spacePressed, enableSpacePan]);

  // panOnDrag：
  // - Space 按下时启用拖拽平移（true）
  // - 默认（左键拖拽）：false（避免与框选冲突，框选由 selectionKeyCode=Meta 触发）
  // - 也可设为 [1]（中键拖拽），但 M1 简化为 Space 模式
  const panOnDrag = isSpacePanning ? true : false;

  const config: UseBlueprintViewportResult['config'] = {
    minZoom,
    maxZoom,
    defaultZoom: 1,
    panOnScroll: false,
    zoomOnScroll: true,
    zoomOnPinch: true,
    panOnDrag,
    zoomOnDoubleClick: true,
    preventScrolling: true,
    // 缺口 3：Space 未按下时裸拖框选（与画布 Selecto 行为对齐）；
    // Space 按下时禁用框选、启用平移（panOnDrag=true）
    selectionOnDrag: !isSpacePanning,
  };

  // 当前缩放级别（来自 viewport，响应式）
  const zoom = viewport.zoom;

  // Fit View：适配所有节点
  const fitView = useCallback(async () => {
    return reactFlow.fitView({
      // 留出 padding 避免节点贴边
      padding: 0.2,
      // 启用动画过渡
      duration: 200,
      // 限制缩放范围
      minZoom,
      maxZoom,
    });
  }, [reactFlow, minZoom, maxZoom]);

  // 缩放到选区：仅适配指定节点
  const fitViewToNodes = useCallback(
    async (nodeIds: string[]) => {
      if (nodeIds.length === 0) {
        // 无选中节点时退化为 fitView
        return reactFlow.fitView({
          padding: 0.2,
          duration: 200,
          minZoom,
          maxZoom,
        });
      }
      // ReactFlow 的 nodes 字段要求 { id: string }[]，这里将 string[] 映射为对象数组
      const fitViewNodes = nodeIds.map((id) => ({ id }));
      return reactFlow.fitView({
        nodes: fitViewNodes,
        padding: 0.3,
        duration: 200,
        minZoom,
        maxZoom,
      });
    },
    [reactFlow, minZoom, maxZoom],
  );

  // 放大一级
  const zoomIn = useCallback(async () => {
    const nextZoom = Math.min(zoom + zoomStep, maxZoom);
    return reactFlow.zoomTo(nextZoom, { duration: 200 });
  }, [reactFlow, zoom, zoomStep, maxZoom]);

  // 缩小一级
  const zoomOut = useCallback(async () => {
    const nextZoom = Math.max(zoom - zoomStep, minZoom);
    return reactFlow.zoomTo(nextZoom, { duration: 200 });
  }, [reactFlow, zoom, zoomStep, minZoom]);

  // 缩放到指定级别（限制在 min/max 范围内）
  const zoomTo = useCallback(
    async (zoomLevel: number) => {
      const clamped = Math.max(minZoom, Math.min(maxZoom, zoomLevel));
      return reactFlow.zoomTo(clamped, { duration: 200 });
    },
    [reactFlow, minZoom, maxZoom],
  );

  // 重置视口到 1x 并居中
  const resetViewport = useCallback(async () => {
    await reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
    return reactFlow.fitView({
      padding: 0.2,
      duration: 200,
      minZoom,
      maxZoom,
    });
  }, [reactFlow, minZoom, maxZoom]);

  // 视口变化结束时缓存快照（pan/zoom 后）
  const onMoveEnd: OnMoveEnd = useCallback((_, vp) => {
    cachedViewport = vp;
  }, []);

  // 恢复上次缓存的视口（组件挂载后调用一次）
  const restoreViewport = useCallback(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (cachedViewport) {
      void reactFlow.setViewport(cachedViewport, { duration: 0 });
    }
  }, [reactFlow]);

  // 卸载时缓存当前视口，供下次打开恢复
  useEffect(() => {
    return () => {
      cachedViewport = viewport;
    };
  }, [viewport]);

  return {
    config,
    zoom,
    spacePressed: isSpacePanning,
    fitView,
    fitViewToNodes,
    zoomIn,
    zoomOut,
    zoomTo,
    resetViewport,
    onMoveEnd,
    restoreViewport,
  };
}
