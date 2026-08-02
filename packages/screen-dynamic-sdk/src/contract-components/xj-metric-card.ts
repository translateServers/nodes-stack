/**
 * 契约 fixture 组件：`xj.metric-card/v1`（指标卡）。
 *
 * A1 切片用途：验证组件 API v2 契约（dataCapability=host-metric）与
 * model v2 dataState 闭环。真实 XJ 指标卡在 A2 实现。
 *
 * 渲染：标题 + dataState 数字（success 显示数据，loading/error 显示状态）。
 * 无框架依赖（Vanilla Custom Element）。
 */

import {
  SCREEN_COMPONENT_API_VERSION_V2,
  type ScreenComponentDataCapability,
  type ScreenComponentElementModelV2,
} from '@nebula/screen-component-sdk/dynamic';

export const XJ_METRIC_CARD_TYPE = 'xj.metric-card/v1';
export const XJ_METRIC_CARD_TAG_NAME = 'xj-metric-card-v1';

export const XJ_METRIC_CARD_MANIFEST = {
  apiVersion: SCREEN_COMPONENT_API_VERSION_V2,
  type: XJ_METRIC_CARD_TYPE,
  implementationVersion: '1.0.0',
  tagName: XJ_METRIC_CARD_TAG_NAME,
  name: '指标卡（契约切片）',
  category: 'chart',
  icon: 'chart',
  description: 'A1 契约切片指标卡：展示单个指标值',
  keywords: ['metric', 'kpi'],
  defaultSize: { width: 300, height: 180 },
  defaultProps: {
    title: '',
    unit: '',
    decimals: 0,
  },
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      unit: { type: 'string' },
      decimals: { type: 'integer', minimum: 0, maximum: 6 },
    },
  },
  events: [{ id: 'valueClick', name: '数值点击' }],
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

export class XjMetricCardElement extends HTMLElement {
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

  #render(): void {
    const shadowRoot = this.shadowRoot;
    if (shadowRoot === null || shadowRoot.childNodes.length === 0) {
      if (shadowRoot === null) return;
      const style = document.createElement('style');
      style.textContent = `:host { display: block; width: 100%; height: 100%; }
.card { display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 100%; height: 100%; background: rgba(15,23,42,0.6); border-radius: 8px;
  font-family: system-ui, sans-serif; }
.title { color: #94a3b8; font-size: 14px; margin-bottom: 8px; }
.value { color: #38bdf8; font-size: 32px; font-weight: 700; }
.status { color: #f87171; font-size: 12px; }`;
      shadowRoot.append(style);
      const card = document.createElement('div');
      card.className = 'card';
      shadowRoot.append(card);
    }
    const card = shadowRoot.querySelector<HTMLDivElement>('.card');
    if (card === null) return;
    const model = this.#model;
    if (model === null) {
      card.innerHTML = '';
      return;
    }
    const title = toText(model.props['title']);
    const unit = toText(model.props['unit']);
    const decimals = Number(model.props['decimals'] ?? 0);
    card.innerHTML = '';
    if (title !== '') {
      const titleEl = document.createElement('div');
      titleEl.className = 'title';
      titleEl.textContent = title;
      card.append(titleEl);
    }
    const state = model.dataState;
    if (state.status === 'success') {
      const valueEl = document.createElement('div');
      valueEl.className = 'value';
      const raw: unknown = state.data;
      let display = '—';
      if (typeof raw === 'number') {
        display = String(raw.toFixed(decimals));
      } else if (typeof raw === 'object' && raw !== null && 'value' in raw) {
        const value: unknown = raw.value;
        if (typeof value === 'number') {
          display = String(value.toFixed(decimals));
        }
      } else if (Array.isArray(raw) && raw.length > 0) {
        const last: unknown = raw[raw.length - 1];
        if (typeof last === 'object' && last !== null) {
          const record = last as Record<string, unknown>;
          const firstNumber = Object.values(record).find(
            (item): item is number => typeof item === 'number',
          );
          if (firstNumber !== undefined) {
            display = String(firstNumber.toFixed(decimals));
          }
        }
      }
      valueEl.textContent = `${display}${unit === '' ? '' : ` ${unit}`}`;
      card.append(valueEl);
    } else if (state.status === 'loading') {
      const statusEl = document.createElement('div');
      statusEl.className = 'status';
      statusEl.textContent = '加载中…';
      card.append(statusEl);
    } else if (state.status === 'error') {
      const statusEl = document.createElement('div');
      statusEl.className = 'status';
      statusEl.textContent = state.error.message;
      card.append(statusEl);
    }
  }
}
