/**
 * 模板插入与历史栈集成测试（任务 9.3）
 *
 * 验证 spec 要求：
 * - 模板插入的节点经共享 Schema 校验并作为一条本地编辑历史入栈
 * - 校验失败不入栈
 *
 * 集成路径：
 * - EmptyBlueprintState.onInsertTemplate(blueprint)
 *   → 调用方 Sheet 调用 useScreenEditorStore.getState().updateBlueprint(blueprint)
 *   → updateBlueprint 内部 pushHistory 推入 1 条历史快照（修改前状态）
 *
 * 本测试通过真实 editor-store 验证：
 * 1. 成功路径：buildValidatedTemplate → success → updateBlueprint → +1 历史，快照为空蓝图
 * 2. 失败路径：buildValidatedTemplate → failure → 不调用 updateBlueprint → 0 历史
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { CanvasConfig, ScreenProject } from '@nebula/shared';
import { useScreenEditorStore } from '../../stores/editor-store';
import { buildValidatedTemplate } from './build-validated-template';
import type { BlueprintTemplateId } from './template-definitions';

function makeMockCanvas(overrides: Partial<CanvasConfig> = {}): CanvasConfig {
  return {
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    scaleMode: 'fit',
    ...overrides,
  };
}

function makeProject(id = 'proj-1'): ScreenProject {
  return {
    id,
    name: `project-${id}`,
    description: null,
    canvas: makeMockCanvas(),
    components: [],
    // 空蓝图：用户首次打开 Sheet 看到空态
    blueprint: { version: 1, nodes: [], edges: [] },
    status: 'draft',
    thumbnail: null,
    createdAt: '2024-01-01 00:00:00',
    updatedAt: '2024-01-01 00:00:00',
  } as unknown as ScreenProject;
}

const TEMPLATE_IDS: BlueprintTemplateId[] = [
  'click-navigate',
  'click-toggle-visibility',
  'page-load-refresh',
];

describe('模板插入与历史栈集成（任务 9.3）', () => {
  beforeEach(() => {
    // 重置 store
    useScreenEditorStore.setState({
      project: null,
      selectedComponentIds: [],
      history: { past: [], future: [] },
      isDirty: false,
      blueprintGesture: { active: false, baseline: undefined },
    });
  });

  describe('校验通过 → updateBlueprint → 一条历史', () => {
    for (const templateId of TEMPLATE_IDS) {
      it(`${templateId}：插入模板产生一条历史，快照为空蓝图`, () => {
        // 1. 加载项目（空蓝图）
        const project = makeProject('proj-1');
        useScreenEditorStore.getState().loadProject(project);
        expect(useScreenEditorStore.getState().history.past).toHaveLength(0);

        // 2. 模拟 EmptyBlueprintState.onInsertTemplate 的下游：
        //    buildValidatedTemplate 成功 → 调用 updateBlueprint
        const result = buildValidatedTemplate(templateId);
        expect(result.success).toBe(true);
        if (result.success) {
          useScreenEditorStore.getState().updateBlueprint(result.blueprint);
        }

        // 3. 历史栈：+1 条
        const past = useScreenEditorStore.getState().history.past;
        expect(past).toHaveLength(1);

        // 4. 历史快照为修改前状态（空蓝图）
        const snapshot = past[0];
        expect(snapshot).toBeDefined();
        expect(snapshot?.blueprint).toEqual({
          version: 1,
          nodes: [],
          edges: [],
        });

        // 5. 当前 blueprint 已更新为模板内容
        const current = useScreenEditorStore.getState().project?.blueprint;
        expect(current).toBeDefined();
        expect(current?.nodes).toHaveLength(2);
        expect(current?.edges).toHaveLength(1);
      });
    }

    it('插入模板后 undo 可回到空蓝图状态', () => {
      const project = makeProject('proj-1');
      useScreenEditorStore.getState().loadProject(project);

      const result = buildValidatedTemplate('click-navigate');
      if (result.success) {
        useScreenEditorStore.getState().updateBlueprint(result.blueprint);
      }

      // 插入后：2 节点
      expect(useScreenEditorStore.getState().project?.blueprint?.nodes).toHaveLength(2);

      // undo → 回到空蓝图
      useScreenEditorStore.getState().undo();

      expect(useScreenEditorStore.getState().project?.blueprint?.nodes).toHaveLength(0);
      expect(useScreenEditorStore.getState().project?.blueprint?.edges).toHaveLength(0);
    });
  });

  describe('校验失败 → 不调用 updateBlueprint → 无历史', () => {
    it('buildValidatedTemplate 返回 failure 时不调用 updateBlueprint，历史栈为空', () => {
      const project = makeProject('proj-1');
      useScreenEditorStore.getState().loadProject(project);
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);

      // 模拟 EmptyBlueprintState 校验失败路径：
      // buildValidatedTemplate 失败 → 不调用 updateBlueprint
      const unknownId = 'unknown-template' as unknown as BlueprintTemplateId;
      const result = buildValidatedTemplate(unknownId);
      expect(result.success).toBe(false);

      if (result.success) {
        // 校验通过时才调用 updateBlueprint（这里不应进入）
        useScreenEditorStore.getState().updateBlueprint(result.blueprint);
      }

      // 历史栈仍为空（未入栈）
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);

      // blueprint 仍为空蓝图
      expect(useScreenEditorStore.getState().project?.blueprint?.nodes).toHaveLength(0);
    });

    it('校验失败不修改 isDirty 脏标记（与"无变化不入栈"语义一致）', () => {
      const project = makeProject('proj-1');
      useScreenEditorStore.getState().loadProject(project);
      expect(useScreenEditorStore.getState().isDirty).toBe(false);

      const unknownId = 'unknown-template' as unknown as BlueprintTemplateId;
      const result = buildValidatedTemplate(unknownId);
      expect(result.success).toBe(false);

      // 失败时不调用 updateBlueprint → isDirty 保持 false
      if (result.success) {
        useScreenEditorStore.getState().updateBlueprint(result.blueprint);
      }
      expect(useScreenEditorStore.getState().isDirty).toBe(false);
    });
  });

  describe('连续插入多次', () => {
    it('连续插入 2 个模板产生 2 条历史，undo 依次回退', () => {
      const project = makeProject('proj-1');
      useScreenEditorStore.getState().loadProject(project);

      // 第一次插入
      const r1 = buildValidatedTemplate('click-navigate');
      if (r1.success) {
        useScreenEditorStore.getState().updateBlueprint(r1.blueprint);
      }
      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);

      // 第二次插入（替换前一个模板的内容）
      const r2 = buildValidatedTemplate('page-load-refresh');
      if (r2.success) {
        useScreenEditorStore.getState().updateBlueprint(r2.blueprint);
      }
      expect(useScreenEditorStore.getState().history.past).toHaveLength(2);

      // undo 一次：回到第一个模板的内容
      useScreenEditorStore.getState().undo();
      const afterFirstUndo = useScreenEditorStore.getState().project?.blueprint;
      expect(afterFirstUndo?.nodes).toHaveLength(2);
      // 第一个模板是 click-navigate（trigger.componentClick）
      const trigger1 = afterFirstUndo?.nodes[0];
      expect(trigger1?.kind).toBe('trigger');
      if (trigger1?.kind === 'trigger') {
        expect(trigger1.config.type).toBe('componentClick');
      }

      // undo 第二次：回到空蓝图
      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().project?.blueprint?.nodes).toHaveLength(0);
    });
  });
});
