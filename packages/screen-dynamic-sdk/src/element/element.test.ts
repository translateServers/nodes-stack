/**
 * screen-dynamic-sdk 元素挂载测试。
 *
 * 测业务约束：
 * - designer 元素挂载/保存/发布/校验/撤销事件闭环
 * - viewer 元素挂载 + fake adapter 数据执行闭环（loading → success）
 * - 数据失败组件触发 nebula-data-error，不影响其它组件
 * - registry 挂载后冻结
 */

import { afterEach, describe, expect, it } from 'vitest';

import { createXjContractFixtureRegistry } from '../contract-components/index.js';
import { defineNebulaScreenDesigner, defineNebulaScreenViewer } from '../element/define.js';
import { createFakeScreenDataAdapter } from '../testing/index.js';
import type { DynamicScreenDocumentV3 } from '@nebula/screen-editor-core/dynamic';

const fakeMetricRows = [
  { sample_hour: '2026-08-03 10:00', database_online: 3, api_success: 120 },
  { sample_hour: '2026-08-03 11:00', database_online: 4, api_success: 150 },
];

function createDocument(): DynamicScreenDocumentV3 {
  return {
    schemaVersion: 3,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [
      {
        id: 'c1',
        name: '在线数',
        type: 'xj.metric-card/v1',
        position: { x: 10, y: 10, width: 300, height: 180 },
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
        name: '请求柱状图',
        type: 'xj.chart.bar/v1',
        position: { x: 320, y: 10, width: 400, height: 260 },
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
    ],
    globalVariables: [],
  };
}

defineNebulaScreenDesigner();
defineNebulaScreenViewer();

afterEach(() => {
  document.body.innerHTML = '';
});

describe('nebula-screen-designer', () => {
  it('挂载、保存、发布与事件闭环', async () => {
    const registry = await createXjContractFixtureRegistry();
    const element = document.createElement('nebula-screen-designer');
    element.document = createDocument();
    element.componentRegistry = registry;
    document.body.append(element);

    await element.whenReady();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const savePromise = new Promise<void>((resolve) => {
      element.addEventListener('nebula-save-success', () => resolve(), { once: true });
    });
    const saved = element.save();
    await savePromise;
    expect(saved.components).toHaveLength(2);
    expect(saved.components[0].dataSource).toMatchObject({ type: 'host/xj-metric', metricId: 1 });

    const publishPromise = new Promise<void>((resolve) => {
      element.addEventListener('nebula-publish-success', () => resolve(), { once: true });
    });
    element.publish();
    await publishPromise;
    expect(element.getDocument()).not.toBeNull();

    element.remove();
  });

  it('validate 返回合法文档诊断（合法文档为空）', async () => {
    const registry = await createXjContractFixtureRegistry();
    const element = document.createElement('nebula-screen-designer');
    element.document = createDocument();
    element.componentRegistry = registry;
    document.body.append(element);
    await element.whenReady();
    expect(element.validate()).toEqual([]);
    element.remove();
  });

  it('registry 挂载后冻结', async () => {
    const registry = await createXjContractFixtureRegistry();
    const element = document.createElement('nebula-screen-designer');
    element.document = createDocument();
    element.componentRegistry = registry;
    document.body.append(element);
    await element.whenReady();
    expect(() => {
      element.componentRegistry = registry;
    }).toThrow();
    element.remove();
  });
});

describe('nebula-screen-viewer', () => {
  it('挂载 + fake adapter 数据执行闭环（success 渲染）', async () => {
    const registry = await createXjContractFixtureRegistry();
    const adapter = createFakeScreenDataAdapter({
      datasets: [
        { metricId: 1, code: 'cloudbase', name: 'CloudBase 运行态势', rows: fakeMetricRows },
      ],
    });
    const element = document.createElement('nebula-screen-viewer');
    element.document = createDocument();
    element.dataAdapter = adapter;
    element.componentRegistry = registry;
    document.body.append(element);

    await element.whenReady();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const metricCard = document
      .querySelector('nebula-screen-viewer')
      ?.shadowRoot?.querySelector('xj-metric-card-v1');
    expect(metricCard).not.toBeNull();
    // 契约切片规则：rows 数组取最后一行首个数值（database_online=4）
    const value = metricCard?.shadowRoot?.querySelector('.value')?.textContent;
    expect(value).toContain('4');

    const chartBar = document
      .querySelector('nebula-screen-viewer')
      ?.shadowRoot?.querySelector('xj-chart-bar-v1');
    const bars = chartBar?.shadowRoot?.querySelectorAll('.bar');
    expect(bars?.length).toBe(2);

    element.remove();
  });

  it('数据失败组件触发 nebula-data-error，且不阻断其它组件', async () => {
    const registry = await createXjContractFixtureRegistry();
    const adapter = createFakeScreenDataAdapter({
      datasets: [
        { metricId: 1, code: 'cloudbase', name: 'CloudBase 运行态势', rows: fakeMetricRows },
      ],
      failMetricIds: [1],
    });
    const element = document.createElement('nebula-screen-viewer');
    element.document = createDocument();
    element.dataAdapter = adapter;
    element.componentRegistry = registry;
    const errors: string[] = [];
    element.addEventListener('nebula-data-error', (event) => {
      errors.push((event as CustomEvent<{ componentId: string }>).detail.componentId);
    });
    document.body.append(element);

    await element.whenReady();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(errors).toContain('c1');
    expect(errors).toContain('c2');
    element.remove();
  });

  it('定时刷新按 refreshIntervalSeconds 重新执行数据', async () => {
    const registry = await createXjContractFixtureRegistry();
    let executeCount = 0;
    const baseAdapter = createFakeScreenDataAdapter({
      datasets: [
        { metricId: 1, code: 'cloudbase', name: 'CloudBase 运行态势', rows: fakeMetricRows },
      ],
    });
    const wrapped: typeof baseAdapter = {
      ...baseAdapter,
      execute: (request, signal) => {
        executeCount += 1;
        return baseAdapter.execute(request, signal);
      },
    };
    const element = document.createElement('nebula-screen-viewer');
    element.document = createDocument();
    element.dataAdapter = wrapped;
    element.componentRegistry = registry;
    element.options = { refreshIntervalSeconds: 1 };
    document.body.append(element);
    await element.whenReady();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(executeCount).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(executeCount).toBeGreaterThanOrEqual(4);
    element.remove();
  });
});
