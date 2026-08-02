/**
 * Component Lab Host 集成测试（Spec §13.2 Phase 2, Task 2.3 + Checkpoint 2）
 *
 * 验证闭环："组件包定义 -> 宿主注册 -> 组件库投影 -> design/preview 渲染"
 *
 * 覆盖：
 * - buildLabRegistry 成功构建包含内置 6 组件 + 指标卡的实例注册表
 * - 指标卡出现在 registry 投影中（has / list）
 * - ComponentRenderer 在 design 模式下渲染指标卡 shadow DOM
 * - CustomElementRenderer 在 preview 模式下渲染指标卡 shadow DOM
 * - 移除指标卡 plugin 后 registry 仅含内置 6 组件（Checkpoint 2）
 * - 指标卡 tagName 在 customElements 全局已注册
 *
 * 测试隔离：customElements 是 Document 全局能力，指标卡 tagName 在 buildLabRegistry
 * 首次调用后注册；后续调用幂等（registry-factory 验证 constructor 一致性）。
 */

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createScreenComponentRegistry,
  type ScreenComponentInstanceRegistry,
} from '@nebula/screen-editor-core/experimental';
import {
  INDICATOR_CARD_TAG_NAME,
  INDICATOR_CARD_TYPE,
  indicatorCardManifest,
  indicatorCardPlugin,
} from '@nebula-example/indicator-card-vanilla';
import { ComponentLabHost } from './component-lab.js';
import { buildLabRegistry } from './lab-registry.js';
import { createIndicatorCardComponent } from './mock-component.js';

// react-ruler requires layout primitives unavailable in jsdom. Canvas behavior is covered here;
// ruler rendering belongs to browser-level verification.
vi.mock('@scena/react-ruler', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
});

describe('buildLabRegistry', () => {
  it('成功构建包含内置 6 组件 + 指标卡的实例注册表', async () => {
    const registry = await buildLabRegistry();
    expect(registry.size).toBe(7); // 6 built-in + 1 indicator card
  });

  it('指标卡出现在 registry 投影中', async () => {
    const registry = await buildLabRegistry();
    expect(registry.has(INDICATOR_CARD_TYPE)).toBe(true);

    const reg = registry.get(INDICATOR_CARD_TYPE);
    expect(reg).toBeDefined();
    expect(reg?.source).toBe('host');
    expect(reg?.manifest.type).toBe(INDICATOR_CARD_TYPE);
    expect(reg?.manifest.tagName).toBe(INDICATOR_CARD_TAG_NAME);
  });

  it('指标卡出现在 registry.list() 中', async () => {
    const registry = await buildLabRegistry();
    const list = registry.list();
    const indicatorCardReg = list.find((r) => r.manifest.type === INDICATOR_CARD_TYPE);
    expect(indicatorCardReg).toBeDefined();
  });

  it('指标卡 tagName 在 customElements 全局已注册', async () => {
    await buildLabRegistry();
    const ctor = customElements.get(INDICATOR_CARD_TAG_NAME);
    expect(ctor).toBeDefined();
  });

  it('重复调用 buildLabRegistry 幂等（constructor 一致）', async () => {
    await buildLabRegistry();
    const ctor1 = customElements.get(INDICATOR_CARD_TAG_NAME);
    await buildLabRegistry();
    const ctor2 = customElements.get(INDICATOR_CARD_TAG_NAME);
    expect(ctor1).toBe(ctor2);
  });

  it('移除指标卡 plugin 后 registry 仅含内置 6 组件（Checkpoint 2）', async () => {
    const registry: ScreenComponentInstanceRegistry = await createScreenComponentRegistry();
    expect(registry.size).toBe(6);
    expect(registry.has(INDICATOR_CARD_TYPE)).toBe(false);
  });

  it('内置组件仍可查询（text/bar-chart 等）', async () => {
    const registry = await buildLabRegistry();
    expect(registry.has('text')).toBe(true);
    expect(registry.has('bar-chart')).toBe(true);
    expect(registry.has('rect')).toBe(true);
    expect(registry.has('ellipse')).toBe(true);
    expect(registry.has('image')).toBe(true);
    expect(registry.has('button')).toBe(true);
  });
});

