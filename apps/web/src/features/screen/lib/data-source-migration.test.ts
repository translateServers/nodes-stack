/**
 * props.data 一次性迁移测试（阶段 2 任务 3.3）
 *
 * 验证点（对应 tasks.md 3.3 验证要求）：
 * - buildDataSourceMigration 产出正确迁移负载
 * - 迁移与新数据层配置经一次 updateComponent 合并为一条历史
 * - 撤销一次完整回退迁移
 * - 未迁移组件 props.data 不丢失
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DataSourceConfig, ScreenComponent, ScreenProject } from '@nebula/shared';
import { buildDataSourceMigration } from './data-source-migration';
import { useScreenEditorStore } from '../stores/editor-store';

const LEGACY_DATA = [
  { name: '旧A', value: 10 },
  { name: '旧B', value: 20 },
];

function makeBarChartComponent(overrides: Partial<ScreenComponent> = {}): ScreenComponent {
  return {
    id: 'chart-1',
    type: 'bar-chart',
    name: '柱状图',
    position: { x: 0, y: 0, width: 400, height: 300 },
    style: {},
    props: { data: LEGACY_DATA, title: '销售' },
    status: { locked: false, hidden: false },
    zIndex: 0,
    ...overrides,
  };
}

function makeProject(components: ScreenComponent[]): ScreenProject {
  return {
    id: 'p1',
    name: '测试大屏',
    description: null,
    canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
    components,
    status: 'draft',
    thumbnail: null,
    createdAt: '2025-06-01 10:00:00',
    updatedAt: '2025-06-01 10:00:00',
  };
}

describe('buildDataSourceMigration', () => {
  it('返回新数据层配置并剔除 props.data 键', () => {
    const component = makeBarChartComponent();
    const dataSource: DataSourceConfig = { type: 'static', staticData: LEGACY_DATA };

    const updates = buildDataSourceMigration(component, dataSource);

    expect(updates.dataSource).toEqual(dataSource);
    expect(updates.props).not.toHaveProperty('data');
    expect(updates.props).toEqual({ title: '销售' });
  });

  it('保留 props 中的其他视觉配置（如 title）', () => {
    const component = makeBarChartComponent({
      props: { data: LEGACY_DATA, title: '报表', custom: 1 },
    });
    const updates = buildDataSourceMigration(component, { type: 'static', staticData: [] });

    expect(updates.props).toEqual({ title: '报表', custom: 1 });
  });

  it('组件本无 props.data 时 props 原样透传', () => {
    const component = makeBarChartComponent({ props: { title: '无遗留数据' } });
    const dataSource: DataSourceConfig = { type: 'static', staticData: [] };

    const updates = buildDataSourceMigration(component, dataSource);

    expect(updates.dataSource).toEqual(dataSource);
    expect(updates.props).toBe(component.props);
  });
});

describe('迁移与历史栈集成（store）', () => {
  beforeEach(() => {
    useScreenEditorStore.getState().loadProject(makeProject([makeBarChartComponent()]));
  });

  function getComponent(): ScreenComponent {
    const project = useScreenEditorStore.getState().project;
    if (!project) throw new Error('project 未加载');
    return project.components[0];
  }

  it('一次 updateComponent 完成迁移：dataSource 生效且 props.data 清除', () => {
    const component = getComponent();
    const dataSource: DataSourceConfig = { type: 'static', staticData: LEGACY_DATA };

    useScreenEditorStore
      .getState()
      .updateComponent(component.id, buildDataSourceMigration(component, dataSource));

    const migrated = getComponent();
    expect(migrated.dataSource).toEqual(dataSource);
    expect(migrated.props).not.toHaveProperty('data');
    expect(migrated.props).toEqual({ title: '销售' });
  });

  it('迁移合并为一条本地编辑历史', () => {
    const before = useScreenEditorStore.getState().history.past.length;
    const component = getComponent();

    useScreenEditorStore
      .getState()
      .updateComponent(
        component.id,
        buildDataSourceMigration(component, { type: 'static', staticData: LEGACY_DATA }),
      );

    expect(useScreenEditorStore.getState().history.past.length).toBe(before + 1);
  });

  it('撤销一次完整回退迁移（dataSource 移除且 props.data 恢复）', () => {
    const component = getComponent();
    useScreenEditorStore
      .getState()
      .updateComponent(
        component.id,
        buildDataSourceMigration(component, { type: 'static', staticData: LEGACY_DATA }),
      );
    expect(getComponent().props).not.toHaveProperty('data');

    useScreenEditorStore.getState().undo();

    const restored = getComponent();
    expect(restored.dataSource).toBeUndefined();
    expect(restored.props).toEqual({ data: LEGACY_DATA, title: '销售' });
  });

  it('未迁移组件的 props.data 不受影响', () => {
    const untouched = makeBarChartComponent({ id: 'chart-2', props: { data: LEGACY_DATA } });
    useScreenEditorStore.getState().loadProject(makeProject([makeBarChartComponent(), untouched]));

    const component = getComponent();
    useScreenEditorStore
      .getState()
      .updateComponent(
        component.id,
        buildDataSourceMigration(component, { type: 'static', staticData: LEGACY_DATA }),
      );

    const project = useScreenEditorStore.getState().project;
    const other = project?.components.find((c) => c.id === 'chart-2');
    expect(other?.props).toEqual({ data: LEGACY_DATA });
    expect(other?.dataSource).toBeUndefined();
  });
});
