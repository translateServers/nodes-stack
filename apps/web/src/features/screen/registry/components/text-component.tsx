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
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}
    >
      {content}
    </div>
  );
}
