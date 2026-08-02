import { describe, expect, it } from 'vitest';
import {
  applyLogicConfig,
  extractDataByPath,
  mapFieldsToChartData,
  parseChartData,
} from './chart-data-parser.js';

describe('chart data parser', () => {
  it('extracts nested arrays including numeric path segments', () => {
    expect(
      extractDataByPath({ payload: { groups: [[{ name: 'A', value: 1 }]] } }, 'payload.groups.0'),
    ).toEqual({
      ok: true,
      value: [{ name: 'A', value: 1 }],
    });
  });

  it('returns stable errors for missing mapped fields', () => {
    expect(
      mapFieldsToChartData([{ city: 'Beijing' }], {
        dimension: 'city',
        value: 'sales',
      }),
    ).toMatchObject({ ok: false, reason: 'missing-value-field' });
  });

  it('sorts and limits a detached result', () => {
    const input = [
      { name: 'A', value: 1 },
      { name: 'B', value: 3 },
      { name: 'C', value: 2 },
    ];
    expect(
      applyLogicConfig(input, { sortField: 'value', sortDirection: 'desc', limit: 2 }),
    ).toEqual([
      { name: 'B', value: 3 },
      { name: 'C', value: 2 },
    ]);
    expect(input.map(({ value }) => value)).toEqual([1, 3, 2]);
  });

  it('parses static object data through dataPath and field mapping', () => {
    const source = { payload: { rows: [{ city: 'Beijing', sales: '100' }] } };
    expect(
      parseChartData(source, {
        type: 'static',
        staticData: source,
        dataPath: 'payload.rows',
        fieldMapping: { dimension: 'city', value: 'sales' },
      }),
    ).toEqual({ status: 'success', data: [{ name: 'Beijing', value: 100 }] });
  });

  it('does not include raw data in parser errors', () => {
    const sensitiveValue = 'secret-value-that-must-not-leak';
    const result = parseChartData([{ sensitiveValue }], {
      type: 'static',
      staticData: [{ sensitiveValue }],
      fieldMapping: { dimension: 'name', value: 'value' },
    });
    expect(result.status).toBe('error');
    expect(JSON.stringify(result)).not.toContain(sensitiveValue);
  });
});
