interface TextComponentProps {
  props: Record<string, unknown>;
  style: Record<string, unknown>;
}

export function TextComponent({ props, style }: TextComponentProps) {
  const content = (props.content as string) ?? '';

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        fontSize: style.fontSize as number | undefined,
        color: style.color as string | undefined,
        textAlign: (style.textAlign as 'left' | 'center' | 'right' | undefined) ?? 'center',
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}
    >
      {content}
    </div>
  );
}
