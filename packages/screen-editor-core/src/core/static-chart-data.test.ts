import { parseStaticBarChartData } from './static-chart-data.js';

describe('parseStaticBarChartData', () => {
  it('parses nested static data with field mapping and logic', () => {
    expect(
      parseStaticBarChartData(
        {
          type: 'static',
          staticData: {
            payload: {
              rows: [
                { city: 'Beijing', sales: 100 },
                { city: 'Shanghai', sales: 200 },
              ],
            },
          },
          dataPath: 'payload.rows',
          fieldMapping: { dimension: 'city', value: 'sales' },
        },
        undefined,
        { sortField: 'value', sortDirection: 'desc', limit: 1 },
      ),
    ).toEqual({ status: 'success', data: [{ name: 'Shanghai', value: 200 }] });
  });

  it('uses legacy props.data only when a static data source is absent', () => {
    const legacy = [{ name: 'legacy', value: 1 }];
    const current = [{ name: 'current', value: 2 }];

    expect(parseStaticBarChartData(undefined, legacy)).toEqual({
      status: 'success',
      data: legacy,
    });
    expect(parseStaticBarChartData({ type: 'static', staticData: current }, legacy)).toEqual({
      status: 'success',
      data: current,
    });
  });

  it('has no API or dataset execution branch', () => {
    expect(parseStaticBarChartData(undefined, undefined)).toEqual({ status: 'empty' });
  });
});
