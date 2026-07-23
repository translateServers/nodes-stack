/**
 * 动作参数模板插值纯函数（任务 10.5）
 *
 * 设计目标：
 * - 动作参数支持引用触发组件数据字段的表达式插值（只读求值，无脚本）
 * - 模板语法：`{{path.to.field}}`，仅支持点分隔路径，不支持 JS 表达式
 * - 字段缺失降级为空字符串（不抛错，不保留占位符）
 * - 非 string 值（number/boolean）转字符串；对象/数组转 JSON
 * - 不使用 eval / new Function，杜绝代码注入
 *
 * 安全约束（spec "无代码执行路径"）：
 * - 占位符内仅接受 `[A-Za-z_][A-Za-z0-9_]*` 点分隔路径
 * - 任意 JS 语法（算术、三元、函数调用、分号）视为非法路径 → 降级为空字符串
 */

import type { BlueprintActionConfig } from '@nebula/shared';

/** 模板插值上下文：包含触发组件与触发事件的数据来源 */
export interface TemplateContext {
  /** 触发组件上下文（componentClick/componentHover/dataLoaded/dataError 的 componentId 对应组件） */
  trigger?: {
    /** 组件的 value 属性（如表单输入值） */
    value?: unknown;
    /** 组件最新解析的数据对象（数据源请求结果） */
    data?: Record<string, unknown>;
  };
  /** 触发事件上下文 */
  event?: {
    /** 触发事件的组件 ID */
    componentId?: string;
    /** dataError 触发器的错误信息 */
    error?: string;
  };
}

/** 占位符正则：`{{ path }}`，path 为点分隔标识符（允许空占位符降级为空字符串） */
const TEMPLATE_PATTERN = /\{\{\s*([^}]*?)\s*\}\}/g;

/** 合法路径片段：字母/下划线开头，后接字母/数字/下划线 */
const PATH_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * 对模板字符串进行插值，返回插值后的字符串。
 *
 * - `{{trigger.value}}` → 触发组件的 value
 * - `{{trigger.data.field}}` → 触发组件数据的指定字段
 * - `{{event.componentId}}` → 触发事件的组件 ID
 * - `{{event.error}}` → dataError 错误信息
 *
 * 字段缺失或路径非法时降级为空字符串。
 */
export function interpolateTemplate(template: string, context: TemplateContext): string {
  if (template === '') return '';
  return template.replace(TEMPLATE_PATTERN, (_match, expr: string) => {
    const value = resolvePath(expr.trim(), context);
    return valueToText(value);
  });
}

/**
 * 对动作配置中的字符串字段进行模板插值。
 *
 * - requestApi: 插值 url / body / headers 的值（键名不插值）
 * - navigate: 插值 url
 * - 其他动作类型（setVisibility/scrollToComponent/refreshDataSource）：原样返回
 *
 * @returns 新的配置对象，不修改原配置（纯函数）
 */
export function interpolateActionConfig(
  config: BlueprintActionConfig,
  context: TemplateContext,
): BlueprintActionConfig {
  switch (config.type) {
    case 'requestApi':
      return {
        ...config,
        url: interpolateTemplate(config.url, context),
        body: interpolateTemplate(config.body, context),
        headers: interpolateHeaders(config.headers, context),
      };
    case 'navigate':
      return {
        ...config,
        url: interpolateTemplate(config.url, context),
      };
    case 'setVisibility':
    case 'scrollToComponent':
    case 'refreshDataSource':
      return config;
    default: {
      // 穷尽性检查：未知动作类型原样返回
      const _exhaustive: never = config;
      void _exhaustive;
      return config;
    }
  }
}

/** 对 headers 的值进行插值（键名保留原值，仅插值 value） */
function interpolateHeaders(
  headers: Record<string, string>,
  context: TemplateContext,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = interpolateTemplate(value, context);
  }
  return result;
}

/**
 * 解析点分隔路径，从 context 中取值。
 *
 * - 路径必须全部由合法标识符片段组成，否则视为非法路径返回 undefined
 * - 中途遇到 null/undefined 或非对象时停止并返回 undefined
 */
function resolvePath(path: string, context: TemplateContext): unknown {
  if (path === '') return undefined;
  const segments = path.split('.');
  // 校验所有片段为合法标识符，拒绝 JS 表达式
  for (const seg of segments) {
    if (!PATH_SEGMENT_PATTERN.test(seg)) {
      return undefined;
    }
  }
  let current: unknown = context;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/** 将任意值转换为插值文本（字段缺失/非法路径降级为空字符串） */
function valueToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // 对象/数组转 JSON；BigInt 等无法序列化时降级为空字符串
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}
