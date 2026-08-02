/**
 * IndicatorCardElement 单元测试（Spec §9.1 + §13.2 Phase 2, Task 2.3）
 *
 * 覆盖：
 * - manifest 校验通过（Spec §7.2）
 * - plugin.define() 幂等返回同一构造器（Spec §7.6）
 * - Custom Element 注册后可通过 document.createElement 创建
 * - model setter 触发渲染：title/value/color 写入 shadow DOM
 * - mode='design' / 'preview' 切换样式 class
 * - model 未赋值时 getter 抛错
 * - 非预期类型的 props 被安全降级
 * - detached snapshot：组件修改 model 不影响下次传入的源对象（由 SDK 保证）
 *
 * 测试隔离：每个 test file 在独立 jsdom 环境运行，customElements.get 在 setup
 * 时为空，定义后仅在当前 file 内可见。
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  defineScreenComponent,
  validateManifest,
  type ScreenComponentElementModel,
} from '@nebula/screen-component-sdk';
import { expectManifestOk } from '@nebula/screen-component-sdk/testing';
import { IndicatorCardElement } from './indicator-card-element.js';
import {
  INDICATOR_CARD_IMPLEMENTATION_VERSION,
  INDICATOR_CARD_TAG_NAME,
  INDICATOR_CARD_TYPE,
  indicatorCardManifest,
  indicatorCardPlugin,
} from './index.js';

/**
 * 创建一个最小合法的 model snapshot（Spec §9.1）。
 *
 * 默认填充 defaultProps 中的值，调用方可通过 overrides 修改任意字段。
 */
function createModel(
  overrides?: Partial<ScreenComponentElementModel>,
): ScreenComponentElementModel {
  return {
    apiVersion: 1,
    componentId: 'test-comp-1',
    mode: 'design',
    interactive: false,
    props: { ...indicatorCardManifest.defaultProps },
    style: {},
    size: { width: 320, height: 180 },
    ...overrides,
  };
}

/**
 * 确保 tagName 在每个测试前未注册；测试中首次定义。
 */
function ensureElementDefined(): void {
  if (customElements.get(INDICATOR_CARD_TAG_NAME) === undefined) {
    customElements.define(INDICATOR_CARD_TAG_NAME, IndicatorCardElement);
  }
}

/**
 * 创建已注册的 IndicatorCardElement 实例。
 */
function createIndicatorCard(): IndicatorCardElement {
  ensureElementDefined();
  return document.createElement(INDICATOR_CARD_TAG_NAME) as IndicatorCardElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('indicatorCardManifest', () => {
  it('通过 SDK manifest 纯校验', () => {
    const result = validateManifest(indicatorCardManifest);
    expect(result.ok).toBe(true);
  });

  it('expectManifestOk 辅助断言通过', () => {
    expectManifestOk(indicatorCardManifest);
  });

  it('identity 字段满足外部 type 正则与 tagName 命名规则', () => {
    expect(indicatorCardManifest.type).toBe(INDICATOR_CARD_TYPE);
    expect(indicatorCardManifest.tagName).toBe(INDICATOR_CARD_TAG_NAME);
    expect(indicatorCardManifest.implementationVersion).toBe(INDICATOR_CARD_IMPLEMENTATION_VERSION);
    expect(INDICATOR_CARD_TYPE).toMatch(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+\/v[1-9][0-9]*$/);
    expect(INDICATOR_CARD_TAG_NAME).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+-v[1-9][0-9]*$/);
    expect(INDICATOR_CARD_TYPE.startsWith('nebula.')).toBe(false);
  });

  it('Phase 3 声明 propertyPanel，Phase 4 声明 events（valueClick）', () => {
    // Task 3.3: propertyPanel 已接入（title/value/color 声明式属性面板）
    expect(indicatorCardManifest.propertyPanel).toBeDefined();
    expect(indicatorCardManifest.propertyPanel!.length).toBeGreaterThan(0);
    // Task 4.3: events 已接入 valueClick（标准事件闭环）
    expect(indicatorCardManifest.events).toBeDefined();
    expect(indicatorCardManifest.events!.length).toBe(1);
    expect(indicatorCardManifest.events![0]?.id).toBe('valueClick');
    expect(indicatorCardManifest.events![0]?.name).toBe('点击数值');
  });

  it('defaultProps 满足 propsSchema', () => {
    const { defaultProps, propsSchema } = indicatorCardManifest;
    expect(typeof defaultProps.title).toBe('string');
    expect(typeof defaultProps.value).toBe('number');
    expect(typeof defaultProps.color).toBe('string');
    expect(propsSchema.additionalProperties).toBe(false);
  });

  it('defaultSize 为正数', () => {
    const { defaultSize } = indicatorCardManifest;
    expect(defaultSize.width).toBeGreaterThan(0);
    expect(defaultSize.height).toBeGreaterThan(0);
  });
});

