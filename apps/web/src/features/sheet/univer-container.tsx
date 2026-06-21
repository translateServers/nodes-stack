import { useEffect, useRef } from 'react';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import type { FUniver } from '@univerjs/presets';
import { UniverSheetsDataValidationPlugin } from '@univerjs/sheets-data-validation';
import '@univerjs/sheets-data-validation/facade';
import { UniverSheetsDataValidationUIPlugin } from '@univerjs/sheets-data-validation-ui';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/sheets-data-validation-ui/lib/index.css';

interface UniverContainerProps {
  initialData?: Record<string, unknown>;
  onReady?: (api: FUniver) => void;
}

export function UniverContainer({ initialData, onReady }: UniverContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<FUniver | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const { univerAPI } = createUniver({
      locale: LocaleType.ZH_CN,
      locales: { [LocaleType.ZH_CN]: mergeLocales(UniverPresetSheetsCoreZhCN) },
      presets: [UniverSheetsCorePreset({ container: containerRef.current })],
      plugins: [UniverSheetsDataValidationPlugin, UniverSheetsDataValidationUIPlugin],
    });

    univerAPI.createWorkbook(initialData ?? {});
    apiRef.current = univerAPI;
    onReady?.(univerAPI);

    return () => {
      univerAPI.dispose();
      apiRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