describe('ComponentLabHost 渲染', () => {
  it('通过真实组件库拖入画布并渲染外部指标卡', async () => {
    const { container } = render(<ComponentLabHost />);

    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
      expect(container.querySelector('[data-testid="canvas-surface"]')).not.toBeNull();
    });

    const editorSection = container.querySelector('[data-lab-section="editor"]');
    const libraryItem = [
      ...(editorSection?.querySelectorAll<HTMLElement>('[draggable="true"]') ?? []),
    ].find((item) => item.textContent?.includes('指标卡'));
    expect(libraryItem).not.toBeUndefined();
    const canvas = editorSection?.querySelector<HTMLElement>('[data-testid="canvas-drop-zone"]');
    expect(canvas).not.toBeNull();
    if (libraryItem === undefined || canvas === null || canvas === undefined) return;

    const values = new Map<string, string>();
    const dataTransfer = {
      dropEffect: 'copy',
      effectAllowed: 'copy',
      getData: (type: string) => values.get(type) ?? '',
      setData: (type: string, value: string) => values.set(type, value),
    } as unknown as DataTransfer;
    fireEvent.dragStart(libraryItem, { dataTransfer });
    expect(dataTransfer.getData('component-type')).toBe(INDICATOR_CARD_TYPE);
    fireEvent.dragOver(canvas, { dataTransfer, clientX: 240, clientY: 180 });
    fireEvent.drop(canvas, { dataTransfer, clientX: 240, clientY: 180 });

    await waitFor(() => {
      expect(
        editorSection?.querySelectorAll('[data-custom-element-host="example-indicator-card-v1"]')
          .length,
      ).toBeGreaterThan(1);
    });
  });

  it('真实 Workbench 预览事件携带 schemaVersion=2 文档', async () => {
    const { container } = render(<ComponentLabHost />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="canvas-surface"]')).not.toBeNull();
    });

    const editorSection = container.querySelector('[data-lab-section="editor"]');
    if (!(editorSection instanceof HTMLElement)) throw new Error('Editor section was not found');
    const previewRequest = vi.fn<(event: Event) => void>();
    editorSection.addEventListener('nebula-preview-request', previewRequest);

    fireEvent.click(within(editorSection).getByRole('button', { name: '预览' }));

    await waitFor(() => expect(previewRequest).toHaveBeenCalledOnce());
    const event = previewRequest.mock.calls[0]?.[0] as CustomEvent<{
      draft: { document: { schemaVersion: number; components: Array<{ type: string }> } };
    }>;
    expect(event.detail.draft.document.schemaVersion).toBe(2);
    expect(event.detail.draft.document.components[0]?.type).toBe(INDICATOR_CARD_TYPE);
  });

  it('异步构建 registry 后渲染 design 模式指标卡', async () => {
    const { container } = render(<ComponentLabHost />);

    // 等待 registry 构建完成（loading state 消失）且 custom element 已挂载
    // CustomElementRenderer 的元素创建 useEffect 在 React 渲染后异步执行，
    // 需等待实际 custom element 出现在 DOM 中再断言
    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
      expect(container.querySelector(INDICATOR_CARD_TAG_NAME)).not.toBeNull();
    });

    // design section 应包含通过 ComponentRenderer 渲染的指标卡
    const designSection = container.querySelector('[data-lab-section="design"]');
    expect(designSection).not.toBeNull();

    // 指标卡 host 容器应存在（CustomElementRenderer 创建的 div）
    const hostEl = designSection?.querySelector(
      `[data-custom-element-host="${INDICATOR_CARD_TAG_NAME}"]`,
    );
    expect(hostEl).not.toBeNull();

    // 内部应有 indicator-card custom element，其 shadow DOM 渲染了 title
    const cardEl = hostEl?.querySelector(INDICATOR_CARD_TAG_NAME);
    expect(cardEl).not.toBeNull();
    const shadowRoot = (cardEl as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
    expect(shadowRoot).not.toBeNull();
    const titleEl = shadowRoot?.querySelector('.indicator-card__title');
    expect(titleEl?.textContent).toBe(indicatorCardManifest.defaultProps.title);
  });

  it('preview 模式渲染指标卡（mode="preview" 不添加 design class）', async () => {
    const { container } = render(<ComponentLabHost />);

    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
    });

    const previewSection = container.querySelector('[data-lab-section="preview"]');
    expect(previewSection).not.toBeNull();

    const hostEl = previewSection?.querySelector(
      `[data-custom-element-host="${INDICATOR_CARD_TAG_NAME}"]`,
    );
    expect(hostEl).not.toBeNull();

    const cardEl = hostEl?.querySelector(INDICATOR_CARD_TAG_NAME);
    const shadowRoot = (cardEl as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
    expect(shadowRoot).not.toBeNull();

    // preview 模式不应有 design class
    const cardDiv = shadowRoot?.querySelector('.indicator-card');
    expect(cardDiv?.classList.contains('indicator-card--design')).toBe(false);

    // preview 模式渲染了自定义 title
    const titleEl = shadowRoot?.querySelector('.indicator-card__title');
    expect(titleEl?.textContent).toBe('预览指标');
  });

  it('design 模式渲染指标卡（mode="design" 添加 design class）', async () => {
    const { container } = render(<ComponentLabHost />);

    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
    });

    const designSection = container.querySelector('[data-lab-section="design"]');
    const hostEl = designSection?.querySelector(
      `[data-custom-element-host="${INDICATOR_CARD_TAG_NAME}"]`,
    );
    const cardEl = hostEl?.querySelector(INDICATOR_CARD_TAG_NAME);
    const shadowRoot = (cardEl as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
    const cardDiv = shadowRoot?.querySelector('.indicator-card');
    expect(cardDiv?.classList.contains('indicator-card--design')).toBe(true);
  });

  it('自定义 props 通过 ComponentRenderer 透传到指标卡 shadow DOM', async () => {
    const { container } = render(
      <ComponentLabHost
        component={createIndicatorCardComponent({
          id: 'custom-card',
          props: { title: '自定义指标', value: 42, color: '#10b981' },
        })}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
    });

    const designSection = container.querySelector('[data-lab-section="design"]');
    const hostEl = designSection?.querySelector(
      `[data-custom-element-host="${INDICATOR_CARD_TAG_NAME}"]`,
    );
    const cardEl = hostEl?.querySelector(INDICATOR_CARD_TAG_NAME);
    const shadowRoot = (cardEl as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;

    const titleEl = shadowRoot?.querySelector('.indicator-card__title');
    const valueEl = shadowRoot?.querySelector('.indicator-card__value');
    expect(titleEl?.textContent).toBe('自定义指标');
    expect(valueEl?.textContent).toBe('42');
  });

  it('registry 投影信息正确显示', async () => {
    const { container } = render(<ComponentLabHost />);

    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
    });

    // registry-info section 应显示注册表大小 7
    const registryInfo = container.querySelector('[data-lab-section="registry-info"]');
    expect(registryInfo?.textContent).toContain('7');
    expect(registryInfo?.textContent).toContain(INDICATOR_CARD_TYPE);
  });
});

