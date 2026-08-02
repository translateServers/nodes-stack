/**
 * registry-factory 单元测试（Spec §8.1 + §8.2 + §8.3 + §13.2 Phase 2, Task 2.1）
 *
 * 覆盖：
 * - 空选项：返回仅含 6 个内置组件的 registry
 * - 单个 host plugin：自动合并到内置组件之后
 * - 多个 host plugin：保持注册顺序
 * - manifest 校验失败：原子 reject，不返回部分 registry
 * - apiVersion 不匹配：reject 为 UNSUPPORTED_COMPONENT_API_VERSION
 * - plugin.define() 抛错：reject 为 COMPONENT_DEFINE_FAILED
 * - plugin.define() 返回非函数：reject 为 COMPONENT_DEFINE_FAILED
 * - 重复 type（host vs built-in / host vs host）：reject 为 DUPLICATE_COMPONENT_TYPE
 * - 重复 tagName：reject 为 DUPLICATE_COMPONENT_TAG_NAME
 * - 构造器与 customElements.get 不一致：reject 为 DUPLICATE_COMPONENT_TAG_NAME
 * - 幂等 define()：同一 plugin 多次构造 registry 返回同一构造器
 * - manifest 深拷贝：外部修改不影响已构建 registry 快照
 * - isScreenComponentRegistryError 类型守卫
 *
 * 测试隔离说明（Spec §8.4）：
 * - customElements 是 Document 全局能力，jsdom 不会在测试间重置 document
 * - 因此每个测试使用唯一 type/tagName 避免跨测试污染
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createScreenComponentRegistry,
  isScreenComponentRegistryError,
  ScreenComponentRegistryErrorImpl,
  type ScreenComponentRegistryError,
} from './registry-factory';
import type {
  ScreenComponentManifestV1,
  ScreenComponentPluginV1,
} from '@nebula/screen-component-sdk';

const SCREEN_COMPONENT_API_VERSION = 'nebula.screen-component/v1' as const;

/**
 * 内置组件 type 列表（用于断言自动合并行为）。
 */
const BUILTIN_TYPES = ['text', 'bar-chart', 'rect', 'ellipse', 'image', 'button'] as const;

/**
 * 全局测试 ID 计数器，用于生成唯一 type/tagName。
 *
 * 由于 customElements 是 Document 全局能力且 jsdom 不在测试间重置 document，
 * 每个测试必须使用唯一 tagName 避免跨测试构造器冲突。
 */
let testIdCounter = 0;

/**
 * 生成唯一测试 ID（每调用一次自增）。
 */
function nextTestId(): string {
  testIdCounter += 1;
  return testIdCounter.toString(36).padStart(3, '0');
}

/**
 * 构造最小合法外部组件 manifest，使用唯一 type/tagName。
 *
 * @param overrides 覆盖字段（type/tagName 默认生成唯一值）
 * @param namespace type/tagName 命名空间前缀，默认 'acme'
 */
function makeHostManifest(
  overrides: Partial<ScreenComponentManifestV1>,
  namespace = 'acme',
): ScreenComponentManifestV1 {
  const id = nextTestId();
  const defaultType = `${namespace}.kpi${id}/v1`;
  const defaultTagName = `${namespace}-kpi${id}-v1`;
  return {
    apiVersion: SCREEN_COMPONENT_API_VERSION,
    type: defaultType,
    implementationVersion: '1.0.0',
    tagName: defaultTagName,
    name: '指标卡',
    category: 'chart',
    icon: 'chart',
    description: '测试指标卡',
    keywords: ['kpi', '指标'],
    order: 0,
    defaultSize: { width: 320, height: 180 },
    defaultProps: { title: '指标', value: 0, color: '#ffffff' },
    propsSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', title: '标题' },
        value: { type: 'number', title: '数值', minimum: 0 },
        color: { type: 'string', title: '颜色', pattern: '^#[0-9a-fA-F]{6}$' },
      },
      required: ['title', 'value', 'color'],
    },
    ...overrides,
  };
}

