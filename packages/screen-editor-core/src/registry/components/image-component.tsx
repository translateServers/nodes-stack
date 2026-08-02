/**
 * 图片组件（任务 7.2）
 *
 * 渲染用户提供的图片资源。资源字段为 `props.src`（data URL 或远程 URL）。
 * 默认尺寸由创建工厂决定；用户可通过 Moveable 缩放/调整。
 *
 * 资源契约（任务 7.1）：
 * - 接受 data URL（base64）和 http(s) URL
 * - 不持久化本地绝对路径（file://）或 object URL（blob:）
 * - 无效或空 src 时显示占位提示
 *
 * 该组件为 canvas 渲染组件（非编辑器 shell），不使用 shadcn/ui，
 * 避免与用户可配置样式冲突。
 */
import type { ComponentStyle } from '@nebula/shared';
import type { ScreenComponentElementModel } from '@nebula/screen-component-sdk';
import { Image } from 'lucide-react';
import { mergeActions, mergeEvents } from '../component-events-actions';
import type { ComponentModule } from '../types';

interface ImageComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
}

export function ImageComponent({ props, style }: ImageComponentProps) {
  const src = (props.src as string | undefined) ?? '';
  const alt = (props.alt as string | undefined) ?? '';

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        未设置图片
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full"
      style={{
        objectFit: style.objectFit ?? 'cover',
        opacity: style.opacity ?? 1,
        borderWidth: style.borderWidth ?? 0,
        borderStyle: style.borderStyle ?? 'solid',
        borderColor: style.borderColor ?? '#000000',
        borderRadius: style.borderRadius ?? 0,
      }}
      // 防止图片拖拽行为干扰画布交互
      draggable={false}
    />
  );
}

function cssLength(value: unknown, fallback = '0px'): string {
  if (typeof value === 'number') return `${value}px`;
  return typeof value === 'string' ? value : fallback;
}

function cssText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function cssNumber(value: unknown, fallback: string): string {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : fallback;
}

export class ImageCustomElement extends HTMLElement {
  #root: HTMLDivElement | null = null;

  #ensureRoot(): HTMLDivElement {
    if (this.#root !== null) return this.#root;
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    const root = document.createElement('div');
    root.style.width = '100%';
    root.style.height = '100%';
    this.append(root);
    this.#root = root;
    return root;
  }

  set model(model: ScreenComponentElementModel) {
    const root = this.#ensureRoot();
    const style = model.style;
    const src = model.props['src'];
    const alt = model.props['alt'];
    root.replaceChildren();
    if (typeof src !== 'string' || src.length === 0) {
      root.style.display = 'flex';
      root.style.alignItems = 'center';
      root.style.justifyContent = 'center';
      root.textContent = '未设置图片';
      return;
    }
    root.style.display = 'block';
    root.textContent = '';
    const image = document.createElement('img');
    image.src = src;
    image.alt = typeof alt === 'string' ? alt : '';
    image.draggable = false;
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = cssText(style['objectFit'], 'cover');
    image.style.opacity = cssNumber(style['opacity'], '1');
    image.style.borderWidth = cssLength(style['borderWidth']);
    image.style.borderStyle = cssText(style['borderStyle'], 'solid');
    image.style.borderColor = cssText(style['borderColor'], '#000000');
    image.style.borderRadius = cssLength(style['borderRadius']);
    root.append(image);
  }
}

if (
  typeof customElements !== 'undefined' &&
  customElements.get('nebula-screen-image-v1') === undefined
) {
  customElements.define('nebula-screen-image-v1', ImageCustomElement);
}

const imageModule: ComponentModule = {
  definition: {
    type: 'image',
    name: '图片',
    category: 'media',
    icon: 'Image',
    keywords: ['图片', '图像', 'image', 'img', '照片', 'picture', 'logo'],
    description: '图片组件，支持 src / alt 与圆角裁剪',
    defaultProps: { src: '', alt: '' },
    defaultSize: { width: 320, height: 240 },
    defaultStyle: {},
    order: 1,
    events: mergeEvents(),
    actions: mergeActions(),
  },
  renderer: ImageComponent,
  customElementConstructor: ImageCustomElement,
  icon: Image,
};

export default imageModule;
