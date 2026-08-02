/**
 * 组件包契约测试辅助函数（Spec §18.1）
 *
 * 供组件作者和 SDK 测试使用，提供 manifest 构造辅助和断言工具。
 */

import type { ScreenComponentManifestV1 } from './contracts/manifest.js';
import type { ScreenComponentPluginV1 } from './contracts/plugin.js';
import { validateManifest } from './validation/manifest-validator.js';
import type { ScreenComponentValidationResult } from './contracts/diagnostic.js';

/**
 * 创建一个合法的最小 manifest，供测试在此基础上修改字段。
 */
export function createMinimalManifest(overrides?: {
  type?: string;
  tagName?: string;
  implementationVersion?: string;
}): ScreenComponentManifestV1 {
  return {
    apiVersion: 'nebula.screen-component/v1',
    type: overrides?.type ?? 'acme.kpi/v1',
    implementationVersion: overrides?.implementationVersion ?? '1.0.0',
    tagName: overrides?.tagName ?? 'acme-kpi-v1',
    name: '测试指标卡',
    category: 'chart',
    icon: 'chart',
    description: '测试用最小指标卡',
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
  };
}

/**
 * 创建一个合法的最小 plugin，供测试使用。
 */
export function createMinimalPlugin(
  manifestOverrides?: Parameters<typeof createMinimalManifest>[0],
  defineImpl?: () => CustomElementConstructor | Promise<CustomElementConstructor>,
): ScreenComponentPluginV1 {
  return {
    manifest: createMinimalManifest(manifestOverrides),
    define:
      defineImpl ??
      (() => {
        class TestKpiElement extends HTMLElement {}
        return TestKpiElement;
      }),
  };
}

/**
 * 断言 manifest 校验通过。
 */
export function expectManifestOk(
  manifest: ScreenComponentManifestV1,
): ScreenComponentValidationResult {
  const result = validateManifest(manifest);
  if (!result.ok) {
    throw new Error(
      `Expected manifest to be valid, but got ${result.diagnostics.length} diagnostic(s):\n` +
        result.diagnostics.map((d) => `  [${d.code}] ${d.path.join('.')}: ${d.message}`).join('\n'),
    );
  }
  return result;
}

/**
 * 断言 manifest 校验失败，并可选检查 code。
 */
export function expectManifestInvalid(
  manifest: ScreenComponentManifestV1,
  expectedCode?: string,
): ScreenComponentValidationResult {
  const result = validateManifest(manifest);
  if (result.ok) {
    throw new Error('Expected manifest to be invalid, but validation passed');
  }
  if (expectedCode !== undefined) {
    const hasCode = result.diagnostics.some((d) => d.code === expectedCode);
    if (!hasCode) {
      throw new Error(
        `Expected diagnostic code "${expectedCode}", but got:\n` +
          result.diagnostics
            .map((d) => `  [${d.code}] ${d.path.join('.')}: ${d.message}`)
            .join('\n'),
      );
    }
  }
  return result;
}
