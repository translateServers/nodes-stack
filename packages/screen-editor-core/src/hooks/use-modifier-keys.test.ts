import { renderHook } from '@testing-library/react';
import type { Options } from 'react-hotkeys-hook';
import { useModifierKeys } from './use-modifier-keys';

interface HotkeysCall {
  callback: (event: KeyboardEvent) => void;
  keys: string;
  options: Options;
}

const capturedCalls: HotkeysCall[] = [];

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn((keys: string, callback: (event: KeyboardEvent) => void, options: Options) => {
    capturedCalls.push({ callback, keys, options });
  }),
}));

describe('useModifierKeys active instance cleanup', () => {
  beforeEach(() => {
    capturedCalls.length = 0;
  });

  it('keeps keydown active-scoped but always enables cleanup keyup handlers', () => {
    renderHook(() => useModifierKeys({ isActive: () => false }));

    for (const key of ['space', 'shift', 'alt', 'ctrl']) {
      const calls = capturedCalls.filter((call) => call.keys === key);
      expect(calls).toHaveLength(2);
      expect(typeof calls[0]?.options.enabled).toBe('function');
      expect((calls[0]?.options.enabled as () => boolean)()).toBe(false);
      expect(calls[1]?.options).toMatchObject({
        enableOnContentEditable: true,
        enableOnFormTags: true,
        enabled: true,
        keydown: false,
        keyup: true,
      });
    }
  });
});
