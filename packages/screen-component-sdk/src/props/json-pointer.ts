/**
 * JSON Pointer props 工具（Spec §7.4 + §10, Task 3.1）
 *
 * RFC 6901 JSON Pointer 相对 props 根的读取/更新/重置。
 *
 * 仅接受相对 props 根的 pointer（如 `/title`、`/axis/labelColor`），
 * 不接受空 pointer（指向整个 props 根）——属性面板字段必须指向具体属性。
 *
 * 安全约束（Spec §15）：
 * - 拒绝 prototype pollution 路径（`__proto__`、`constructor`、`prototype`）
 * - 转义：`~1` → `/`，`~0` → `~`（RFC 6901 §3）
 * - 数组索引：支持数字索引访问数组元素
 *
 * 不可变语义（Spec §10）：
 * - read 返回值（不修改 props）
 * - update 返回新 props 对象，原 props 不变
 * - reset 使用 manifest defaultProps 对应 pointer 的值
 */

import type { ScreenComponentJsonValue, ScreenComponentProps } from '../contracts/json.js';

/** 拒绝的路径段（prototype pollution 防护，Spec §15） */
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * 解析 RFC 6901 JSON Pointer 为路径段数组（Spec §7.4）。
 *
 * pointer 相对 props 根，必须以 `/` 开头：
 * - `/title` → `['title']`
 * - `/axis/labelColor` → `['axis', 'labelColor']`
 * - `/items/0/name` → `['items', '0', 'name']`
 * - `/a~1b` → `['a/b']`（`~1` 转义为 `/`）
 * - `/a~0b` → `['a~b']`（`~0` 转义为 `~`）
 * - `''` (empty) → `null`（本工具要求 pointer 至少一层路径）
 * - `'title'` (无前导 `/`) → `null`
 *
 * @returns 路径段数组，或 `null` 表示格式不合法
 */
