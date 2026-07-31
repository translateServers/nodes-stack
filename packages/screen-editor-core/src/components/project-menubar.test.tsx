import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScreenProject } from '@nebula/shared';
import { createScreenEditorStore, ScreenEditorStoreProvider } from '../stores/editor-store';
import { ScreenEditorEnvironmentProvider } from './screen-editor-environment';
import { ProjectMenubar } from './project-menubar';

function createProject(): ScreenProject {
  return {
    id: 'screen-1',
    name: 'Screen',
    description: null,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [],
    globalVariables: [],
    status: 'draft',
    thumbnail: null,
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: 'revision-1',
  };
}

interface RenderMenubarOptions {
  onExport?: () => void;
  onPublish?: () => void;
  onShowImport?: () => void;
}

function renderMenubar(options: RenderMenubarOptions = {}) {
  const store = createScreenEditorStore({ persistPreferences: false });
  store.getState().loadProject(createProject());
  const noop = vi.fn();
  return render(
    <ScreenEditorStoreProvider store={store}>
      <ScreenEditorEnvironmentProvider
        capabilityProfile="static"
        portalRoot={null}
        requestNavigate={noop}
        setTheme={noop}
        theme="light"
      >
        <ProjectMenubar
          onSave={noop}
          onPreview={noop}
          onShowCanvasSettings={noop}
          onShowEventBlueprint={noop}
          onShowCodeEditor={noop}
          onShowShortcutsHelp={noop}
          onZoomIn={noop}
          onZoomOut={noop}
          onFitToScreen={noop}
          {...options}
        />
      </ScreenEditorEnvironmentProvider>
    </ScreenEditorStoreProvider>,
  );
}

describe('ProjectMenubar Adapter capabilities', () => {
  it('hides optional publish, import, and export commands when callbacks are absent', async () => {
    const user = userEvent.setup();
    renderMenubar();
    await user.click(screen.getByRole('button', { name: '文件' }));

    expect(screen.queryByText('发布项目')).not.toBeInTheDocument();
    expect(screen.queryByText('导入 JSON...')).not.toBeInTheDocument();
    expect(screen.queryByText('导出 JSON')).not.toBeInTheDocument();
    expect(screen.getByText('保存项目')).toBeInTheDocument();
  });

  it('shows optional commands when the Adapter capabilities are present', async () => {
    const user = userEvent.setup();
    renderMenubar({ onPublish: vi.fn(), onShowImport: vi.fn(), onExport: vi.fn() });
    await user.click(screen.getByRole('button', { name: '文件' }));

    expect(screen.getByText('发布项目')).toBeInTheDocument();
    expect(screen.getByText('导入 JSON...')).toBeInTheDocument();
    expect(screen.getByText('导出 JSON')).toBeInTheDocument();
  });
});
