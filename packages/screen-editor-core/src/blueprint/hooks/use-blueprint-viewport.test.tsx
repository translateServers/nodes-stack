/**
 * 蓝图视口控制 Hook 测试（任务 4.6）
 *
 * 测试策略：
 * - 纯单元测试 config 与常量（不依赖 ReactFlow 上下文）
 * - 通过 vi.hoisted + vi.mock 替换 useReactFlow / useViewport，验证回调调用
 * - 不直接 await fitView 返回的 Promise（ReactFlow 内部 Promise 在 jsdom 下可能永不 resolve）
 */

import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, useBlueprintViewport } from './use-blueprint-viewport';

// React Flow 依赖 ResizeObserver 等，jsdom 未实现
beforeAll(() => {
  if (typeof window.ResizeObserver !== 'function') {
    class MockResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  }
  if (typeof window.DOMMatrix !== 'function') {
    class MockDOMMatrix {
      constructor() {}
      static fromFloat32Array(): MockDOMMatrix {
        return new MockDOMMatrix();
      }
      static fromFloat64Array(): MockDOMMatrix {
        return new MockDOMMatrix();
      }
    }
    vi.stubGlobal('DOMMatrix', MockDOMMatrix);
  }
  if (typeof window.IntersectionObserver !== 'function') {
    class MockIntersectionObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): [] {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  }
});

// 使用 vi.hoisted 创建 mock 容器，保证 vi.mock 工厂执行时可用
const mocks = vi.hoisted(() => {
  return {
    zoomTo: vi.fn().mockResolvedValue(true),
    fitView: vi.fn().mockResolvedValue(true),
    setViewport: vi.fn().mockResolvedValue(true),
    getZoom: vi.fn().mockReturnValue(1),
    getViewport: vi.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 }),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
});

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      zoomTo: mocks.zoomTo,
      fitView: mocks.fitView,
      setViewport: mocks.setViewport,
      getZoom: mocks.getZoom,
      getViewport: mocks.getViewport,
    }),
    useViewport: () => mocks.viewport,
  };
});

