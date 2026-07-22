/**
 * 路径读写工具（Phase 2 Slice B）
 *
 * 声明式字段通过 `path`（如 'style.fontSize'、'position.width'）描述取值位置。
 * 读取由 `getByPath` 完成；写入由 `buildNestedUpdate` 产生不可变嵌套 partial，
 * 交给 store.updateComponent 做 shallow merge（单向数据流不变）。
 */

/**
 * 按点分路径读取嵌套值。
 * getByPath(component, 'style.fontSize') → component.style.fontSize
 * getByPath(component, 'props.content') → component.props.content
 */
export function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

/**
 * 按点分路径构造嵌套 partial update。
 *
 * buildNestedUpdate(component, 'position.x', 100)
 *   → { position: { ...component.position, x: 100 } }
 *
 * buildNestedUpdate(canvas, 'width', 1920)
 *   → { width: 1920 }
 *
 * 结果可直接传给 store.updateComponent(id, partial) / store.updateCanvas(partial)，
 * shallow merge 后等价于在原对象上递归覆盖目标路径，且保留兄弟字段。
 */
export function buildNestedUpdate<T extends Record<string, unknown>>(
  source: T,
  path: string,
  value: unknown,
): Partial<T> {
  const keys = path.split('.');
  if (keys.length === 1) {
    return { [keys[0]!]: value } as Partial<T>;
  }
  const [head, ...rest] = keys;
  const headKey = head!;
  const currentValue = source[headKey];
  const nestedSource = (currentValue ?? {}) as Record<string, unknown>;
  const updatedNested = buildNestedUpdate(nestedSource, rest.join('.'), value);
  return {
    [headKey]: { ...nestedSource, ...updatedNested },
  } as Partial<T>;
}
