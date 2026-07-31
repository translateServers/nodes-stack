import type {
  ScreenHostAdapter,
  ScreenProjectEnvelopeInput,
} from '@nebula/screen-editor-core/internal';
import { ScreenAdapterErrorCode, ScreenHostController } from '@nebula/screen-editor-core/internal';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createScreenHostSessionPort } from '../lib/screen-host-session';
import { createScreenEditorStore, ScreenEditorStoreProvider } from '../stores/editor-store';
import { ImportDialog } from './import-dialog';
import { ScreenEditorNotificationProvider } from './screen-editor-notifications';

function createEnvelope(revision: string): ScreenProjectEnvelopeInput {
  return {
    id: 'screen-1',
    name: 'Current Screen',
    description: null,
    status: 'draft',
    revision,
    document: {
      schemaVersion: 1,
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#000000',
        scaleMode: 'fit',
      },
      components: [],
      globalVariables: [],
    },
  };
}

function createTransferFile(): File {
  return new File(
    [
      JSON.stringify({
        format: 'nebula-screen',
        formatVersion: 1,
        name: 'Imported Screen',
        description: 'Imported description',
        document: createEnvelope('transfer').document,
      }),
    ],
    'import.json',
    { type: 'application/json' },
  );
}

describe('ImportDialog Host Adapter workflow', () => {
  it('previews a transfer, warns about dirty state, and applies the Adapter envelope', async () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const importProject = vi.fn(
      ({ transfer }: Parameters<NonNullable<ScreenHostAdapter['importProject']>>[0]) =>
        Promise.resolve({
          ...createEnvelope('revision-imported'),
          name: transfer.name,
          description: transfer.description,
          document: transfer.document,
        }),
    );
    const adapter: ScreenHostAdapter = {
      loadProject: () => Promise.resolve(createEnvelope('revision-1')),
      saveProject: () => Promise.resolve(createEnvelope('revision-2')),
      importProject,
    };
    const controller = new ScreenHostController({
      session: createScreenHostSessionPort(store),
    });
    controller.setBinding('screen-1', adapter);
    await vi.waitFor(() => expect(controller.getState().phase).toBe('awaiting-render'));
    controller.markRendered();
    store.getState().updateCanvas({ width: 1280 });

    const onOpenChange = vi.fn();
    render(
      <ScreenEditorStoreProvider store={store}>
        <ScreenEditorNotificationProvider>
          <ImportDialog
            open
            onOpenChange={onOpenChange}
            currentProjectId="screen-1"
            hostController={controller}
          />
        </ScreenEditorNotificationProvider>
      </ScreenEditorStoreProvider>,
    );
    expect(screen.getByText('导入将覆盖当前未保存内容，请确认后继续')).toBeInTheDocument();

    const file = createTransferFile();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Import file input was not rendered');
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Imported Screen')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));

    await waitFor(() => expect(importProject).toHaveBeenCalledOnce());
    expect(store.getState().project?.name).toBe('Imported Screen');
    expect(store.getState().project?.updatedAt).toBe('revision-imported');
    expect(store.getState().history).toEqual({ past: [], future: [] });
    expect(store.getState().isDirty).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('routes import conflicts to the reload-or-cancel flow', async () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const conflict = Object.assign(new Error('conflict detail'), {
      code: ScreenAdapterErrorCode.CONFLICT,
    });
    const controller = new ScreenHostController({
      session: createScreenHostSessionPort(store),
    });
    controller.setBinding('screen-1', {
      loadProject: () => Promise.resolve(createEnvelope('revision-1')),
      saveProject: () => Promise.resolve(createEnvelope('revision-2')),
      importProject: () => Promise.reject(conflict),
    });
    await vi.waitFor(() => expect(controller.getState().phase).toBe('awaiting-render'));
    controller.markRendered();
    const onConflict = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ScreenEditorStoreProvider store={store}>
        <ScreenEditorNotificationProvider>
          <ImportDialog
            open
            onOpenChange={onOpenChange}
            onConflict={onConflict}
            currentProjectId="screen-1"
            hostController={controller}
          />
        </ScreenEditorNotificationProvider>
      </ScreenEditorStoreProvider>,
    );
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Import file input was not rendered');
    fireEvent.change(input, { target: { files: [createTransferFile()] } });
    await screen.findByText('Imported Screen');
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));

    await waitFor(() => expect(onConflict).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(store.getState().project?.updatedAt).toBe('revision-1');
  });
});
