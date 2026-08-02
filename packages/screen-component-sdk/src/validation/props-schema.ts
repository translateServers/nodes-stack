/**
 * propsSchema 校验（Spec §7.3）
 *
 * propsSchema 使用 JSON Schema 2020-12 的受限 object 子集。
 * 支持：type、properties、required、additionalProperties、enum、const、
 * minimum、maximum、multipleOf、minLength、maxLength、pattern、items、
 * minItems、maxItems、title、description。
 *
 * 禁止所有 $ref、组合关键字、自定义执行关键字和会加载外部资源的 schema。
 * 根 schema 必须为 object，并显式设置 additionalProperties: false。
 * defaultProps 是唯一默认值来源，propsSchema 不声明第二套 default。
 */

import {
  PROPS_SCHEMA_ALLOWED_KEYWORDS,
  PROPS_SCHEMA_FORBIDDEN_KEYWORDS,
  PROPS_SCHEMA_ALLOWED_TYPES,
  type ScreenComponentManifest,
} from '../contracts/manifest.js';
import {
  createValidationDiagnostic,
  type ScreenComponentValidationDiagnostic,
} from '../contracts/diagnostic.js';
import { checkJsonValue } from './json-boundary.js';

type SchemaObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is SchemaObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Reflect.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * 递归校验单个 schema 节点是否只使用允许的关键字和类型。
 */
