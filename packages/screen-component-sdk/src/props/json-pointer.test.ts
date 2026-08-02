/**
 * JSON Pointer props 工具测试（Task 3.1）
 *
 * 覆盖：
 * - RFC 6901 pointer 解析（转义、数组、嵌套路径）
 * - 不可变 read/update/reset
 * - 缺失路径
 * - prototype pollution 负例
 * - 数组索引边界
 */

import { describe, expect, it } from 'vitest';
import {
  getPropByPointer,
  parseJsonPointer,
  resetPropByPointer,
  updatePropByPointer,
} from './json-pointer.js';
import type { ScreenComponentProps } from '../contracts/json.js';

describe('json-pointer · parseJsonPointer', () => {
  it('解析单层 pointer', () => {
    expect(parseJsonPointer('/title')).toEqual(['title']);
    expect(parseJsonPointer('/value')).toEqual(['value']);
  });

  it('解析多层 pointer', () => {
    expect(parseJsonPointer('/axis/labelColor')).toEqual(['axis', 'labelColor']);
    expect(parseJsonPointer('/a/b/c/d')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('解析数组索引', () => {
    expect(parseJsonPointer('/items/0/name')).toEqual(['items', '0', 'name']);
    expect(parseJsonPointer('/list/42')).toEqual(['list', '42']);
  });

  it('解析转义字符 ~1 → /', () => {
    expect(parseJsonPointer('/a~1b')).toEqual(['a/b']);
  });

  it('解析转义字符 ~0 → ~', () => {
    expect(parseJsonPointer('/a~0b')).toEqual(['a~b']);
  });

  it('组合转义 ~0 和 ~1', () => {
    expect(parseJsonPointer('/a~1b~0c')).toEqual(['a/b~c']);
    // ~0 在 ~1 之后（顺序无关，先 ~1 再 ~0 是 RFC 6901 要求）
    expect(parseJsonPointer('/x~0~1y')).toEqual(['x~/y']);
  });

  it('空字符串返回 null', () => {
    expect(parseJsonPointer('')).toBeNull();
  });

  it('无前导 / 返回 null', () => {
    expect(parseJsonPointer('title')).toBeNull();
    expect(parseJsonPointer('a/b')).toBeNull();
  });

  it('仅根 / 返回空数组（指向 props 根）', () => {
    // 单独的 / 解析为空数组（getPropByPointer 会返回整个 props，
    // updatePropByPointer 会拒绝）
    expect(parseJsonPointer('/')).toEqual([]);
  });
});

describe('json-pointer · getPropByPointer', () => {
  it('读取单层属性', () => {
    const props: ScreenComponentProps = { title: '指标', value: 100, color: '#ff0000' };
    expect(getPropByPointer(props, '/title')).toBe('指标');
    expect(getPropByPointer(props, '/value')).toBe(100);
    expect(getPropByPointer(props, '/color')).toBe('#ff0000');
  });

  it('读取嵌套对象属性', () => {
    const props: ScreenComponentProps = {
      axis: { labelColor: '#333', lineColor: '#999' },
      title: '图表',
    };
    expect(getPropByPointer(props, '/axis/labelColor')).toBe('#333');
    expect(getPropByPointer(props, '/axis/lineColor')).toBe('#999');
  });

  it('读取数组元素', () => {
    const props: ScreenComponentProps = {
      items: [{ name: 'a' }, { name: 'b' }],
    };
    expect(getPropByPointer(props, '/items/0/name')).toBe('a');
    expect(getPropByPointer(props, '/items/1/name')).toBe('b');
    expect(getPropByPointer(props, '/items/0')).toEqual({ name: 'a' });
  });

  it('读取不存在的路径返回 undefined', () => {
    const props: ScreenComponentProps = { title: '指标' };
    expect(getPropByPointer(props, '/missing')).toBeUndefined();
    expect(getPropByPointer(props, '/a/b/c/d')).toBeUndefined();
  });

  it('路径中间为 null 返回 undefined', () => {
    const props: ScreenComponentProps = { axis: null };
    expect(getPropByPointer(props, '/axis/labelColor')).toBeUndefined();
  });

  it('路径中间为原始值返回 undefined', () => {
    const props: ScreenComponentProps = { title: '字符串' };
    expect(getPropByPointer(props, '/title/sub')).toBeUndefined();
  });

  it('数组索引越界返回 undefined', () => {
    const props: ScreenComponentProps = { items: [{ name: 'a' }] };
    expect(getPropByPointer(props, '/items/1')).toBeUndefined();
    expect(getPropByPointer(props, '/items/99')).toBeUndefined();
  });

  it('非数组用数组索引返回 undefined', () => {
    const props: ScreenComponentProps = { axis: { labelColor: '#333' } };
    expect(getPropByPointer(props, '/axis/0')).toBeUndefined();
  });

  it('非法数组索引返回 undefined', () => {
    const props: ScreenComponentProps = { items: [{ name: 'a' }] };
    expect(getPropByPointer(props, '/items/abc')).toBeUndefined();
    expect(getPropByPointer(props, '/items/-1')).toBeUndefined();
    expect(getPropByPointer(props, '/items/01')).toBeUndefined();
  });

  it('非法 pointer 格式返回 undefined', () => {
    const props: ScreenComponentProps = { title: '指标' };
    expect(getPropByPointer(props, '')).toBeUndefined();
    expect(getPropByPointer(props, 'title')).toBeUndefined();
  });

  it('读取转义后的路径段', () => {
    const props: ScreenComponentProps = { 'a/b': 'slash', 'a~b': 'tilde' };
    expect(getPropByPointer(props, '/a~1b')).toBe('slash');
    expect(getPropByPointer(props, '/a~0b')).toBe('tilde');
  });

  it('读取 null 值', () => {
    const props: ScreenComponentProps = { value: null };
    expect(getPropByPointer(props, '/value')).toBeNull();
  });

  it('读取 boolean 值', () => {
    const props: ScreenComponentProps = { visible: true, hidden: false };
    expect(getPropByPointer(props, '/visible')).toBe(true);
    expect(getPropByPointer(props, '/hidden')).toBe(false);
  });
});

describe('json-pointer · updatePropByPointer', () => {
  it('更新单层属性', () => {
    const props: ScreenComponentProps = { title: '旧值', value: 0 };
    const updated = updatePropByPointer(props, '/title', '新值');
    expect(updated).toEqual({ title: '新值', value: 0 });
    // 原对象不变
    expect(props.title).toBe('旧值');
  });

  it('更新嵌套对象属性', () => {
    const props: ScreenComponentProps = {
      axis: { labelColor: '#333', lineColor: '#999' },
      title: '图表',
    };
    const updated = updatePropByPointer(props, '/axis/labelColor', '#000');
    expect(updated).toEqual({
      axis: { labelColor: '#000', lineColor: '#999' },
      title: '图表',
    });
    // 原对象不变
    const originalAxis = props.axis as { labelColor: string; lineColor: string };
    expect(originalAxis.labelColor).toBe('#333');
  });

  it('更新数组元素', () => {
    const props: ScreenComponentProps = {
      items: [{ name: 'a' }, { name: 'b' }],
    };
    const updated = updatePropByPointer(props, '/items/1/name', 'B');
    expect(updated).toEqual({
      items: [{ name: 'a' }, { name: 'B' }],
    });
    // 原数组不变
    const originalItems = props.items as Array<{ name: string }>;
    expect(originalItems[1].name).toBe('b');
  });

  it('更新不存在的路径自动创建中间对象', () => {
    const props: ScreenComponentProps = { title: '指标' };
    const updated = updatePropByPointer(props, '/axis/labelColor', '#000');
    expect(updated).toEqual({
      title: '指标',
      axis: { labelColor: '#000' },
    });
  });

  it('更新不存在的数组路径自动创建数组', () => {
    const props: ScreenComponentProps = {};
    const updated = updatePropByPointer(props, '/items/0/name', 'first');
    expect(updated).toEqual({
      items: [{ name: 'first' }],
    });
  });

  it('更新转义后的路径段', () => {
    const props: ScreenComponentProps = {};
    const updated = updatePropByPointer(props, '/a~1b', 'slash');
    expect(updated).toEqual({ 'a/b': 'slash' });
  });

  it('更新 boolean 值', () => {
    const props: ScreenComponentProps = { visible: false };
    const updated = updatePropByPointer(props, '/visible', true);
    expect(updated).toEqual({ visible: true });
  });

  it('更新 null 值', () => {
    const props: ScreenComponentProps = { value: 100 };
    const updated = updatePropByPointer(props, '/value', null);
    expect(updated).toEqual({ value: null });
  });

  it('更新数组索引越界时扩展数组', () => {
    const props: ScreenComponentProps = { items: [{ name: 'a' }] };
    const updated = updatePropByPointer(props, '/items/2/name', 'c');
    expect(updated.items).toHaveLength(3);
    expect((updated.items as Array<{ name: string }>)[2].name).toBe('c');
  });

  it('更新保留兄弟字段（嵌套）', () => {
    const props: ScreenComponentProps = {
      axis: { labelColor: '#333', lineColor: '#999', width: 2 },
    };
    const updated = updatePropByPointer(props, '/axis/labelColor', '#000');
    expect(updated.axis).toEqual({
      labelColor: '#000',
      lineColor: '#999',
      width: 2,
    });
  });

  it('非法 pointer 格式抛错', () => {
    const props: ScreenComponentProps = { title: '指标' };
    expect(() => updatePropByPointer(props, '', '新值')).toThrow(/不是合法/);
    expect(() => updatePropByPointer(props, 'title', '新值')).toThrow(/不是合法/);
  });

  it('prototype pollution 路径抛错', () => {
    const props: ScreenComponentProps = { title: '指标' };
    expect(() => updatePropByPointer(props, '/__proto__/polluted', 'true')).toThrow(
      /prototype pollution/,
    );
    expect(() => updatePropByPointer(props, '/constructor/prototype/polluted', 'true')).toThrow(
      /prototype pollution/,
    );
    expect(() => updatePropByPointer(props, '/prototype/polluted', 'true')).toThrow(
      /prototype pollution/,
    );
  });

  it('prototype pollution 不会污染原型', () => {
    const props: ScreenComponentProps = { title: '指标' };
    // 即使绕过校验（直接调用），也不应污染 Object.prototype
    // 这里测试公开 API 的防护
    expect(() => updatePropByPointer(props, '/__proto__/x', 'bad')).toThrow();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('对象使用数字段作为 key（RFC 6901 允许）', () => {
    // RFC 6901: 当目标是对象时，数字段是合法 key（不当作数组索引）
    const props: ScreenComponentProps = { axis: { labelColor: '#333' } };
    const updated = updatePropByPointer(props, '/axis/0', 'val');
    expect(updated).toEqual({ axis: { labelColor: '#333', '0': 'val' } });
  });

  it('数组使用非数字段抛错', () => {
    const props: ScreenComponentProps = { items: [{ name: 'a' }] };
    expect(() => updatePropByPointer(props, '/items/abc', 'val')).toThrow(/不是合法数组索引/);
    expect(() => updatePropByPointer(props, '/items/-1', 'val')).toThrow(/不是合法数组索引/);
  });
});

describe('json-pointer · resetPropByPointer', () => {
  it('使用 defaultProps 重置属性', () => {
    const props: ScreenComponentProps = { title: '修改后', value: 999, color: '#000' };
    const defaultProps: ScreenComponentProps = {
      title: '默认标题',
      value: 0,
      color: '#4f46e5',
    };
    const reset = resetPropByPointer(props, '/title', defaultProps);
    expect(reset).toEqual({
      title: '默认标题',
      value: 999,
      color: '#000',
    });
    // 原对象不变
    expect(props.title).toBe('修改后');
  });

  it('重置嵌套属性', () => {
    const props: ScreenComponentProps = {
      axis: { labelColor: '#modified', lineColor: '#keep' },
    };
    const defaultProps: ScreenComponentProps = {
      axis: { labelColor: '#default', lineColor: '#defaultLine' },
    };
    const reset = resetPropByPointer(props, '/axis/labelColor', defaultProps);
    expect(reset).toEqual({
      axis: { labelColor: '#default', lineColor: '#keep' },
    });
  });

  it('defaultProps 缺失时删除属性', () => {
    const props: ScreenComponentProps = { title: '指标', optional: 'value' };
    const defaultProps: ScreenComponentProps = { title: '指标' };
    const reset = resetPropByPointer(props, '/optional', defaultProps);
    expect(reset).toEqual({ title: '指标' });
  });

  it('defaultProps 缺失且属性不存在时不变', () => {
    const props: ScreenComponentProps = { title: '指标' };
    const defaultProps: ScreenComponentProps = { title: '指标' };
    const reset = resetPropByPointer(props, '/optional', defaultProps);
    expect(reset).toEqual({ title: '指标' });
  });

  it('重置数组元素', () => {
    const props: ScreenComponentProps = {
      items: [{ name: 'modified' }, { name: 'b' }],
    };
    const defaultProps: ScreenComponentProps = {
      items: [{ name: 'default' }],
    };
    const reset = resetPropByPointer(props, '/items/0/name', defaultProps);
    expect(reset).toEqual({
      items: [{ name: 'default' }, { name: 'b' }],
    });
  });

  it('prototype pollution 路径抛错', () => {
    const props: ScreenComponentProps = { title: '指标' };
    const defaultProps: ScreenComponentProps = { title: '指标' };
    expect(() => resetPropByPointer(props, '/__proto__/x', defaultProps)).toThrow(
      /prototype pollution/,
    );
  });
});