export function parseJsonPointer(pointer: string): string[] | null {
  if (typeof pointer !== 'string' || pointer.length === 0) return null;
  if (!pointer.startsWith('/')) return null;
  // 单独的 `/` 表示根 pointer，返回空数组（无路径段）
  if (pointer === '/') return [];
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/**
 * 检查路径段是否安全（非 prototype pollution 路径）。
 */
function isSafeSegment(segment: string): boolean {
  return !FORBIDDEN_SEGMENTS.has(segment);
}

/**
 * 检查路径段是否为合法数组索引。
 *
 * 合法数组索引：非负整数字符串（`'0'`、`'1'`、`'42'`），不包含前导零（除 `'0'` 本身），
 * 不超过 `2^32 - 2`（JS 数组最大长度限制）。
 */
function isArrayIndex(segment: string): boolean {
  if (segment.length === 0) return false;
  if (segment === '0') return true;
  if (!/^[1-9][0-9]*$/.test(segment)) return false;
  const num = Number(segment);
  return Number.isSafeInteger(num) && num <= 4294967294;
}

/**
 * 按 pointer 读取 props 中的值（Spec §10）。
 *
 * 行为：
 * - 路径存在 → 返回对应值
 * - 路径中间为 `null`/非对象/非数组 → 返回 `undefined`
 * - 数组索引越界 → 返回 `undefined`
 * - pointer 格式不合法 → 返回 `undefined`
 * - prototype pollution 路径 → 返回 `undefined`
 *
 * @param props 组件 props（ScreenComponentProps）
 * @param pointer RFC 6901 相对 pointer（如 `/title`、`/axis/labelColor`）
 * @returns 路径处的值，或 `undefined`
 */
export function getPropByPointer(
  props: ScreenComponentProps,
  pointer: string,
): ScreenComponentJsonValue | undefined {
  const segments = parseJsonPointer(pointer);
  if (segments === null) return undefined;
  if (segments.length === 0) return props;

  let current: ScreenComponentJsonValue | undefined = props;
  for (const segment of segments) {
    if (!isSafeSegment(segment)) return undefined;
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      if (!isArrayIndex(segment)) return undefined;
      const idx = Number(segment);
      if (idx >= current.length) return undefined;
      current = current[idx];
    } else if (typeof current === 'object') {
      current = (current as Record<string, ScreenComponentJsonValue>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * 按 pointer 不可变更新 props 中的值（Spec §10）。
 *
 * 行为：
 * - 返回新的 props 对象，原 props 不变（immutable）
 * - 路径中间缺失时自动创建中间对象（或数组，当下一段是数字索引时）
 * - prototype pollution 路径 → 抛错
 * - pointer 格式不合法 → 抛错
 * - pointer 指向 props 根（空路径） → 抛错
 *
 * @param props 原始 props
 * @param pointer RFC 6901 相对 pointer
 * @param value 新值（必须是合法 JSON 值）
 * @returns 更新后的新 props
 * @throws Error 当 pointer 不合法或路径包含 `__proto__`/`constructor`/`prototype`
 */
export function updatePropByPointer(
  props: ScreenComponentProps,
  pointer: string,
  value: ScreenComponentJsonValue,
): ScreenComponentProps {
  const segments = parseJsonPointer(pointer);
  if (segments === null) {
    throw new Error(`[json-pointer] pointer "${pointer}" 不是合法的 RFC 6901 相对 pointer`);
  }
  if (segments.length === 0) {
    throw new Error('[json-pointer] pointer 不能指向 props 根（必须至少一层路径）');
  }
  for (const segment of segments) {
    if (!isSafeSegment(segment)) {
      throw new Error(`[json-pointer] 路径段 "${segment}" 不允许（prototype pollution 防护）`);
    }
  }
  return updateAtPath(props, segments, value) as ScreenComponentProps;
}

/**
 * 递归不可变更新辅助函数。
 *
 * 在路径中间缺失时：
 * - 下一段是合法数组索引 → 创建数组
 * - 下一段不是数组索引 → 创建对象
 */
function updateAtPath(
  current: ScreenComponentJsonValue,
  segments: string[],
  value: ScreenComponentJsonValue,
): ScreenComponentJsonValue {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return value;
  }

  const nextSegment = rest[0];
  const shouldCreateArray = nextSegment !== undefined && isArrayIndex(nextSegment);

  if (Array.isArray(current)) {
    if (!isArrayIndex(head)) {
      throw new Error(`[json-pointer] 路径段 "${head}" 不是合法数组索引`);
    }
    const idx = Number(head);
    const arr = [...current];
    if (rest.length === 0) {
      arr[idx] = value;
    } else {
      const existing: ScreenComponentJsonValue = idx < arr.length ? (arr[idx] ?? {}) : {};
      arr[idx] = updateAtPath(existing, rest, value);
    }
    return arr;
  }

  if (current === null || typeof current !== 'object') {
    // 非对象/数组：替换为合适的容器
    current = shouldCreateArray ? [] : {};
  }

  const obj = current as Record<string, ScreenComponentJsonValue>;
  const newObj = { ...obj };
  if (rest.length === 0) {
    newObj[head] = value;
  } else {
    // 中间路径缺失时：下一段是数组索引 → 创建数组，否则创建对象
    const existing: ScreenComponentJsonValue =
      head in obj ? obj[head] : shouldCreateArray ? [] : {};
    newObj[head] = updateAtPath(existing, rest, value);
  }
  return newObj;
}

/**
 * 按 pointer 删除 props 中的值（不可变）。
 *
 * 用于 reset 时 defaultProps 不存在对应 pointer 的场景。
 * - 路径不存在 → 返回原 props（不变）
 * - 路径存在 → 返回删除后的新 props
 *
 * @throws Error 当 pointer 不合法或路径包含 prototype pollution 段
 */
function removePropByPointer(props: ScreenComponentProps, pointer: string): ScreenComponentProps {
  const segments = parseJsonPointer(pointer);
  if (segments === null) {
    throw new Error(`[json-pointer] pointer "${pointer}" 不是合法的 RFC 6901 相对 pointer`);
  }
  if (segments.length === 0) {
    throw new Error('[json-pointer] pointer 不能指向 props 根（必须至少一层路径）');
  }
  for (const segment of segments) {
    if (!isSafeSegment(segment)) {
      throw new Error(`[json-pointer] 路径段 "${segment}" 不允许（prototype pollution 防护）`);
    }
  }
  return removeAtPath(props, segments) as ScreenComponentProps;
}

/**
 * 递归不可变删除辅助函数。
 *
 * 如果删除后容器变空且原本不存在于 default，调用方应自行决定是否保留空容器。
 * 本函数不清理空容器（保留中间结构，避免意外丢失兄弟字段）。
 */
function removeAtPath(
  current: ScreenComponentJsonValue,
  segments: string[],
): ScreenComponentJsonValue | undefined {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return undefined;
  }

  if (Array.isArray(current)) {
    if (!isArrayIndex(head)) return current;
    const idx = Number(head);
    if (idx >= current.length) return current;
    if (rest.length === 0) {
      // 压缩数组：移除指定索引元素（filter 直接返回新数组，无需 delete）
      return current.filter((_, i) => i !== idx);
    }
    const arr = [...current];
    const child = arr[idx];
    if (child === undefined || child === null) return current;
    const removed = removeAtPath(child, rest);
    if (removed === undefined) {
      return arr.filter((_, i) => i !== idx);
    }
    arr[idx] = removed;
    return arr;
  }

  if (current === null || typeof current !== 'object') {
    return current;
  }

  const obj = current as Record<string, ScreenComponentJsonValue>;
  if (!(head in obj)) return current;
  if (rest.length === 0) {
    const newObj = { ...obj };
    delete newObj[head];
    return newObj;
  }
  const child = obj[head];
  if (child === undefined || child === null) return current;
  const removed = removeAtPath(child, rest);
  if (removed === undefined) {
    const newObj = { ...obj };
    delete newObj[head];
    return newObj;
  }
  return { ...obj, [head]: removed };
}

/**
 * 按 pointer 重置 props 中的值为 manifest defaultProps 对应值（Spec §10）。
 *
 * 行为：
 * - defaultProps 在 pointer 处有值 → 用 default 值替换（不可变）
 * - defaultProps 在 pointer 处无值 → 删除该 key（Spec §10: defaultProps 缺失的 optional 值由控件显示为空）
 * - prototype pollution 路径 → 抛错
 *
 * @param props 当前 props
 * @param pointer RFC 6901 相对 pointer
 * @param defaultProps manifest defaultProps
 * @returns 重置后的新 props
 * @throws Error 当 pointer 不合法或路径包含 prototype pollution 段
 */
export function resetPropByPointer(
  props: ScreenComponentProps,
  pointer: string,
  defaultProps: Readonly<ScreenComponentProps>,
): ScreenComponentProps {
  const defaultValue = getPropByPointer(defaultProps, pointer);
  if (defaultValue === undefined) {
    return removePropByPointer(props, pointer);
  }
  return updatePropByPointer(props, pointer, defaultValue);
}