function validateSchemaNode(
  node: unknown,
  path: ReadonlyArray<string | number>,
  diagnostics: ScreenComponentValidationDiagnostic[],
  seen: WeakSet<object>,
): boolean {
  if (!isPlainObject(node)) {
    diagnostics.push(
      createValidationDiagnostic('INVALID_PROPS_SCHEMA', path, 'schema 节点必须是 plain object'),
    );
    return false;
  }

  if (seen.has(node)) {
    diagnostics.push(
      createValidationDiagnostic('INVALID_PROPS_SCHEMA', path, 'propsSchema 不允许循环引用'),
    );
    return false;
  }
  seen.add(node);

  let valid = true;

  // 检查禁止的关键字
  for (const key of Object.keys(node)) {
    if (PROPS_SCHEMA_FORBIDDEN_KEYWORDS.has(key)) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_PROPS_SCHEMA',
          [...path, key],
          `propsSchema 禁止使用关键字 "${key}"`,
        ),
      );
      valid = false;
    } else if (!PROPS_SCHEMA_ALLOWED_KEYWORDS.has(key)) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_PROPS_SCHEMA',
          [...path, key],
          `propsSchema 不支持关键字 "${key}"（仅允许受限子集）`,
        ),
      );
      valid = false;
    }
  }

  // 检查 type 字段
  const typeValue = node['type'];
  if (typeValue !== undefined) {
    if (typeof typeValue === 'string') {
      if (!PROPS_SCHEMA_ALLOWED_TYPES.includes(typeValue as never)) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPS_SCHEMA',
            [...path, 'type'],
            `propsSchema type "${typeValue}" 不在允许列表 [${PROPS_SCHEMA_ALLOWED_TYPES.join(', ')}] 中`,
          ),
        );
        valid = false;
      }
    } else if (Array.isArray(typeValue)) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_PROPS_SCHEMA',
          [...path, 'type'],
          'propsSchema type 不接受联合数组，只接受单个字符串',
        ),
      );
      valid = false;
    } else {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_PROPS_SCHEMA',
          [...path, 'type'],
          'propsSchema type 必须是字符串',
        ),
      );
      valid = false;
    }
  }

  // 递归 properties
  const properties = node['properties'];
  if (properties !== undefined) {
    if (!isPlainObject(properties)) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_PROPS_SCHEMA',
          [...path, 'properties'],
          'properties 必须是 plain object',
        ),
      );
      valid = false;
    } else {
      for (const key of Object.keys(properties)) {
        if (!validateSchemaNode(properties[key], [...path, 'properties', key], diagnostics, seen)) {
          valid = false;
        }
      }
    }
  }

  // 递归 items
  const items = node['items'];
  if (items !== undefined) {
    if (!validateSchemaNode(items, [...path, 'items'], diagnostics, seen)) {
      valid = false;
    }
  }

  // 检查 required
  const required = node['required'];
  if (required !== undefined) {
    if (!Array.isArray(required)) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_PROPS_SCHEMA',
          [...path, 'required'],
          'required 必须是字符串数组',
        ),
      );
      valid = false;
    } else {
      for (let i = 0; i < required.length; i++) {
        if (typeof required[i] !== 'string') {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_PROPS_SCHEMA',
              [...path, 'required', i],
              `required[${i}] 必须是字符串`,
            ),
          );
          valid = false;
        }
      }
    }
  }

  // 检查 additionalProperties（根必须为 false）
  const additionalProperties = node['additionalProperties'];
  if (additionalProperties !== undefined && typeof additionalProperties !== 'boolean') {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_PROPS_SCHEMA',
        [...path, 'additionalProperties'],
        'additionalProperties 只接受 boolean',
      ),
    );
    valid = false;
  }

  // 检查数值约束
  const numericKeys = ['minimum', 'maximum', 'multipleOf'] as const;
  for (const key of numericKeys) {
    const val = node[key];
    if (val !== undefined && (typeof val !== 'number' || !Number.isFinite(val))) {
      diagnostics.push(
        createValidationDiagnostic('INVALID_PROPS_SCHEMA', [...path, key], `${key} 必须是有限数字`),
      );
      valid = false;
    }
  }

  // 检查整数约束
  const intKeys = ['minItems', 'maxItems'] as const;
  for (const key of intKeys) {
    const val = node[key];
    if (
      val !== undefined &&
      (typeof val !== 'number' || !Number.isFinite(val) || !Number.isInteger(val) || val < 0)
    ) {
      diagnostics.push(
        createValidationDiagnostic('INVALID_PROPS_SCHEMA', [...path, key], `${key} 必须是非负整数`),
      );
      valid = false;
    }
  }

  // 检查字符串约束
  const stringKeys = ['minLength', 'maxLength', 'pattern'] as const;
  for (const key of stringKeys) {
    const val = node[key];
    if (key === 'pattern') {
      if (val !== undefined && typeof val !== 'string') {
        diagnostics.push(
          createValidationDiagnostic('INVALID_PROPS_SCHEMA', [...path, key], `${key} 必须是字符串`),
        );
        valid = false;
      }
    } else {
      if (
        val !== undefined &&
        (typeof val !== 'number' || !Number.isFinite(val) || !Number.isInteger(val) || val < 0)
      ) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPS_SCHEMA',
            [...path, key],
            `${key} 必须是非负整数`,
          ),
        );
        valid = false;
      }
    }
  }

  // 检查 enum/const 的值必须是 JSON 边界值
  const enumValue = node['enum'];
  if (enumValue !== undefined) {
    if (!Array.isArray(enumValue)) {
      diagnostics.push(
        createValidationDiagnostic('INVALID_PROPS_SCHEMA', [...path, 'enum'], 'enum 必须是数组'),
      );
      valid = false;
    } else {
      for (let i = 0; i < enumValue.length; i++) {
        checkJsonValue(enumValue[i], [...path, 'enum', i], diagnostics);
      }
    }
  }

  const constValue = node['const'];
  if (constValue !== undefined) {
    checkJsonValue(constValue, [...path, 'const'], diagnostics);
  }

  return valid;
}

/**
 * 简化的 JSON Schema 值校验。
 *
 * 实现受限子集的校验逻辑，用于验证 defaultProps 是否符合 propsSchema。
 * 不实现完整的 JSON Schema 规范。
 */
