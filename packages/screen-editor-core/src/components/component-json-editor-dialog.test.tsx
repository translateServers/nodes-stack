import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import { DEFAULT_BUILTIN_REGISTRY, RegistryProvider } from '../registry/registry-context';
import { createScreenEditorStore, ScreenEditorStoreProvider } from '../stores/editor-store';
import { ScreenEditorEnvironmentProvider } from './screen-editor-environment';
import type { ComponentJsonEditorProps } from './component-json-editor';
import { ComponentJsonEditorDialog } from './component-json-editor-dialog';

function makeComponent(): ScreenComponent {
  return {
    id: 'text-1',
    name: '标题',
    position: { height: 64, width: 320, x: 40, y: 48 },
    props: { content: '旧标题' },
    status: { hidden: false, locked: false },
    style: { color: '#ffffff', fontSize: 24 },
    type: 'text',
    zIndex: 1,
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

function FakeComponentJsonEditor({
  ariaLabel,
  onChange,
  readOnly,
  value,
}: ComponentJsonEditorProps) {
  return (
    <textarea
      aria-label={ariaLabel}
      data-testid="fake-component-json-editor"
      disabled={readOnly}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  );
}

interface RenderDialogOptions {
  readonly?: boolean;
}

function renderDialog(options: RenderDialogOptions = {}) {
  const component = makeComponent();
  const store = createScreenEditorStore({ persistPreferences: false });
  store.getState().loadProject(makeProject(component));
  const onOpenChange = vi.fn();
  render(
    <ScreenEditorStoreProvider store={store}>
      <ScreenEditorEnvironmentProvider
        capabilityProfile="dynamic"
        portalRoot={null}
        readonly={options.readonly}
        requestNavigate={vi.fn()}
        setTheme={vi.fn()}
        theme="light"
      >
        <RegistryProvider registry={DEFAULT_BUILTIN_REGISTRY}>
          <ComponentJsonEditorDialog
            componentId={component.id}
            editor={FakeComponentJsonEditor}
            onOpenChange={onOpenChange}
            open={true}
          />
        </RegistryProvider>
      </ScreenEditorEnvironmentProvider>
    </ScreenEditorStoreProvider>,
  );
  return { component, onOpenChange, store };
}

async function getEditor(): Promise<HTMLTextAreaElement> {
  await waitFor(() => expect(screen.getByTestId('fake-component-json-editor')).toBeDefined());
  const editor = screen.getByTestId('fake-component-json-editor');
  if (!(editor instanceof HTMLTextAreaElement)) throw new Error('Expected a textarea editor');
  return editor;
}

describe('ComponentJsonEditorDialog', () => {
  it('renders as a non-modal floating dialog without an overlay', async () => {
    renderDialog();
    await getEditor();

    const dialog = screen.getByTestId('component-json-editor-dialog');
    expect(dialog.getAttribute('data-slot')).toBe('dialog-content');
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
  });

  it('keeps the Monaco-compatible draft local until a valid apply', async () => {
    const { component, onOpenChange, store } = renderDialog();
    const editor = await getEditor();
    const next = JSON.stringify(
      {
        name: '新标题',
        position: component.position,
        props: { content: '新标题' },
        status: component.status,
        style: component.style,
        zIndex: component.zIndex,
      },
      null,
      2,
    );

    fireEvent.change(editor, { target: { value: next } });
    expect(store.getState().project?.components[0]?.props).toEqual({ content: '旧标题' });
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().isDirty).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(store.getState().project?.components[0]).toMatchObject({
      name: '新标题',
      props: { content: '新标题' },
    });
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().isDirty).toBe(true);
  });

  it('keeps an invalid draft open and reports a diagnostic without writing the store', async () => {
    const { onOpenChange, store } = renderDialog();
    const editor = await getEditor();

    fireEvent.change(editor, { target: { value: '{ "name": ' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    await waitFor(() => {
      expect(screen.getByTestId('component-json-editor-diagnostics').textContent).toContain(
        'JSON 格式错误',
      );
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(store.getState().project?.components[0]?.props).toEqual({ content: '旧标题' });
    expect(store.getState().history.past).toHaveLength(0);
  });

  it('requires confirmation before discarding a dirty draft', async () => {
    renderDialog();
    const editor = await getEditor();

    fireEvent.change(editor, { target: { value: '{' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => expect(screen.getByText('放弃 JSON 修改？')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    expect(screen.getByTestId('fake-component-json-editor')).toBeDefined();
  });

  it('keeps a stale draft open instead of replacing a later external update', async () => {
    const { component, store } = renderDialog();
    await getEditor();
    store.getState().updateComponent(component.id, { props: { content: '外部更新' } });

    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    await waitFor(() => {
      expect(screen.getByTestId('component-json-editor-diagnostics').textContent).toContain(
        '组件配置已在编辑期间变化',
      );
    });
    expect(store.getState().project?.components[0]?.props).toEqual({ content: '外部更新' });
  });

  it('renders the injected editor as readonly without an apply command', async () => {
    renderDialog({ readonly: true });
    const editor = await getEditor();

    expect(editor.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: '应用' })).toBeNull();
    expect(screen.getByRole('button', { name: '关闭' })).toBeDefined();
  });
});