describe('Checkpoint 2: 移除指标卡 plugin 后行为不变', () => {
  it('不传 components 时 createScreenComponentRegistry 仅返回内置 6 组件', async () => {
    const registry = await createScreenComponentRegistry();
    expect(registry.size).toBe(6);
    expect(registry.has(INDICATOR_CARD_TYPE)).toBe(false);

    // 内置组件仍可正常查询
    expect(registry.has('text')).toBe(true);
    expect(registry.has('bar-chart')).toBe(true);
  });

  it('indicatorCardPlugin 是合法的 ScreenComponentPlugin', () => {
    expect(indicatorCardPlugin.manifest).toBe(indicatorCardManifest);
    expect(typeof indicatorCardPlugin.define).toBe('function');
  });
});

/**
 * Phase 4 Task 4.3: 事件 E2E 集成测试
 *
 * 验证闭环："组件派发 nebula-component-event → renderer listener 校验 →
 * BlueprintEventProvider 回调 → React state 切换 → Card B 显隐变化"
 *
 * 覆盖：
 * - Card A（interactive=true）点击数值 → 派发 valueClick → Card B visibility 切换
 * - Card B 初始可见，第一次点击后变 hidden，第二次点击后恢复 visible
 * - 事件日志区显示最近的 valueClick 事件
 * - Card B（interactive=false）点击数值不派发事件（闸门）
 */