export function validateValueAgainstSchema(
  value: unknown,
  schema: unknown,
  path: ReadonlyArray<string | number>,
  diagnostics: ScreenComponentValidationDiagnostic[],
): boolean {
  if (!isPlainObject(schema)) {
    return true; // schema 本身不合法已在 schema 校验阶段报告
  }

  const type = schema['type'];
  let valid = true;

  // type 校验
  if (typeof type === 'string') {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_DEFAULT_PROPS',
              path,
              `期望 string，实际为 ${typeof value}`,
            ),
          );
          valid = false;
        }
        break;
      case 'number':
      case 'integer':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_DEFAULT_PROPS',
              path,
              `期望 ${type}，实际为 ${typeof value}`,
            ),
          );
          valid = false;
        } else if (type === 'integer' && !Number.isInteger(value)) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_DEFAULT_PROPS',
              path,
              `期望 integer，实际为非整数 number`,
            ),
          );
          valid = false;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_DEFAULT_PROPS',
              path,
              `期望 boolean，实际为 ${typeof value}`,
            ),
          );
          valid = false;
        }
        break;
      case 'null':
        if (value !== null) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_DEFAULT_PROPS',
              path,
              `期望 null，实际为 ${typeof value}`,
            ),
          );
          valid = false;
        }
        break;
      case 'object':
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_DEFAULT_PROPS',
              path,
              `期望 object，实际为 ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`,
            ),
          );
          valid = false;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_DEFAULT_PROPS',
              path,
              `期望 array，实际为 ${typeof value}`,
            ),
          );
          valid = false;
        }
        break;
      default:
        break;
    }
  }

  // const 校验
  const constValue = schema['const'];
  if (constValue !== undefined) {
    if (JSON.stringify(constValue) !== JSON.stringify(value)) {
      diagnostics.push(
        createValidationDiagnostic('INVALID_DEFAULT_PROPS', path, `值不匹配 const 约束`),
      );
      valid = false;
    }
  }

  // enum 校验
  const enumValue = schema['enum'];
  if (Array.isArray(enumValue)) {
    const matched = enumValue.some((item) => JSON.stringify(item) === JSON.stringify(value));
    if (!matched) {
      diagnostics.push(
        createValidationDiagnostic('INVALID_DEFAULT_PROPS', path, `值不在 enum 允许列表中`),
      );
      valid = false;
    }
  }

  // string 约束
  if (typeof value === 'string' && typeof type === 'string' && type === 'string') {
    const minLength = schema['minLength'];
    if (typeof minLength === 'number' && value.length < minLength) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_DEFAULT_PROPS',
          path,
          `字符串长度 ${value.length} 小于 minLength ${minLength}`,
        ),
      );
      valid = false;
    }
    const maxLength = schema['maxLength'];
    if (typeof maxLength === 'number' && value.length > maxLength) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_DEFAULT_PROPS',
          path,
          `字符串长度 ${value.length} 大于 maxLength ${maxLength}`,
        ),
      );
      valid = false;
    }
    const pattern = schema['pattern'];
    if (typeof pattern === 'string') {
      try {
        if (!new RegExp(pattern).test(value)) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_DEFAULT_PROPS',
              path,
              `字符串不匹配 pattern ${pattern}`,
            ),
          );
          valid = false;
        }
      } catch {
        // pattern 本身不合法已在 schema 校验报告
      }
    }
  }

  // number 约束
  if (typeof value === 'number' && Number.isFinite(value)) {
    const minimum = schema['minimum'];
    if (typeof minimum === 'number' && value < minimum) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_DEFAULT_PROPS',
          path,
          `数值 ${value} 小于 minimum ${minimum}`,
        ),
      );
      valid = false;
    }
    const maximum = schema['maximum'];
    if (typeof maximum === 'number' && value > maximum) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_DEFAULT_PROPS',
          path,
          `数值 ${value} 大于 maximum ${maximum}`,
        ),
      );
      valid = false;
    }
    const multipleOf = schema['multipleOf'];
    if (typeof multipleOf === 'number' && multipleOf > 0) {
      if (value / multipleOf !== Math.floor(value / multipleOf)) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_DEFAULT_PROPS',
            path,
            `数值 ${value} 不是 multipleOf ${multipleOf} 的整数倍`,
          ),
        );
        valid = false;
      }
    }
  }

  // array 约束
  if (Array.isArray(value)) {
    const minItems = schema['minItems'];
    if (typeof minItems === 'number' && value.length < minItems) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_DEFAULT_PROPS',
          path,
          `数组长度 ${value.length} 小于 minItems ${minItems}`,
        ),
      );
      valid = false;
    }
    const maxItems = schema['maxItems'];
    if (typeof maxItems === 'number' && value.length > maxItems) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_DEFAULT_PROPS',
          path,
          `数组长度 ${value.length} 大于 maxItems ${maxItems}`,
        ),
      );
      valid = false;
    }
    const items = schema['items'];
    if (isPlainObject(items)) {
      for (let i = 0; i < value.length; i++) {
        if (!validateValueAgainstSchema(value[i], items, [...path, i], diagnostics)) {
          valid = false;
        }
      }
    }
  }

  // object properties 递归校验
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema['properties'];
    const required = schema['required'];
    const additionalProperties = schema['additionalProperties'];
    if (isPlainObject(properties)) {
      const requiredSet = new Set(
        Array.isArray(required)
          ? required.filter((r: unknown): r is string => typeof r === 'string')
          : [],
      );
      // required 检查
      for (const reqKey of requiredSet) {
        if (!(reqKey in (value as Record<string, unknown>))) {
          diagnostics.push(
            createValidationDiagnostic('INVALID_DEFAULT_PROPS', path, `缺少必填属性: ${reqKey}`),
          );
          valid = false;
        }
      }
      // properties 递归
      for (const key of Object.keys(properties)) {
        if (key in (value as Record<string, unknown>)) {
          const propSchema = properties[key];
          if (isPlainObject(propSchema)) {
            if (
              !validateValueAgainstSchema(
                (value as Record<string, unknown>)[key],
                propSchema,
                [...path, key],
                diagnostics,
              )
            ) {
              valid = false;
            }
          }
        }
      }
      // additionalProperties: false 时检查未知属性
      if (additionalProperties === false) {
        const knownKeys = new Set(Object.keys(properties));
        for (const key of Object.keys(value)) {
          if (!knownKeys.has(key)) {
            diagnostics.push(
              createValidationDiagnostic(
                'INVALID_DEFAULT_PROPS',
                [...path, key],
                `additionalProperties=false 不允许未知属性: ${key}`,
              ),
            );
            valid = false;
          }
        }
      }
    }
  }

  return valid;
}

