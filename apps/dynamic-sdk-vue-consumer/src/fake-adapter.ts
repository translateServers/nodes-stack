/**
 * Vue 3 Consumer Fake 数据适配器。
 *
 * 生产由 XJ Vue adapter（frontend/src/api/screen.ts）实现；
 * 这里仅验证 SDK 契约闭环（openContext → execute → dataState）。
 */

import { createFakeScreenDataAdapter } from '@nebula/screen-dynamic-sdk/testing';

export const fakeAdapter = createFakeScreenDataAdapter({
  datasets: [
    {
      metricId: 1,
      code: 'cloudbase_ops',
      name: 'CloudBase 运行态势',
      rows: [
        { sample_hour: '2026-08-03 10:00', database_online: 3, api_success: 120 },
        { sample_hour: '2026-08-03 11:00', database_online: 4, api_success: 150 },
        { sample_hour: '2026-08-03 12:00', database_online: 4, api_success: 172 },
      ],
    },
  ],
});
