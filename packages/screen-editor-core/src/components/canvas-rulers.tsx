import { memo, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Ruler from '@scena/react-ruler';
import { useScreenEditorEnvironment } from './screen-editor-environment';

export interface RulersHandle {
  syncScroll: (scale?: number, offset?: { x: number; y: number }) => void;
}

interface RulersProps {
  scale: number;
  offset: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const RULER_SIZE = 20;

interface RulerPalette {
  background: string;
  line: string;
  text: string;
  cornerBg: string;
  cornerBorder: string;
  cornerText: string;
}

const LIGHT_PALETTE: RulerPalette = {
  background: '#ffffff',
  line: '#e4e4e7',
  text: '#71717a',
  cornerBg: 'bg-card',
  cornerBorder: 'border-border',
  cornerText: 'text-muted-foreground',
};

const DARK_PALETTE: RulerPalette = {
  background: '#1e1e2f',
  line: '#3a3a4e',
  text: '#a0a0b2',
  cornerBg: 'bg-[#1e1e2f]',
  cornerBorder: 'border-[#3a3a4e]',
  cornerText: 'text-[#a0a0b2]',
};

function useIsDark(): boolean {
  return useScreenEditorEnvironment().theme === 'dark';
}

export const CanvasRulers = memo(
  forwardRef<RulersHandle, RulersProps>(function CanvasRulers(
    { scale, offset, containerRef },
    ref,
  ) {
    const rulerXRef = useRef<Ruler>(null);
    const rulerYRef = useRef<Ruler>(null);
    const isDark = useIsDark();
    const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

    const scaleRef = useRef(scale);
    const offsetRef = useRef(offset);
    const containerRefRef = useRef(containerRef);
    scaleRef.current = scale;
    offsetRef.current = offset;
    containerRefRef.current = containerRef;

    const doSyncScroll = (s: number, o: { x: number; y: number }) => {
      const container = containerRefRef.current;
      if (!container.current) return;
      const rect = container.current.getBoundingClientRect();
      const scrollX = -(rect.left - o.x) / s;
      const scrollY = -(rect.top - o.y) / s;
      rulerXRef.current?.scroll(scrollX);
      rulerYRef.current?.scroll(scrollY);
    };

    useImperativeHandle(ref, () => ({
      syncScroll(s?: number, o?: { x: number; y: number }) {
        const currentScale = s ?? scaleRef.current;
        const currentOffset = o ?? offsetRef.current;
        doSyncScroll(currentScale, currentOffset);
      },
    }));

    useEffect(() => {
      doSyncScroll(scale, offset);
    }, [scale, offset]);

    const unit = Math.max(1, Math.floor(50 / scale));

    return (
      <div className="pointer-events-none absolute inset-0 z-50">
        <div
          className={`absolute left-0 top-0 h-5 w-5 border-b border-r text-center text-[9px] leading-5 ${palette.cornerBg} ${palette.cornerBorder} ${palette.cornerText}`}
        >
          px
        </div>
        <div className="absolute top-0" style={{ left: RULER_SIZE, right: 0, height: RULER_SIZE }}>
          <Ruler
            ref={rulerXRef}
            type="horizontal"
            style={{ width: '100%', height: RULER_SIZE }}
            lineColor={palette.line}
            textColor={palette.text}
            backgroundColor={palette.background}
            negativeRuler
            zoom={scale}
            unit={unit}
            segment={2}
            textOffset={[0, 10]}
          />
        </div>
        <div className="absolute left-0" style={{ top: RULER_SIZE, bottom: 0, width: RULER_SIZE }}>
          <Ruler
            ref={rulerYRef}
            type="vertical"
            style={{ width: RULER_SIZE, height: '100%' }}
            lineColor={palette.line}
            textColor={palette.text}
            backgroundColor={palette.background}
            negativeRuler
            zoom={scale}
            unit={unit}
            segment={2}
            textOffset={[10, 0]}
          />
        </div>
      </div>
    );
  }),
  (prevProps, nextProps) => {
    return prevProps.scale === nextProps.scale;
  },
);
