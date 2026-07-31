import type { FieldMapping } from '../schemas/field-mapping.schema.js';
import type { DataSourceConfig, LogicConfig } from '../schemas/screen.schema.js';

export interface ChartDataItem {
  readonly name: string;
  readonly value: number;
}

export interface ParseSuccess {
  readonly status: 'success';
  readonly data: readonly ChartDataItem[];
}

export interface ParseEmpty {
  readonly status: 'empty';
}

export interface ParseError {
  readonly status: 'error';
  readonly reason: ParseErrorReason;
  readonly message: string;
}

export type ParseResult = ParseSuccess | ParseEmpty | ParseError;

export type ParseErrorReason =
  | 'not-an-array'
  | 'path-not-found'
  | 'path-not-array'
  | 'missing-dimension-field'
  | 'missing-value-field'
  | 'invalid-value-type';

const DEFAULT_DIMENSION_FIELD = 'name';
const DEFAULT_VALUE_FIELD = 'value';

function inferFieldMapping(sample: Record<string, unknown>): FieldMapping {
  if (DEFAULT_DIMENSION_FIELD in sample && DEFAULT_VALUE_FIELD in sample) {
    return { dimension: DEFAULT_DIMENSION_FIELD, value: DEFAULT_VALUE_FIELD };
  }

  let dimension: string | undefined;
  let value: string | undefined;
  for (const [key, candidate] of Object.entries(sample)) {
    if (dimension === undefined && typeof candidate === 'string') dimension = key;
    if (value === undefined && typeof candidate === 'number') value = key;
    if (dimension !== undefined && value !== undefined) break;
  }
  return {
    dimension: dimension ?? DEFAULT_DIMENSION_FIELD,
    value: value ?? DEFAULT_VALUE_FIELD,
  };
}

export function extractDataByPath(
  rawData: unknown,
  dataPath?: string,
): { ok: true; value: unknown } | { ok: false; reason: 'path-not-found' } {
  if (dataPath === undefined || dataPath === '') return { ok: true, value: rawData };

  let current: unknown = rawData;
  for (const segment of dataPath.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return { ok: false, reason: 'path-not-found' };
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { ok: false, reason: 'path-not-found' };
      }
      current = current[index];
      continue;
    }
    if (!(segment in current)) return { ok: false, reason: 'path-not-found' };
    current = (current as Record<string, unknown>)[segment];
  }
  return { ok: true, value: current };
}

export function mapFieldsToChartData(
  rawArray: readonly unknown[],
  fieldMapping: FieldMapping,
): { ok: true; data: ChartDataItem[] } | { ok: false; reason: ParseErrorReason; message: string } {
  const result: ChartDataItem[] = [];
  for (const [index, item] of rawArray.entries()) {
    if (item === null || item === undefined || typeof item !== 'object' || Array.isArray(item)) {
      return {
        ok: false,
        reason: 'not-an-array',
        message: `第 ${index + 1} 条数据不是对象`,
      };
    }
    const record = item as Record<string, unknown>;
    if (!(fieldMapping.dimension in record)) {
      return {
        ok: false,
        reason: 'missing-dimension-field',
        message: `第 ${index + 1} 条数据缺少维度字段 "${fieldMapping.dimension}"`,
      };
    }
    if (!(fieldMapping.value in record)) {
      return {
        ok: false,
        reason: 'missing-value-field',
        message: `第 ${index + 1} 条数据缺少数值字段 "${fieldMapping.value}"`,
      };
    }

    const rawName = record[fieldMapping.dimension];
    const rawValue = record[fieldMapping.value];
    const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(numericValue)) {
      return {
        ok: false,
        reason: 'invalid-value-type',
        message: `第 ${index + 1} 条数据的数值字段 "${fieldMapping.value}" 无法转为数值`,
      };
    }
    result.push({
      name: typeof rawName === 'string' ? rawName : String(rawName),
      value: numericValue,
    });
  }
  return { ok: true, data: result };
}

export function applyLogicConfig(
  data: readonly ChartDataItem[],
  logic?: LogicConfig,
): ChartDataItem[] {
  if (logic === undefined) return [...data];
  let result = [...data];
  if (logic.sortField !== undefined && logic.sortDirection !== undefined) {
    const multiplier = logic.sortDirection === 'desc' ? -1 : 1;
    result.sort((left, right) => {
      const leftValue = logic.sortField === 'dimension' ? left.name : left.value;
      const rightValue = logic.sortField === 'dimension' ? right.name : right.value;
      if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        return leftValue.localeCompare(rightValue) * multiplier;
      }
      return ((leftValue as number) - (rightValue as number)) * multiplier;
    });
  }
  if (logic.limit !== undefined && logic.limit > 0) result = result.slice(0, logic.limit);
  return result;
}

export function parseChartData(
  rawData: unknown,
  dataSource?: DataSourceConfig,
  logic?: LogicConfig,
): ParseResult {
  if (dataSource === undefined) return { status: 'empty' };
  const extracted = extractDataByPath(rawData, dataSource.dataPath);
  if (!extracted.ok) {
    return {
      status: 'error',
      reason: 'path-not-found',
      message: `数据路径 "${dataSource.dataPath ?? ''}" 不存在`,
    };
  }
  if (!Array.isArray(extracted.value)) {
    return { status: 'error', reason: 'not-an-array', message: '数据源提取结果不是数组' };
  }
  if (extracted.value.length === 0) return { status: 'empty' };

  const firstItem = extracted.value[0] as Record<string, unknown>;
  const mapped = mapFieldsToChartData(
    extracted.value,
    dataSource.fieldMapping ?? inferFieldMapping(firstItem),
  );
  if (!mapped.ok) return { status: 'error', reason: mapped.reason, message: mapped.message };
  if (mapped.data.length === 0) return { status: 'empty' };

  const processed = applyLogicConfig(mapped.data, logic);
  return processed.length === 0 ? { status: 'empty' } : { status: 'success', data: processed };
}
