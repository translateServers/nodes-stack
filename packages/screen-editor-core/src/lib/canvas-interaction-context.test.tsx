import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  deriveCapabilities,
  DESIGN_CAPABILITIES,
  INTERACTIVE_CAPABILITIES,
  useCanvasInteraction,
  useCanvasInteractionValue,
  CanvasInteractionProvider,
} from './canvas-interaction-context';
import type { ReactNode } from 'react';

describe('deriveCapabilities', () => {
  it('design 模式派生正确能力', () => {
    const caps = deriveCapabilities('design');
    expect(caps.mode).toBe('design');
    expect(caps.canEditCanvas).toBe(true);
    expect(caps.canDispatchNativeEvents).toBe(false);
    expect(caps.canDispatchBlueprintEvents).toBe(false);
  });

  it('interactive 模式派生正确能力', () => {
    const caps = deriveCapabilities('interactive');
    expect(caps.mode).toBe('interactive');
    expect(caps.canEditCanvas).toBe(false);
    expect(caps.canDispatchNativeEvents).toBe(true);
    expect(caps.canDispatchBlueprintEvents).toBe(true);
  });

  it('design 与 interactive 能力互斥', () => {
    expect(DESIGN_CAPABILITIES.canEditCanvas).toBe(true);
    expect(DESIGN_CAPABILITIES.canDispatchNativeEvents).toBe(false);
    expect(DESIGN_CAPABILITIES.canDispatchBlueprintEvents).toBe(false);

    expect(INTERACTIVE_CAPABILITIES.canEditCanvas).toBe(false);
    expect(INTERACTIVE_CAPABILITIES.canDispatchNativeEvents).toBe(true);
    expect(INTERACTIVE_CAPABILITIES.canDispatchBlueprintEvents).toBe(true);
  });
});

describe('useCanvasInteraction', () => {
  it('无 Provider 时安全回退到 design 能力', () => {
    const { result } = renderHook(() => useCanvasInteraction());
    expect(result.current.mode).toBe('design');
    expect(result.current.canEditCanvas).toBe(true);
    expect(result.current.canDispatchNativeEvents).toBe(false);
    expect(result.current.canDispatchBlueprintEvents).toBe(false);
  });

  it('Provider 注入 interactive 能力', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasInteractionProvider value={INTERACTIVE_CAPABILITIES}>
        {children}
      </CanvasInteractionProvider>
    );
    const { result } = renderHook(() => useCanvasInteraction(), { wrapper });
    expect(result.current.mode).toBe('interactive');
    expect(result.current.canEditCanvas).toBe(false);
    expect(result.current.canDispatchNativeEvents).toBe(true);
    expect(result.current.canDispatchBlueprintEvents).toBe(true);
  });
});

describe('useCanvasInteractionValue', () => {
  it('design 模式返回 design 能力', () => {
    const { result } = renderHook(() => useCanvasInteractionValue('design'));
    expect(result.current).toBe(DESIGN_CAPABILITIES);
  });

  it('interactive 模式返回 interactive 能力', () => {
    const { result } = renderHook(() => useCanvasInteractionValue('interactive'));
    expect(result.current).toBe(INTERACTIVE_CAPABILITIES);
  });

  it('相同模式返回稳定引用（memo 化）', () => {
    const { result, rerender } = renderHook(() => useCanvasInteractionValue('design'));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
