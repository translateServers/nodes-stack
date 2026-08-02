/**
 * Manifest Identity 校验（Spec §7.2）
 *
 * 校验 apiVersion、type、SemVer、tagName、category、默认尺寸等。
 */

import {
  SCREEN_COMPONENT_API_VERSION,
  BUILTIN_COMPONENT_TYPES,
  BUILTIN_TYPE_PREFIX,
  EXTERNAL_TYPE_PATTERN,
  TAG_NAME_PATTERN,
  SCREEN_COMPONENT_CATEGORIES,
  SCREEN_COMPONENT_ICON_TOKENS,
  type ScreenComponentManifestV1,
} from '../contracts/manifest.js';
import {
  createValidationDiagnostic,
  type ScreenComponentValidationDiagnostic,
} from '../contracts/diagnostic.js';

/**
 * SemVer 正则（简化版：MAJOR.MINOR.PATCH，可选 pre-release 和 build metadata）
 */
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * 从 type 中提取契约主版本号。
 * - 内置 type（text/bar-chart/...）返回 1（兼容保留值）
 * - 外部 type（acme.kpi/v1）返回捕获组中的数字
 * - 不合法的 type 返回 null
 */
export function extractTypeMajorVersion(type: string): number | null {
  if (BUILTIN_COMPONENT_TYPES.has(type)) return 1;
  const match = EXTERNAL_TYPE_PATTERN.exec(type);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * 从 tagName 中提取契约主版本号。
 * - nebula-text-v1 返回 1
 * - acme-kpi-v2 返回 2
 * - 不合法的 tagName 返回 null
 */
export function extractTagNameMajorVersion(tagName: string): number | null {
  const match = TAG_NAME_PATTERN.exec(tagName);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * 校验 manifest identity 字段（Spec §7.2）。
 *
 * 检查项：
 * - apiVersion 等于 SCREEN_COMPONENT_API_VERSION
 * - type 合法（内置保留值 或 外部命名空间格式）
 * - 外部 type 不使用 nebula. 前缀
 * - implementationVersion 是合法 SemVer
 * - tagName 满足 Custom Element 命名规则
 * - tagName 主版本与 type 主版本一致
 * - name 非空
 * - category 合法
 * - icon（如提供）是合法 token
 * - defaultSize 为正数
 * - order（如提供）是有限整数
 */
export function validateManifestIdentity(
  manifest: ScreenComponentManifestV1,
  diagnostics: ScreenComponentValidationDiagnostic[],
): boolean {
  let valid = true;

  // apiVersion
  const apiVersion: string = manifest.apiVersion;
  if (apiVersion !== SCREEN_COMPONENT_API_VERSION) {
    diagnostics.push(
      createValidationDiagnostic(
        'UNSUPPORTED_COMPONENT_API_VERSION',
        ['apiVersion'],
        `apiVersion 必须为 ${SCREEN_COMPONENT_API_VERSION}，实际为 ${apiVersion}`,
      ),
    );
    valid = false;
  }

  // type
  const typeMajor = extractTypeMajorVersion(manifest.type);
  if (typeMajor === null) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_COMPONENT_TYPE',
        ['type'],
        `type "${manifest.type}" 不合法：外部组件必须匹配 ${EXTERNAL_TYPE_PATTERN.source}，或使用内置保留 type`,
      ),
    );
    valid = false;
  } else if (
    !BUILTIN_COMPONENT_TYPES.has(manifest.type) &&
    manifest.type.startsWith(BUILTIN_TYPE_PREFIX)
  ) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_COMPONENT_TYPE',
        ['type'],
        `外部组件 type 不得使用内置保留前缀 "${BUILTIN_TYPE_PREFIX}"`,
      ),
    );
    valid = false;
  }

  // implementationVersion (SemVer)
  if (!SEMVER_PATTERN.test(manifest.implementationVersion)) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_IMPLEMENTATION_VERSION',
        ['implementationVersion'],
        `implementationVersion "${manifest.implementationVersion}" 不是合法 SemVer`,
      ),
    );
    valid = false;
  }

  // tagName
  const tagMajor = extractTagNameMajorVersion(manifest.tagName);
  if (tagMajor === null) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_COMPONENT_TAG_NAME',
        ['tagName'],
        `tagName "${manifest.tagName}" 不合法：必须匹配 ${TAG_NAME_PATTERN.source}`,
      ),
    );
    valid = false;
  } else if (typeMajor !== null && tagMajor !== typeMajor) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_COMPONENT_TAG_NAME',
        ['tagName'],
        `tagName 主版本 (v${tagMajor}) 必须与 type 主版本 (v${typeMajor}) 一致`,
      ),
    );
    valid = false;
  }

  // name
  if (typeof manifest.name !== 'string' || manifest.name.trim().length === 0) {
    diagnostics.push(
      createValidationDiagnostic('INVALID_COMPONENT_MANIFEST', ['name'], 'name 必须是非空字符串'),
    );
    valid = false;
  }

  // category
  if (!SCREEN_COMPONENT_CATEGORIES.includes(manifest.category)) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_COMPONENT_MANIFEST',
        ['category'],
        `category "${manifest.category}" 不在允许列表 [${SCREEN_COMPONENT_CATEGORIES.join(', ')}] 中`,
      ),
    );
    valid = false;
  }

  // icon (optional)
  if (manifest.icon !== undefined && !SCREEN_COMPONENT_ICON_TOKENS.includes(manifest.icon)) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_COMPONENT_MANIFEST',
        ['icon'],
        `icon "${manifest.icon}" 不在 SDK icon token 列表 [${SCREEN_COMPONENT_ICON_TOKENS.join(', ')}] 中`,
      ),
    );
    valid = false;
  }

  // defaultSize
  const { width, height } = manifest.defaultSize;
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_DEFAULT_SIZE',
        ['defaultSize'],
        'defaultSize.width 和 height 必须是正数',
      ),
    );
    valid = false;
  }

  // order (optional)
  if (
    manifest.order !== undefined &&
    (typeof manifest.order !== 'number' ||
      !Number.isFinite(manifest.order) ||
      !Number.isInteger(manifest.order))
  ) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_COMPONENT_MANIFEST',
        ['order'],
        'order 如提供必须是有限整数',
      ),
    );
    valid = false;
  }

  // keywords (optional)
  if (manifest.keywords !== undefined) {
    if (!Array.isArray(manifest.keywords)) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_COMPONENT_MANIFEST',
          ['keywords'],
          'keywords 必须是字符串数组',
        ),
      );
      valid = false;
    } else {
      for (let i = 0; i < manifest.keywords.length; i++) {
        if (typeof manifest.keywords[i] !== 'string') {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_COMPONENT_MANIFEST',
              ['keywords', i],
              `keywords[${i}] 必须是字符串`,
            ),
          );
          valid = false;
        }
      }
    }
  }

  return valid;
}
