import { describe, expect, it } from 'vitest';

import { LegacyScreenDocumentSchema, migrateLegacyScreenDocument } from './screen.schema.js';

const component = {
  id: 'button-1',
  type: 'button',
  name: 'Button',
  position: { x: 0, y: 0, width: 120, height: 40 },
  style: {},
  props: { text: 'Open' },
  status: { hidden: false, locked: false },
  zIndex: 1,
};

describe('migrateLegacyScreenDocument', () => {
  it('preserves document content while converting a legacy blueprint', () => {
    const legacy = LegacyScreenDocumentSchema.parse({
      canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
      components: [component],
      blueprint: {
        version: 1,
        nodes: [
          {
            id: 'trigger',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'button-1' },
          },
        ],
        edges: [],
      },
    });

    const result = migrateLegacyScreenDocument(legacy);

    expect(result.warnings).toEqual([]);
    expect(result.document.components).toEqual([component]);
    expect(result.document.globalVariables).toEqual([]);
    expect(result.document.blueprint).toMatchObject({
      version: 2,
      nodes: [
        {
          id: 'blueprint-trigger-trigger',
          kind: 'component',
          componentId: 'button-1',
        },
      ],
    });
  });
});
