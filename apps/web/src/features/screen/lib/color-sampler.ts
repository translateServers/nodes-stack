/**
 * 任务 9.1：颜色采样纯函数模块
 *
 * 定义可采样表面与颜色规范化规则：
 * - `normalizeColor`：将 hex / rgb / rgba 字符串规范化为 6 位 hex（小写）
 * - `isTransparent`：判定颜色是否为透明（含 'transparent' 关键字或 alpha=0）
 * - `sampleColorFromElement`：从 DOM 元素的 computed style 读取颜色，
 *   按优先级（背景 > 边框 > 文本）返回首个不透明颜色
 *
 * 设计原则：
 * - 不使用 canvas像素读取（getImageData），避免跨域污染与性能开销
 * - 仅消费编辑器自身拥有的 DOM 表面，不读取跨域 iframe 或外部元素
 * - 不可采样目标（透明 / 空 / 继承默认值）返回 null，由调用方决定反馈语义
 */

/**
 * 可采样表面种类。
 *
 * 优先级从高到低：
 * 1. component-background — 组件背景色
 * 2. component-border — 组件边框色（仅在 borderWidth > 0 时生效）
 * 3. component-text — 组件文本色
 * 4. canvas-background — 画布背景色
 * 5. none — 无可采样表面
 */
export type SampledTarget =
  | 'component-background'
  | 'component-border'
  | 'component-text'
  | 'canvas-background'
  | 'none';

/**
 * 采样结果。
 *
 * - `color` 为规范化后的 6 位 hex 字符串；不可采样时为 null
 * - `target` 描述采样来源，便于 UI 反馈与日志
 */
export interface SampledColor {
  readonly color: string | null;
  readonly target: SampledTarget;
}

/** 不可采样结果常量，避免重复构造 */
export const UNSAMPLEABLE: SampledColor = { color: null, target: 'none' } as const;

/**
 * 判定颜色字符串是否为透明。
 *
 * 覆盖：
 * - 'transparent' 关键字
 * - 'rgba(r, g, b, 0)' / 'rgba(r, g, b, 0.0)' 等 alpha=0 的 rgba
 * - 空字符串与非颜色值（保守视为透明，不参与采样）
 *
 * 注意：rgb()（3 个分量）永远不透明，仅 rgba()（4 个分量）的 alpha=0 才视为透明。
 * 早期实现错误地将 rgb() 的蓝色分量当作 alpha，导致 'rgb(0, 0, 0)' 被误判为透明。
 *
 * @param color - 待判定的颜色字符串
 * @returns true 表示透明或不可解析
 */
export function isTransparent(color: string): boolean {
  if (!color) return true;
  const trimmed = color.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed === 'transparent' || trimmed === 'none') return true;

  // 仅 rgba() 含 alpha 通道（4 个分量），rgb()（3 个分量）永远不透明
  const rgbaMatch = /^rgba\(\s*([^)]+)\s*\)\s*$/.exec(trimmed);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((p) => p.trim());
    if (parts.length < 4) return false;
    const alpha = Number.parseFloat(parts[3]);
    return Number.isNaN(alpha) || alpha === 0;
  }

  // rgb() 或其他格式均视为不透明
  return false;
}

/**
 * 将十进制分量（0-255）规范化为 2 位小写 hex。
 */
function toHex2(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, '0');
}

/**
 * 将颜色字符串规范化为 6 位小写 hex（不带 alpha）。
 *
 * 支持：
 * - 3 位 hex：'#fff' → '#ffffff'
 * - 6 位 hex：'#FFFFFF' → '#ffffff'
 * - 8 位 hex（带 alpha）：'#ffffffff' → '#ffffff'（丢弃 alpha）
 * - rgb()：'rgb(255, 0, 0)' → '#ff0000'
 * - rgba()：'rgba(255, 0, 0, 0.5)' → '#ff0000'（丢弃 alpha）
 *
 * 不支持：hsl()、hsla()、颜色关键字（'red'）、CSS 变量（'var(--x)'）
 *
 * @param input - 待规范化的颜色字符串
 * @returns 6 位小写 hex；不可解析时返回 null
 */
export function normalizeColor(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // hex 处理
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (/^[0-9a-f]{3}$/.test(hex)) {
      // #fff → #ffffff
      return `#${hex
        .split('')
        .map((c) => c + c)
        .join('')}`;
    }
    if (/^[0-9a-f]{6}$/.test(hex)) {
      return `#${hex}`;
    }
    if (/^[0-9a-f]{8}$/.test(hex)) {
      // 8 位 hex（带 alpha），丢弃后 2 位
      return `#${hex.slice(0, 6)}`;
    }
    return null;
  }

  // rgb() / rgba() 处理
  const rgbMatch = /^rgba?\(\s*([^)]+)\s*\)\s*$/.exec(trimmed);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => p.trim());
    if (parts.length < 3) return null;
    const r = Number.parseFloat(parts[0]);
    const g = Number.parseFloat(parts[1]);
    const b = Number.parseFloat(parts[2]);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  }

  // 其他格式（hsl、颜色关键字、var 等）不支持
  return null;
}

