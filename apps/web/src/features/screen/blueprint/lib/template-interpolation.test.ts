/**
 * 模板插值纯函数测试（任务 10.5）
 *
 * 验证点（对应 tasks.md 10.5 验证要求）：
 * - 插值求值：基础路径、嵌套路径、多占位符
 * - 字段缺失降级：路径不存在/undefined/null → 空字符串
 * - 无代码执行路径：JS 表达式/函数调用/三元 → 降级为空字符串
 * - 类型转换：number/boolean/object/array → 字符串
 * - interpolateActionConfig：对动作配置字段进行插值，原配置不被修改
 */

import { describe, it, expect } from 'vitest';
import {
  interpolateActionConfig,
  interpolateTemplate,
  type TemplateContext,
} from './template-interpolation.js';
import type { BlueprintActionConfig } from '@nebula/shared';

// ===== 公共上下文构造器 =====

function makeContext(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    trigger: {
      value: 'hello',
      data: { field: 'world', nested: { deep: 'nested-value' }, num: 42, flag: true },
    },
    event: { componentId: 'c1', error: 'network failed' },
    ...overrides,
  };
}

// ===== interpolateTemplate：基础插值求值 =====

describe('interpolateTemplate — 基础插值求值', () => {
  it('单个占位符替换为 trigger.value', () => {
    expect(interpolateTemplate('{{trigger.value}}', makeContext())).toBe('hello');
  });

  it('占位符 + 字面文本', () => {
    expect(interpolateTemplate('prefix-{{trigger.value}}-suffix', makeContext())).toBe(
      'prefix-hello-suffix',
    );
  });

  it('多个占位符组合', () => {
    const template = '{{trigger.value}}-{{trigger.data.field}}';
    expect(interpolateTemplate(template, makeContext())).toBe('hello-world');
  });

  it('嵌套路径 trigger.data.field', () => {
    expect(interpolateTemplate('{{trigger.data.field}}', makeContext())).toBe('world');
  });

  it('深层嵌套路径 trigger.data.nested.deep', () => {
    expect(interpolateTemplate('{{trigger.data.nested.deep}}', makeContext())).toBe('nested-value');
  });

  it('event.componentId 路径', () => {
    expect(interpolateTemplate('{{event.componentId}}', makeContext())).toBe('c1');
  });

  it('event.error 路径', () => {
    expect(interpolateTemplate('{{event.error}}', makeContext())).toBe('network failed');
  });

  it('占位符内空格被忽略', () => {
    expect(interpolateTemplate('{{ trigger.value }}', makeContext())).toBe('hello');
  });
});

// ===== interpolateTemplate：字段缺失降级 =====

describe('interpolateTemplate — 字段缺失降级', () => {
  it('路径不存在降级为空字符串', () => {
    expect(interpolateTemplate('{{trigger.missing}}', makeContext())).toBe('');
  });

  it('深层路径中途不存在降级为空字符串', () => {
    expect(interpolateTemplate('{{trigger.data.missing.deep}}', makeContext())).toBe('');
  });

  it('undefined 值降级为空字符串', () => {
    const ctx = makeContext({ trigger: { value: undefined, data: {} } });
    expect(interpolateTemplate('{{trigger.value}}', ctx)).toBe('');
  });

  it('null 值降级为空字符串', () => {
    const ctx = makeContext({ trigger: { value: null, data: {} } });
    expect(interpolateTemplate('{{trigger.value}}', ctx)).toBe('');
  });

  it('中途遇到非对象（字符串）降级为空字符串', () => {
    const ctx = makeContext({ trigger: { value: 'string-value', data: {} } });
    expect(interpolateTemplate('{{trigger.value.foo}}', ctx)).toBe('');
  });

  it('中途遇到非对象（数字）降级为空字符串', () => {
    const ctx = makeContext({ trigger: { value: 42, data: {} } });
    expect(interpolateTemplate('{{trigger.value.foo}}', ctx)).toBe('');
  });

  it('trigger 整体缺失时降级为空字符串', () => {
    const ctx: TemplateContext = { event: { componentId: 'c1' } };
    expect(interpolateTemplate('{{trigger.value}}', ctx)).toBe('');
  });

  it('event 整体缺失时降级为空字符串', () => {
    const ctx: TemplateContext = { trigger: { value: 'hello', data: {} } };
    expect(interpolateTemplate('{{event.error}}', ctx)).toBe('');
  });
});

