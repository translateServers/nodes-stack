/**
 * component-event-context 单元测试（任务 7.1）
 *
 * 验证点：
 * - Provider 注入回调后 useComponentEvent 返回该回调
 * - 未注入 Provider 时 useComponentEvent 返回 null（编辑态默认行为）
 * - 回调签名支持 componentId + eventId + 可选 payload
 */

import { describe, expect, it, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import {
  BlueprintEventProvider,
  useComponentEvent,
  type ComponentEventCallback,
} from './component-event-context';

describe('component-event-context', () => {
  it('未注入 Provider 时 useComponentEvent 返回 null（编辑态）', () => {
    const { result } = renderHook(() => useComponentEvent());
    expect(result.current).toBeNull();
  });

  it('注入 Provider 后 useComponentEvent 返回回调', () => {
    const callback: ComponentEventCallback = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <BlueprintEventProvider value={callback}>{children}</BlueprintEventProvider>
    );
    const { result } = renderHook(() => useComponentEvent(), { wrapper });
    expect(result.current).toBe(callback);
  });

  it('回调可被组件调用并携带 componentId + eventId + payload', () => {
    const callback: ComponentEventCallback = vi.fn();
    function Consumer(): JSX.Element {
      const onEvent = useComponentEvent();
      return (
        <button
          type="button"
          onClick={() => {
            onEvent?.('comp-1', 'click', { x: 10, y: 20 });
          }}
        >
          click
        </button>
      );
    }
    const { container } = render(
      <BlueprintEventProvider value={callback}>
        <Consumer />
      </BlueprintEventProvider>,
    );
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    button?.click();
    expect(callback).toHaveBeenCalledWith('comp-1', 'click', { x: 10, y: 20 });
  });

  it('回调签名兼容无 payload 调用', () => {
    const callback: ComponentEventCallback = vi.fn();
    function Consumer(): JSX.Element {
      const onEvent = useComponentEvent();
      return (
        <button
          type="button"
          onClick={() => {
            onEvent?.('comp-1', 'hover');
          }}
        >
          hover
        </button>
      );
    }
    const { container } = render(
      <BlueprintEventProvider value={callback}>
        <Consumer />
      </BlueprintEventProvider>,
    );
    container.querySelector('button')?.click();
    expect(callback).toHaveBeenCalledWith('comp-1', 'hover');
  });
});