/**
 * 构造最小合法 host plugin。
 *
 * `defineImpl` 可注入自定义 define 行为（抛错、返回非函数、返回不同构造器等）。
 * 默认实现：首次调用创建 class 并缓存，后续调用返回同一引用（幂等，Spec §7.6）。
 */
function makeHostPlugin(
  manifestOverrides?: Partial<ScreenComponentManifestV1>,
  defineImpl?: () => CustomElementConstructor | Promise<CustomElementConstructor>,
  namespace = 'acme',
): ScreenComponentPluginV1 {
  const manifest = makeHostManifest(manifestOverrides ?? {}, namespace);
  const fallbackImpl = () => {
    class TestKpiElement extends HTMLElement {}
    return TestKpiElement;
  };
  const impl = defineImpl ?? fallbackImpl;

  // 缓存保证默认 define 幂等：同一 plugin 多次调用返回同一构造器
  let cached: CustomElementConstructor | undefined;
  let cachedPromise: Promise<CustomElementConstructor> | undefined;
  return {
    manifest,
    define: () => {
      if (cached !== undefined) return cached;
      const result = impl();
      if (result instanceof Promise) {
        if (cachedPromise === undefined) {
          cachedPromise = result.then((c) => {
            cached = c;
            return c;
          });
        }
        return cachedPromise;
      }
      cached = result;
      return result;
    },
  };
}