/**
 * 从 DOM 元素的 computed style 按优先级采样颜色。
 *
 * 优先级（与 SampledTarget 一致）：
 * 1. background-color（非透明时取）
 * 2. border-color（仅在 border-width > 0 且非透明时取）
 * 3. color（文本色，非默认时取；这里不区分默认值，由调用方按需过滤）
 *
 * @param el - 目标 DOM 元素
 * @returns 采样结果；不可采样时 color=null, target='none'
 */
export function sampleColorFromElement(el: Element | null): SampledColor {
  if (!el) return UNSAMPLEABLE;

  const computed = window.getComputedStyle(el);
  if (!computed) return UNSAMPLEABLE;

  // 1. 背景色
  const bgRaw = computed.backgroundColor;
  if (bgRaw && !isTransparent(bgRaw)) {
    const normalized = normalizeColor(bgRaw);
    if (normalized) {
      return { color: normalized, target: 'component-background' };
    }
  }

  // 2. 边框色（仅在 border-width > 0 时生效）
  const borderWidthRaw = computed.borderWidth;
  const borderWidth = Number.parseFloat(borderWidthRaw);
  if (!Number.isNaN(borderWidth) && borderWidth > 0) {
    const borderRaw = computed.borderColor;
    if (borderRaw && !isTransparent(borderRaw)) {
      const normalized = normalizeColor(borderRaw);
      if (normalized) {
        return { color: normalized, target: 'component-border' };
      }
    }
  }

  // 3. 文本色
  const colorRaw = computed.color;
  if (colorRaw && !isTransparent(colorRaw)) {
    const normalized = normalizeColor(colorRaw);
    if (normalized) {
      return { color: normalized, target: 'component-text' };
    }
  }

  return UNSAMPLEABLE;
}

/**
 * 从画布容器元素采样背景色。
 *
 * 画布背景色通常来自项目 canvas.backgroundColor，渲染在画布容器的 background-color。
 * 与组件采样不同，画布只读 background-color，不读 border / color。
 *
 * @param canvasEl - 画布容器 DOM 元素
 * @returns 采样结果；不可采样时 color=null, target='none'
 */
export function sampleColorFromCanvas(canvasEl: Element | null): SampledColor {
  if (!canvasEl) return UNSAMPLEABLE;

  const computed = window.getComputedStyle(canvasEl);
  if (!computed) return UNSAMPLEABLE;

  const bgRaw = computed.backgroundColor;
  if (bgRaw && !isTransparent(bgRaw)) {
    const normalized = normalizeColor(bgRaw);
    if (normalized) {
      return { color: normalized, target: 'canvas-background' };
    }
  }

  return UNSAMPLEABLE;
}

// ============================================================================
// 任务 9.3：颜色应用策略
// ============================================================================

/**
 * 颜色应用目标字段。
 *
 * 对应 ComponentStyleSchema 中的颜色字段：
 * - 'color'：文本颜色（text 组件等）
 * - 'backgroundColor'：背景颜色（rect/ellipse 等装饰组件）
 * - 'borderColor'：边框颜色（仅当组件已有 borderWidth > 0 时）
 */
export type ColorApplyTarget = 'color' | 'backgroundColor' | 'borderColor';

/**
 * 根据组件类型与当前样式决定颜色应用目标。
 *
 * 策略（与 COMPONENT_DEFINITIONS 的 defaultStyle 对齐）：
 * - text：应用到 `color`（文本色）
 * - rect / ellipse：应用到 `backgroundColor`（背景色）
 * - image / bar-chart / 其他：不支持（返回 null），调用方不应入历史
 *
 * 若装饰组件 borderWidth > 0，可考虑应用到 `borderColor`，
 * 但为简化首版策略，统一应用 backgroundColor。
 *
 * @param component - 待应用的组件
 * @returns 应用目标字段；不支持时返回 null
 */
export function getColorApplyTarget(component: {
  readonly type: string;
  readonly style: { readonly borderWidth?: number };
}): ColorApplyTarget | null {
  switch (component.type) {
    case 'text':
      return 'color';
    case 'rect':
    case 'ellipse':
      return 'backgroundColor';
    default:
      return null;
  }
}

/**
 * 应用颜色到组件 style，返回新的 style 对象（不可变更新）。
 *
 * 若 target 为 null（组件不支持颜色），返回原 style 引用（调用方应据此跳过入历史）。
 *
 * @param style - 原 ComponentStyle
 * @param target - 应用目标
 * @param color - 规范化后的颜色字符串
 * @returns 新 style 对象；若 target 为 null 则返回原 style
 */
export function applyColorToStyle<T extends Record<string, unknown>>(
  style: T,
  target: ColorApplyTarget | null,
  color: string,
): T {
  if (!target) return style;
  return { ...style, [target]: color };
}
