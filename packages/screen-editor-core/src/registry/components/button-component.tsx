/**
 * 按钮组件
 *
 * 交互型基础元素，主要用于触发事件蓝图中的点击事件。
 *
 * 渲染特性：
 * - 居中显示按钮文字（props.text）
 * - 应用 backgroundColor / color / fontSize / borderRadius / borderWidth 等基础样式
 *
 * 该组件为 canvas 渲染组件（非编辑器 shell），不使用 shadcn/ui，
 * 避免与用户可配置样式冲突。
 */
import type { ComponentStyle } from '@nebula/shared';
import { MousePointerClick } from 'lucide-react';
import { mergeActions, mergeEvents } from '../component-events-actions';
import type { ComponentModule } from '../types';
import { BUTTON_SCHEMA } from '../../property-schema/schemas';

interface ButtonComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
}

export function ButtonComponent({ props, style }: ButtonComponentProps) {
  const text = (props.text as string) ?? '按钮';

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        backgroundColor: style.backgroundColor ?? '#3b82f6',
        color: style.color ?? '#ffffff',
        fontSize: style.fontSize ?? 14,
        fontWeight: style.fontWeight ?? '500',
        borderWidth: style.borderWidth ?? 0,
        borderStyle: style.borderStyle ?? 'solid',
        borderColor: style.borderColor ?? 'transparent',
        borderRadius: style.borderRadius ?? 8,
        opacity: style.opacity ?? 1,
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span className="truncate px-2" title={text}>
        {text}
      </span>
    </div>
  );
}

const buttonModule: ComponentModule = {
  definition: {
    type: 'button',
    name: '按钮',
    category: 'text',
    icon: 'MousePointerClick',
    keywords: ['按钮', 'button', 'btn', '点击', '交互', '提交', '确认'],
    description: '按钮组件，支持文字、样式与点击事件',
    defaultProps: { text: '按钮' },
    defaultSize: { width: 120, height: 48 },
    defaultStyle: {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      fontSize: 14,
      borderRadius: 8,
      borderWidth: 0,
      borderColor: '#1e40af',
    },
    order: 2,
    events: mergeEvents(),
    actions: mergeActions(),
  },
  renderer: ButtonComponent,
  schema: BUTTON_SCHEMA,
  icon: MousePointerClick,
};

export default buttonModule;
