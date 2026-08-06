import { describe, expect, it } from 'vitest';

import { EMPTY_SCREEN_DOCUMENT, ScreenDocumentSchema } from './screen.schema.js';

describe('canonical ScreenDocument legacy input boundary', () => {
  it('rejects legacy screen documents rather than normalizing or migrating them', () => {
    const result = ScreenDocumentSchema.safeParse({
      canvas: EMPTY_SCREEN_DOCUMENT.canvas,
      components: [],
      globalVariables: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects historical component status and host-specific wire branches', () => {
    const result = ScreenDocumentSchema.safeParse({
      ...EMPTY_SCREEN_DOCUMENT,
      components: [
        {
          id: 'metric-1',
          type: 'nebula.metric/v1',
          name: 'Metric',
          position: { x: 0, y: 0, width: 100, height: 100 },
          style: {},
          props: {},
          dataSource: { type: 'host/xj-metric', metricId: 1 },
          status: 'active',
          zIndex: 1,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
