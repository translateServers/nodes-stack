/**
 * instance-registry 单元测试（Spec §3.4 + §8.2 + §8.3）
 *
 * 覆盖：
 * - 隔离性：两个 snapshot 互不影响（Instance Isolation）
 * - 重复 type 检测：构建期抛 DUPLICATE_COMPONENT_TYPE
 * - 重复 tagName 检测：构建期抛 DUPLICATE_COMPONENT_TAG_NAME
 * - 原子性：失败时不返回部分注册表
 * - get / has / list 基础读 API
 */

import { describe, expect, it } from 'vitest';
import {
  buildInstanceRegistry,
  InstanceRegistryBuildError,
  type ScreenComponentRegistration,
} from './instance-registry';
import type { ScreenComponentManifest } from '@nebula/screen-component-sdk';

const SCREEN_COMPONENT_API_VERSION = 'nebula.screen-component/v1' as const;

/**
 * 构造最小合法 manifest。
 *
 * 默认 type/text-v1/tagName/nebula-screen-text-v1，调用方可覆盖任意字段。
 */
function makeManifest(overrides: Partial<ScreenComponentManifest>): ScreenComponentManifest {
  return {
    apiVersion: SCREEN_COMPONENT_API_VERSION,
    type: 'text',
    implementationVersion: '1.0.0',
    tagName: 'nebula-screen-text-v1',
    name: '文本',
    category: 'text',
    defaultSize: { width: 200, height: 60 },
    defaultProps: { content: '请输入文本' },
    propsSchema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      additionalProperties: false,
    },
    ...overrides,
  };
}

/**
 * 构造最小 built-in registration。
 */
function makeBuiltIn(
  manifest: ScreenComponentManifest,
  legacy?: Omit<ScreenComponentRegistration, 'source' | 'manifest'>,
): ScreenComponentRegistration {
  return {
    source: 'built-in',
    manifest,
    ...legacy,
  };
}

