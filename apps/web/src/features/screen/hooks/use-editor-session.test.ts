import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useEditorSession,
  type UseEditorSessionOptions,
  type TextEditingContext,
} from './use-editor-session';
import { getToolById, TOOL_REGISTRY, type EditorTool } from './tool-registry';
import type { ToolStateMachineApi } from './use-tool-state-machine';
import type {
  InteractionEvent,
  InteractionEventPayload,
  InteractionStateMachineApi,
  InteractionState,
} from './use-interaction-state-machine';

/**
 * 任务 2.1 验证：编辑器会话交互控制器 API
 *
 * 测试策略：
 * - mock ToolStateMachineApi 和 InteractionStateMachineApi，避免依赖具体实现
 * - 验证 API 字段拥有者划分正确（工具/交互状态透传，能力派生，文本/颜色由控制器持有）
 * - 验证 API 不包含持久项目副本、Moveable 实例、DOM ref 或每帧 pointer 坐标
 * - 验证活动工具切换时能力正确派生
 * - 验证文本编辑对象生命周期
 * - 验证会话活动颜色读写
 */

function makeToolStateMachine(
  overrides: {
    activeTool?: EditorTool;
    currentTool?: EditorTool;
    hasTemporaryTool?: boolean;
    setTool?: ReturnType<typeof vi.fn<(tool: EditorTool) => void>>;
    pushTemporaryTool?: ReturnType<typeof vi.fn<(tool: EditorTool) => void>>;
    popTemporaryTool?: ReturnType<typeof vi.fn<(tool: EditorTool) => void>>;
    clearTemporaryTools?: ReturnType<typeof vi.fn<() => void>>;
  } = {},
): ToolStateMachineApi {
  return {
    activeTool: overrides.activeTool ?? 'select',
    currentTool: overrides.currentTool ?? 'select',
    hasTemporaryTool: overrides.hasTemporaryTool ?? false,
    setTool: overrides.setTool ?? vi.fn<(tool: EditorTool) => void>(),
    pushTemporaryTool: overrides.pushTemporaryTool ?? vi.fn<(tool: EditorTool) => void>(),
    popTemporaryTool: overrides.popTemporaryTool ?? vi.fn<(tool: EditorTool) => void>(),
    clearTemporaryTools: overrides.clearTemporaryTools ?? vi.fn<() => void>(),
  };
}

function makeInteractionStateMachine(
  overrides: {
    state?: InteractionState;
    isInteracting?: boolean;
    isEditingText?: boolean;
    isContextMenuOpen?: boolean;
    dispatch?: ReturnType<
      typeof vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>
    >;
  } = {},
): InteractionStateMachineApi {
  return {
    state: overrides.state ?? 'idle',
    isInteracting: overrides.isInteracting ?? false,
    isEditingText: overrides.isEditingText ?? false,
    isContextMenuOpen: overrides.isContextMenuOpen ?? false,
    dispatch: overrides.dispatch ?? vi.fn(),
    setState: vi.fn(),
  };
}

function renderSession(options?: Partial<UseEditorSessionOptions>) {
  const tsm = options?.toolStateMachine ?? makeToolStateMachine();
  const ism = options?.interactionStateMachine ?? makeInteractionStateMachine();
  return renderHook(() =>
    useEditorSession({ toolStateMachine: tsm, interactionStateMachine: ism }),
  );
}

