import { describe, expect, it } from 'vitest';
import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import {
  createAlignmentLinesStore,
  createDimensionStore,
  createScreenEditorStore,
} from './editor-store';

function createComponent(id: string): ScreenComponent {
  return {
    id,
    type: 'text',
    name: id,
    position: { x: 0, y: 0, width: 100, height: 40 },
    style: {},
    props: { content: id },
    status: { locked: false, hidden: false },
    zIndex: 1,
  };
}

function createProject(id: string): ScreenProject {
  return {
    id,
    name: id,
    description: null,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [createComponent(`${id}-component`)],
    globalVariables: [],
    status: 'draft',
    thumbnail: null,
    createdAt: '2026-07-30 10:00:00',
    updatedAt: '2026-07-30 10:00:00',
  };
}

describe('screen editor instance isolation', () => {
  it('isolates project, selection, history, dirty state and viewport', () => {
    const first = createScreenEditorStore({ instanceId: 'first', persistPreferences: false });
    const second = createScreenEditorStore({ instanceId: 'second', persistPreferences: false });
    first.getState().loadProject(createProject('first'));
    second.getState().loadProject(createProject('second'));

    first.getState().selectComponent('first-component');
    first.getState().addComponent(createComponent('first-added'));
    first.getState().setCanvasScaleAndOffset(1.5, { x: 40, y: 20 });

    expect(first.getState()).toMatchObject({
      selectedComponentIds: ['first-component'],
      isDirty: true,
      canvasScale: 1.5,
      canvasOffset: { x: 40, y: 20 },
    });
    expect(first.getState().history.past).toHaveLength(1);
    expect(second.getState()).toMatchObject({
      selectedComponentIds: [],
      isDirty: false,
      canvasScale: 1,
      canvasOffset: { x: 0, y: 0 },
    });
    expect(second.getState().history.past).toHaveLength(0);
    expect(second.getState().project?.components).toHaveLength(1);

    first.getState().undo();
    expect(first.getState().project?.components).toHaveLength(1);
    expect(second.getState().project?.id).toBe('second');
  });

  it('creates fresh auxiliary stores for each editor instance', () => {
    const firstDimension = createDimensionStore();
    const secondDimension = createDimensionStore();
    firstDimension
      .getState()
      .setDimension((dimension) => ({ ...dimension, x: 120, visible: true }));
    expect(firstDimension.getState().dimension.x).toBe(120);
    expect(secondDimension.getState().dimension).toMatchObject({ x: 0, visible: false });

    const firstAlignment = createAlignmentLinesStore();
    const secondAlignment = createAlignmentLinesStore();
    firstAlignment.getState().setLines(
      [
        {
          axis: 'horizontal',
          position: 10,
          movedEdge: 'top',
          otherEdge: 'bottom',
          distance: 0,
          otherId: 'target',
        },
      ],
      { x: 0, y: 0, width: 100, height: 40 },
    );
    expect(firstAlignment.getState().lines).toHaveLength(1);
    expect(secondAlignment.getState().lines).toHaveLength(0);
  });
});
