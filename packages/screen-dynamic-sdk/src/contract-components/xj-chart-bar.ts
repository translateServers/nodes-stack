/**
 * 契约 fixture 组件：`xj.chart.bar/v1`（柱状图）。
 *
 * A1 切片用途：验证组件 API v2 契约（dataCapability=host-metric）与
 * model v2 dataState 闭环。无 ECharts 依赖，用纯 DOM 绘制简单柱状图。
 * 真实 XJ 柱状图（ECharts 渲染）在 A2 实现。
 */

import {
  SCREEN_COMPONENT_API_VERSION_V2,
  type ScreenComponentDataCapability,
  type ScreenComponentElementModelV2,
} from '@nebula/screen-component-sdk/dynamic';

export const XJ_CHART_BAR_TYPE = 'xj.chart.bar/v1';
export const XJ_CHART_BAR_TAG_NAME = 'xj-chart-bar-v1';

export const XJ_CHART_BAR_MANIFEST = {
  apiVersion: SCREEN_COMPONENT_API_VERSION_V2,
  type: XJ_CHART_BAR_TYPE,
  implementationVersion: '1.0.0',
  tagName: XJ_CHART_BAR_TAG_NAME,
  name: '柱状图（契约切片）',
  category: 'chart',
  icon: 'chart',
  description: 'A1 契约切片柱状图：展示分类/数值序列',
  keywords: ['bar', 'chart'],
  defaultSize: { width: 400, height: 260 },
  defaultProps: {
    title: '',
    categoryField: '',
    valueFields: [],
  },
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      categoryField: { type: 'string' },
      valueFields: { type: 'array', items: { type: 'string' } },
    },
  },
  events: [{ id: 'dataLoaded', name: '数据加载完成' }],
  // v2 扩展字段（类型层面由 dynamic 契约定义）
  dataCapability: 'host-metric' as ScreenComponentDataCapability,
} as const;

/** JSON 值安全转文本（避免对象默认 stringification） */
function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return '';
}

export class XjChartBarElement extends HTMLElement {
  static readonly observedAttributes = [] as const;

  #model: ScreenComponentElementModelV2 | null = null;

  connectedCallback(): void {
    this.attachShadow({ mode: 'open' });
    this.#render();
  }

  set model(model: ScreenComponentElementModelV2) {
    this.#model = structuredClone(model);
    this.#render();
  }

  get model(): ScreenComponentElementModelV2 | null {
    return this.#model;
  }

  #extractSeries(data: unknown): { labels: string[]; values: number[] } {
    const rows = Array.isArray(data) ? data : [];
    const valueFieldsRaw = this.#model?.props['valueFields'];
    const valueField = Array.isArray(valueFieldsRaw)
      ? toText(valueFieldsRaw[0]) || 'value'
      : 'value';
    const categoryField = toText(this.#model?.props['categoryField']);
    const labels: string[] = [];
    const values: number[] = [];
    for (const row of rows) {
      if (typeof row !== 'object' || row === null) continue;
      const record = row as Record<string, unknown>;
      const label =
        categoryField === '' ? String(labels.length + 1) : toText(record[categoryField]) || '';
      const raw = record[valueField];
      const value = typeof raw === 'number' ? raw : Number(raw);
      labels.push(label);
      values.push(Number.isFinite(value) ? value : 0);
    }
    return { labels, values };
  }

  #render(): void {
    const shadowRoot = this.shadowRoot;
    if (shadowRoot === null || shadowRoot.childNodes.length === 0) {
      if (shadowRoot === null) return;
      const style = document.createElement('style');
      style.textContent = `:host { display: block; width: 100%; height: 100%; }
.bar-chart { display: flex; flex-direction: column; width: 100%; height: 100%;
  background: rgba(15,23,42,0.6); border-radius: 8px; padding: 8px; box-sizing: border-box;
  font-family: system-ui, sans-serif; }
.title { color: #94a3b8; font-size: 14px; margin-bottom: 6px; }
.plot { flex: 1; display: flex; align-items: flex-end; gap: 6px; min-height: 0; }
.bar { flex: 1; background: linear-gradient(180deg, #38bdf8, #0ea5e9); border-radius: 2px 2px 0 0; }
.status { color: #f87171; font-size: 12px; padding: 8px; }`;
      shadowRoot.append(style);
      const root = document.createElement('div');
      root.className = 'bar-chart';
      shadowRoot.append(root);
    }
    const rootEl = shadowRoot.querySelector<HTMLDivElement>('.bar-chart');
    if (rootEl === null) return;
    const model = this.#model;
    if (model === null) {
      rootEl.innerHTML = '';
      return;
    }
    const title = toText(model.props['title']);
    rootEl.innerHTML = '';
    if (title !== '') {
      const titleEl = document.createElement('div');
      titleEl.className = 'title';
      titleEl.textContent = title;
      rootEl.append(titleEl);
    }
    const state = model.dataState;
    if (state.status === 'success') {
      const { labels, values } = this.#extractSeries(state.data);
      const plot = document.createElement('div');
      plot.className = 'plot';
      const max = Math.max(...values, 1);
      for (const [index, value] of values.entries()) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = `${Math.max(2, Math.round((value / max) * 100))}%`;
        bar.title = `${labels[index] ?? ''}: ${value}`;
        plot.append(bar);
      }
      if (values.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'status';
        empty.textContent = '暂无数据';
        plot.append(empty);
      }
      rootEl.append(plot);
    } else if (state.status === 'loading') {
      const statusEl = document.createElement('div');
      statusEl.className = 'status';
      statusEl.textContent = '加载中…';
      rootEl.append(statusEl);
    } else if (state.status === 'error') {
      const statusEl = document.createElement('div');
      statusEl.className = 'status';
      statusEl.textContent = state.error.message;
      rootEl.append(statusEl);
    }
  }
}