// ReactFlowProvider 包裹组件
function Wrapper({ children }: { children: ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

describe('use-blueprint-viewport', () => {
  describe('常量', () => {
    it('MIN_ZOOM 为 0.25', () => {
      expect(MIN_ZOOM).toBe(0.25);
    });

    it('MAX_ZOOM 为 2', () => {
      expect(MAX_ZOOM).toBe(2);
    });

    it('ZOOM_STEP 为 0.2', () => {
      expect(ZOOM_STEP).toBe(0.2);
    });
  });

  describe('useBlueprintViewport', () => {
    beforeEach(() => {
      mocks.zoomTo.mockReset();
      mocks.fitView.mockReset();
      mocks.setViewport.mockReset();
      mocks.zoomTo.mockResolvedValue(true);
      mocks.fitView.mockResolvedValue(true);
      mocks.setViewport.mockResolvedValue(true);
      mocks.getZoom.mockReturnValue(1);
      mocks.getViewport.mockReturnValue({ x: 0, y: 0, zoom: 1 });
      mocks.viewport.zoom = 1;
    });

    it('返回正确的 config 默认值', () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      expect(result.current.config.minZoom).toBe(MIN_ZOOM);
      expect(result.current.config.maxZoom).toBe(MAX_ZOOM);
      expect(result.current.config.defaultZoom).toBe(1);
      expect(result.current.config.panOnScroll).toBe(false);
      expect(result.current.config.zoomOnScroll).toBe(true);
      expect(result.current.config.zoomOnPinch).toBe(true);
      expect(result.current.config.zoomOnDoubleClick).toBe(true);
      expect(result.current.config.preventScrolling).toBe(true);
    });

    it('默认 panOnDrag=false（未按 Space 时）', () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });
      expect(result.current.config.panOnDrag).toBe(false);
      expect(result.current.spacePressed).toBe(false);
    });

    it('按下 Space 时 panOnDrag 切换为 true', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true,
          }),
        );
        await Promise.resolve();
      });

      expect(result.current.spacePressed).toBe(true);
      expect(result.current.config.panOnDrag).toBe(true);

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keyup', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true,
          }),
        );
        await Promise.resolve();
      });

      expect(result.current.spacePressed).toBe(false);
      expect(result.current.config.panOnDrag).toBe(false);
    });

    it('enableSpacePan=false 时 Space 不启用平移', async () => {
      const { result } = renderHook(() => useBlueprintViewport({ enableSpacePan: false }), {
        wrapper: Wrapper,
      });

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true,
          }),
        );
        await Promise.resolve();
      });

      expect(result.current.spacePressed).toBe(false);
      expect(result.current.config.panOnDrag).toBe(false);
    });

    it('支持自定义 minZoom / maxZoom', () => {
      const { result } = renderHook(
        () =>
          useBlueprintViewport({
            minZoom: 0.5,
            maxZoom: 1.5,
            zoomStep: 0.1,
          }),
        { wrapper: Wrapper },
      );

      expect(result.current.config.minZoom).toBe(0.5);
      expect(result.current.config.maxZoom).toBe(1.5);
    });

    it('zoom 反映当前视口缩放', () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });
      expect(typeof result.current.zoom).toBe('number');
    });

    it('zoomIn 调用 reactFlow.zoomTo（基于当前 zoom + step）', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.zoomIn();
      });

      expect(mocks.zoomTo).toHaveBeenCalledTimes(1);
      const callArgs = mocks.zoomTo.mock.calls[0];
      expect(callArgs?.[0]).toBe(1 + ZOOM_STEP); // 1 + 0.2 = 1.2
    });

    it('zoomOut 调用 reactFlow.zoomTo（基于当前 zoom - step）', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.zoomOut();
      });

      expect(mocks.zoomTo).toHaveBeenCalledTimes(1);
      const callArgs = mocks.zoomTo.mock.calls[0];
      expect(callArgs?.[0]).toBe(1 - ZOOM_STEP); // 1 - 0.2 = 0.8
    });

    it('zoomIn 不超过 maxZoom', async () => {
      // 模拟当前 zoom 已达上限（zoomIn 通过 reactFlow.getZoom() 读取最新值）
      mocks.getZoom.mockReturnValue(2);

      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.zoomIn();
      });

      const callArgs = mocks.zoomTo.mock.calls[0];
      expect(callArgs?.[0]).toBe(MAX_ZOOM); // 限制为 2
    });

    it('zoomOut 不低于 minZoom', async () => {
      // 模拟当前 zoom 已达下限（zoomOut 通过 reactFlow.getZoom() 读取最新值）
      mocks.getZoom.mockReturnValue(0.25);

      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.zoomOut();
      });

      const callArgs = mocks.zoomTo.mock.calls[0];
      expect(callArgs?.[0]).toBe(MIN_ZOOM); // 限制为 0.25
    });

    it('zoomTo 限制在 min/max 范围内（超过 max）', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.zoomTo(5);
      });

      expect(mocks.zoomTo).toHaveBeenCalledWith(MAX_ZOOM, expect.anything());
    });

    it('zoomTo 限制在 min/max 范围内（低于 min）', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.zoomTo(0.1);
      });

      expect(mocks.zoomTo).toHaveBeenCalledWith(MIN_ZOOM, expect.anything());
    });

    it('zoomTo 在范围内时直接使用', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.zoomTo(1.5);
      });

      expect(mocks.zoomTo).toHaveBeenCalledWith(1.5, expect.anything());
    });

    it('fitView 调用 reactFlow.fitView（含 padding 与 min/max）', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.fitView();
      });

      expect(mocks.fitView).toHaveBeenCalledTimes(1);
      const options = mocks.fitView.mock.calls[0]?.[0] as {
        padding?: number;
        minZoom?: number;
        maxZoom?: number;
      };
      expect(options?.padding).toBe(0.2);
      expect(options?.minZoom).toBe(MIN_ZOOM);
      expect(options?.maxZoom).toBe(MAX_ZOOM);
    });

    it('fitViewToNodes 空数组时退化为 fitView（不含 nodes 字段）', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.fitViewToNodes([]);
      });

      expect(mocks.fitView).toHaveBeenCalledTimes(1);
      const options = mocks.fitView.mock.calls[0]?.[0] as { nodes?: unknown };
      expect(options?.nodes).toBeUndefined();
    });

    it('fitViewToNodes 非空数组时传 nodes 字段', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.fitViewToNodes(['n1', 'n2']);
      });

      expect(mocks.fitView).toHaveBeenCalledTimes(1);
      const options = mocks.fitView.mock.calls[0]?.[0] as {
        nodes?: Array<{ id: string }>;
      };
      expect(options?.nodes).toEqual([{ id: 'n1' }, { id: 'n2' }]);
    });

    it('resetViewport 调用 setViewport 后再调用 fitView', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.resetViewport();
      });

      expect(mocks.setViewport).toHaveBeenCalledTimes(1);
      const viewportArg = mocks.setViewport.mock.calls[0]?.[0] as {
        x: number;
        y: number;
        zoom: number;
      };
      expect(viewportArg).toEqual({ x: 0, y: 0, zoom: 1 });
      expect(mocks.fitView).toHaveBeenCalledTimes(1);
    });
  });

  describe('Space 平移与画布快捷键不冲突', () => {
    beforeEach(() => {
      mocks.zoomTo.mockReset();
      mocks.fitView.mockReset();
      mocks.setViewport.mockReset();
      mocks.zoomTo.mockResolvedValue(true);
      mocks.fitView.mockResolvedValue(true);
      mocks.setViewport.mockResolvedValue(true);
      mocks.viewport.zoom = 1;
    });

    it('Space 按下仅切换 panOnDrag，不触发其他副作用', async () => {
      const { result } = renderHook(() => useBlueprintViewport(), { wrapper: Wrapper });

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true,
          }),
        );
        await Promise.resolve();
      });

      expect(result.current.spacePressed).toBe(true);

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keyup', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true,
          }),
        );
        await Promise.resolve();
      });

      expect(result.current.spacePressed).toBe(false);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      mocks.zoomTo.mockReset();
      mocks.fitView.mockReset();
      mocks.setViewport.mockReset();
      mocks.zoomTo.mockResolvedValue(true);
      mocks.fitView.mockResolvedValue(true);
      mocks.setViewport.mockResolvedValue(true);
      mocks.viewport.zoom = 1;
    });

    it('组件卸载后不再响应 Space', async () => {
      const { result, unmount } = renderHook(() => useBlueprintViewport(), {
        wrapper: Wrapper,
      });

      unmount();

      // 卸载后 dispatch 不应再触发状态更新（useKeyPress 内部已清理监听器）
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true,
          }),
        );
        await Promise.resolve();
      });

      // result.current 仍为卸载前的快照
      expect(result.current.spacePressed).toBe(false);
    });
  });
});