describe('indicatorCardPlugin', () => {
  it('是合法的 ScreenComponentPlugin', () => {
    expect(indicatorCardPlugin.manifest).toBe(indicatorCardManifest);
    expect(typeof indicatorCardPlugin.define).toBe('function');
  });

  it('define() 幂等返回同一构造器引用', () => {
    const ctor1 = indicatorCardPlugin.define();
    const ctor2 = indicatorCardPlugin.define();
    expect(ctor1).toBe(ctor2);
    expect(ctor1).toBe(IndicatorCardElement);
  });

  it('defineScreenComponent identity helper 返回原 plugin', () => {
    const plugin = defineScreenComponent({
      manifest: indicatorCardManifest,
      define: () => IndicatorCardElement,
    });
    expect(plugin.manifest).toBe(indicatorCardManifest);
    expect(plugin.define()).toBe(IndicatorCardElement);
  });
});

describe('IndicatorCardElement', () => {
  it('通过 document.createElement 创建后是 IndicatorCardElement 实例', () => {
    const el = createIndicatorCard();
    expect(el).toBeInstanceOf(IndicatorCardElement);
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('model 未赋值时 getter 抛错', () => {
    const el = createIndicatorCard();
    expect(() => el.model).toThrowError(/model accessed before assignment/);
  });

  it('model setter 触发 shadow DOM 渲染：title/value 写入 textContent', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      props: { title: '销售额', value: 12345, color: '#10b981' },
    });

    const titleEl = el.shadowRoot?.querySelector('.indicator-card__title');
    const valueEl = el.shadowRoot?.querySelector('.indicator-card__value');
    expect(titleEl?.textContent).toBe('销售额');
    expect(valueEl?.textContent).toBe('12,345');
  });

  it('color 通过 CSS custom property 设置到卡片', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      props: { title: '指标', value: 0, color: '#ff6b6b' },
    });

    const card = el.shadowRoot?.querySelector('.indicator-card') as HTMLElement | null;
    expect(card?.style.getPropertyValue('--indicator-color')).toBe('#ff6b6b');
  });

  it('color 为空字符串时移除 CSS custom property', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    // 先设置一个非空 color
    el.model = createModel({
      props: { title: '指标', value: 0, color: '#ff6b6b' },
    });
    // 再设置为空字符串
    el.model = createModel({
      props: { title: '指标', value: 0, color: '' },
    });

    const card = el.shadowRoot?.querySelector('.indicator-card') as HTMLElement | null;
    expect(card?.style.getPropertyValue('--indicator-color')).toBe('');
  });

  it('mode="design" 添加 indicator-card--design class', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({ mode: 'design' });

    const card = el.shadowRoot?.querySelector('.indicator-card');
    expect(card?.classList.contains('indicator-card--design')).toBe(true);
  });

  it('mode="preview" 不添加 design class', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({ mode: 'preview' });

    const card = el.shadowRoot?.querySelector('.indicator-card');
    expect(card?.classList.contains('indicator-card--design')).toBe(false);
  });

  it('model 更新复用同一 Element 实例（不重建 DOM）', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      props: { title: '初始', value: 100, color: '#4f46e5' },
    });
    const cardBefore = el.shadowRoot?.querySelector('.indicator-card');
    const titleBefore = el.shadowRoot?.querySelector('.indicator-card__title');

    el.model = createModel({
      props: { title: '更新后', value: 200, color: '#10b981' },
    });
    const cardAfter = el.shadowRoot?.querySelector('.indicator-card');
    const titleAfter = el.shadowRoot?.querySelector('.indicator-card__title');

    expect(cardAfter).toBe(cardBefore);
    expect(titleAfter).toBe(titleBefore);
    expect(titleAfter?.textContent).toBe('更新后');
  });

  it('非字符串 title 被安全降级为空字符串', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      props: { title: 123, value: 0, color: '#4f46e5' },
    });

    const titleEl = el.shadowRoot?.querySelector('.indicator-card__title');
    expect(titleEl?.textContent).toBe('');
  });

  it('非数值 value 被安全降级为 0', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      props: { title: '指标', value: 'not-a-number' as unknown as number, color: '#4f46e5' },
    });

    const valueEl = el.shadowRoot?.querySelector('.indicator-card__value');
    expect(valueEl?.textContent).toBe('0');
  });

  it('非有限数值（NaN/Infinity）被安全降级为 0', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      props: { title: '指标', value: Number.NaN, color: '#4f46e5' },
    });

    const valueEl = el.shadowRoot?.querySelector('.indicator-card__value');
    expect(valueEl?.textContent).toBe('0');
  });

  it('shadow DOM 模板包含 card / title / value 节点', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    expect(el.shadowRoot?.querySelector('.indicator-card')).not.toBeNull();
    expect(el.shadowRoot?.querySelector('.indicator-card__title')).not.toBeNull();
    expect(el.shadowRoot?.querySelector('.indicator-card__value')).not.toBeNull();
  });

  it('shadow DOM 使用 open mode（宿主可查询 part 属性）', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    expect(el.shadowRoot?.mode).toBe('open');
    expect(el.shadowRoot?.querySelector('[part="card"]')).not.toBeNull();
    expect(el.shadowRoot?.querySelector('[part="title"]')).not.toBeNull();
    expect(el.shadowRoot?.querySelector('[part="value"]')).not.toBeNull();
  });
});

