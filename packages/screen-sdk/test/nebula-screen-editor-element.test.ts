/**
 * NebulaScreenEditorElement 生命周期与命令矩阵测试
 *
 * 覆盖 Task 16 验收项：
 * - observed attributes 与 property/attribute 反射
 * - React Root mount/unmount（通过 runtime dispose 验证）
 * - 显式注册和 auto-register 幂等保护
 * - 公共方法返回值不暴露可变 Store 引用（深拷贝）
 * - readonly 命令矩阵：异步 mutation reject、undo/redo no-op、只读命令可用
 * - readonly 下 Adapter mutation 不被调用
 * - disconnected 时释放 Root、Adapter 操作和事件监听
 * - property 与 attribute 赋值顺序不影响加载
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  NebulaScreenEditorEventMap,
  ScreenHostAdapter,
  ScreenProjectEnvelopeInput,
} from '@nebula/screen-editor-core';
import { defineNebulaScreenEditor } from '../src/element/define.js';
import { NEBULA_SCREEN_EDITOR_TAG_NAME } from '../src/element/define.js';
import { NebulaScreenEditorElement } from '../src/element/nebula-screen-editor-element.js';

// ===== 测试工具 =====

function createEnvelope(
  projectId = 'screen-1',
  overrides: Partial<ScreenProjectEnvelopeInput> = {},
): ScreenProjectEnvelopeInput {
  return {
    id: projectId,
    name: `Project ${projectId}`,
    description: null,
    status: 'draft',
    revision: `revision-${projectId}`,
    document: {
      schemaVersion: 1,
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#000000',
        scaleMode: 'fit',
      },
      components: [],
      globalVariables: [],
    },
    ...overrides,
  };
}

function createAdapter(overrides: Partial<ScreenHostAdapter> = {}): ScreenHostAdapter {
  const loadProject = vi.fn(({ projectId }: { projectId: string }) =>
    Promise.resolve(createEnvelope(projectId)),
  );
  const saveProject = vi.fn(({ projectId }: { projectId: string }) =>
    Promise.resolve(createEnvelope(projectId, { revision: 'revision-saved' })),
  );
  const publishProject = vi.fn(({ projectId }: { projectId: string }) =>
    Promise.resolve(
      createEnvelope(projectId, { revision: 'revision-published', status: 'published' }),
    ),
  );
  return { loadProject, saveProject, publishProject, ...overrides };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForReady(element: NebulaScreenEditorElement): Promise<void> {
  await element.whenReady();
}

function createConnectedElement(): NebulaScreenEditorElement {
  const element = document.createElement(NEBULA_SCREEN_EDITOR_TAG_NAME);
  document.body.append(element);
  return element;
}

async function setupReadyElement(
  adapter: ScreenHostAdapter,
  projectId = 'screen-1',
): Promise<NebulaScreenEditorElement> {
  const element = createConnectedElement();
  element.adapter = adapter;
  element.projectId = projectId;
  await flush();
  await waitForReady(element);
  return element;
}

// ===== 测试 =====

describe('NebulaScreenEditorElement', () => {
  beforeEach(() => {
    defineNebulaScreenEditor();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('registration', () => {
    it('defineNebulaScreenEditor is idempotent', () => {
      // jsdom 不允许 new CustomElementRegistry()，使用全局 registry 验证幂等
      defineNebulaScreenEditor();
      defineNebulaScreenEditor();
      expect(customElements.get(NEBULA_SCREEN_EDITOR_TAG_NAME)).toBe(NebulaScreenEditorElement);
    });

    it('defineNebulaScreenEditor skips when tag is already defined', () => {
      // 先确保已注册（beforeEach 已注册一次），再次调用应跳过
      const before = customElements.get(NEBULA_SCREEN_EDITOR_TAG_NAME);
      defineNebulaScreenEditor();
      expect(customElements.get(NEBULA_SCREEN_EDITOR_TAG_NAME)).toBe(before);
    });
  });

  describe('attribute and property reflection', () => {
    it('reflects project-id attribute to projectId property', () => {
      const element = createConnectedElement();
      element.setAttribute('project-id', 'screen-attr');
      expect(element.projectId).toBe('screen-attr');
    });

    it('reflects projectId property to project-id attribute', () => {
      const element = createConnectedElement();
      element.projectId = 'screen-prop';
      expect(element.getAttribute('project-id')).toBe('screen-prop');
    });

    it('removes project-id attribute when projectId is set to empty string', () => {
      const element = createConnectedElement();
      element.projectId = 'screen-x';
      element.projectId = '';
      expect(element.hasAttribute('project-id')).toBe(false);
    });

    it('reflects readonly attribute to readonly property', () => {
      const element = createConnectedElement();
      element.setAttribute('readonly', '');
      expect(element.readonly).toBe(true);
    });

    it('reflects readonly property to readonly attribute', () => {
      const element = createConnectedElement();
      element.readonly = true;
      expect(element.hasAttribute('readonly')).toBe(true);
      element.readonly = false;
      expect(element.hasAttribute('readonly')).toBe(false);
    });

    it('reflects theme attribute to theme property', () => {
      const element = createConnectedElement();
      element.setAttribute('theme', 'dark');
      expect(element.theme).toBe('dark');
      element.setAttribute('theme', 'light');
      expect(element.theme).toBe('light');
    });

    it('reflects theme property to theme attribute', () => {
      const element = createConnectedElement();
      element.theme = 'dark';
      expect(element.getAttribute('theme')).toBe('dark');
    });

    it('defaults theme to light when attribute is absent', () => {
      const element = createConnectedElement();
      expect(element.theme).toBe('light');
    });
  });

  describe('out-of-order assignment', () => {
    it('loads when adapter is set before projectId', async () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      element.adapter = adapter;
      element.projectId = 'screen-1';
      await flush();
      await waitForReady(element);
      expect(adapter.loadProject).toHaveBeenCalledOnce();
    });

    it('loads when projectId is set before adapter', async () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      element.projectId = 'screen-1';
      element.adapter = adapter;
      await flush();
      await waitForReady(element);
      expect(adapter.loadProject).toHaveBeenCalledOnce();
    });

    it('does not reload when same adapter reference is assigned again', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.adapter = adapter;
      await flush();
      expect(adapter.loadProject).toHaveBeenCalledOnce();
    });

    it('reloads when a new adapter reference is assigned', async () => {
      const adapter1 = createAdapter();
      const element = await setupReadyElement(adapter1);
      const adapter2 = createAdapter();
      element.adapter = adapter2;
      await flush();
      await waitForReady(element);
      expect(adapter1.loadProject).toHaveBeenCalledOnce();
      expect(adapter2.loadProject).toHaveBeenCalledOnce();
    });
  });

  describe('deep clone of return values', () => {
    it('getDraft returns a deep clone that does not mutate internal state', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      const draft1 = element.getDraft();
      expect(draft1).not.toBeNull();
      if (draft1 !== null) {
        draft1.name = 'mutated';
        (draft1.document as { canvas: { width: number } }).canvas.width = 999;
      }
      const draft2 = element.getDraft();
      expect(draft2?.name).toBe('Project screen-1');
      expect((draft2?.document as { canvas: { width: number } }).canvas.width).toBe(1920);
    });

    it('getDocument returns a deep clone that does not mutate internal state', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      const doc1 = element.getDocument();
      expect(doc1).not.toBeNull();
      if (doc1 !== null) {
        doc1.canvas.width = 999;
      }
      const doc2 = element.getDocument();
      expect(doc2?.canvas.width).toBe(1920);
    });

    it('options getter returns a deep clone', () => {
      const element = createConnectedElement();
      element.options = { debug: true, preferenceNamespace: 'test-ns' };
      const opts1 = element.options;
      expect(opts1).toBeDefined();
      if (opts1 !== undefined) {
        opts1.debug = false;
      }
      expect(element.options?.debug).toBe(true);
    });
  });

  describe('readonly command matrix', () => {
    it('rejects save() with FORBIDDEN in readonly mode', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.readonly = true;
      await flush();
      await expect(element.save()).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(adapter.saveProject).not.toHaveBeenCalled();
    });

    it('rejects publish() with FORBIDDEN in readonly mode', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.readonly = true;
      await flush();
      await expect(element.publish()).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(adapter.publishProject).not.toHaveBeenCalled();
    });

    it('undo() is a safe no-op in readonly mode', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.readonly = true;
      await flush();
      expect(() => element.undo()).not.toThrow();
    });

    it('redo() is a safe no-op in readonly mode', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.readonly = true;
      await flush();
      expect(() => element.redo()).not.toThrow();
    });

    it('allows reload() in readonly mode', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.readonly = true;
      await flush();
      await expect(element.reload()).resolves.toBeUndefined();
      expect(adapter.loadProject).toHaveBeenCalledTimes(2);
    });

    it('allows getDraft(), getDocument(), validate() in readonly mode', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.readonly = true;
      await flush();
      expect(element.getDraft()).not.toBeNull();
      expect(element.getDocument()).not.toBeNull();
      expect(Array.isArray(element.validate())).toBe(true);
    });

    it('allows fitToScreen() and focusComponent() in readonly mode', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.readonly = true;
      await flush();
      expect(() => element.fitToScreen()).not.toThrow();
      expect(() => element.focusComponent('nonexistent')).not.toThrow();
    });

    it('does not call any Adapter mutation method in readonly mode', async () => {
      const saveProject = vi.fn(({ projectId }: { projectId: string }) =>
        Promise.resolve(createEnvelope(projectId, { revision: 'r2' })),
      );
      const publishProject = vi.fn(({ projectId }: { projectId: string }) =>
        Promise.resolve(createEnvelope(projectId, { revision: 'r3' })),
      );
      const adapter = createAdapter({ saveProject, publishProject });
      const element = await setupReadyElement(adapter);
      element.readonly = true;
      await flush();

      await expect(element.save()).rejects.toBeDefined();
      await expect(element.publish()).rejects.toBeDefined();
      element.undo();
      element.redo();

      expect(saveProject).not.toHaveBeenCalled();
      expect(publishProject).not.toHaveBeenCalled();
    });

    it('save() and publish() work normally when not readonly', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      const saved = await element.save();
      expect(saved.revision).toBe('revision-saved');
      expect(adapter.saveProject).toHaveBeenCalledOnce();

      const published = await element.publish();
      expect(published.revision).toBe('revision-published');
      expect(adapter.publishProject).toHaveBeenCalledOnce();
    });
  });

  describe('disconnectedCallback', () => {
    it('disposes runtime when disconnected from DOM', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.remove();
      await flush();

      // After disconnection, imperative methods should reject with UNAVAILABLE
      await expect(element.save()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
      expect(element.getDraft()).toBeNull();
      expect(element.getDocument()).toBeNull();
    });

    it('late adapter responses do not write to Store after disconnect', async () => {
      let resolveLoad: ((value: ScreenProjectEnvelopeInput) => void) | undefined;
      const adapter = createAdapter({
        loadProject: () =>
          new Promise<ScreenProjectEnvelopeInput>((resolve) => {
            resolveLoad = resolve;
          }),
      });
      const element = createConnectedElement();
      element.adapter = adapter;
      element.projectId = 'screen-late';
      await flush();
      element.remove();
      await flush();

      const errorListener = vi.fn();
      element.addEventListener('nebula-error', errorListener);

      resolveLoad?.(createEnvelope('screen-late'));
      await flush();

      expect(errorListener).not.toHaveBeenCalled();
      expect(element.getDraft()).toBeNull();
    });

    it('can reconnect after disconnection and load again', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      element.remove();
      await flush();

      document.body.append(element);
      await flush();
      await waitForReady(element);
      expect(adapter.loadProject).toHaveBeenCalledTimes(2);
      expect(element.getDraft()).not.toBeNull();
    });
  });

  describe('events', () => {
    it('dispatches nebula-ready with bubbles and composed', async () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      const readyListener = vi.fn();
      element.addEventListener('nebula-ready', readyListener);
      element.adapter = adapter;
      element.projectId = 'screen-1';
      await flush();
      await waitForReady(element);

      expect(readyListener).toHaveBeenCalledOnce();
      const event = readyListener.mock.calls[0]?.[0] as NebulaScreenEditorEventMap['nebula-ready'];
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
      expect(event.detail.projectId).toBe('screen-1');
    });

    it('dispatches nebula-error on load failure', async () => {
      const adapter = createAdapter({
        loadProject: () => Promise.reject(new Error('network failure')),
      });
      const element = createConnectedElement();
      const errorListener = vi.fn();
      element.addEventListener('nebula-error', errorListener);
      element.adapter = adapter;
      element.projectId = 'screen-fail';
      await flush();
      await vi.waitFor(() => expect(errorListener).toHaveBeenCalled());

      const event = errorListener.mock.calls[0]?.[0] as NebulaScreenEditorEventMap['nebula-error'];
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
      expect(event.detail.operation).toBe('load');
      expect(event.detail.error.code).toBe('UNKNOWN');
    });
  });
});
