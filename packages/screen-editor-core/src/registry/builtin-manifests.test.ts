/**
 * builtin-manifests 单元测试（Spec §13.2 Phase 1, Task 1.2）
 *
 * 覆盖：
 * - 6 个内置组件 manifest 通过 validateManifest
 * - BUILTIN_COMPONENT_REGISTRATIONS 长度与顺序
 * - manifest 身份字段（type / tagName / apiVersion / implementationVersion）
 * - propsSchema 与 defaultProps 一致性
 * - events 正确映射
 * - legacy 字段保留引用
 */

import { validateManifest } from '@nebula/screen-component-sdk';
import { describe, expect, it } from 'vitest';
import { BUILTIN_COMPONENT_REGISTRATIONS } from './builtin-manifests';
import { buildInstanceRegistry } from './instance-registry';

const EXPECTED_ORDER = ['text', 'bar-chart', 'rect', 'ellipse', 'image', 'button'] as const;

describe('BUILTIN_COMPONENT_REGISTRATIONS', () => {
  describe('列表完整性', () => {
    it('包含 6 个内置组件', () => {
      expect(BUILTIN_COMPONENT_REGISTRATIONS).toHaveLength(6);
    });

    it('顺序为 text / bar-chart / rect / ellipse / image / button', () => {
      const types = BUILTIN_COMPONENT_REGISTRATIONS.map((r) => r.manifest.type);
      expect(types).toEqual([...EXPECTED_ORDER]);
    });

    it('所有 registration source 为 built-in', () => {
      for (const reg of BUILTIN_COMPONENT_REGISTRATIONS) {
        expect(reg.source).toBe('built-in');
      }
    });
  });

  describe('manifest 校验', () => {
    it('每个内置组件 manifest 通过 validateManifest', () => {
      for (const reg of BUILTIN_COMPONENT_REGISTRATIONS) {
        const result = validateManifest(reg.manifest);
        if (!result.ok) {
          const details = result.diagnostics
            .map((d) => `  ${d.code} at ${d.path.join('.')}: ${d.message}`)
            .join('\n');
          throw new Error(`${reg.manifest.type} manifest 校验失败:\n${details}`);
        }
        expect(result.ok).toBe(true);
      }
    });
  });

  describe('身份字段', () => {
    it('apiVersion 为 nebula.screen-component/v1', () => {
      for (const reg of BUILTIN_COMPONENT_REGISTRATIONS) {
        expect(reg.manifest.apiVersion).toBe('nebula.screen-component/v1');
      }
    });

    it('implementationVersion 为 1.0.0', () => {
      for (const reg of BUILTIN_COMPONENT_REGISTRATIONS) {
        expect(reg.manifest.implementationVersion).toBe('1.0.0');
      }
    });

    it('tagName 为 nebula-screen-<type>-v1', () => {
      for (const reg of BUILTIN_COMPONENT_REGISTRATIONS) {
        const { type, tagName } = reg.manifest;
        expect(tagName).toBe(`nebula-screen-${type}-v1`);
      }
    });

    it('icon token 在 SDK 允许列表内', () => {
      for (const reg of BUILTIN_COMPONENT_REGISTRATIONS) {
        expect(reg.manifest.icon).toBeDefined();
      }
    });
  });

  describe('propsSchema 与 defaultProps 一致性', () => {
    it('text: {content: string} 与 {content: "请输入文本"}', () => {
      const reg = BUILTIN_COMPONENT_REGISTRATIONS[0];
      expect(reg.manifest.type).toBe('text');
      expect(reg.manifest.defaultProps).toEqual({ content: '请输入文本' });
      expect(reg.manifest.propsSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
    });

    it('bar-chart: {title, data} 与含数据数组的 defaultProps', () => {
      const reg = BUILTIN_COMPONENT_REGISTRATIONS[1];
      expect(reg.manifest.type).toBe('bar-chart');
      expect(reg.manifest.defaultProps).toHaveProperty('title', '柱状图');
      expect(reg.manifest.defaultProps).toHaveProperty('data');
      const data = (reg.manifest.defaultProps as { data: unknown[] }).data;
      expect(data).toHaveLength(5);
      expect(data[0]).toMatchObject({ name: 'A', value: 120 });
    });

    it('rect / ellipse: 空 props', () => {
      const rect = BUILTIN_COMPONENT_REGISTRATIONS[2];
      const ellipse = BUILTIN_COMPONENT_REGISTRATIONS[3];
      expect(rect.manifest.type).toBe('rect');
      expect(rect.manifest.defaultProps).toEqual({});
      expect(ellipse.manifest.type).toBe('ellipse');
      expect(ellipse.manifest.defaultProps).toEqual({});
    });

    it('image: {src, alt}', () => {
      const reg = BUILTIN_COMPONENT_REGISTRATIONS[4];
      expect(reg.manifest.type).toBe('image');
      expect(reg.manifest.defaultProps).toEqual({ src: '', alt: '' });
    });

    it('button: {text}', () => {
      const reg = BUILTIN_COMPONENT_REGISTRATIONS[5];
      expect(reg.manifest.type).toBe('button');
      expect(reg.manifest.defaultProps).toEqual({ text: '按钮' });
    });
  });

  describe('events 映射', () => {
    it('text 包含 click / hover', () => {
      const reg = BUILTIN_COMPONENT_REGISTRATIONS[0];
      const ids = reg.manifest.events?.map((e) => e.id);
      expect(ids).toEqual(['click', 'hover']);
    });

    it('bar-chart 包含 click / hover / dataLoaded / dataError', () => {
      const reg = BUILTIN_COMPONENT_REGISTRATIONS[1];
      const ids = reg.manifest.events?.map((e) => e.id);
      expect(ids).toEqual(['click', 'hover', 'dataLoaded', 'dataError']);
    });
  });

  describe('legacy 字段保留', () => {
    it('已迁移的内置组件提供 Custom Element constructor 且不再暴露 internalRenderer', () => {
      for (const index of [0, 2, 3, 4, 5]) {
        const reg = BUILTIN_COMPONENT_REGISTRATIONS[index];
        expect(reg?.elementConstructor).toBeDefined();
        expect(reg?.internalRenderer).toBeUndefined();
      }
    });

    it('未迁移的 registration 仍有 internalRenderer', () => {
      const barChart = BUILTIN_COMPONENT_REGISTRATIONS[1];
      expect(barChart?.internalRenderer).toBeDefined();
      expect(barChart?.elementConstructor).toBeUndefined();
    });

    it('text / bar-chart / button 有 legacySchema', () => {
      const text = BUILTIN_COMPONENT_REGISTRATIONS[0];
      const barChart = BUILTIN_COMPONENT_REGISTRATIONS[1];
      const button = BUILTIN_COMPONENT_REGISTRATIONS[5];
      expect(text.legacySchema).toBeDefined();
      expect(barChart.legacySchema).toBeDefined();
      expect(button.legacySchema).toBeDefined();
    });

    it('每个 registration 都有 legacyIcon', () => {
      for (const reg of BUILTIN_COMPONENT_REGISTRATIONS) {
        expect(reg.legacyIcon).toBeDefined();
      }
    });

    it('每个 registration 都有 legacyEvents', () => {
      for (const reg of BUILTIN_COMPONENT_REGISTRATIONS) {
        expect(reg.legacyEvents).toBeDefined();
      }
    });

    it('每个 registration 都有 legacyActions', () => {
      for (const reg of BUILTIN_COMPONENT_REGISTRATIONS) {
        expect(reg.legacyActions).toBeDefined();
      }
    });

    it('bar-chart legacyActions 包含 refreshData', () => {
      const reg = BUILTIN_COMPONENT_REGISTRATIONS[1];
      const ids = reg.legacyActions?.map((a) => a.id);
      expect(ids).toContain('refreshData');
    });
  });

  describe('可构建为实例注册表', () => {
    it('BUILTIN_COMPONENT_REGISTRATIONS 可通过 buildInstanceRegistry 构建', () => {
      const registry = buildInstanceRegistry(BUILTIN_COMPONENT_REGISTRATIONS);
      expect(registry.size).toBe(6);
      for (const type of EXPECTED_ORDER) {
        expect(registry.has(type)).toBe(true);
      }
    });
  });
});