describe('IndicatorCardElement · valueClick 事件派发（Phase 4 Task 4.3, Spec §9.2）', () => {
  it('interactive=true + 点击数值 → 派发 nebula-component-event {valueClick, {value}}', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      mode: 'preview',
      interactive: true,
      props: { title: '触发卡', value: 42, color: '#4f46e5' },
    });

    const events: CustomEvent[] = [];
    el.addEventListener('nebula-component-event', (e) => {
      events.push(e as CustomEvent);
    });

    const valueEl = el.shadowRoot?.querySelector('.indicator-card__value') as HTMLElement;
    expect(valueEl).not.toBeNull();
    valueEl.click();

    expect(events).toHaveLength(1);
    const evt = events[0];
    expect(evt.type).toBe('nebula-component-event');
    expect(evt.bubbles).toBe(true);
    expect(evt.composed).toBe(true);
    const detail = evt.detail as { name: string; payload: { value: number } };
    expect(detail.name).toBe('valueClick');
    expect(detail.payload).toEqual({ value: 42 });
  });

  it('interactive=false（design 模式）+ 点击数值 → 不派发事件', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      mode: 'design',
      interactive: false,
      props: { title: '设计态', value: 100, color: '#4f46e5' },
    });

    const events: CustomEvent[] = [];
    el.addEventListener('nebula-component-event', (e) => {
      events.push(e as CustomEvent);
    });

    const valueEl = el.shadowRoot?.querySelector('.indicator-card__value') as HTMLElement;
    valueEl.click();

    expect(events).toHaveLength(0);
  });

  it('preview + interactive=false → 不派发事件（闸门只看 interactive 不看 mode）', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      mode: 'preview',
      interactive: false,
      props: { title: '预览态', value: 100, color: '#4f46e5' },
    });

    const events: CustomEvent[] = [];
    el.addEventListener('nebula-component-event', (e) => {
      events.push(e as CustomEvent);
    });

    const valueEl = el.shadowRoot?.querySelector('.indicator-card__value') as HTMLElement;
    valueEl.click();

    expect(events).toHaveLength(0);
  });

  it('interactive=true 时数值区域添加 indicator-card--interactive class（cursor: pointer）', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      mode: 'preview',
      interactive: true,
      props: { title: '触发卡', value: 0, color: '#4f46e5' },
    });

    const card = el.shadowRoot?.querySelector('.indicator-card');
    expect(card?.classList.contains('indicator-card--interactive')).toBe(true);
  });

  it('model 未赋值时点击数值不抛错（防御性）', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    // 不赋值 model，直接点击 value 元素
    const valueEl = el.shadowRoot?.querySelector('.indicator-card__value') as HTMLElement;
    expect(() => valueEl.click()).not.toThrow();
  });

  it('payload 中的 value 反映 model 当前值（更新后派发新值）', () => {
    const el = createIndicatorCard();
    document.body.appendChild(el);
    el.model = createModel({
      mode: 'preview',
      interactive: true,
      props: { title: '初始', value: 10, color: '#4f46e5' },
    });

    const events: CustomEvent[] = [];
    el.addEventListener('nebula-component-event', (e) => {
      events.push(e as CustomEvent);
    });

    // 第一次点击：value=10
    const valueEl = el.shadowRoot?.querySelector('.indicator-card__value') as HTMLElement;
    valueEl.click();

    // 更新 model.props.value 到 99 后再点击
    el.model = createModel({
      mode: 'preview',
      interactive: true,
      props: { title: '更新', value: 99, color: '#4f46e5' },
    });
    valueEl.click();

    expect(events).toHaveLength(2);
    const firstPayload = (events[0].detail as { payload: { value: number } }).payload;
    const secondPayload = (events[1].detail as { payload: { value: number } }).payload;
    expect(firstPayload.value).toBe(10);
    expect(secondPayload.value).toBe(99);
  });
});
