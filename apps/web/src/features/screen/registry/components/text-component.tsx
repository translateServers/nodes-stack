import type { ComponentStyle } from '@nebula/shared';

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
