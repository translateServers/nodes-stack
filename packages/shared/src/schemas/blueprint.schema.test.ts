import { describe, expect, it } from 'vitest';
import {
  BlueprintClipboardSchema,
  BlueprintEdgeSchema,
  BlueprintNodeSchema,
  EventBlueprintSchema,
  EVENT_BLUEPRINT_VERSION,
  LEGACY_EVENT_BLUEPRINT_VERSION,
  LegacyEventBlueprintSchema,
} from './blueprint.schema.js';

describe('正式事件蓝图契约', () => {
  it('接受组件事件到组件动作的正式执行边', () => {
    const blueprint = {
      version: EVENT_BLUEPRINT_VERSION,
      nodes: [
        {
          id: 'source',
          kind: 'component',
          componentId: 'button-1',
          position: { x: 0, y: 0 },
        },
        {
          id: 'target',
          kind: 'component',
          componentId: 'panel-1',
          position: { x: 320, y: 0 },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'source',
          sourceHandle: 'evt:click',
          target: 'target',
          targetHandle: 'act:show',
        },
      ],
    };

    expect(EventBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(BlueprintNodeSchema.parse(blueprint.nodes[0])).toEqual(blueprint.nodes[0]);
    expect(BlueprintEdgeSchema.parse(blueprint.edges[0])).toEqual(blueprint.edges[0]);
    expect(
      BlueprintClipboardSchema.parse({
        kind: 'nebula-blueprint-clipboard',
        nodes: blueprint.nodes,
        edges: blueprint.edges,
      }),
    ).toMatchObject({ nodes: blueprint.nodes, edges: blueprint.edges });
  });

  it('将归档 trigger/action 图限制在迁移读取边界', () => {
    const legacy = {
      version: LEGACY_EVENT_BLUEPRINT_VERSION,
      nodes: [],
      edges: [],
    };

    expect(LegacyEventBlueprintSchema.parse(legacy)).toEqual(legacy);
    expect(EventBlueprintSchema.safeParse(legacy).success).toBe(false);
  });
});
