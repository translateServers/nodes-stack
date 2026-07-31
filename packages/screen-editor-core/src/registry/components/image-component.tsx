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
  icon: Image,
};

export default imageModule;
