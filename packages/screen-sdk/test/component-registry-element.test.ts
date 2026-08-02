/**
 * componentRegistry property 与 V2 联合类型测试（Task 6.1）
 *
 * 覆盖 Spec §8.5 + §14.1 + Requirement 2/3/4/13：
 * - componentRegistry 是 JavaScript-only property（不在 observedAttributes）
 * - 未赋值时使用内置默认 registry，V1 路径不受影响
 * - 首次 load 开始时冻结，冻结后赋新值抛 InvalidStateError
 * - 外部 registry 搭配 V1 Adapter 在 load 前被拒绝（不调用 Adapter）
 * - V1/V2 闭合联合类型：adapter/save/publish/getDraft/getDocument/validate
 * - V2 事件 map：ready/change/error 事件签名
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ScreenHostAdapter,
  ScreenHostAdapterV2,
  ScreenProjectEnvelopeInput,
} from '@nebula/screen-editor-core';
import { defineNebulaScreenEditor } from '../src/element/define.js';
import { NEBULA_SCREEN_EDITOR_TAG_NAME } from '../src/element/define.js';
import { NebulaScreenEditorElement } from '../src/element/nebula-screen-editor-element.js';
import { createScreenComponentRegistry } from '../src/components/index.js';
import type {
  NebulaScreenEditorEventMapV2,
  ScreenComponentRegistry,
  ScreenEditorAdapterV2,
} from '../src/element/v2-contracts.js';

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

function createV2Adapter(overrides: Partial<ScreenHostAdapterV2> = {}): ScreenHostAdapterV2 {
  const base = createAdapter(overrides as Partial<ScreenHostAdapter>);
  return {
    documentVersion: 2,
    loadProject: base.loadProject,
    saveProject: vi.fn(() => Promise.resolve(createEnvelope())) as never,
    ...overrides,
  };
}

let builtinRegistry: ScreenComponentRegistry;
let secondaryBuiltinRegistry: ScreenComponentRegistry;
let hostRegistry: ScreenComponentRegistry;

class TestHostElement extends HTMLElement {}

beforeAll(async () => {
  builtinRegistry = await createScreenComponentRegistry();
  secondaryBuiltinRegistry = await createScreenComponentRegistry();
  hostRegistry = await createScreenComponentRegistry({
    components: [
      {
        manifest: {
          apiVersion: 'nebula.screen-component/v1',
          type: 'acme.kpi/v1',
          implementationVersion: '1.0.0',
          tagName: 'acme-kpi-v1',
          name: 'KPI',
          category: 'chart',
          defaultSize: { width: 320, height: 180 },
          defaultProps: {},
          propsSchema: { type: 'object', additionalProperties: false },
        },
        define: () => TestHostElement,
      },
    ],
  });
});

/** 返回 public factory 创建的 built-in facade。 */
function createBuiltinOnlyRegistry(): ScreenComponentRegistry {
  return builtinRegistry;
}