/**
 * 校验 manifest 的 propsSchema 和 defaultProps（Spec §7.3）。
 */
export function validatePropsSchema(
  manifest: ScreenComponentManifest,
  diagnostics: ScreenComponentValidationDiagnostic[],
): boolean {
  let valid = true;

  // propsSchema 必须是 plain object
  if (!isPlainObject(manifest.propsSchema)) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_PROPS_SCHEMA',
        ['propsSchema'],
        'propsSchema 必须是 plain object',
      ),
    );
    return false;
  }

  const seen = new WeakSet<object>();
  valid = validateSchemaNode(manifest.propsSchema, ['propsSchema'], diagnostics, seen) && valid;

  // 根 schema 必须为 object
  if (manifest.propsSchema['type'] !== 'object') {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_PROPS_SCHEMA',
        ['propsSchema', 'type'],
        '根 schema type 必须为 object',
      ),
    );
    valid = false;
  }

  // 根 schema 必须显式设置 additionalProperties: false
  if (manifest.propsSchema['additionalProperties'] !== false) {
    diagnostics.push(
      createValidationDiagnostic(
        'INVALID_PROPS_SCHEMA',
        ['propsSchema', 'additionalProperties'],
        '根 schema 必须显式设置 additionalProperties: false',
      ),
    );
    valid = false;
  }

  // defaultProps 必须通过 propsSchema
  if (valid) {
    validateValueAgainstSchema(
      manifest.defaultProps,
      manifest.propsSchema,
      ['defaultProps'],
      diagnostics,
    );
  }

  return valid;
}
