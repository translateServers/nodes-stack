import { describe, expect, it } from 'vitest';
import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import { extractEditableComponentConfig } from '../lib/component-json-config';
import { createScreenEditorStore } from './editor-store';

function makeComponent(): ScreenComponent {
  return {
    dataSource: {
      staticData: [{ name: '一月', value: 12 }],
      type: 'static',
    },
    id: 'component-1',
    interaction: { tooltipOnHover: true },
    logic: { limit: 10 },
    name: '销售图表',
    position: { height: 240, width: 480, x: 100, y: 120 },
    props: { title: '销售额' },
    status: { hidden: false, locked: false },
    style: { backgroundColor: '#111111' },
    type: 'bar-chart',
    zIndex: 2,
  };
}

function makeProject(component = makeComponent()): ScreenProject {
  return {
    canvas: { backgroundColor: '#000000', height: 1080, scaleMode: 'fit', width: 1920 },
    components: [component],
    createdAt: '2026-08-02T00:00:00.000Z',
    description: null,
    globalVariables: [],
    id: 'project-1',
    name: '测试项目',
    status: 'draft',
    thumbnail: null,
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

describe('replaceComponentConfig', () => {
  it('replaces the editable config exactly, removes optional fields, and creates one history entry', () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const component = makeComponent();
    store.getState().loadProject(makeProject(component));
    const baseline = extractEditableComponentConfig(component);
    const next = {
      ...baseline,
      name: '月度销售额',
      props: { title: '月度销售额' },
      position: { ...baseline.position, width: 640 },
    };
    delete next.dataSource;
    delete next.interaction;
    delete next.logic;

    const result = store.getState().replaceComponentConfig({
      baseline,
      componentId: component.id,
      next,
    });

    expect(result).toBe('updated');
    const updated = store.getState().project?.components[0];
    expect(updated).toMatchObject({
      id: component.id,
      name: '月度销售额',
      props: { title: '月度销售额' },
      type: component.type,
    });
    expect(updated?.position.width).toBe(640);
    expect(updated?.dataSource).toBeUndefined();
    expect(updated?.logic).toBeUndefined();
    expect(updated?.interaction).toBeUndefined();
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().isDirty).toBe(true);

    store.getState().undo();
    const undone = store.getState().project?.components[0];
    expect(undone?.dataSource).toEqual(component.dataSource);
    expect(undone?.logic).toEqual(component.logic);
    expect(undone?.interaction).toEqual(component.interaction);
    expect(undone?.position.width).toBe(480);

    store.getState().redo();
    const redone = store.getState().project?.components[0];
    expect(redone?.dataSource).toBeUndefined();
    expect(redone?.logic).toBeUndefined();
    expect(redone?.interaction).toBeUndefined();
    expect(redone?.position.width).toBe(640);
  });

  it('does not create a history entry for an unchanged config', () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const component = makeComponent();
    store.getState().loadProject(makeProject(component));
    const config = extractEditableComponentConfig(component);

    const result = store.getState().replaceComponentConfig({
      baseline: config,
      componentId: component.id,
      next: { ...config, props: { ...config.props } },
    });

    expect(result).toBe('unchanged');
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().isDirty).toBe(false);
  });

  it('rejects a stale baseline without overwriting the current config', () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const component = makeComponent();
    store.getState().loadProject(makeProject(component));
    const baseline = extractEditableComponentConfig(component);
    store.getState().updateComponent(component.id, { props: { title: '外部更新' } });

    const result = store.getState().replaceComponentConfig({
      baseline,
      componentId: component.id,
      next: { ...baseline, props: { title: '草稿更新' } },
    });

    expect(result).toBe('conflict');
    expect(store.getState().project?.components[0]?.props).toEqual({ title: '外部更新' });
    expect(store.getState().history.past).toHaveLength(1);
  });

  it('returns missing when the component no longer exists', () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const component = makeComponent();
    store.getState().loadProject(makeProject(component));
    const config = extractEditableComponentConfig(component);

    const result = store.getState().replaceComponentConfig({
      baseline: config,
      componentId: 'missing-component',
      next: config,
    });

    expect(result).toBe('missing');
    expect(store.getState().history.past).toHaveLength(0);
  });

  it('rejects the action in a readonly store', () => {
    const store = createScreenEditorStore({ isReadonly: () => true, persistPreferences: false });
    const component = makeComponent();
    store.getState().loadProject(makeProject(component));
    const config = extractEditableComponentConfig(component);

    const result = store.getState().replaceComponentConfig({
      baseline: config,
      componentId: component.id,
      next: { ...config, props: { title: '不可写入' } },
    });

    expect(result).toBe('readonly');
    expect(store.getState().project?.components[0]?.props).toEqual(component.props);
    expect(store.getState().history.past).toHaveLength(0);
  });
});
