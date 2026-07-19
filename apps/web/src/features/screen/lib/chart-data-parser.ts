/**
 * 数据解析器（Data Parser）
 *
 * 阶段 2 任务 2.x：纯函数数据解析管线。
 * 原始数据 → 可选数据路径提取 → 字段映射 → 逻辑层处理 → 规范化图表数据。
 *
 * 设计原则：
 * - 纯函数，不发起 IO，不产生副作用
 * - 产出结构化结果（成功/空/错误），错误原因可区分
 * - 不抛出未捕获异常
 * - 错误信息面向用户可读，不泄露原始数据全文
 *
 * 管线顺序（对应 tasks.md 2.1-2.4）：
 * 1. extractDataByPath：按可选数据路径从嵌套结构提取目标数组
 * 2. mapFieldsToChartData：按字段映射（或默认推断）产出规范化条目
 * 3. applyLogicConfig：排序 + 条数限制（作用于副本）
 * 4. parseChartData：统一入口，组合 1-3
 */

import type { DataSourceConfig, FieldMapping, LogicConfig } from '@nebula/shared';

// ===== 规范化图表数据模型 =====

/** 规范化图表数据条目：维度名称 + 数值 */
export interface ChartDataItem {
  readonly name: string;
  readonly value: number;
}

// ===== 解析结果类型（判别联合） =====

/** 解析成功：有数据 */
export interface ParseSuccess {
  readonly status: 'success';
  readonly data: readonly ChartDataItem[];
}

/** 解析成功但为空：合法空数组或映射后零条 */
export interface ParseEmpty {
  readonly status: 'empty';
}

/** 解析失败：结构化错误 */
export interface ParseError {
  readonly status: 'error';
  readonly reason: ParseErrorReason;
  readonly message: string;
}

export type ParseResult = ParseSuccess | ParseEmpty | ParseError;

/** 解析错误原因（可区分） */
export type ParseErrorReason =
  | 'not-an-array' // 原始数据不是数组
  | 'path-not-found' // 数据路径不存在
  | 'path-not-array' // 路径指向的值不是数组
  | 'missing-dimension-field' // 映射维度字段缺失
  | 'missing-value-field' // 映射数值字段缺失
  | 'invalid-value-type'; // 映射值无法转为数值

// ===== 默认字段映射推断规则 =====

const DEFAULT_DIMENSION_FIELD = 'name';
const DEFAULT_VALUE_FIELD = 'value';

/**
 * 推断字段映射：未配置时使用默认规则 name→维度、value→数值。
 * 如果数据中没有 name/value 字段但有其他字段，取第一个字符串字段为维度、
 * 第一个数值字段为数值。
 */
function inferFieldMapping(sample: Record<string, unknown>): FieldMapping {
  if (DEFAULT_DIMENSION_FIELD in sample && DEFAULT_VALUE_FIELD in sample) {
    return { dimension: DEFAULT_DIMENSION_FIELD, value: DEFAULT_VALUE_FIELD };
  }

  let dimension: string | undefined;
  let value: string | undefined;
  for (const [key, val] of Object.entries(sample)) {
    if (dimension === undefined && typeof val === 'string') {
      dimension = key;
    }
    if (value === undefined && typeof val === 'number') {
      value = key;
    }
    if (dimension !== undefined && value !== undefined) break;
  }

  return {
    dimension: dimension ?? DEFAULT_DIMENSION_FIELD,
    value: value ?? DEFAULT_VALUE_FIELD,
  };
}

// ===== 2.2 数据路径提取 =====

/**
 * 按点分隔路径从嵌套结构中提取值。
 * 例如 dataPath='data.list' 从 { data: { list: [...] } } 中提取数组。
 *
 * 无 dataPath 时直接返回输入值。
 */
export function extractDataByPath(
  rawData: unknown,
  dataPath?: string,
): { ok: true; value: unknown } | { ok: false; reason: 'path-not-found' } {
  if (dataPath === undefined || dataPath === '') {
    return { ok: true, value: rawData };
  }

  const segments = dataPath.split('.');
  let current: unknown = rawData;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return { ok: false, reason: 'path-not-found' };
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { ok: false, reason: 'path-not-found' };
      }
      current = current[index];
    } else {
      if (!(segment in current)) {
        return { ok: false, reason: 'path-not-found' };
      }
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return { ok: true, value: current };
}

// ===== 2.2 字段映射 =====

