/**
 * Vue 3 Consumer 示例文档（V3 动态文档，host/xj-metric 数据源）。
 */

import type { DynamicScreenDocumentV3 } from '@nebula/screen-editor-core/dynamic';

export const sampleDocument: DynamicScreenDocumentV3 = {
  schemaVersion: 3,
  canvas: {
    width: 1920,
    height: 1080,
    backgroundColor: '#07141c',
    scaleMode: 'fit',
  },
  components: [
    {
      id: 'c1',
      name: '数据库在线',
      type: 'xj.metric-card/v1',
      position: { x: 40, y: 40, width: 320, height: 180 },
      style: {},
      props: { title: '数据库在线', decimals: 0 },
      dataSource: {
        type: 'host/xj-metric',
        metricId: 1,
        binding: { valueFields: ['database_online'] },
      },
      status: 'active',
      zIndex: 1,
    },
    {
      id: 'c2',
      name: '请求量',
      type: 'xj.chart.bar/v1',
      position: { x: 400, y: 40, width: 480, height: 280 },
      style: {},
      props: { title: '请求量', valueFields: ['api_success'], categoryField: 'sample_hour' },
      dataSource: {
        type: 'host/xj-metric',
        metricId: 1,
        binding: { categoryField: 'sample_hour', valueFields: ['api_success'] },
      },
      status: 'active',
      zIndex: 2,
    },
    {
      id: 'c3',
      name: '资源散点占位',
      type: 'xj.chart.bar/v1',
      position: { x: 900, y: 40, width: 420, height: 240 },
      style: {},
      props: { title: '备用柱状图' },
      status: 'active',
      zIndex: 3,
    },
  ],
  globalVariables: [],
};