describe('Phase 4 Task 4.3: 事件 E2E（valueClick → toggle 目标卡）', () => {
  /**
   * 在已渲染的容器中查找指定 componentId 对应的指标卡 value 元素。
   *
   * CustomElementRenderer 通过 data-custom-element-host="<tagName>" 标记外层 div，
   * 内部包含一个 example-indicator-card-v1 元素。这里通过遍历所有 host div 来
   * 定位包含目标 componentId 的卡片（componentId 写入 model，无法直接通过 DOM 属性查询）。
   *
   * 简化策略：events section 中有两个 host div，第一个是 Card A，第二个是 Card B。
   */
  function findCardValueEl(container: HTMLElement, cardIndex: 0 | 1): HTMLElement {
    const eventsSection = container.querySelector('[data-lab-section="events"]');
    expect(eventsSection).not.toBeNull();
    const hosts = eventsSection?.querySelectorAll('[data-custom-element-host]');
    expect(hosts?.length).toBeGreaterThanOrEqual(cardIndex + 1);
    const host = hosts?.[cardIndex];
    const cardEl = host?.querySelector(INDICATOR_CARD_TAG_NAME);
    const shadowRoot = (cardEl as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
    const valueEl = shadowRoot?.querySelector('.indicator-card__value') as HTMLElement | null;
    expect(valueEl).not.toBeNull();
    return valueEl!;
  }

  it('Card A 点击数值 → Card B visibility 从 visible 切换为 hidden', async () => {
    const { container } = render(<ComponentLabHost />);

    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
    });

    const cardBWrapper = container.querySelector('[data-lab-target="card-b"]') as HTMLElement;
    expect(cardBWrapper.style.visibility).toBe('visible');

    const valueEl = findCardValueEl(container, 0);
    fireEvent.click(valueEl);

    // Card B visibility 应切换为 hidden
    expect(cardBWrapper.style.visibility).toBe('hidden');

    // 事件日志应包含 valueClick
    const logEl = container.querySelector('[data-lab-event-log]');
    expect(logEl?.textContent).toContain('valueClick');
    expect(logEl?.textContent).toContain('card-a');
  });

  it('Card A 二次点击 → Card B visibility 恢复 visible', async () => {
    const { container } = render(<ComponentLabHost />);

    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
    });

    const cardBWrapper = container.querySelector('[data-lab-target="card-b"]') as HTMLElement;
    expect(cardBWrapper.style.visibility).toBe('visible');

    const valueEl = findCardValueEl(container, 0);

    // 第一次点击：visible → hidden
    fireEvent.click(valueEl);
    expect(cardBWrapper.style.visibility).toBe('hidden');

    // 第二次点击：hidden → visible
    fireEvent.click(valueEl);
    expect(cardBWrapper.style.visibility).toBe('visible');
  });

  it('Card B（interactive=false）点击数值不切换 Card B 显隐（不派发 valueClick）', async () => {
    const { container } = render(<ComponentLabHost />);

    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
    });

    const cardBWrapper = container.querySelector('[data-lab-target="card-b"]') as HTMLElement;
    expect(cardBWrapper.style.visibility).toBe('visible');

    // 点击 Card B（cardIndex=1，interactive=false）的数值
    const valueEl = findCardValueEl(container, 1);
    fireEvent.click(valueEl);

    // 不应切换：仍为 visible
    expect(cardBWrapper.style.visibility).toBe('visible');

    // 日志也不应包含 valueClick
    const logEl = container.querySelector('[data-lab-event-log]');
    expect(logEl?.textContent).toContain('等待 valueClick 事件');
  });

  it('payload 中 value 反映 Card A 当前 props（100）', async () => {
    const { container } = render(<ComponentLabHost />);

    await waitFor(() => {
      expect(container.querySelector('[data-lab-state="loading"]')).toBeNull();
    });

    const valueEl = findCardValueEl(container, 0);
    fireEvent.click(valueEl);

    const logEl = container.querySelector('[data-lab-event-log]');
    // Card A props value=100，应出现在日志中
    expect(logEl?.textContent).toContain('"value":100');
  });
});