describe('buildInstanceRegistry', () => {
  describe('基础读 API', () => {
    it('空 registrations 返回空 registry', () => {
      const registry = buildInstanceRegistry([]);
      expect(registry.size).toBe(0);
      expect(registry.list()).toEqual([]);
      expect(registry.has('text')).toBe(false);
      expect(registry.get('text')).toBeUndefined();
    });

    it('单个 registration 正确存入并可查询', () => {
      const manifest = makeManifest({});
      const registry = buildInstanceRegistry([makeBuiltIn(manifest)]);

      expect(registry.size).toBe(1);
      expect(registry.has('text')).toBe(true);
      expect(registry.get('text')?.manifest).toEqual(manifest);
      expect(registry.get('text')?.manifest).not.toBe(manifest);
      expect(registry.list()).toHaveLength(1);
      expect(registry.list()[0]?.manifest.type).toBe('text');
    });

    it('list() 保持构建顺序（不依赖 Map 内部哈希）', () => {
      const a = makeBuiltIn(makeManifest({ type: 'text', tagName: 'nebula-screen-text-v1' }));
      const b = makeBuiltIn(
        makeManifest({
          type: 'rect',
          tagName: 'nebula-screen-rect-v1',
          name: '矩形',
          category: 'decoration',
        }),
      );
      const c = makeBuiltIn(
        makeManifest({
          type: 'image',
          tagName: 'nebula-screen-image-v1',
          name: '图片',
          category: 'media',
        }),
      );

      const registry = buildInstanceRegistry([a, b, c]);
      expect(registry.list().map((r) => r.manifest.type)).toEqual(['text', 'rect', 'image']);
    });

    it('未注册 type 返回 undefined / has=false', () => {
      const registry = buildInstanceRegistry([makeBuiltIn(makeManifest({}))]);
      expect(registry.has('unknown')).toBe(false);
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('host source 的 registration 同样可查询', () => {
      const manifest = makeManifest({
        type: 'acme.kpi/v1',
        tagName: 'acme-kpi-v1',
        name: '指标卡',
        category: 'chart',
      });
      const hostReg: ScreenComponentRegistration = {
        source: 'host',
        manifest,
        elementConstructor: class extends HTMLElement {},
      };

      const registry = buildInstanceRegistry([hostReg]);
      expect(registry.size).toBe(1);
      expect(registry.has('acme.kpi/v1')).toBe(true);
      const got = registry.get('acme.kpi/v1');
      expect(got?.source).toBe('host');
      if (got?.source === 'host') {
        expect(got.elementConstructor).toBeDefined();
      }
    });
  });

  describe('Instance Isolation（Spec §8.4）', () => {
    it('两个独立 registry 互不影响', () => {
      const textManifest = makeManifest({ type: 'text', tagName: 'nebula-screen-text-v1' });
      const kpiManifest = makeManifest({
        type: 'acme.kpi/v1',
        tagName: 'acme-kpi-v1',
        name: '指标卡',
        category: 'chart',
      });

      const registryA = buildInstanceRegistry([
        makeBuiltIn(textManifest),
        {
          source: 'host',
          manifest: kpiManifest,
          elementConstructor: class extends HTMLElement {},
        },
      ]);
      const registryB = buildInstanceRegistry([makeBuiltIn(textManifest)]);

      expect(registryA.size).toBe(2);
      expect(registryA.has('acme.kpi/v1')).toBe(true);

      expect(registryB.size).toBe(1);
      expect(registryB.has('acme.kpi/v1')).toBe(false);
      expect(registryB.has('text')).toBe(true);
    });

    it('同一 manifest 数组构造两个 registry，互不影响', () => {
      const manifest = makeManifest({});
      const registrations = [makeBuiltIn(manifest)];

      const a = buildInstanceRegistry(registrations);
      const b = buildInstanceRegistry(registrations);

      expect(a.size).toBe(1);
      expect(b.size).toBe(1);
      expect(a.get('text')).toEqual(b.get('text'));
      expect(a.get('text')).not.toBe(b.get('text'));
    });
  });

  describe('原子重复检测（Spec §3.4 + §8.3）', () => {
    it('重复 type 抛 DUPLICATE_COMPONENT_TYPE', () => {
      const a = makeBuiltIn(makeManifest({ type: 'text', tagName: 'nebula-screen-text-v1' }));
      const b = makeBuiltIn(
        makeManifest({
          type: 'text', // 重复 type
          tagName: 'nebula-screen-text-alt-v1', // 不同 tagName
          name: '另一个文本',
        }),
      );

      expect(() => buildInstanceRegistry([a, b])).toThrow(InstanceRegistryBuildError);
      try {
        buildInstanceRegistry([a, b]);
      } catch (err) {
        expect(err).toBeInstanceOf(InstanceRegistryBuildError);
        expect((err as InstanceRegistryBuildError).code).toBe('DUPLICATE_COMPONENT_TYPE');
        expect((err as Error).message).toContain('text');
      }
    });

    it('重复 tagName 抛 DUPLICATE_COMPONENT_TAG_NAME', () => {
      const a = makeBuiltIn(makeManifest({ type: 'text', tagName: 'nebula-screen-text-v1' }));
      const b = makeBuiltIn(
        makeManifest({
          type: 'text-alt', // 不同 type
          tagName: 'nebula-screen-text-v1', // 重复 tagName
          name: '另一个文本',
        }),
      );

      expect(() => buildInstanceRegistry([a, b])).toThrow(InstanceRegistryBuildError);
      try {
        buildInstanceRegistry([a, b]);
      } catch (err) {
        expect(err).toBeInstanceOf(InstanceRegistryBuildError);
        expect((err as InstanceRegistryBuildError).code).toBe('DUPLICATE_COMPONENT_TAG_NAME');
        expect((err as Error).message).toContain('nebula-screen-text-v1');
      }
    });

    it('type 与 tagName 都重复时优先报 DUPLICATE_COMPONENT_TYPE', () => {
      const a = makeBuiltIn(makeManifest({ type: 'text', tagName: 'nebula-screen-text-v1' }));
      const b = makeBuiltIn(makeManifest({ type: 'text', tagName: 'nebula-screen-text-v1' }));

      expect(() => buildInstanceRegistry([a, b])).toThrow(InstanceRegistryBuildError);
      try {
        buildInstanceRegistry([a, b]);
      } catch (err) {
        expect((err as InstanceRegistryBuildError).code).toBe('DUPLICATE_COMPONENT_TYPE');
      }
    });

    it('原子性：失败时不返回部分注册表', () => {
      // 第 4 项重复 type -> 整个构建失败
      const registrations: ScreenComponentRegistration[] = [
        makeBuiltIn(makeManifest({ type: 'text', tagName: 'nebula-screen-text-v1' })),
        makeBuiltIn(
          makeManifest({
            type: 'rect',
            tagName: 'nebula-screen-rect-v1',
            name: '矩形',
            category: 'decoration',
          }),
        ),
        makeBuiltIn(
          makeManifest({
            type: 'image',
            tagName: 'nebula-screen-image-v1',
            name: '图片',
            category: 'media',
          }),
        ),
        makeBuiltIn(
          makeManifest({
            type: 'text', // 重复 type
            tagName: 'nebula-screen-text-alt-v1',
            name: '另一个文本',
          }),
        ),
      ];

      expect(() => buildInstanceRegistry(registrations)).toThrow(InstanceRegistryBuildError);
    });

    it('重复出现在第 N 项时仍然失败', () => {
      const good = makeBuiltIn(makeManifest({ type: 'text', tagName: 'nebula-screen-text-v1' }));
      const dup = makeBuiltIn(makeManifest({ type: 'text', tagName: 'nebula-screen-text-v1' }));

      // 第 2 项重复
      expect(() => buildInstanceRegistry([good, dup])).toThrow(InstanceRegistryBuildError);
    });

    it('同一项不能在数组里出现两次（极端重复 case）', () => {
      const reg = makeBuiltIn(makeManifest({}));
      expect(() => buildInstanceRegistry([reg, reg])).toThrow(InstanceRegistryBuildError);
    });
  });

  describe('不可变性', () => {
    it('修改原始 registrations 数组不影响已构建的 registry', () => {
      const manifest = makeManifest({});
      const registrations: ScreenComponentRegistration[] = [makeBuiltIn(manifest)];

      const registry = buildInstanceRegistry(registrations);

      // 修改原数组（push 新项）
      registrations.push(
        makeBuiltIn(
          makeManifest({
            type: 'rect',
            tagName: 'nebula-screen-rect-v1',
            name: '矩形',
            category: 'decoration',
          }),
        ),
      );

      // 已构建的 registry 不受影响
      expect(registry.size).toBe(1);
      expect(registry.has('rect')).toBe(false);
    });

    it('list() 返回的快照与底层 Map 解耦', () => {
      const manifest = makeManifest({});
      const registry = buildInstanceRegistry([makeBuiltIn(manifest)]);

      const list1 = registry.list();
      const list2 = registry.list();

      // 引用稳定（同一快照），但调用方无法通过 list 修改底层
      expect(list1).toBe(list2);
      expect(list1).toHaveLength(1);
      expect(Object.isFrozen(list1)).toBe(true);
    });

    it('冻结 registration 与 manifest，并隔离原始输入对象', () => {
      const manifest = makeManifest({});
      const registry = buildInstanceRegistry([makeBuiltIn(manifest)]);
      const registration = registry.get('text');

      expect(registration).toBeDefined();
      if (registration === undefined) return;

      manifest.name = '已修改的原始 manifest';
      (manifest.defaultProps as Record<string, unknown>).content = '已修改的原始默认值';

      expect(registration.manifest.name).toBe('文本');
      expect(registration.manifest.defaultProps.content).toBe('请输入文本');
      expect(Object.isFrozen(registration)).toBe(true);
      expect(Object.isFrozen(registration.manifest)).toBe(true);
      expect(Object.isFrozen(registration.manifest.defaultProps)).toBe(true);
      expect(
        Reflect.set(registration.manifest.defaultProps, 'content', '不应写入 registry snapshot'),
      ).toBe(false);
      expect(registration.manifest.defaultProps.content).toBe('请输入文本');
    });
  });
});
