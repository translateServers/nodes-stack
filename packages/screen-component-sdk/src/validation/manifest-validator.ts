/**
 * Manifest 纯校验入口（Spec §7, Task 0.3）
 *
 * 编排 identity、JSON 边界、propsSchema、propertyPanel 和 events 校验。
 * 输出稳定 diagnostics，不定义 Custom Element。
 */

import type { ScreenComponentManifest } from '../contracts/manifest.js';
import {
  type ScreenComponentValidationResult,
  type ScreenComponentValidationDiagnostic,
  errorResult,
  okResult,
} from '../contracts/diagnostic.js';
import { checkJsonProps } from './json-boundary.js';
import { validateManifestIdentity } from './identity.js';
import { validatePropsSchema } from './props-schema.js';
import { validatePropertyPanel } from './property-panel.js';
import { validateEvents } from './events.js';

/**
 * 校验 manifest 的所有契约字段。
 *
 * 不定义 Custom Element，不扫描 DOM，不发请求。
 * 任一字段非法时返回 ok=false 和对应 diagnostics。
 */
export function validateManifest(
  manifest: ScreenComponentManifest,
): ScreenComponentValidationResult {
  const diagnostics: ScreenComponentValidationDiagnostic[] = [];

  // 1. JSON 边界检查（defaultProps / propsSchema 必须是合法 JSON 值）
  checkJsonProps(manifest.defaultProps, ['defaultProps'], diagnostics);
  checkJsonProps(manifest.propsSchema, ['propsSchema'], diagnostics);

  // 2. Identity 校验
  validateManifestIdentity(manifest, diagnostics);

  // 3. propsSchema 校验（只在 JSON 边界通过时进行深度校验）
  validatePropsSchema(manifest, diagnostics);

  // 4. propertyPanel 校验（依赖 propsSchema 已声明属性）
  validatePropertyPanel(manifest, diagnostics);

  // 5. events 校验
  validateEvents(manifest, diagnostics);

  if (diagnostics.length > 0) {
    return errorResult(diagnostics);
  }
  return okResult();
}