// ===== interpolateTemplate：类型转换 =====

describe('interpolateTemplate — 类型转换', () => {
  it('number 转换为字符串', () => {
    expect(interpolateTemplate('{{trigger.data.num}}', makeContext())).toBe('42');
  });

  it('boolean true 转换为字符串 "true"', () => {
    expect(interpolateTemplate('{{trigger.data.flag}}', makeContext())).toBe('true');
  });

  it('object 转换为 JSON 字符串', () => {
    const ctx = makeContext({ trigger: { value: 'x', data: { obj: { a: 1, b: 'two' } } } });
    expect(interpolateTemplate('{{trigger.data.obj}}', ctx)).toBe('{"a":1,"b":"two"}');
  });

  it('array 转换为 JSON 字符串', () => {
    const ctx = makeContext({ trigger: { value: 'x', data: { list: [1, 'two', false] } } });
    expect(interpolateTemplate('{{trigger.data.list}}', ctx)).toBe('[1,"two",false]');
  });
});

// ===== interpolateTemplate：无代码执行路径（安全） =====

describe('interpolateTemplate — 无代码执行路径', () => {
  it('空占位符 {{}} 降级为空字符串', () => {
    expect(interpolateTemplate('{{}}', makeContext())).toBe('');
  });

  it('仅空格占位符 {{ }} 降级为空字符串', () => {
    expect(interpolateTemplate('{{ }}', makeContext())).toBe('');
  });

  it('JS 算术表达式 1+1 降级为空字符串（非法路径）', () => {
    expect(interpolateTemplate('{{1+1}}', makeContext())).toBe('');
  });

  it('函数调用 alert(1) 降级为空字符串（非法路径）', () => {
    expect(interpolateTemplate('{{alert(1)}}', makeContext())).toBe('');
  });

  it('三元表达式 a ? b : c 降级为空字符串（非法路径）', () => {
    expect(interpolateTemplate('{{trigger.value ? "yes" : "no"}}', makeContext())).toBe('');
  });

  it('数字开头的路径 1abc 降级为空字符串（非法标识符）', () => {
    expect(interpolateTemplate('{{1abc}}', makeContext())).toBe('');
  });

  it('含分号的路径降级为空字符串', () => {
    expect(interpolateTemplate('{{trigger.value;}}', makeContext())).toBe('');
  });

  it('含方括号的路径降级为空字符串', () => {
    expect(interpolateTemplate('{{trigger["value"]}}', makeContext())).toBe('');
  });
});

// ===== interpolateTemplate：边界情况 =====

describe('interpolateTemplate — 边界情况', () => {
  it('空字符串输入返回空字符串', () => {
    expect(interpolateTemplate('', makeContext())).toBe('');
  });

  it('无占位符的字符串原样返回', () => {
    expect(interpolateTemplate('plain text no placeholder', makeContext())).toBe(
      'plain text no placeholder',
    );
  });

  it('连续多个占位符全部解析', () => {
    const template = '{{trigger.value}}{{trigger.data.field}}{{event.componentId}}';
    expect(interpolateTemplate(template, makeContext())).toBe('helloworldc1');
  });

  it('相邻占位符无分隔符', () => {
    expect(interpolateTemplate('{{trigger.value}}{{trigger.data.field}}', makeContext())).toBe(
      'helloworld',
    );
  });

  it('空上下文对象所有占位符降级为空字符串', () => {
    const ctx: TemplateContext = {};
    expect(interpolateTemplate('{{trigger.value}}-{{event.error}}', ctx)).toBe('-');
  });
});

