/**
 * 指标卡 Custom Element 实现（Spec §9.1 + §13.2 Phase 2, Task 2.3 + Phase 4 Task 4.3）
 *
 * 实现 `ScreenComponentElement` 接口（Spec §9.1）：
 * - 通过 `model` setter 接收 detached snapshot
 * - 在 setter 中触发渲染（同步，避免中间态）
 * - 渲染内容根据 mode='design' | 'preview' 切换样式（Phase 2 仅视觉差异）
 * - interactive=false 时 SDK 忽略业务事件，本切片也不派发任何事件
 *
 * Phase 4 Task 4.3：interactive=true 时点击数值派发 `nebula-component-event`
 * CustomEvent（Spec §9.2），detail.payload 携带当前数值。design 模式下
 * interactive 恒为 false（由 editor-core 传入），事件不会派发。
 *
 * 渲染策略：
 * - 使用 shadow DOM 隔离样式，避免被宿主 CSS 污染
 * - 卡片填满容器（width:100%; height:100%），定位/尺寸/旋转由外层 Canvas wrapper 控制
 *   （Spec §9.1：element 应填满容器；定位/尺寸/旋转/zIndex/显隐/滤镜由外层管理）
 * - title/value/color 来自 model.props（已通过 sanitizeToJson 清洗为合法 JSON 值）
 *
 * 不接收 dataSource/logic/interaction（外部组件第一版不支持）
 */

import {
  COMPONENT_EVENT_TYPE,
  type ScreenComponentElement,
  type ScreenComponentElementModelV1,
} from '@nebula/screen-component-sdk';

/**
 * 指标卡 shadow DOM 模板（Spec §9.1: element 应填满容器）。
 *
 * 使用 CSS 变量 `--indicator-color` 暴露主色，便于宿主覆盖（如果需要）。
 */
const INDICATOR_CARD_TEMPLATE = `
  <style>
    :host {
      display: block;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .indicator-card {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      padding: 16px;
      box-sizing: border-box;
      background: var(--indicator-color, #4f46e5);
      color: #ffffff;
      border-radius: 8px;
      text-align: center;
      overflow: hidden;
    }
    .indicator-card__title {
      font-size: 14px;
      font-weight: 500;
      opacity: 0.9;
      margin-bottom: 8px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .indicator-card__value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
    }
    .indicator-card--design {
      border: 1px dashed rgba(255, 255, 255, 0.5);
    }
    /* Phase 4 Task 4.3: interactive 模式下数值区域显示 pointer 视觉提示 */
    .indicator-card--interactive .indicator-card__value {
      cursor: pointer;
    }
  </style>
  <div class="indicator-card" part="card">
    <div class="indicator-card__title" part="title"></div>
    <div class="indicator-card__value" part="value"></div>
  </div>
`;

/**
 * 从 model.props 安全读取字符串值（Spec §7.1 JSON 边界）。
 *
 * model 已由 SDK 的 sanitizeToJson 清洗，但仍可能因 defaultProps 被外部修改而包含
 * 非预期类型。这里做一次 defensive read，确保写入 DOM 的内容是合法字符串。
 */
function readStringProp(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === 'string' ? value : '';
}

/**
 * 从 model.props 安全读取数值（Spec §7.1 JSON 边界）。
 */
function readNumberProp(props: Record<string, unknown>, key: string): number {
  const value = props[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * 指标卡 Custom Element（Spec §9.1）。
 *
 * 通过 `model` setter 接收 detached snapshot，setter 内同步触发渲染。
 *
 * 生命周期：
 * - constructor：创建 shadow DOM 并注入模板
 * - model setter：读取 props，更新 shadow DOM 子节点
 * - mode='design'：添加 dashed border 视觉提示（仅样式差异，不改变布局）
 * - mode='preview'：纯展示模式
 */
export class IndicatorCardElement extends HTMLElement implements ScreenComponentElement {
  private _model: ScreenComponentElementModelV1 | null = null;
  private readonly _card: HTMLDivElement;
  private readonly _titleEl: HTMLDivElement;
  private readonly _valueEl: HTMLDivElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const template = document.createElement('template');
    template.innerHTML = INDICATOR_CARD_TEMPLATE;
    const content = template.content.cloneNode(true) as DocumentFragment;
    shadow.appendChild(content);

    this._card = shadow.querySelector('.indicator-card') as HTMLDivElement;
    this._titleEl = shadow.querySelector('.indicator-card__title') as HTMLDivElement;
    this._valueEl = shadow.querySelector('.indicator-card__value') as HTMLDivElement;

    // Phase 4 Task 4.3：点击数值派发 nebula-component-event（Spec §9.2）
    // 监听器在 constructor 一次性绑定，派发与否在 _handleValueClick 中按 model.interactive 闸门
    // （避免每次 model 赋值重新绑定监听器；Spec §9.1: interactive=false 时 SDK 忽略业务事件）
    this._valueEl.addEventListener('click', () => {
      this._handleValueClick();
    });
  }

  get model(): ScreenComponentElementModelV1 {
    if (this._model === null) {
      throw new Error('IndicatorCardElement: model accessed before assignment');
    }
    return this._model;
  }

  set model(value: ScreenComponentElementModelV1) {
    this._model = value;
    this._render();
  }

  /**
   * 渲染当前 model 到 shadow DOM。
   *
   * 策略（Spec §9.1）：
   * - title/value 写入 textContent（避免 XSS，不使用 innerHTML）
   * - color 通过 CSS custom property 传递（避免直接修改 style.color 时的优先级冲突）
   * - mode='design' 时添加 dashed border 视觉提示
   * - interactive=true 时添加 cursor:pointer 视觉提示（Phase 4 Task 4.3）
   */
  private _render(): void {
    const model = this._model;
    if (model === null) {
      return;
    }

    const props = model.props;
    const title = readStringProp(props, 'title');
    const value = readNumberProp(props, 'value');
    const color = readStringProp(props, 'color');

    this._titleEl.textContent = title;
    this._valueEl.textContent = value.toLocaleString();

    if (color.length > 0) {
      this._card.style.setProperty('--indicator-color', color);
    } else {
      this._card.style.removeProperty('--indicator-color');
    }

    if (model.mode === 'design') {
      this._card.classList.add('indicator-card--design');
    } else {
      this._card.classList.remove('indicator-card--design');
    }

    // Phase 4 Task 4.3：interactive 视觉提示（cursor: pointer）
    if (model.interactive) {
      this._card.classList.add('indicator-card--interactive');
    } else {
      this._card.classList.remove('indicator-card--interactive');
    }
  }

  /**
   * 处理数值区域点击事件（Spec §9.2，Phase 4 Task 4.3）。
   *
   * 闸门：
   * - model 未赋值：忽略
   * - model.interactive=false：忽略（design 模式 / 预览态未启用交互）
   *
   * 派发：
   * - CustomEvent 类型 `nebula-component-event`（COMPONENT_EVENT_TYPE）
   * - detail.name = 'valueClick'（与 manifest.events 对齐）
   * - detail.payload = `{ value: <current value> }`（JSON 边界合法）
   * - bubbles + composed：使事件穿过 shadow DOM 到达 editor-core renderer 监听器
   */
  private _handleValueClick(): void {
    const model = this._model;
    if (model === null || !model.interactive) {
      return;
    }
    const value = readNumberProp(model.props, 'value');
    this.dispatchEvent(
      new CustomEvent(COMPONENT_EVENT_TYPE, {
        detail: { name: 'valueClick', payload: { value } },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
