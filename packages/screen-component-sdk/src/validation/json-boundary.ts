/**
 * JSON 边界校验（Spec §7.1）
 *
 * 递归检查值是否为合法的 JSON 边界值。
 * 拒绝：undefined、bigint、symbol、function、class instance、DOM Node、Promise、循环引用。
 */

import {
  createValidationDiagnostic,
  type ScreenComponentValidationDiagnostic,
} from '../contracts/diagnostic.js';

/**
 * 检查值是否为合法的 JSON 边界值。
 *
 * @param value 待检查的值
 * @param path 当前路径（用于诊断）
 * @param diagnostics 诊断收集数组
 * @param ancestors 当前递归路径上的对象，用于循环引用检测
 * @param options 可选的边界兼容行为
 * @returns true 表示值合法
 */
export function checkJsonValue(
  value: unknown,
  path: ReadonlyArray<string | number>,
  diagnostics: ScreenComponentValidationDiagnostic[],
  ancestors: WeakSet<object> = new WeakSet(),
  options?: { readonly allowUndefinedObjectProperties?: boolean },
): boolean {
  // null 是合法的 JSON 值
  if (value === null) return true;

  // 基本类型：string / number / boolean
  if (typeof value === 'string') return true;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      diagnostics.push(
        createValidationDiagnostic('INVALID_JSON_VALUE', path, 'JSON 边界值不允许 NaN 或 Infinity'),
      );
      return false;
    }
    return true;
  }
  if (typeof value === 'boolean') return true;

  // 非法类型
  if (typeof value === 'undefined') {
    diagnostics.push(
      createValidationDiagnostic('INVALID_JSON_VALUE', path, 'JSON 边界值不允许 undefined'),
    );
    return false;
  }
  if (typeof value === 'bigint') {
    diagnostics.push(
      createValidationDiagnostic('INVALID_JSON_VALUE', path, 'JSON 边界值不允许 bigint'),
    );
    return false;
  }
  if (typeof value === 'symbol') {
    diagnostics.push(
      createValidationDiagnostic('INVALID_JSON_VALUE', path, 'JSON 边界值不允许 symbol'),
    );
    return false;
  }
  if (typeof value === 'function') {
    diagnostics.push(
      createValidationDiagnostic('INVALID_JSON_VALUE', path, 'JSON 边界值不允许 function'),
    );
    return false;
  }

  // 此时 value 是 object
  const obj = value as Record<string, unknown> | unknown[];

  // DOM Node 检测
  if (typeof Node !== 'undefined' && value instanceof Node) {
    diagnostics.push(
      createValidationDiagnostic('INVALID_JSON_VALUE', path, 'JSON 边界值不允许 DOM Node'),
    );
    return false;
  }

  // Promise 检测
  if (typeof Promise !== 'undefined' && typeof (value as { then?: unknown }).then === 'function') {
    diagnostics.push(
      createValidationDiagnostic('INVALID_JSON_VALUE', path, 'JSON 边界值不允许 Promise/thenable'),
    );
    return false;
  }

  // 循环引用检测
  if (ancestors.has(obj)) {
    diagnostics.push(
      createValidationDiagnostic('INVALID_JSON_VALUE', path, 'JSON 边界值不允许循环引用'),
    );
    return false;
  }
  ancestors.add(obj);

  let valid = true;
  try {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (!checkJsonValue(value[i], [...path, i], diagnostics, ancestors, options)) {
          valid = false;
        }
      }
    } else {
      // 检查是否为 plain object（原型为 Object.prototype 或 null）
      const proto = Reflect.getPrototypeOf(obj);
      if (proto !== null && proto !== Object.prototype) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_JSON_VALUE',
            path,
            'JSON 边界值不允许 class instance（仅接受 plain object）',
          ),
        );
        return false;
      }

      // 检查自身可枚举属性（避免 prototype pollution 键如 __proto__）
      for (const key of Object.keys(value)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_JSON_VALUE',
              [...path, key],
              `JSON 边界值不允许 prototype pollution 键: ${key}`,
            ),
          );
          valid = false;
          continue;
        }
        const nestedValue = (value as Record<string, unknown>)[key];
        if (nestedValue === undefined && options?.allowUndefinedObjectProperties === true) {
          continue;
        }
        if (!checkJsonValue(nestedValue, [...path, key], diagnostics, ancestors, options)) {
          valid = false;
        }
      }
    }
  } finally {
    ancestors.delete(obj);
  }

  return valid;
}

/**
 * 检查对象是否所有值都是合法的 JSON 边界值。
 */
export function checkJsonProps(
  props: unknown,
  path: ReadonlyArray<string | number>,
  diagnostics: ScreenComponentValidationDiagnostic[],
): boolean {
  if (props === null || typeof props !== 'object' || Array.isArray(props)) {
    diagnostics.push(
      createValidationDiagnostic('INVALID_JSON_VALUE', path, 'props 必须是 JSON object'),
    );
    return false;
  }
  return checkJsonValue(props, path, diagnostics);
}
