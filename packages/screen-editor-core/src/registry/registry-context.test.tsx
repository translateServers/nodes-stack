/**
 * registry-context 单元测试（Spec §13.2 Phase 1, Task 1.3）
 *
 * 覆盖：
 * - RegistryProvider 注入 registry
 * - useRegistry 在 Provider 内可读取
 * - useRegistry 在 Provider 外抛错
 * - useOptionalRegistry 在 Provider 外返回 null
 * - 默认 registry（未传 prop）非空且包含内置组件
 * - 两个 Provider 注入不同 registry 实现隔离
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import type { ScreenComponentManifestV1 } from '@nebula/screen-component-sdk';
import { buildInstanceRegistry, type ScreenComponentRegistration } from './instance-registry';
import {
  DEFAULT_BUILTIN_REGISTRY,
  RegistryProvider,
  useOptionalRegistry,
  useRegistry,
} from './registry-context';

function makeManifest(type: string, tagName: string): ScreenComponentManifestV1 {
  return {
    apiVersion: 'nebula.screen-component/v1',
    type,
    implementationVersion: '1.0.0',
    tagName,
    name: type,
    category: 'text',
    defaultSize: { width: 100, height: 100 },
    defaultProps: {},
    propsSchema: { type: 'object', additionalProperties: false },
  };
}

function makeBuiltIn(manifest: ScreenComponentManifestV1): ScreenComponentRegistration {
  return { source: 'built-in', manifest };
}

function createWrapper(
  registry?: ReturnType<typeof buildInstanceRegistry>,
): (props: { children: ReactNode }) => React.JSX.Element {
  return ({ children }: { children: ReactNode }) => (
    <RegistryProvider registry={registry}>{children}</RegistryProvider>
  );
}

describe('registry-context', () => {
  describe('DEFAULT_BUILTIN_REGISTRY', () => {
    it('包含 6 个内置组件', () => {
      expect(DEFAULT_BUILTIN_REGISTRY.size).toBe(6);
    });

    it('包含 text 组件', () => {
      expect(DEFAULT_BUILTIN_REGISTRY.has('text')).toBe(true);
    });
  });

  describe('useRegistry', () => {
    it('在 RegistryProvider 内返回注入的 registry', () => {
      const custom = buildInstanceRegistry([
        makeBuiltIn(makeManifest('acme.kpi/v1', 'acme-kpi-v1')),
      ]);
      const { result } = renderHook(() => useRegistry(), { wrapper: createWrapper(custom) });
      expect(result.current).toBe(custom);
    });

    it('未传 registry prop 时返回 DEFAULT_BUILTIN_REGISTRY', () => {
      const { result } = renderHook(() => useRegistry(), { wrapper: createWrapper(undefined) });
      expect(result.current).toBe(DEFAULT_BUILTIN_REGISTRY);
    });

    it('在 RegistryProvider 外抛错', () => {
      expect(() => renderHook(() => useRegistry())).toThrow(
        'useRegistry must be used within RegistryProvider',
      );
    });
  });

  describe('useOptionalRegistry', () => {
    it('在 RegistryProvider 内返回注入的 registry', () => {
      const custom = buildInstanceRegistry([
        makeBuiltIn(makeManifest('acme.kpi/v1', 'acme-kpi-v1')),
      ]);
      const { result } = renderHook(() => useOptionalRegistry(), {
        wrapper: createWrapper(custom),
      });
      expect(result.current).toBe(custom);
    });

    it('在 RegistryProvider 外返回 null', () => {
      const { result } = renderHook(() => useOptionalRegistry());
      expect(result.current).toBeNull();
    });
  });

  describe('Instance Isolation', () => {
    it('两个 Provider 注入不同 registry 互不影响', () => {
      const registryA = buildInstanceRegistry([
        makeBuiltIn(makeManifest('acme.kpi/v1', 'acme-kpi-v1')),
      ]);
      const registryB = buildInstanceRegistry([
        makeBuiltIn(makeManifest('other.card/v1', 'other-card-v1')),
      ]);

      const { result: resultA } = renderHook(() => useRegistry(), {
        wrapper: createWrapper(registryA),
      });
      const { result: resultB } = renderHook(() => useRegistry(), {
        wrapper: createWrapper(registryB),
      });

      expect(resultA.current).toBe(registryA);
      expect(resultB.current).toBe(registryB);
      expect(resultA.current.has('acme.kpi/v1')).toBe(true);
      expect(resultA.current.has('other.card/v1')).toBe(false);
      expect(resultB.current.has('other.card/v1')).toBe(true);
      expect(resultB.current.has('acme.kpi/v1')).toBe(false);
    });
  });
});
