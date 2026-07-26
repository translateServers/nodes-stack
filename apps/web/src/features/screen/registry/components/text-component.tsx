import type { ComponentStyle } from '@nebula/shared';
import { Type } from 'lucide-react';
import { mergeActions, mergeEvents } from '../component-events-actions';
import type { ComponentModule } from '../types';
import { TEXT_SCHEMA } from '../../property-schema/schemas';

interface TextComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
}

export function TextComponent({ props, style }: TextComponentProps) {
  const content = (props.content as string) ?? '';

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        fontSize: style.fontSize,
        color: style.color,
        textAlign: style.textAlign ?? 'center',
        // Phase 2 Slice D：文本增强字段（字重 / 行高），由 Schema 声明式字段写入 style
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        // Task 7：文本细化配置（Light Chaser 特色：字间距 + 文字描边）
        letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
        WebkitTextStroke: style.textStrokeWidth
          ? `${style.textStrokeWidth}px ${style.textStrokeColor ?? '#000000'}`
          : undefined,
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}
    >
      {content}
    </div>
  );
}

const textModule: ComponentModule = {
  definition: {
    type: 'text',
    name: '文本',
    category: 'text',
    icon: 'Type',
    keywords: ['文本', '文字', 'text', 'title', '标题', '段落'],
    description: '可编辑的文本段落，支持字号、字色、对齐等样式',
    defaultProps: { content: '请输入文本' },
    defaultSize: { width: 200, height: 60 },
    defaultStyle: { color: '#ffffff', fontSize: 14 },
    order: 1,
    events: mergeEvents(),
    actions: mergeActions(),
  },
  renderer: TextComponent,
  schema: TEXT_SCHEMA,
  icon: Type,
};

export default textModule;