// ===== interpolateActionConfig：动作配置插值 =====

describe('interpolateActionConfig — 动作配置插值', () => {
  it('requestApi 插值 url/body/headers', () => {
    const config: BlueprintActionConfig = {
      type: 'requestApi',
      method: 'POST',
      url: 'https://api.example.com/{{event.componentId}}',
      headers: { Authorization: 'Bearer {{trigger.value}}', 'X-Data': '{{trigger.data.field}}' },
      body: '{"comp":"{{event.componentId}}","val":"{{trigger.value}}"}',
      secretHeaderKeys: ['Authorization'],
      timeoutMs: 10_000,
    };
    const result = interpolateActionConfig(config, makeContext());
    expect(result).toEqual({
      type: 'requestApi',
      method: 'POST',
      url: 'https://api.example.com/c1',
      headers: { Authorization: 'Bearer hello', 'X-Data': 'world' },
      body: '{"comp":"c1","val":"hello"}',
      secretHeaderKeys: ['Authorization'],
      timeoutMs: 10_000,
    });
  });

  it('requestApi secretHeaderKeys 键名不被插值', () => {
    const config: BlueprintActionConfig = {
      type: 'requestApi',
      method: 'GET',
      url: 'https://a.com',
      headers: {},
      body: '',
      secretHeaderKeys: ['{{trigger.value}}'],
      timeoutMs: 10_000,
    };
    const result = interpolateActionConfig(config, makeContext());
    expect((result as { secretHeaderKeys: string[] }).secretHeaderKeys).toEqual([
      '{{trigger.value}}',
    ]);
  });

  it('navigate 插值 url', () => {
    const config: BlueprintActionConfig = {
      type: 'navigate',
      url: 'https://example.com/redirect?from={{event.componentId}}',
      target: '_blank',
    };
    const result = interpolateActionConfig(config, makeContext());
    expect(result).toEqual({
      type: 'navigate',
      url: 'https://example.com/redirect?from=c1',
      target: '_blank',
    });
  });

  it('setVisibility 原样返回（componentId 不插值）', () => {
    const config: BlueprintActionConfig = {
      type: 'setVisibility',
      targetComponentId: '{{event.componentId}}',
      visible: 'show',
    };
    const result = interpolateActionConfig(config, makeContext());
    expect(result).toEqual(config);
  });

  it('scrollToComponent 原样返回', () => {
    const config: BlueprintActionConfig = {
      type: 'scrollToComponent',
      targetComponentId: 'c2',
    };
    const result = interpolateActionConfig(config, makeContext());
    expect(result).toEqual(config);
  });

  it('refreshDataSource 原样返回', () => {
    const config: BlueprintActionConfig = {
      type: 'refreshDataSource',
      targetComponentId: 'c2',
    };
    const result = interpolateActionConfig(config, makeContext());
    expect(result).toEqual(config);
  });

  it('纯函数：不修改原配置对象', () => {
    const config: BlueprintActionConfig = {
      type: 'navigate',
      url: '{{event.componentId}}',
      target: '_blank',
    };
    const original = { ...config };
    interpolateActionConfig(config, makeContext());
    expect(config).toEqual(original);
  });

  it('纯函数：headers 对象不被原地修改', () => {
    const config: BlueprintActionConfig = {
      type: 'requestApi',
      method: 'GET',
      url: 'https://a.com',
      headers: { Authorization: '{{trigger.value}}' },
      body: '',
      secretHeaderKeys: [],
      timeoutMs: 10_000,
    };
    const originalHeadersValue = config.headers.Authorization;
    interpolateActionConfig(config, makeContext());
    expect(config.headers.Authorization).toBe(originalHeadersValue);
  });
});
