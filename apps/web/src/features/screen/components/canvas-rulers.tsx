import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Ruler from '@scena/react-ruler';

export interface RulersHandle {
  syncScroll: () => void;
}

interface RulersProps {
  scale: number;
  offset: { x: number; y: number };
  canvasWidth: number;
  canvasHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const RULER_SIZE = 20;

export const CanvasRulers = forwardRef<RulersHandle, RulersProps>(function CanvasRulers(
  { scale, offset, canvasWidth, canvasHeight, containerRef },
  ref,
) {
  const rulerXRef = useRef<Ruler>(null);
  const rulerYRef = useRef<Ruler>(null);

  useImperativeHandle(ref, () => ({
    syncScroll() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollX = -(rect.left - offset.x) / scale;
      const scrollY = -(rect.top - offset.y) / scale;
      rulerXRef.current?.scroll(scrollX);
      rulerYRef.current?.scroll(scrollY);
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollX = -(rect.left - offset.x) / scale;
    const scrollY = -(rect.top - offset.y) / scale;
    rulerXRef.current?.scroll(scrollX);
    rulerYRef.current?.scroll(scrollY);
  }, [scale, offset, containerRef]);

  const unit = Math.max(1, Math.floor(50 / scale));

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div className="absolute left-0 top-0 h-5 w-5 border-b border-r border-gray-700 bg-[#1e1e2f] text-center text-[9px] leading-5 text-gray-400">
        px
      </div>
      <div className="absolute top-0" style={{ left: RULER_SIZE, right: 0, height: RULER_SIZE }}>
        <Ruler
          ref={rulerXRef}
          type="horizontal"
          style={{ width: '100%', height: RULER_SIZE }}
          lineColor="#3A3A4E"
          textColor="#A0A0B2"
          backgroundColor="#1E1E2F"
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
          lineColor="#3A3A4E"
          textColor="#A0A0B2"
          backgroundColor="#1E1E2F"
          negativeRuler
          zoom={scale}
          unit={unit}
          segment={2}
          textOffset={[10, 0]}
        />
      </div>
    </div>
  );
});