describe('createScreenComponentRegistry', () => {
  describe('自动合并内置组件', () => {
    it('空选项返回仅含 6 个内置组件的 registry', async () => {
      const registry = await createScreenComponentRegistry();

      expect(registry.size).toBe(6);
      for (const type of BUILTIN_TYPES) {
        expect(registry.has(type)).toBe(true);
        const reg = registry.get(type);
        expect(reg?.source).toBe('built-in');
      }
    });

    it('undefined options 返回 6 个内置组件', async () => {
      const registry = await createScreenComponentRegistry(undefined);
      expect(registry.size).toBe(6);
    });

    it('空 components 数组返回 6 个内置组件', async () => {
      const registry = await createScreenComponentRegistry({ components: [] });
      expect(registry.size).toBe(6);
    });
  });

  describe('host plugin 合并', () => {
    it('单个 host plugin 合并到内置组件之后', async () => {
      const plugin = makeHostPlugin();
      const registry = await createScreenComponentRegistry({ components: [plugin] });

      expect(registry.size).toBe(7);
      const hostType = plugin.manifest.type;
      expect(registry.has(hostType)).toBe(true);

      const hostReg = registry.get(hostType);
      expect(hostReg?.source).toBe('host');
      if (hostReg?.source === 'host') {
        expect(hostReg.elementConstructor).toBeDefined();
        expect(typeof hostReg.elementConstructor).toBe('function');
      }

      // 内置组件仍在
      for (const type of BUILTIN_TYPES) {
        expect(registry.has(type)).toBe(true);
      }
    });

    it('多个 host plugin 保持注册顺序', async () => {
      const pluginA = makeHostPlugin({ name: 'A 组件' });
      const pluginB = makeHostPlugin({ name: 'B 组件' });
      const pluginC = makeHostPlugin({ name: 'C 组件' });

      const registry = await createScreenComponentRegistry({
        components: [pluginA, pluginB, pluginC],
      });

      expect(registry.size).toBe(9);
      const hostTypes = registry
        .list()
        .slice(6) // 跳过 6 个内置
        .map((r) => r.manifest.type);
      expect(hostTypes).toEqual([
        pluginA.manifest.type,
        pluginB.manifest.type,
        pluginC.manifest.type,
      ]);
    });

    it('host registration 的 manifest 是深拷贝，外部修改不影响快照', async () => {
      const plugin = makeHostPlugin();
      const registry = await createScreenComponentRegistry({ components: [plugin] });

      const hostType = plugin.manifest.type;
      const beforeReg = registry.get(hostType);
      const beforeName = beforeReg?.manifest.name;

      // 修改原始 plugin 的 manifest（defaultProps 是 Readonly，需 cast 为 mutable 才能修改）
      plugin.manifest.name = '已修改的名称';
      (plugin.manifest.defaultProps as Record<string, unknown>).title = '被篡改';

      const afterReg = registry.get(hostType);
      expect(afterReg?.manifest.name).toBe(beforeName);
      expect(afterReg?.manifest.defaultProps.title).toBe('指标');
    });
  });

  describe('manifest 校验失败（Spec §3.4 Fail Closed）', () => {
    it('非法 type 拒绝为 INVALID_COMPONENT_MANIFEST', async () => {
      const plugin = makeHostPlugin({
        // 缺少命名空间和版本号
        type: 'invalid-type',
        tagName: 'invalid-tag-v1',
      });

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'INVALID_COMPONENT_MANIFEST',
      });
    });

    it('apiVersion 不匹配拒绝为 UNSUPPORTED_COMPONENT_API_VERSION', async () => {
      const plugin = makeHostPlugin({
        apiVersion: 'nebula.screen-component/v2' as typeof SCREEN_COMPONENT_API_VERSION,
      });

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'UNSUPPORTED_COMPONENT_API_VERSION',
      });
    });

    it('非法 tagName 主版本拒绝为 INVALID_COMPONENT_MANIFEST', async () => {
      const plugin = makeHostPlugin({
        tagName: 'acme-kpi', // 缺少 -v1 后缀
      });

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'INVALID_COMPONENT_MANIFEST',
      });
    });

    it('type 与 tagName 主版本不一致拒绝为 INVALID_COMPONENT_MANIFEST', async () => {
      const plugin = makeHostPlugin({
        // 让 type 和 tagName 主版本不一致
      });
      // 手动构造不一致的主版本
      plugin.manifest.tagName = plugin.manifest.type.replace(/(\w+)\.(\w+)(\w*)\/v1/, '$1-$2$3-v2');

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'INVALID_COMPONENT_MANIFEST',
      });
    });

    it('外部 type 使用 nebula. 前缀拒绝为 INVALID_COMPONENT_MANIFEST', async () => {
      const plugin = makeHostPlugin(
        {
          type: 'nebula.kpi/v1',
          tagName: 'nebula-kpi-v1',
        },
        undefined,
        // 不使用默认 'acme' namespace 避免被覆盖
      );

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'INVALID_COMPONENT_MANIFEST',
      });
    });

    it('manifest 校验失败时不返回部分 registry', async () => {
      const goodPlugin = makeHostPlugin({ name: 'Good' });
      const badPlugin = makeHostPlugin({
        apiVersion: 'nebula.screen-component/v2' as typeof SCREEN_COMPONENT_API_VERSION,
      });

      await expect(
        createScreenComponentRegistry({ components: [goodPlugin, badPlugin] }),
      ).rejects.toBeInstanceOf(ScreenComponentRegistryErrorImpl);

      // 预检在任何 define/customElements 副作用前完成。
      expect(customElements.get(goodPlugin.manifest.tagName)).toBeUndefined();
      // 重试时 goodPlugin 正常进入 define/commit 阶段。
      const registry = await createScreenComponentRegistry({ components: [goodPlugin] });
      expect(registry.has(goodPlugin.manifest.type)).toBe(true);
    });

    it('manifest 校验失败映射为安全 V2 diagnostics', async () => {
      const plugin = makeHostPlugin({
        apiVersion: 'nebula.screen-component/v2' as typeof SCREEN_COMPONENT_API_VERSION,
      });

      try {
        await createScreenComponentRegistry({ components: [plugin] });
      } catch (err) {
        expect(isScreenComponentRegistryError(err)).toBe(true);
        if (isScreenComponentRegistryError(err)) {
          expect(err.diagnostics.length).toBeGreaterThan(0);
          expect(err.diagnostics.some((d) => d.code === 'UNSUPPORTED_COMPONENT_API_VERSION')).toBe(
            true,
          );
          expect(err.diagnostics).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                severity: 'error',
                message: '组件 API 版本不受支持。',
              }),
            ]),
          );
          expect(JSON.stringify(err.diagnostics)).not.toContain('nebula.screen-component/v2');
        }
      }
    });
  });

  describe('plugin.define() 失败', () => {
    it('plugin.define() 抛错拒绝为 COMPONENT_DEFINE_FAILED', async () => {
      const plugin = makeHostPlugin({}, () => {
        throw new Error('define boom');
      });

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'COMPONENT_DEFINE_FAILED',
      });
    });

    it('plugin.define() reject 拒绝为 COMPONENT_DEFINE_FAILED', async () => {
      const plugin = makeHostPlugin({}, () => Promise.reject(new Error('async define boom')));

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'COMPONENT_DEFINE_FAILED',
      });
    });

    it('plugin.define() 返回非函数拒绝为 COMPONENT_DEFINE_FAILED', async () => {
      const plugin: ScreenComponentPluginV1 = {
        manifest: makeHostManifest({}),
        // 故意返回非函数（type system 上不合法，但运行时需检测）
        define: () => 'not-a-constructor' as unknown as CustomElementConstructor,
      };

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'COMPONENT_DEFINE_FAILED',
      });
    });

    it('plugin.define() 抛错时不返回部分 registry', async () => {
      const goodPlugin = makeHostPlugin({ name: 'Good' });
      const badPlugin = makeHostPlugin({ name: 'Bad' }, () => {
        throw new Error('bad define');
      });

      await expect(
        createScreenComponentRegistry({ components: [goodPlugin, badPlugin] }),
      ).rejects.toMatchObject({ code: 'COMPONENT_DEFINE_FAILED' });
      expect(customElements.get(goodPlugin.manifest.tagName)).toBeUndefined();
    });
  });

  describe('重复检测（Spec §8.3）', () => {
    it('host type 与内置 type 重复拒绝为 DUPLICATE_COMPONENT_TYPE', async () => {
      const plugin = makeHostPlugin({
        type: 'text', // 与内置重复
        tagName: 'acme-text-override-v1',
      });

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'DUPLICATE_COMPONENT_TYPE',
      });
    });

    it('两个 host plugin 使用相同 type 拒绝为 DUPLICATE_COMPONENT_TYPE', async () => {
      // 构造两个不同 plugin 但相同 type：先建第一个，然后复制其 type/tagName 到第二个
      const pluginA = makeHostPlugin({ name: 'Dup A' });
      const pluginB = makeHostPlugin({
        type: pluginA.manifest.type, // 重复 type
        name: 'Dup B',
      });
      // 注意：pluginB 的 tagName 由 makeHostManifest 生成唯一值，避免 tagName 先冲突
      // 但 pluginB 的 type 主版本与 tagName 主版本需要一致
      // 这里 pluginA type=v1, pluginB tagName 也是 v1，主版本一致，校验通过到重复 type 检测

      await expect(
        createScreenComponentRegistry({ components: [pluginA, pluginB] }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_COMPONENT_TYPE' });
    });

    it('host tagName 与内置 tagName 重复拒绝为 DUPLICATE_COMPONENT_TAG_NAME', async () => {
      const plugin = makeHostPlugin({
        tagName: 'nebula-screen-text-v1', // 与内置 text 重复
      });
      // 修正 type 主版本与 tagName 主版本一致（都是 v1）
      plugin.manifest.type = 'acme.text/v1';

      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'DUPLICATE_COMPONENT_TAG_NAME',
      });
    });

    it('两个 host plugin 使用相同 tagName 拒绝为 DUPLICATE_COMPONENT_TAG_NAME', async () => {
      // 让两个 plugin 共享相同 tagName：先建第一个，复制其 tagName 到第二个
      const pluginA = makeHostPlugin({ name: 'A' });
      const pluginB = makeHostPlugin({
        tagName: pluginA.manifest.tagName, // 重复 tagName
        name: 'B',
      });

      await expect(
        createScreenComponentRegistry({ components: [pluginA, pluginB] }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_COMPONENT_TAG_NAME' });
    });
  });

  describe('构造器一致性（Spec §7.6 + §8.3 + §8.4）', () => {
    it('plugin.define() 非幂等（每次返回新构造器）拒绝为 DUPLICATE_COMPONENT_TAG_NAME', async () => {
      // 构造非幂等 plugin：每次 define 都创建新 class
      // 首次 define 创建 class A 并 customElements.define
      // 第二次 registry 构造时 define 创建 class B，customElements.get 返回 A，B !== A
      const manifest = makeHostManifest({});
      const plugin: ScreenComponentPluginV1 = {
        manifest,
        define: () => {
          class FreshElement extends HTMLElement {}
          return FreshElement;
        },
      };

      // 首次成功（customElements.define 第一次调用）
      const registry1 = await createScreenComponentRegistry({ components: [plugin] });
      expect(registry1.has(manifest.type)).toBe(true);

      // 第二次失败：define 返回新构造器，与 customElements.get 不一致
      await expect(createScreenComponentRegistry({ components: [plugin] })).rejects.toMatchObject({
        code: 'DUPLICATE_COMPONENT_TAG_NAME',
      });
    });

    it('plugin.define() 幂等时多次构造 registry 返回同一构造器', async () => {
      const plugin = makeHostPlugin(); // 默认 define 幂等（缓存）

      const registry1 = await createScreenComponentRegistry({ components: [plugin] });
      const registry2 = await createScreenComponentRegistry({ components: [plugin] });

      const hostType = plugin.manifest.type;
      const reg1 = registry1.get(hostType);
      const reg2 = registry2.get(hostType);
      expect(reg1?.source).toBe('host');
      expect(reg2?.source).toBe('host');
      if (reg1?.source === 'host' && reg2?.source === 'host') {
        expect(reg1.elementConstructor).toBe(reg2.elementConstructor);
      }
    });

    it('并发构造 registry 时串行复用同一个全局 Custom Element 定义', async () => {
      const plugin = makeHostPlugin();

      const [registryA, registryB] = await Promise.all([
        createScreenComponentRegistry({ components: [plugin] }),
        createScreenComponentRegistry({ components: [plugin] }),
      ]);

      const registrationA = registryA.get(plugin.manifest.type);
      const registrationB = registryB.get(plugin.manifest.type);
      expect(registrationA?.source).toBe('host');
      expect(registrationB?.source).toBe('host');
      if (registrationA?.source === 'host' && registrationB?.source === 'host') {
        expect(registrationA.elementConstructor).toBe(registrationB.elementConstructor);
      }
      expect(customElements.get(plugin.manifest.tagName)).toBe(registrationA?.elementConstructor);
    });

    it('不同 host plugin 使用相同 tagName 但不同构造器拒绝', async () => {
      // 先用 plugin A 定义某 tagName
      // 再用 plugin B 试图用同一 tagName 但不同构造器 → 拒绝
      const pluginA = makeHostPlugin({ name: 'A' });
      const sharedTagName = pluginA.manifest.tagName;
      const sharedTypeMajor = 'v1';

      const pluginB: ScreenComponentPluginV1 = {
        manifest: makeHostManifest({
          type: `acme.b${nextTestId()}/${sharedTypeMajor}`,
          tagName: sharedTagName, // 同 tagName
          name: 'B',
        }),
        define: () => {
          // 不同构造器
          class DifferentElement extends HTMLElement {}
          return DifferentElement;
        },
      };

      await expect(
        createScreenComponentRegistry({ components: [pluginA, pluginB] }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_COMPONENT_TAG_NAME' });
    });
  });

  describe('原子性与失败处理（Spec §3.4 Fail Closed）', () => {
    it('失败时不返回部分 registry', async () => {
      const badPlugin = makeHostPlugin({
        apiVersion: 'nebula.screen-component/v2' as typeof SCREEN_COMPONENT_API_VERSION,
      });

      // reject 时 Promise 不会 resolve，因此没有部分 registry
      const promise = createScreenComponentRegistry({ components: [badPlugin] });
      await expect(promise).rejects.toBeInstanceOf(ScreenComponentRegistryErrorImpl);
    });

    it('manifest 预检失败时不产生 customElements 副作用', async () => {
      // plugin B manifest 非法 → plugin A 不会进入 define 或 customElements.define。
      const pluginA = makeHostPlugin({ name: 'A' });
      const pluginB = makeHostPlugin({
        name: 'B',
        apiVersion: 'nebula.screen-component/v2' as typeof SCREEN_COMPONENT_API_VERSION,
      });

      await expect(
        createScreenComponentRegistry({ components: [pluginA, pluginB] }),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_COMPONENT_API_VERSION' });

      expect(customElements.get(pluginA.manifest.tagName)).toBeUndefined();
    });
  });

  describe('isScreenComponentRegistryError 类型守卫', () => {
    it('ScreenComponentRegistryErrorImpl 实例被识别', async () => {
      const plugin = makeHostPlugin({
        apiVersion: 'nebula.screen-component/v2' as typeof SCREEN_COMPONENT_API_VERSION,
      });

      try {
        await createScreenComponentRegistry({ components: [plugin] });
      } catch (err) {
        expect(isScreenComponentRegistryError(err)).toBe(true);
        if (isScreenComponentRegistryError(err)) {
          expect(err.code).toBe('UNSUPPORTED_COMPONENT_API_VERSION');
          expect(err.name).toBe('ScreenComponentRegistryError');
          expect(err.message).toContain(plugin.manifest.type);
          expect(err.diagnostics).toBeInstanceOf(Array);
        }
      }
    });

    it('普通 Error 不被识别', () => {
      const err = new Error('plain error');
      expect(isScreenComponentRegistryError(err)).toBe(false);
    });

    it('非 Error 值不被识别', () => {
      expect(isScreenComponentRegistryError(null)).toBe(false);
      expect(isScreenComponentRegistryError(undefined)).toBe(false);
      expect(isScreenComponentRegistryError('string')).toBe(false);
      expect(isScreenComponentRegistryError({ code: 'INVALID_COMPONENT_MANIFEST' })).toBe(false);
    });

    it('reject 后宿主可安全收窄错误类型', async () => {
      const plugin = makeHostPlugin({}, () => {
        throw new Error('define failed');
      });

      const caught: ScreenComponentRegistryError | null = await createScreenComponentRegistry({
        components: [plugin],
      }).then(
        () => null,
        (err) => (isScreenComponentRegistryError(err) ? err : null),
      );

      expect(caught).not.toBeNull();
      expect(caught?.code).toBe('COMPONENT_DEFINE_FAILED');
    });
  });

  describe('错误诊断脱敏（Spec §8.2 安全约束）', () => {
    it('错误消息包含 type 但不包含完整 manifest 源码', async () => {
      const plugin = makeHostPlugin({
        apiVersion: 'nebula.screen-component/v2' as typeof SCREEN_COMPONENT_API_VERSION,
      });

      try {
        await createScreenComponentRegistry({ components: [plugin] });
      } catch (err) {
        expect(isScreenComponentRegistryError(err)).toBe(true);
        if (isScreenComponentRegistryError(err)) {
          // type 出现在错误消息中
          expect(err.message).toContain(plugin.manifest.type);
          // diagnostics 不包含 manifest 完整对象
          for (const d of err.diagnostics) {
            expect(d).not.toHaveProperty('manifest');
            expect(d).not.toHaveProperty('defaultProps');
          }
        }
      }
    });
  });

  describe('define() 调用次数', () => {
    it('同一 plugin 只调用一次 define（缓存生效）', async () => {
      const defineSpy = vi.fn(() => {
        class SpyElement extends HTMLElement {}
        return SpyElement;
      });
      const plugin: ScreenComponentPluginV1 = {
        manifest: makeHostManifest({}),
        define: () => {
          const result = defineSpy();
          return result;
        },
      };

      await createScreenComponentRegistry({ components: [plugin] });

      expect(defineSpy).toHaveBeenCalledTimes(1);
    });

    it('不同 plugin 各自调用 define', async () => {
      const spyA = vi.fn(() => {
        class A extends HTMLElement {}
        return A;
      });
      const spyB = vi.fn(() => {
        class B extends HTMLElement {}
        return B;
      });

      await createScreenComponentRegistry({
        components: [
          {
            manifest: makeHostManifest({ name: 'A' }),
            define: spyA,
          },
          {
            manifest: makeHostManifest({ name: 'B' }),
            define: spyB,
          },
        ],
      });

      expect(spyA).toHaveBeenCalledTimes(1);
      expect(spyB).toHaveBeenCalledTimes(1);
    });
  });
});
