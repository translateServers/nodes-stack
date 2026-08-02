import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GLOBAL_COMPONENT_ID, type EventBlueprint, type ScreenComponent } from '@nebula/shared';

import { useBlueprintPreviewRuntime } from './use-blueprint-preview-runtime.js';

function makeComponent(id: string): ScreenComponent {
  return {
    id,
    type: 'rect',
    name: id,
    position: { x: 0, y: 0, width: 100, height: 100 },
    style: {},
    props: {},
    zIndex: 0,
    status: { locked: false, hidden: false },
  };
}

function makePageLoadBlueprint(targetId: string): EventBlueprint {
  return {
    version: 2,
    nodes: [
      {
        id: 'page-load',
        kind: 'component',
        position: { x: 0, y: 0 },
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'pageLoad',
      },
      {
        id: 'target',
        kind: 'component',
        position: { x: 100, y: 0 },
        componentId: targetId,
      },
    ],
    edges: [
      {
        id: 'show-target',
        source: 'page-load',
        sourceHandle: 'evt:pageLoad',
        target: 'target',
        targetHandle: 'act:show',
      },
    ],
  };
}

function makeClickBlueprint(triggerId: string, targetId: string): EventBlueprint {
  return {
    version: 2,
    nodes: [
      {
        id: 'trigger',
        kind: 'component',
        position: { x: 0, y: 0 },
        componentId: triggerId,
      },
      {
        id: 'target',
        kind: 'component',
        position: { x: 100, y: 0 },
        componentId: targetId,
      },
    ],
    edges: [
      {
        id: 'hide-target',
        source: 'trigger',
        sourceHandle: 'evt:click',
        target: 'target',
        targetHandle: 'act:hide',
      },
    ],
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useBlueprintPreviewRuntime', () => {
  it('compiles and runs page-load rules', async () => {
    const target = makeComponent('target');
    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(makePageLoadBlueprint(target.id), [target]),
    );

    expect(result.current.compiledRules).toHaveLength(1);
    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get(target.id)).toBe(true);
    });
  });

  it('dispatches component events and click shorthand', async () => {
    const trigger = makeComponent('trigger');
    const target = makeComponent('target');
    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(makeClickBlueprint(trigger.id, target.id), [trigger, target]),
    );

    act(() => {
      result.current.onComponentClick(trigger.id);
    });
    await waitFor(() => {
      expect(result.current.contextValue.visibilityOverrides.get(target.id)).toBe(false);
    });
  });

  it('schedules interval rules using each rule interval', async () => {
    vi.useFakeTimers();
    const target = makeComponent('target');
    const blueprint: EventBlueprint = {
      version: 2,
      nodes: [
        {
          id: 'interval',
          kind: 'component',
          position: { x: 0, y: 0 },
          componentId: GLOBAL_COMPONENT_ID,
          globalType: 'interval',
          config: { globalType: 'interval', intervalMs: 100 },
        },
        {
          id: 'target',
          kind: 'component',
          position: { x: 100, y: 0 },
          componentId: target.id,
        },
      ],
      edges: [
        {
          id: 'hide-target',
          source: 'interval',
          sourceHandle: 'evt:interval',
          target: 'target',
          targetHandle: 'act:hide',
        },
      ],
    };
    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [target]));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.contextValue.visibilityOverrides.get(target.id)).toBe(false);
  });

  it('does not enable rules with an error diagnostic', () => {
    const target = makeComponent('target');
    const blueprint = makeClickBlueprint('missing', target.id);
    const { result } = renderHook(() => useBlueprintPreviewRuntime(blueprint, [target]));

    expect(result.current.compiledRules).toEqual([]);
    expect(result.current.isEnabled).toBe(false);
  });

  it('does nothing while disabled', async () => {
    const trigger = makeComponent('trigger');
    const target = makeComponent('target');
    const { result } = renderHook(() =>
      useBlueprintPreviewRuntime(makeClickBlueprint(trigger.id, target.id), [trigger, target], {
        enabled: false,
      }),
    );

    act(() => {
      result.current.onComponentEvent(trigger.id, 'click');
    });
    await Promise.resolve();

    expect(result.current.contextValue.visibilityOverrides.size).toBe(0);
  });
});
