import { describe, expect, it } from 'vitest';
import { migrateLegacyBlueprint } from './blueprint-migration.js';
import { LEGACY_EVENT_BLUEPRINT_VERSION, type LegacyEventBlueprint } from './blueprint.schema.js';

const position = { x: 0, y: 0 };

function createLegacyBlueprint(
  overrides: Partial<LegacyEventBlueprint> = {},
): LegacyEventBlueprint {
  return {
    version: LEGACY_EVENT_BLUEPRINT_VERSION,
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe('migrateLegacyBlueprint', () => {
  it('迁移组件触发器和目标动作', () => {
    const result = migrateLegacyBlueprint(
      createLegacyBlueprint({
        nodes: [
          {
            id: 'trigger',
            kind: 'trigger',
            position,
            config: { type: 'componentClick', componentId: 'button-1' },
          },
          {
            id: 'action',
            kind: 'action',
            position: { x: 300, y: 0 },
            config: { type: 'setVisibility', targetComponentId: 'panel-1', visible: 'show' },
          },
        ],
        edges: [
          {
            id: 'edge-trigger-action',
            source: 'trigger',
            sourceHandle: 'out',
            target: 'action',
            targetHandle: 'in',
          },
        ],
      }),
    );

    expect(result.warnings).toEqual([]);
    expect(result.blueprint).toMatchObject({ version: 2 });
    expect(result.blueprint.edges).toEqual([
      {
        id: 'edge-trigger-action',
        source: 'blueprint-trigger-trigger',
        sourceHandle: 'evt:click',
        target: 'blueprint-action-action',
        targetHandle: 'act:show',
      },
    ]);
  });

  it('展开历史动作链以保持执行顺序', () => {
    const result = migrateLegacyBlueprint(
      createLegacyBlueprint({
        nodes: [
          {
            id: 'trigger',
            kind: 'trigger',
            position,
            config: { type: 'componentClick', componentId: 'button-1' },
          },
          {
            id: 'show-panel',
            kind: 'action',
            position,
            config: { type: 'setVisibility', targetComponentId: 'panel-1', visible: 'show' },
          },
          {
            id: 'hide-tooltip',
            kind: 'action',
            position,
            config: { type: 'setVisibility', targetComponentId: 'tooltip-1', visible: 'hide' },
          },
        ],
        edges: [
          {
            id: 'first',
            source: 'trigger',
            sourceHandle: 'out',
            target: 'show-panel',
            targetHandle: 'in',
          },
          {
            id: 'second',
            source: 'show-panel',
            sourceHandle: 'out',
            target: 'hide-tooltip',
            targetHandle: 'in',
          },
        ],
      }),
    );

    expect(result.warnings).toEqual([]);
    expect(result.blueprint.edges).toEqual([
      {
        id: 'first',
        source: 'blueprint-trigger-trigger',
        sourceHandle: 'evt:click',
        target: 'blueprint-action-show-panel',
        targetHandle: 'act:show',
      },
      {
        id: 'second',
        source: 'blueprint-trigger-trigger',
        sourceHandle: 'evt:click',
        target: 'blueprint-action-hide-tooltip',
        targetHandle: 'act:hide',
      },
    ]);
  });

  it('保留独立全局动作的配置', () => {
    const result = migrateLegacyBlueprint(
      createLegacyBlueprint({
        nodes: [
          {
            id: 'trigger',
            kind: 'trigger',
            position,
            config: { type: 'pageLoad' },
          },
          {
            id: 'first-navigation',
            kind: 'action',
            position,
            config: { type: 'navigate', url: 'https://example.com/a', target: '_self' },
          },
          {
            id: 'second-navigation',
            kind: 'action',
            position: { x: 300, y: 0 },
            config: { type: 'navigate', url: 'https://example.com/b', target: '_blank' },
          },
        ],
        edges: [
          {
            id: 'first-navigation-edge',
            source: 'trigger',
            sourceHandle: 'out',
            target: 'first-navigation',
            targetHandle: 'in',
          },
          {
            id: 'second-navigation-edge',
            source: 'trigger',
            sourceHandle: 'out',
            target: 'second-navigation',
            targetHandle: 'in',
          },
        ],
      }),
    );

    const navigationNodes = result.blueprint.nodes.filter(
      (node) => node.kind === 'component' && node.globalType === 'navigate',
    );
    expect(navigationNodes).toHaveLength(2);
    expect(navigationNodes.map((node) => node.config)).toEqual([
      { globalType: 'navigate', url: 'https://example.com/a', target: '_self' },
      { globalType: 'navigate', url: 'https://example.com/b', target: '_blank' },
    ]);
  });

  it('拒绝无法无损迁移的环', () => {
    const result = migrateLegacyBlueprint(
      createLegacyBlueprint({
        nodes: [
          {
            id: 'trigger',
            kind: 'trigger',
            position,
            config: { type: 'componentClick', componentId: 'button-1' },
          },
          {
            id: 'action',
            kind: 'action',
            position,
            config: { type: 'setVisibility', targetComponentId: 'panel-1', visible: 'show' },
          },
        ],
        edges: [
          {
            id: 'trigger-edge',
            source: 'trigger',
            sourceHandle: 'out',
            target: 'action',
            targetHandle: 'in',
          },
          {
            id: 'cycle-edge',
            source: 'action',
            sourceHandle: 'out',
            target: 'action',
            targetHandle: 'in',
          },
        ],
      }),
    );

    expect(result.warnings).toEqual([
      expect.objectContaining({ sourceId: 'cycle-edge', message: expect.stringContaining('环') }),
    ]);
  });
});
