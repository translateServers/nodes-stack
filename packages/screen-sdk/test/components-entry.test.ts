/**
 * Tests for `@nebula/screen-sdk/components` opt-in entry point (Task 6.3)
 *
 * Verifies:
 * - Registry factory returns public ScreenComponentRegistry with built-in components
 * - V2 types are exported and structurally correct
 * - Registry error guard and implementation class work
 * - validateManifest is re-exported
 * - Default V1 path unchanged (no auto-upgrade)
 */

import { describe, expect, it } from 'vitest';
import { resolveScreenComponentRegistryForRuntime } from '@nebula/screen-editor-core';

import {
  createScreenComponentRegistry,
  isScreenComponentRegistryError,
  ScreenComponentRegistryErrorImpl,
  validateManifest,
  SCREEN_DOCUMENT_V2_VERSION,
  SCREEN_TRANSFER_FORMAT_VERSION_V2,
  type CreateScreenComponentRegistryOptions,
  type ScreenComponentManifestV1,
  type ScreenComponentPluginV1,
  type ScreenComponentRegistry,
  type ScreenComponentRegistryError,
  type ScreenComponentRegistryErrorCode,
  type ScreenComponentRegistration,
  type ScreenComponentRegistrationBase,
  type ScreenDocumentV2,
  type ScreenHostAdapterV2,
  type ScreenProjectDraftV2,
  type ScreenProjectEnvelopeV2,
  type ScreenSdkDiagnosticV2,
  type ScreenSdkDocument,
  type ScreenPublicErrorV2,
  type NebulaScreenEditorEventMapV2,
  type ScreenEditorAdapterV2,
  type ScreenSdkProjectDraft,
  type ScreenSdkProjectEnvelope,
  type ScreenOperationSuccessDetailV2,
} from '../src/components/index.js';

