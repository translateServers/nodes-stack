import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { ScreenProject } from '@nebula/shared';

import { useScreenEditorStore } from '../stores/editor-store';
import { CanvasSettingsDialog } from './canvas-settings-dialog';

/** 创建一个最小可用的 ScreenProject mock */
function makeProject(): ScreenProject {
  return {
    id: 'proj-1',
    name: 'project-proj-1',
    description: null,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [],
    status: 'draft',
    thumbnail: null,
    createdAt: '2024-01-01 00:00:00',
    updatedAt: '2024-01-01 00:00:00',
  } as unknown as ScreenProject;
}

/** 通过 label 文本查找同容器内的 input 元素（对话框字段 label 与 input 为同容器节点） */
function findInputByLabel(label: string, selector = 'input'): HTMLInputElement {
  const labelEl = screen.getByText(label, { exact: true });
  const container = labelEl.parentElement;
  if (!container) throw new Error(`label "${label}" has no parent element`);
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`no input found for label "${label}"`);
  return input;
}

describe('CanvasSettingsDialog 画布配置进入历史栈（任务 8.2/8.3）', () => {
  beforeEach(() => {
    // 重置 store 数据字段，保留 actions；隔离每个用例的状态
    useScreenEditorStore.setState({
      project: null,
      selectedComponentIds: [],
      history: { past: [], future: [] },
      isDirty: false,
    });
  });

  it('连续修改数值与颜色后点击应用：一次业务修改只产生一条历史', () => {
    useScreenEditorStore.getState().loadProject(makeProject());
    render(<CanvasSettingsDialog open={true} onOpenChange={vi.fn()} />);

    // 数值连续输入（draft 阶段，不写入 store）
    fireEvent.change(findInputByLabel('宽度'), { target: { value: '1280' } });
    fireEvent.change(findInputByLabel('高度'), { target: { value: '720' } });

    // 颜色连续输入（文本框多次变更，均为 draft）
    const colorTextInput = findInputByLabel('背景色', 'input[type="text"]');
    fireEvent.change(colorTextInput, { target: { value: '#ff0000' } });
    fireEvent.change(colorTextInput, { target: { value: '#00ff00' } });

    // draft 阶段：store 画布与历史均未受影响
    expect(useScreenEditorStore.getState().project?.canvas.width).toBe(1920);
    expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
    expect(useScreenEditorStore.getState().isDirty).toBe(false);

    // 确认提交
    fireEvent.click(screen.getByText('应用'));

    const state = useScreenEditorStore.getState();
    expect(state.project?.canvas.width).toBe(1280);
    expect(state.project?.canvas.height).toBe(720);
    expect(state.project?.canvas.backgroundColor).toBe('#00ff00');
    // 一次业务修改只入栈一条，条目为修改前的组件 + 画布快照
    expect(state.history.past).toHaveLength(1);
    expect(state.history.past[0]).toEqual({
      components: [],
      canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
    });
    expect(state.isDirty).toBe(true);
  });

  it('未做任何修改点击应用：不产生空历史记录、不置脏', () => {
    useScreenEditorStore.getState().loadProject(makeProject());
    const onOpenChange = vi.fn();
    render(<CanvasSettingsDialog open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText('应用'));

    const state = useScreenEditorStore.getState();
    expect(state.history.past).toHaveLength(0);
    expect(state.history.future).toHaveLength(0);
    expect(state.isDirty).toBe(false);
    // 对话框仍按既有语义关闭
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('取消：draft 修改不写入 store、不产生历史', () => {
    useScreenEditorStore.getState().loadProject(makeProject());
    const onOpenChange = vi.fn();
    render(<CanvasSettingsDialog open={true} onOpenChange={onOpenChange} />);

    fireEvent.change(findInputByLabel('宽度'), { target: { value: '1280' } });
    fireEvent.click(screen.getByText('取消'));

    const state = useScreenEditorStore.getState();
    expect(state.project?.canvas.width).toBe(1920);
    expect(state.history.past).toHaveLength(0);
    expect(state.isDirty).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('应用后的画布修改可通过 undo/redo 恢复', () => {
    useScreenEditorStore.getState().loadProject(makeProject());
    render(<CanvasSettingsDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.change(findInputByLabel('宽度'), { target: { value: '1280' } });
    fireEvent.click(screen.getByText('应用'));
    expect(useScreenEditorStore.getState().project?.canvas.width).toBe(1280);

    useScreenEditorStore.getState().undo();
    expect(useScreenEditorStore.getState().project?.canvas.width).toBe(1920);

    useScreenEditorStore.getState().redo();
    expect(useScreenEditorStore.getState().project?.canvas.width).toBe(1280);
  });
});