/**
 * 将原始数据条目按字段映射转换为规范化图表数据。
 *
 * 每个条目必须是对象，且包含映射所需的维度字段和数值字段。
 * 数值字段的值必须可转为有限数值。
 */
export function mapFieldsToChartData(
  rawArray: readonly unknown[],
  fieldMapping: FieldMapping,
): { ok: true; data: ChartDataItem[] } | { ok: false; reason: ParseErrorReason; message: string } {
  const result: ChartDataItem[] = [];

  for (let i = 0; i < rawArray.length; i++) {
    const item = rawArray[i];
    if (item === null || item === undefined || typeof item !== 'object' || Array.isArray(item)) {
      return {
        ok: false,
        reason: 'not-an-array',
        message: `第 ${i + 1} 条数据不是对象`,
      };
    }

    const record = item as Record<string, unknown>;

    if (!(fieldMapping.dimension in record)) {
      return {
        ok: false,
        reason: 'missing-dimension-field',
        message: `第 ${i + 1} 条数据缺少维度字段 "${fieldMapping.dimension}"`,
      };
    }

    if (!(fieldMapping.value in record)) {
      return {
        ok: false,
        reason: 'missing-value-field',
        message: `第 ${i + 1} 条数据缺少数值字段 "${fieldMapping.value}"`,
      };
    }

    const rawName = record[fieldMapping.dimension];
    const name = typeof rawName === 'string' ? rawName : String(rawName);

    const rawValue = record[fieldMapping.value];
    const numValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(numValue)) {
      return {
        ok: false,
        reason: 'invalid-value-type',
        message: `第 ${i + 1} 条数据的数值字段 "${fieldMapping.value}" 无法转为数值`,
      };
    }

    result.push({ name, value: numValue });
  }

  return { ok: true, data: result };
}

// ===== 2.3 逻辑层处理 =====

/**
 * 对映射结果应用排序与条数限制。
 * 作用于副本，原始输入引用不变。
 */
export function applyLogicConfig(
  data: readonly ChartDataItem[],
  logic?: LogicConfig,
): ChartDataItem[] {
  if (logic === undefined) {
    return [...data];
  }

  let result = [...data];

  if (logic.sortField !== undefined && logic.sortDirection !== undefined) {
    const multiplier = logic.sortDirection === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const aVal = logic.sortField === 'dimension' ? a.name : a.value;
      const bVal = logic.sortField === 'dimension' ? b.name : b.value;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier;
      }
      return ((aVal as number) - (bVal as number)) * multiplier;
    });
  }

  if (logic.limit !== undefined && logic.limit > 0) {
    result = result.slice(0, logic.limit);
  }

  return result;
}

// ===== 2.4 统一解析入口 =====

/**
 * 统一数据解析入口：静态数据与 API 响应复用同一管线。
 *
 * 输入原始数据 + 数据层配置 + 逻辑层配置，产出结构化解析结果。
 * 纯函数，不发起 IO，不产生副作用。
 */
export function parseChartData(
  rawData: unknown,
  dataSource?: DataSourceConfig,
  logic?: LogicConfig,
): ParseResult {
  // 无数据源配置时返回空
  if (dataSource === undefined) {
    return { status: 'empty' };
  }

  // 步骤 1：数据路径提取
  const extracted = extractDataByPath(rawData, dataSource.dataPath);
  if (!extracted.ok) {
    return {
      status: 'error',
      reason: 'path-not-found',
      message: `数据路径 "${dataSource.dataPath ?? ''}" 不存在`,
    };
  }

  // 步骤 2：确认是数组
  if (!Array.isArray(extracted.value)) {
    return {
      status: 'error',
      reason: 'not-an-array',
      message: '数据源提取结果不是数组',
    };
  }

  if (extracted.value.length === 0) {
    return { status: 'empty' };
  }

  // 步骤 3：字段映射
  const firstItem = extracted.value[0] as Record<string, unknown>;
  const mapping = dataSource.fieldMapping ?? inferFieldMapping(firstItem);
  const mapped = mapFieldsToChartData(extracted.value, mapping);
  if (!mapped.ok) {
    return { status: 'error', reason: mapped.reason, message: mapped.message };
  }

  if (mapped.data.length === 0) {
    return { status: 'empty' };
  }

  // 步骤 4：逻辑层处理
  const processed = applyLogicConfig(mapped.data, logic);

  if (processed.length === 0) {
    return { status: 'empty' };
  }

  return { status: 'success', data: processed };
}