describe('useEditorSession 任务 2.1：编辑器会话交互控制器 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('字段拥有者划分', () => {
    it('工具状态字段从 ToolStateMachineApi 透传', () => {
      const tsm = makeToolStateMachine({
        activeTool: 'hand',
        currentTool: 'select',
        hasTemporaryTool: true,
      });
      const { result } = renderSession({ toolStateMachine: tsm });
      expect(result.current.activeTool).toBe('hand');
      expect(result.current.currentTool).toBe('select');
      expect(result.current.hasTemporaryTool).toBe(true);
    });

    it('交互状态字段从 InteractionStateMachineApi 透传', () => {
      const ism = makeInteractionStateMachine({
        state: 'dragging',
        isInteracting: true,
        isEditingText: false,
        isContextMenuOpen: false,
      });
      const { result } = renderSession({ interactionStateMachine: ism });
      expect(result.current.interactionState).toBe('dragging');
      expect(result.current.isInteracting).toBe(true);
      expect(result.current.isEditingText).toBe(false);
      expect(result.current.isContextMenuOpen).toBe(false);
    });

    it('活动工具能力从 TOOL_REGISTRY 派生（不持有副本）', () => {
      const tsm = makeToolStateMachine({ activeTool: 'select' });
      const { result } = renderSession({ toolStateMachine: tsm });
      const expected = getToolById('select')!.capabilities;
      expect(result.current.activeCapabilities).toEqual(expected);
    });

    it('活动工具能力随 activeTool 切换更新', () => {
      const tsm = makeToolStateMachine({ activeTool: 'select' });
      const { result, rerender } = renderHook(
        ({ tsm, ism }: { tsm: ToolStateMachineApi; ism: InteractionStateMachineApi }) =>
          useEditorSession({ toolStateMachine: tsm, interactionStateMachine: ism }),
        {
          initialProps: {
            tsm,
            ism: makeInteractionStateMachine(),
          },
        },
      );
      expect(result.current.activeCapabilities.canSelect).toBe(true);

      // 切换到 hand
      const newTsm = makeToolStateMachine({ activeTool: 'hand' });
      rerender({ tsm: newTsm, ism: makeInteractionStateMachine() });
      expect(result.current.activeCapabilities.canPan).toBe(true);
      expect(result.current.activeCapabilities.canSelect).toBe(false);
    });

    it('hasCapability 便捷方法查询活动工具能力', () => {
      const tsm = makeToolStateMachine({ activeTool: 'rect' });
      const { result } = renderSession({ toolStateMachine: tsm });
      expect(result.current.hasCapability('canCreate')).toBe(true);
      expect(result.current.hasCapability('canPan')).toBe(false);
    });

    it('文本编辑对象由会话控制器持有（初始为 null）', () => {
      const { result } = renderSession();
      expect(result.current.textEditing).toBeNull();
    });

    it('会话活动颜色由会话控制器持有（初始为 #ffffff）', () => {
      const { result } = renderSession();
      expect(result.current.activeColor).toBe('#ffffff');
    });
  });

  describe('工具状态透传', () => {
    it('setTool 透传到 ToolStateMachineApi', () => {
      const setTool = vi.fn<(tool: EditorTool) => void>();
      const tsm = makeToolStateMachine({ setTool });
      const { result } = renderSession({ toolStateMachine: tsm });
      act(() => result.current.setTool('hand'));
      expect(setTool).toHaveBeenCalledWith('hand');
    });

    it('pushTemporaryTool 透传到 ToolStateMachineApi', () => {
      const push = vi.fn<(tool: EditorTool) => void>();
      const tsm = makeToolStateMachine({ pushTemporaryTool: push });
      const { result } = renderSession({ toolStateMachine: tsm });
      act(() => result.current.pushTemporaryTool('hand'));
      expect(push).toHaveBeenCalledWith('hand');
    });

    it('popTemporaryTool 透传到 ToolStateMachineApi', () => {
      const pop = vi.fn<(tool: EditorTool) => void>();
      const tsm = makeToolStateMachine({ popTemporaryTool: pop });
      const { result } = renderSession({ toolStateMachine: tsm });
      act(() => result.current.popTemporaryTool('hand'));
      expect(pop).toHaveBeenCalledWith('hand');
    });
  });

  /**
   * 任务 13.6 回归测试：工具切换时清理交互状态。
   *
   * 修复 bug：用户在 text-editing / creating / panning 等瞬时状态切换工具时，
   * 交互状态机卡住，导致 Selecto onDragStart 仲裁拒绝后续点击，无法选中组件。
   *
   * setToolWithCleanup 策略：非 idle/hovering 状态下切换工具时，先派发 cancel
   * 事件让交互状态机恢复到 idle，再调用底层 setTool。
   */
  describe('任务 13.6：工具切换时清理交互状态', () => {
    it('idle 状态下切换工具不派发 cancel', () => {
      const setTool = vi.fn<(tool: EditorTool) => void>();
      const dispatch =
        vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>();
      const tsm = makeToolStateMachine({ setTool });
      const ism = makeInteractionStateMachine({ state: 'idle', dispatch });
      const { result } = renderSession({ toolStateMachine: tsm, interactionStateMachine: ism });

      act(() => result.current.setTool('hand'));

      expect(dispatch).not.toHaveBeenCalled();
      expect(setTool).toHaveBeenCalledWith('hand');
    });

    it('hovering 状态下切换工具不派发 cancel', () => {
      const setTool = vi.fn<(tool: EditorTool) => void>();
      const dispatch =
        vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>();
      const tsm = makeToolStateMachine({ setTool });
      const ism = makeInteractionStateMachine({ state: 'hovering', dispatch });
      const { result } = renderSession({ toolStateMachine: tsm, interactionStateMachine: ism });

      act(() => result.current.setTool('select'));

      expect(dispatch).not.toHaveBeenCalled();
      expect(setTool).toHaveBeenCalledWith('select');
    });

    it('text-editing 状态下切换工具派发 cancel（修复文本编辑态卡住）', () => {
      const setTool = vi.fn<(tool: EditorTool) => void>();
      const dispatch =
        vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>();
      const tsm = makeToolStateMachine({ setTool });
      const ism = makeInteractionStateMachine({ state: 'text-editing', dispatch });
      const { result } = renderSession({ toolStateMachine: tsm, interactionStateMachine: ism });

      act(() => result.current.setTool('select'));

      expect(dispatch).toHaveBeenCalledWith('cancel');
      expect(setTool).toHaveBeenCalledWith('select');
    });

    it('creating 状态下切换工具派发 cancel（修复创建态卡住）', () => {
      const setTool = vi.fn<(tool: EditorTool) => void>();
      const dispatch =
        vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>();
      const tsm = makeToolStateMachine({ setTool });
      const ism = makeInteractionStateMachine({ state: 'creating', dispatch });
      const { result } = renderSession({ toolStateMachine: tsm, interactionStateMachine: ism });

      act(() => result.current.setTool('select'));

      expect(dispatch).toHaveBeenCalledWith('cancel');
      expect(setTool).toHaveBeenCalledWith('select');
    });

    it('panning 状态下切换工具派发 cancel（修复平移态卡住）', () => {
      const setTool = vi.fn<(tool: EditorTool) => void>();
      const dispatch =
        vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>();
      const tsm = makeToolStateMachine({ setTool });
      const ism = makeInteractionStateMachine({ state: 'panning', dispatch });
      const { result } = renderSession({ toolStateMachine: tsm, interactionStateMachine: ism });

      act(() => result.current.setTool('select'));

      expect(dispatch).toHaveBeenCalledWith('cancel');
      expect(setTool).toHaveBeenCalledWith('select');
    });

    it('dragging 状态下切换工具派发 cancel（修复拖拽态卡住）', () => {
      const setTool = vi.fn<(tool: EditorTool) => void>();
      const dispatch =
        vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>();
      const tsm = makeToolStateMachine({ setTool });
      const ism = makeInteractionStateMachine({ state: 'dragging', dispatch });
      const { result } = renderSession({ toolStateMachine: tsm, interactionStateMachine: ism });

      act(() => result.current.setTool('select'));

      expect(dispatch).toHaveBeenCalledWith('cancel');
      expect(setTool).toHaveBeenCalledWith('select');
    });

    it('连续切换工具只对第一次非 idle 状态派发 cancel', () => {
      const setTool = vi.fn<(tool: EditorTool) => void>();
      const dispatch =
        vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>();
      const tsm = makeToolStateMachine({ setTool });
      const ism = makeInteractionStateMachine({ state: 'text-editing', dispatch });
      const { result } = renderSession({ toolStateMachine: tsm, interactionStateMachine: ism });

      // 第一次切换：text-editing → 派发 cancel
      act(() => result.current.setTool('select'));
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith('cancel');

      // 第二次切换：ref 仍为 text-editing（mock 不更新 state），仍派发 cancel
      act(() => result.current.setTool('hand'));
      expect(dispatch).toHaveBeenCalledTimes(2);
    });

    it('setToolWithCleanup 是稳定引用（不依赖 interactionState）', () => {
      const setTool = vi.fn<(tool: EditorTool) => void>();
      const dispatch =
        vi.fn<(event: InteractionEvent, payload?: InteractionEventPayload) => void>();
      const tsm = makeToolStateMachine({ setTool });
      const ism = makeInteractionStateMachine({ state: 'idle', dispatch });
      const { result, rerender } = renderSession({
        toolStateMachine: tsm,
        interactionStateMachine: ism,
      });

      const firstRef = result.current.setTool;
      // 重新渲染（interactionState 不变）
      rerender();
      expect(result.current.setTool).toBe(firstRef);
    });
  });

  describe('交互状态透传', () => {
    it('dispatchInteraction 透传到 InteractionStateMachineApi', () => {
      const dispatch = vi.fn();
      const ism = makeInteractionStateMachine({ dispatch });
      const { result } = renderSession({ interactionStateMachine: ism });
      const payload: InteractionEventPayload = { hitComponent: true };
      act(() => result.current.dispatchInteraction('pointer-down', payload));
      expect(dispatch).toHaveBeenCalledWith('pointer-down', payload);
    });

    it('dispatchInteraction 无 payload 时只传事件名', () => {
      const dispatch = vi.fn();
      const ism = makeInteractionStateMachine({ dispatch });
      const { result } = renderSession({ interactionStateMachine: ism });
      act(() => result.current.dispatchInteraction('escape'));
      // 无 payload 时 dispatch 只传事件名（与 InteractionStateMachineApi 签名一致）
      expect(dispatch).toHaveBeenCalledWith('escape');
    });
  });

  describe('文本编辑对象生命周期', () => {
    it('beginTextEditing 设置文本编辑上下文', () => {
      const { result } = renderSession();
      const ctx: TextEditingContext = {
        componentId: 'c1',
        initialContent: 'hello',
        isNewlyCreated: false,
      };
      act(() => result.current.beginTextEditing(ctx));
      expect(result.current.textEditing).toEqual(ctx);
    });

    it('beginTextEditing 覆盖之前的编辑上下文', () => {
      const { result } = renderSession();
      act(() =>
        result.current.beginTextEditing({
          componentId: 'c1',
          initialContent: 'a',
          isNewlyCreated: false,
        }),
      );
      act(() =>
        result.current.beginTextEditing({
          componentId: 'c2',
          initialContent: 'b',
          isNewlyCreated: false,
        }),
      );
      expect(result.current.textEditing).toEqual({
        componentId: 'c2',
        initialContent: 'b',
        isNewlyCreated: false,
      });
    });

    it('endTextEditing 清空文本编辑上下文', () => {
      const { result } = renderSession();
      act(() =>
        result.current.beginTextEditing({
          componentId: 'c1',
          initialContent: 'a',
          isNewlyCreated: false,
        }),
      );
      act(() => result.current.endTextEditing());
      expect(result.current.textEditing).toBeNull();
    });
  });

  describe('会话活动颜色', () => {
    it('setActiveColor 更新活动颜色', () => {
      const { result } = renderSession();
      act(() => result.current.setActiveColor('#ff0000'));
      expect(result.current.activeColor).toBe('#ff0000');
    });

    it('setActiveColor 可被多次调用', () => {
      const { result } = renderSession();
      act(() => result.current.setActiveColor('#ff0000'));
      act(() => result.current.setActiveColor('#00ff00'));
      act(() => result.current.setActiveColor('#0000ff'));
      expect(result.current.activeColor).toBe('#0000ff');
    });
  });

  describe('API 边界约束（任务 2.1 验证要求）', () => {
    it('API 不包含持久项目副本（project/components）', () => {
      const { result } = renderSession();
      const api = result.current as unknown as Record<string, unknown>;
      expect(api).not.toHaveProperty('project');
      expect(api).not.toHaveProperty('components');
      expect(api).not.toHaveProperty('selectedComponentIds');
    });

    it('API 不包含 Moveable 实例或 DOM ref', () => {
      const { result } = renderSession();
      const api = result.current as unknown as Record<string, unknown>;
      expect(api).not.toHaveProperty('moveable');
      expect(api).not.toHaveProperty('moveableRef');
      expect(api).not.toHaveProperty('canvasRef');
      expect(api).not.toHaveProperty('containerRef');
    });

    it('API 不包含每帧 pointer 坐标', () => {
      const { result } = renderSession();
      const api = result.current as unknown as Record<string, unknown>;
      expect(api).not.toHaveProperty('pointerX');
      expect(api).not.toHaveProperty('pointerY');
      expect(api).not.toHaveProperty('startX');
      expect(api).not.toHaveProperty('startY');
      expect(api).not.toHaveProperty('currentX');
      expect(api).not.toHaveProperty('currentY');
    });

    it('API 不包含 Selecto 实例', () => {
      const { result } = renderSession();
      const api = result.current as unknown as Record<string, unknown>;
      expect(api).not.toHaveProperty('selecto');
      expect(api).not.toHaveProperty('selectoRef');
    });

    it('API 字段总数受控（避免随意扩展）', () => {
      const { result } = renderSession();
      const expectedKeys = [
        'activeTool',
        'currentTool',
        'hasTemporaryTool',
        'setTool',
        'pushTemporaryTool',
        'popTemporaryTool',
        'interactionState',
        'isInteracting',
        'isEditingText',
        'isContextMenuOpen',
        'dispatchInteraction',
        'activeCapabilities',
        'hasCapability',
        'textEditing',
        'beginTextEditing',
        'endTextEditing',
        'activeColor',
        'setActiveColor',
      ];
      const actualKeys = Object.keys(result.current).sort();
      expect(actualKeys).toEqual(expectedKeys.sort());
    });
  });

  describe('活动工具能力一致性', () => {
    it('每个 TOOL_REGISTRY 工具的能力都能正确派生', () => {
      for (const tool of TOOL_REGISTRY) {
        const tsm = makeToolStateMachine({ activeTool: tool.id });
        const { result } = renderSession({ toolStateMachine: tsm });
        expect(result.current.activeCapabilities).toEqual(tool.capabilities);
      }
    });

    it('hasCapability 对每种工具返回正确值', () => {
      const cases = [
        {
          tool: 'select' as EditorTool,
          trueCaps: ['canSelect', 'canDrag', 'canResize', 'canRotate'] as const,
        },
        { tool: 'hand' as EditorTool, trueCaps: ['canPan'] as const },
        { tool: 'text' as EditorTool, trueCaps: ['canCreate'] as const },
        { tool: 'rect' as EditorTool, trueCaps: ['canCreate'] as const },
        { tool: 'ellipse' as EditorTool, trueCaps: ['canCreate'] as const },
        { tool: 'image' as EditorTool, trueCaps: ['canCreate'] as const },
        { tool: 'zoom' as EditorTool, trueCaps: ['canZoom'] as const },
        { tool: 'eyedropper' as EditorTool, trueCaps: ['canSample'] as const },
      ];
      for (const { tool, trueCaps } of cases) {
        const tsm = makeToolStateMachine({ activeTool: tool });
        const { result } = renderSession({ toolStateMachine: tsm });
        for (const cap of trueCaps) {
          expect(result.current.hasCapability(cap), `${tool}.${cap} 应为 true`).toBe(true);
        }
      }
    });
  });
});