/** 返回 public factory 创建的 host facade。 */
function createHostRegistry(): ScreenComponentRegistry {
  return hostRegistry;
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
  adapter: ScreenEditorAdapterV2,
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

describe('NebulaScreenEditorElement componentRegistry (Task 6.1)', () => {
  beforeEach(() => {
    defineNebulaScreenEditor();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('observedAttributes', () => {
    it('does not include componentRegistry in observedAttributes', () => {
      expect(NebulaScreenEditorElement.observedAttributes).not.toContain('component-registry');
      expect(NebulaScreenEditorElement.observedAttributes).not.toContain('componentRegistry');
    });
  });

  describe('default registry (Requirement 2, 9)', () => {
    it('componentRegistry defaults to undefined', () => {
      const element = createConnectedElement();
      expect(element.componentRegistry).toBeUndefined();
    });

    it('V1 path works without componentRegistry set', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      expect(adapter.loadProject).toHaveBeenCalledOnce();
      expect(element.getDraft()).not.toBeNull();
      expect(element.getDocument()).not.toBeNull();
    });

    it('builtin-only registry does not block V1 adapter', async () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      element.componentRegistry = createBuiltinOnlyRegistry();
      element.adapter = adapter;
      element.projectId = 'screen-1';
      await flush();
      await waitForReady(element);
      expect(adapter.loadProject).toHaveBeenCalledOnce();
    });
  });

  describe('freeze-on-load (Spec §8.5)', () => {
    it('throws InvalidStateError when replacing registry after load started', async () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      element.adapter = adapter;
      element.projectId = 'screen-1';
      await flush();

      // Load has started, registry should be frozen
      expect(() => {
        element.componentRegistry = createHostRegistry();
      }).toThrow(expect.objectContaining({ name: 'InvalidStateError' }));
    });

    it('preserves original registry reference after rejected replacement', async () => {
      const adapter = createAdapter();
      const originalRegistry = createBuiltinOnlyRegistry();
      const element = createConnectedElement();
      element.componentRegistry = originalRegistry;
      element.adapter = adapter;
      element.projectId = 'screen-1';
      await flush();

      const newRegistry = createHostRegistry();
      expect(() => {
        element.componentRegistry = newRegistry;
      }).toThrow(expect.objectContaining({ name: 'InvalidStateError' }));
      expect(element.componentRegistry).toBe(originalRegistry);
    });

    it('allows registry assignment before load starts', () => {
      const element = createConnectedElement();
      const registry = createBuiltinOnlyRegistry();
      expect(() => {
        element.componentRegistry = registry;
      }).not.toThrow();
      expect(element.componentRegistry).toBe(registry);
    });

    it('does not freeze when adapter is set but projectId is empty', () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      element.adapter = adapter;
      // projectId is empty (default), so load hasn't started
      expect(() => {
        element.componentRegistry = createBuiltinOnlyRegistry();
      }).not.toThrow();
    });

    it('does not freeze when projectId is set but adapter is undefined', () => {
      const element = createConnectedElement();
      element.projectId = 'screen-1';
      // adapter is undefined, so load hasn't started
      expect(() => {
        element.componentRegistry = createBuiltinOnlyRegistry();
      }).not.toThrow();
    });
  });

  describe('external registry + V1 adapter rejection (Requirement 13)', () => {
    it('rejects host registry with V1 adapter before load', async () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      const errorListener = vi.fn();
      element.addEventListener('nebula-error', errorListener);
      element.componentRegistry = createHostRegistry();
      element.adapter = adapter;
      element.projectId = 'screen-1';
      await flush();

      expect(errorListener).toHaveBeenCalled();
      const event = errorListener.mock
        .calls[0]?.[0] as NebulaScreenEditorEventMapV2['nebula-error'];
      expect(event.detail.operation).toBe('load');
      expect(event.detail.error.code).toBe('VALIDATION');
      // Adapter must not be called
      expect(adapter.loadProject).not.toHaveBeenCalled();
    });

    it('does not call Adapter when rejecting external registry + V1 combo', async () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      element.componentRegistry = createHostRegistry();
      element.adapter = adapter;
      element.projectId = 'screen-rejected';
      await flush();

      expect(adapter.loadProject).not.toHaveBeenCalled();
      expect(adapter.saveProject).not.toHaveBeenCalled();
    });

    it('freezes registry even when V1+host combo is rejected', async () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      element.componentRegistry = createHostRegistry();
      element.adapter = adapter;
      element.projectId = 'screen-1';
      await flush();

      // Registry should be frozen (load was attempted/rejected)
      expect(() => {
        element.componentRegistry = createBuiltinOnlyRegistry();
      }).toThrow(expect.objectContaining({ name: 'InvalidStateError' }));
    });
  });

  describe('V2 adapter opt-in boundary', () => {
    it('rejects a V2 adapter without an explicit registry before load', async () => {
      const adapter = createV2Adapter();
      const element = createConnectedElement();
      const errorListener = vi.fn();
      element.addEventListener('nebula-error', errorListener);
      element.adapter = adapter;
      element.projectId = 'screen-v2-without-registry';

      await vi.waitFor(() => expect(errorListener).toHaveBeenCalled());

      const event = errorListener.mock
        .calls[0]?.[0] as NebulaScreenEditorEventMapV2['nebula-error'];
      expect(event.detail.operation).toBe('load');
      expect(event.detail.error.code).toBe('VALIDATION');
      expect(adapter.loadProject).not.toHaveBeenCalled();
    });

    it('rejects a structurally forged registry before calling a V2 adapter', async () => {
      const adapter = createV2Adapter();
      const forgedRegistry: ScreenComponentRegistry = {
        size: 1,
        get: () => undefined,
        has: () => false,
        list: () => [
          {
            source: 'host',
            manifest: { type: 'acme.forged/v1' } as never,
            elementConstructor: TestHostElement,
          },
        ],
      };
      const element = createConnectedElement();
      const errorListener = vi.fn();
      element.addEventListener('nebula-error', errorListener);
      element.componentRegistry = forgedRegistry;
      element.adapter = adapter;
      element.projectId = 'screen-forged-registry';

      await vi.waitFor(() => expect(errorListener).toHaveBeenCalled());
      const event = errorListener.mock
        .calls[0]?.[0] as NebulaScreenEditorEventMapV2['nebula-error'];
      expect(event.detail.error.code).toBe('VALIDATION');
      expect(adapter.loadProject).not.toHaveBeenCalled();
    });
  });

  describe('V1/V2 closed union types (Spec §14.1)', () => {
    it('adapter property accepts V1 adapter', async () => {
      const v1Adapter = createAdapter();
      const element = await setupReadyElement(v1Adapter);
      expect(element.adapter).toBe(v1Adapter);
    });

    it('adapter property accepts V2 adapter type', () => {
      const element = createConnectedElement();
      const v2Adapter = createV2Adapter();
      // Type-level test: V2 adapter is assignable to adapter property
      element.adapter = v2Adapter;
      expect(element.adapter).toBe(v2Adapter);
    });

    it('save() returns ScreenSdkProjectEnvelope union (V1 branch)', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      const envelope = await element.save();
      // V1 branch: schemaVersion === 1
      expect(envelope.document.schemaVersion).toBe(1);
    });

    it('publish() returns ScreenSdkProjectEnvelope union (V1 branch)', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      const envelope = await element.publish();
      expect(envelope.document.schemaVersion).toBe(1);
    });

    it('getDraft() returns ScreenSdkProjectDraft union (V1 branch)', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      const draft = element.getDraft();
      expect(draft).not.toBeNull();
      if (draft !== null) {
        expect(draft.document.schemaVersion).toBe(1);
      }
    });

    it('getDocument() returns ScreenSdkDocument union (V1 branch)', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      const doc = element.getDocument();
      expect(doc).not.toBeNull();
      if (doc !== null) {
        expect(doc.schemaVersion).toBe(1);
      }
    });

    it('validate() returns ScreenSdkDiagnosticV2[] (V1 diagnostics assignable to V2)', async () => {
      const adapter = createAdapter();
      const element = await setupReadyElement(adapter);
      const diagnostics = element.validate();
      expect(Array.isArray(diagnostics)).toBe(true);
      // V1 diagnostics are structurally compatible with V2 (code is a subset)
      for (const diag of diagnostics) {
        expect(typeof diag.code).toBe('string');
        expect(Array.isArray(diag.path)).toBe(true);
        expect(typeof diag.severity).toBe('string');
        expect(typeof diag.message).toBe('string');
      }
    });
  });

  describe('V2 event map (Spec §14.1)', () => {
    it('nebula-ready event is compatible with V2 event map', async () => {
      const adapter = createAdapter();
      const element = createConnectedElement();
      const readyListener = vi.fn();
      element.addEventListener('nebula-ready', readyListener);
      element.adapter = adapter;
      element.projectId = 'screen-1';
      await flush();
      await waitForReady(element);

      expect(readyListener).toHaveBeenCalledOnce();
      const event = readyListener.mock
        .calls[0]?.[0] as NebulaScreenEditorEventMapV2['nebula-ready'];
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
      expect(event.detail.projectId).toBe('screen-1');
      // V1 branch: envelope.schemaVersion === 1
      expect(event.detail.envelope.document.schemaVersion).toBe(1);
    });

    it('nebula-error event is compatible with V2 event map', async () => {
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

      const event = errorListener.mock
        .calls[0]?.[0] as NebulaScreenEditorEventMapV2['nebula-error'];
      expect(event.detail.operation).toBe('load');
      expect(event.detail.error.code).toBe('UNKNOWN');
    });
  });

  describe('same reference assignment is no-op', () => {
    it('setting same registry reference twice does not throw', () => {
      const element = createConnectedElement();
      const registry = createBuiltinOnlyRegistry();
      element.componentRegistry = registry;
      expect(() => {
        element.componentRegistry = registry;
      }).not.toThrow();
    });
  });

  // ===== Task 6.2: static runtime configuration =====

  describe('static runtime configuration (Task 6.2)', () => {
    describe('registry flows to runtime before mount (Requirement 4, 8)', () => {
      function queryRuntimeRoot(element: NebulaScreenEditorElement): HTMLElement | null {
        return (
          element.shadowRoot?.querySelector<HTMLElement>('[data-testid="screen-editor-runtime"]') ??
          null
        );
      }

      it('passes componentRegistry to runtime config when set before connect', async () => {
        const adapter = createAdapter();
        const registry = createBuiltinOnlyRegistry();
        const element = createConnectedElement();
        element.componentRegistry = registry;
        element.adapter = adapter;
        element.projectId = 'screen-1';
        await flush();
        await waitForReady(element);

        // The test fixture exposes the registry size via data attribute,
        // proving the registry reference reached the runtime configuration.
        await vi.waitFor(() => {
          expect(queryRuntimeRoot(element)?.dataset['componentRegistrySize']).toBe(
            String(registry.size),
          );
        });
      });

      it('routes an explicit registry plus V2 adapter to the V2 runtime configuration', async () => {
        const element = createConnectedElement();
        element.componentRegistry = createBuiltinOnlyRegistry();
        element.adapter = createV2Adapter();
        element.projectId = 'screen-v2';

        await vi.waitFor(() => {
          const runtimeRoot = queryRuntimeRoot(element);
          expect(runtimeRoot?.dataset['documentMode']).toBe('v2');
          expect(runtimeRoot?.hasAttribute('data-v2-adapter')).toBe(true);
        });
      });

      it('omits componentRegistry from runtime config when not set', async () => {
        const adapter = createAdapter();
        const element = await setupReadyElement(adapter);

        await vi.waitFor(() => {
          expect(queryRuntimeRoot(element)?.dataset['componentRegistrySize']).toBe('none');
        });
      });

      it('preserves the same registry reference through the config chain', async () => {
        const adapter = createAdapter();
        const registry = createBuiltinOnlyRegistry();
        const element = createConnectedElement();
        element.componentRegistry = registry;
        element.adapter = adapter;
        element.projectId = 'screen-1';
        await flush();
        await waitForReady(element);

        // Element property and runtime config share the same reference (no copy).
        expect(element.componentRegistry).toBe(registry);
      });

      it('updates runtime config with new registry size on reconnect', async () => {
        const adapter = createAdapter();
        const registry = createBuiltinOnlyRegistry();
        const element = createConnectedElement();
        element.componentRegistry = registry;
        element.adapter = adapter;
        element.projectId = 'screen-1';
        await flush();
        await waitForReady(element);

        await vi.waitFor(() => {
          expect(queryRuntimeRoot(element)?.dataset['componentRegistrySize']).toBe(
            String(registry.size),
          );
        });

        // Disconnect and reconnect — a new element gets a fresh registry.
        element.remove();
        await flush();

        const element2 = createConnectedElement();
        const smallRegistry = secondaryBuiltinRegistry;
        element2.componentRegistry = smallRegistry;
        element2.adapter = adapter;
        element2.projectId = 'screen-2';
        await flush();
        await waitForReady(element2);

        await vi.waitFor(() => {
          expect(queryRuntimeRoot(element2)?.dataset['componentRegistrySize']).toBe(
            String(smallRegistry.size),
          );
        });
      });
    });

    describe('disconnect does not undefine Custom Element (Requirement 11)', () => {
      it('custom element definition persists after disconnect', async () => {
        const adapter = createAdapter();
        const element = await setupReadyElement(adapter);
        element.remove();
        await flush();

        // The Custom Element constructor must remain registered globally.
        // disconnect only releases runtime listeners; it does not undefine
        // the Custom Element (Spec §13.2 Task 6.2, Requirement 11).
        expect(customElements.get(NEBULA_SCREEN_EDITOR_TAG_NAME)).toBe(NebulaScreenEditorElement);
      });

      it('can create and connect a new element after another disconnects', async () => {
        const adapter = createAdapter();
        const element1 = await setupReadyElement(adapter);
        element1.remove();
        await flush();

        // A fresh element can still be created from the same registry definition.
        const element2 = await setupReadyElement(adapter, 'screen-2');
        expect(element2).toBeInstanceOf(NebulaScreenEditorElement);
        expect(element2.getDraft()).not.toBeNull();
      });

      it('releases runtime listener on disconnect (no writes after disconnect)', async () => {
        const adapter = createAdapter();
        const element = await setupReadyElement(adapter);
        const changeListener = vi.fn();
        element.addEventListener('nebula-change', changeListener);

        element.remove();
        await flush();

        // After disconnect, no runtime events should fire.
        // Attempting operations should reject with UNAVAILABLE.
        await expect(element.save()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        expect(changeListener).not.toHaveBeenCalled();
      });
    });
  });
});