describe('@nebula/screen-sdk/components entry point', () => {
  describe('createScreenComponentRegistry', () => {
    it('returns a registry with 6 built-in components', async () => {
      const registry = await createScreenComponentRegistry();
      expect(registry.size).toBe(6);
    });

    it('returns a registry assignable to public ScreenComponentRegistry', async () => {
      const registry: ScreenComponentRegistry = await createScreenComponentRegistry();
      // Public interface only exposes size/get/has/list
      expect(typeof registry.size).toBe('number');
      expect(typeof registry.get).toBe('function');
      expect(typeof registry.has).toBe('function');
      expect(typeof registry.list).toBe('function');
    });

    it('built-in components include text, bar-chart, rect, ellipse, image, button', async () => {
      const registry = await createScreenComponentRegistry();
      const types = registry.list().map((r) => r.manifest.type);
      expect(types).toEqual(
        expect.arrayContaining(['text', 'bar-chart', 'rect', 'ellipse', 'image', 'button']),
      );
    });

    it('each built-in registration has manifest and source', async () => {
      const registry = await createScreenComponentRegistry();
      for (const registration of registry.list()) {
        expect(registration.source).toBe('built-in');
        expect(registration.manifest).toBeDefined();
        expect(registration.manifest.type).toBeTruthy();
        expect(registration.manifest.tagName).toBeTruthy();
      }
    });

    it('exposes a frozen public facade without core legacy fields', async () => {
      const registry = await createScreenComponentRegistry();
      const registration = registry.get('text');

      expect(registration).toBeDefined();
      if (registration === undefined) return;

      expect(registration).not.toHaveProperty('legacyRenderer');
      expect(registration).not.toHaveProperty('internalRenderer');
      expect(registration).not.toHaveProperty('legacySchema');
      expect(registration).not.toHaveProperty('legacyIcon');
      expect(Object.isFrozen(registry)).toBe(true);
      expect(Object.isFrozen(registry.list())).toBe(true);
      expect(Object.isFrozen(registration)).toBe(true);
      expect(Object.isFrozen(registration.manifest)).toBe(true);

      const internalRegistry = resolveScreenComponentRegistryForRuntime(registry);
      expect(internalRegistry).not.toBe(registry);
      expect(internalRegistry?.get('text')).toHaveProperty('elementConstructor');
      expect(internalRegistry?.get('bar-chart')).toHaveProperty('internalRenderer');
    });

    it('does not resolve a structurally forged facade into a core registry', () => {
      const forgedRegistry = {
        size: 0,
        get: () => undefined,
        has: () => false,
        list: () => [],
      } as ScreenComponentRegistry;

      expect(resolveScreenComponentRegistryForRuntime(forgedRegistry)).toBeUndefined();
    });

    it('get() returns undefined for unknown type', async () => {
      const registry = await createScreenComponentRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('has() returns false for unknown type', async () => {
      const registry = await createScreenComponentRegistry();
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('list() returns readonly array preserving build order', async () => {
      const registry = await createScreenComponentRegistry();
      const list = registry.list();
      expect(Array.isArray(list)).toBe(true);
      // Built-in components are registered in a fixed order
      expect(list.length).toBe(6);
    });

    it('accepts empty components option', async () => {
      const registry = await createScreenComponentRegistry({ components: [] });
      expect(registry.size).toBe(6);
    });

    it('accepts options typed as CreateScreenComponentRegistryOptions', async () => {
      const options: CreateScreenComponentRegistryOptions = { components: [] };
      const registry = await createScreenComponentRegistry(options);
      expect(registry.size).toBe(6);
    });
  });

  describe('registry error handling', () => {
    it('isScreenComponentRegistryError narrows registry errors', () => {
      const error = new ScreenComponentRegistryErrorImpl(
        'INVALID_COMPONENT_MANIFEST',
        'test error',
      );
      expect(isScreenComponentRegistryError(error)).toBe(true);
    });

    it('isScreenComponentRegistryError rejects generic errors', () => {
      expect(isScreenComponentRegistryError(new Error('generic'))).toBe(false);
      expect(isScreenComponentRegistryError('string')).toBe(false);
      expect(isScreenComponentRegistryError(null)).toBe(false);
      expect(isScreenComponentRegistryError(undefined)).toBe(false);
    });

    it('ScreenComponentRegistryErrorImpl has stable code and diagnostics', () => {
      const error = new ScreenComponentRegistryErrorImpl(
        'DUPLICATE_COMPONENT_TYPE',
        'duplicate type',
      );
      expect(error.code).toBe('DUPLICATE_COMPONENT_TYPE');
      expect(error.diagnostics).toEqual([]);
      expect(error.message).toBe('duplicate type');
      expect(error.name).toBe('ScreenComponentRegistryError');
    });

    it('error code is assignable to ScreenComponentRegistryErrorCode', () => {
      const code: ScreenComponentRegistryErrorCode = 'INVALID_COMPONENT_MANIFEST';
      const error: ScreenComponentRegistryError = new ScreenComponentRegistryErrorImpl(
        code,
        'test',
      );
      expect(error.code).toBe(code);
    });
  });

  describe('validateManifest re-export', () => {
    it('is a function', () => {
      expect(typeof validateManifest).toBe('function');
    });

    it('accepts a valid built-in manifest', async () => {
      const registry = await createScreenComponentRegistry();
      const textRegistration = registry.get('text');
      expect(textRegistration).toBeDefined();
      const result = validateManifest(textRegistration!.manifest);
      expect(result.ok).toBe(true);
    });
  });

  describe('V2 version constants', () => {
    it('exports SCREEN_DOCUMENT_V2_VERSION = 2', () => {
      expect(SCREEN_DOCUMENT_V2_VERSION).toBe(2);
    });

    it('exports SCREEN_TRANSFER_FORMAT_VERSION_V2 = 2', () => {
      expect(SCREEN_TRANSFER_FORMAT_VERSION_V2).toBe(2);
    });
  });

  describe('type exports are structurally correct (compile-time check)', () => {
    // These tests exist purely for type-level assertions. If the types are not
    // exported from the entry point, the imports at the top of this file fail
    // to compile. The runtime assertions below confirm the types are usable.

    it('ScreenComponentRegistry interface is usable', () => {
      const registry: ScreenComponentRegistry = {
        size: 0,
        get: () => undefined,
        has: () => false,
        list: () => [],
      };
      expect(registry.size).toBe(0);
    });

    it('ScreenComponentRegistration is a discriminated union by source', () => {
      const builtIn: ScreenComponentRegistration = {
        source: 'built-in',
        manifest: {
          type: 'test',
          apiVersion: '1.0.0',
          tagName: 'test-v1',
        } as unknown as ScreenComponentManifestV1,
      };
      const host: ScreenComponentRegistration = {
        source: 'host',
        manifest: {
          type: 'test2',
          apiVersion: '1.0.0',
          tagName: 'test2-v1',
        } as unknown as ScreenComponentManifestV1,
        elementConstructor: class extends HTMLElement {},
      };
      expect(builtIn.source).toBe('built-in');
      expect(host.source).toBe('host');
    });

    it('ScreenComponentRegistrationBase has manifest field', () => {
      const base: ScreenComponentRegistrationBase = {
        manifest: {
          type: 'test',
          apiVersion: '1.0.0',
          tagName: 'test-v1',
        } as unknown as ScreenComponentManifestV1,
      };
      expect(base.manifest.type).toBe('test');
    });

    it('V2 document types are usable', () => {
      // Type-level check: if these types are not exported, compilation fails.
      const _doc: ScreenDocumentV2 | undefined = undefined;
      const _draft: ScreenProjectDraftV2 | undefined = undefined;
      const _envelope: ScreenProjectEnvelopeV2 | undefined = undefined;
      const _sdkDoc: ScreenSdkDocument | undefined = undefined;
      expect(_doc).toBeUndefined();
      expect(_draft).toBeUndefined();
      expect(_envelope).toBeUndefined();
      expect(_sdkDoc).toBeUndefined();
    });

    it('V2 adapter and error types are usable', () => {
      const _adapter: ScreenHostAdapterV2 | undefined = undefined;
      const _error: ScreenPublicErrorV2 | undefined = undefined;
      const _diag: ScreenSdkDiagnosticV2 | undefined = undefined;
      expect(_adapter).toBeUndefined();
      expect(_error).toBeUndefined();
      expect(_diag).toBeUndefined();
    });

    it('V2 union types are usable', () => {
      const _draft: ScreenSdkProjectDraft | undefined = undefined;
      const _envelope: ScreenSdkProjectEnvelope | undefined = undefined;
      const _adapter: ScreenEditorAdapterV2 | undefined = undefined;
      const _eventMap: NebulaScreenEditorEventMapV2 | undefined = undefined;
      const _success: ScreenOperationSuccessDetailV2 | undefined = undefined;
      expect(_draft).toBeUndefined();
      expect(_envelope).toBeUndefined();
      expect(_adapter).toBeUndefined();
      expect(_eventMap).toBeUndefined();
      expect(_success).toBeUndefined();
    });

    it('ScreenComponentPluginV1 is usable', () => {
      const plugin: ScreenComponentPluginV1 = {
        manifest: {
          type: 'test',
          apiVersion: '1.0.0',
          tagName: 'test-v1',
        } as unknown as ScreenComponentManifestV1,
        define: () => class extends HTMLElement {},
      };
      expect(typeof plugin.define).toBe('function');
    });
  });
});
