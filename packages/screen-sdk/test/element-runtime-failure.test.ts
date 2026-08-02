import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineNebulaScreenEditor, NEBULA_SCREEN_EDITOR_TAG_NAME } from '../src/element/define.js';
import type { MountScreenEditorRuntime, ScreenEditorRuntime } from '../src/element/runtime.js';

const { loadRuntimeMount } = vi.hoisted(() => ({
  loadRuntimeMount: vi.fn<() => Promise<MountScreenEditorRuntime>>(),
}));

vi.mock('../src/element/runtime-loader.js', () => ({ loadRuntimeMount }));

function createRuntime(): ScreenEditorRuntime {
  return {
    dispose: () => undefined,
    fitToScreen: () => undefined,
    focusComponent: () => false,
    getDocument: () => null,
    getDraft: () => null,
    publish: () => Promise.reject(new Error('unused')),
    redo: () => undefined,
    reload: () => Promise.resolve(),
    resize: () => undefined,
    save: () => Promise.reject(new Error('unused')),
    undo: () => undefined,
    update: () => undefined,
    validate: () => [],
    whenReady: () => Promise.resolve(),
  };
}

describe('NebulaScreenEditorElement runtime loading failure', () => {
  beforeEach(() => {
    defineNebulaScreenEditor();
    document.body.innerHTML = '';
    loadRuntimeMount.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('dispatches a safe load error and retries from the ShadowRoot button', async () => {
    const runtime = createRuntime();
    loadRuntimeMount
      .mockRejectedValueOnce(new Error('runtime chunk failed'))
      .mockResolvedValueOnce(() => runtime);

    const element = document.createElement(NEBULA_SCREEN_EDITOR_TAG_NAME);
    const errorListener = vi.fn();
    element.addEventListener('nebula-error', errorListener);
    document.body.append(element);

    await expect(element.whenReady()).rejects.toMatchObject({ code: 'UNKNOWN' });
    expect(errorListener).toHaveBeenCalledOnce();
    const errorEvent = errorListener.mock.calls[0]?.[0] as CustomEvent<{
      operation: string;
      error: { code: string; message: string; recoverable?: boolean };
    }>;
    expect(errorEvent.detail.operation).toBe('load');
    expect(errorEvent.detail.error).toEqual({
      code: 'UNKNOWN',
      message: '操作失败，请稍后重试。',
      recoverable: true,
    });

    const runtimeError = element.shadowRoot?.querySelector<HTMLElement>(
      '[data-nebula-runtime-error]',
    );
    expect(runtimeError?.hidden).toBe(false);
    element.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-nebula-runtime-error] button')
      ?.click();
    await vi.waitFor(() => expect(loadRuntimeMount).toHaveBeenCalledTimes(2));
    expect(runtimeError?.hidden).toBe(true);
  });
});
