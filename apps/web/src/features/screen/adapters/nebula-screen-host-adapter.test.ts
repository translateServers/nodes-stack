import { QueryClient } from '@tanstack/react-query';
import { BizCode, BusinessError, type ScreenProject } from '@nebula/shared';
import { parseScreenProjectEnvelopeInput } from '@nebula/screen-sdk/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  createNebulaScreenHostAdapter,
  inspectNebulaScreenSdkCompatibility,
  mapNebulaScreenAdapterError,
  openNebulaScreenEditorPreview,
  screenProjectToSdkEnvelope,
  type NebulaScreenApi,
} from './nebula-screen-host-adapter';

const BASELINE = '2026-08-01 10:00:00';
const UPDATED = '2026-08-01 10:05:00';

function createProject(overrides: Partial<ScreenProject> = {}): ScreenProject {
  return {
    id: 'screen-1',
    name: '静态项目',
    description: null,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [],
    blueprint: { version: 2, nodes: [], edges: [] },
    globalVariables: [],
    status: 'draft',
    thumbnail: null,
    createdAt: '2026-08-01 09:00:00',
    updatedAt: BASELINE,
    ...overrides,
  };
}

function createApi(project = createProject()): {
  api: NebulaScreenApi;
  getProject: ReturnType<typeof vi.fn<NebulaScreenApi['getProject']>>;
  publishProject: ReturnType<typeof vi.fn<NebulaScreenApi['publishProject']>>;
  updateProject: ReturnType<typeof vi.fn<NebulaScreenApi['updateProject']>>;
} {
  const getProject = vi.fn<NebulaScreenApi['getProject']>(() => Promise.resolve(project));
  const updateProject = vi.fn<NebulaScreenApi['updateProject']>(() =>
    Promise.resolve({ ...project, updatedAt: UPDATED }),
  );
  const publishProject = vi.fn<NebulaScreenApi['publishProject']>(() =>
    Promise.resolve({ ...project, status: 'published', updatedAt: UPDATED }),
  );
  return {
    api: { getProject, publishProject, updateProject },
    getProject,
    publishProject,
    updateProject,
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

describe('Nebula ScreenHostAdapter', () => {
  it('maps updatedAt to the opaque SDK revision on load', async () => {
    const { api, getProject } = createApi();
    const queryClient = createQueryClient();
    const adapter = createNebulaScreenHostAdapter({ api, queryClient });
    const controller = new AbortController();

    const result = await adapter.loadProject({
      projectId: 'screen-1',
      signal: controller.signal,
    });

    expect(result).toEqual(screenProjectToSdkEnvelope(createProject()));
    expect(result.revision).toBe(BASELINE);
    expect(getProject).toHaveBeenCalledWith('screen-1', controller.signal);
    expect(queryClient.getQueryData(['screen-projects', 'screen-1'])).toEqual(createProject());
  });

  it('maps the full SDK draft to update API fields and invalidates only the list', async () => {
    const { api, updateProject } = createApi();
    const queryClient = createQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const adapter = createNebulaScreenHostAdapter({ api, queryClient });
    const controller = new AbortController();
    const parsedEnvelope = parseScreenProjectEnvelopeInput(
      screenProjectToSdkEnvelope(createProject()),
    );
    if (!parsedEnvelope.success) throw new Error('Static fixture should satisfy the SDK contract');
    const envelope = parsedEnvelope.data;

    const result = await adapter.saveProject({
      projectId: envelope.id,
      revision: envelope.revision,
      draft: {
        name: envelope.name,
        description: envelope.description,
        document: envelope.document,
      },
      signal: controller.signal,
    });

    expect(updateProject).toHaveBeenCalledWith(
      'screen-1',
      {
        name: '静态项目',
        description: undefined,
        canvas: envelope.document.canvas,
        components: envelope.document.components,
        blueprint: envelope.document.blueprint,
        globalVariables: envelope.document.globalVariables,
        expectedUpdatedAt: BASELINE,
      },
      controller.signal,
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['screen-projects'], exact: true });
    expect(result.revision).toBe(UPDATED);
  });

  it('publishes with the current revision and invalidates list and preview caches', async () => {
    const { api, publishProject } = createApi();
    const queryClient = createQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const adapter = createNebulaScreenHostAdapter({ api, queryClient });
    const controller = new AbortController();

    const result = await adapter.publishProject?.({
      projectId: 'screen-1',
      revision: BASELINE,
      signal: controller.signal,
    });

    expect(publishProject).toHaveBeenCalledWith(
      'screen-1',
      { expectedUpdatedAt: BASELINE },
      controller.signal,
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['screen-projects'], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['screen-preview', 'screen-1'] });
    expect(result?.status).toBe('published');
  });

  it.each([
    [BizCode.SCREEN_SAVE_CONFLICT, 'CONFLICT'],
    [BizCode.SCREEN_NAME_EXISTS, 'VALIDATION'],
    [BizCode.SCREEN_NOT_FOUND, 'NOT_FOUND'],
    [BizCode.UNAUTHORIZED, 'UNAUTHORIZED'],
    [BizCode.FORBIDDEN, 'FORBIDDEN'],
    [BizCode.INTERNAL_ERROR, 'UNAVAILABLE'],
    [-1, 'UNAVAILABLE'],
  ] as const)('maps Nebula error %s to %s', (bizCode, expectedCode) => {
    expect(mapNebulaScreenAdapterError(new BusinessError(bizCode, 'sensitive')).code).toBe(
      expectedCode,
    );
  });

  it('maps an aborted request without exposing the transport error', () => {
    const controller = new AbortController();
    controller.abort();

    expect(
      mapNebulaScreenAdapterError(
        new BusinessError(-1, 'Authorization: secret'),
        controller.signal,
      ),
    ).toMatchObject({ code: 'ABORTED', message: 'ABORTED' });
  });

  it('rejects dynamic Nebula projects through the shared SDK compatibility parser', () => {
    const dynamicProject = createProject({
      components: [
        {
          id: 'text-1',
          name: '动态文本',
          type: 'text',
          position: { x: 0, y: 0, width: 200, height: 80 },
          props: { content: 'dynamic' },
          style: {},
          dataSource: {
            type: 'api',
            staticData: null,
            apiConfig: { url: 'https://example.com/data', method: 'GET' },
          },
          status: { locked: false, hidden: false },
          zIndex: 1,
        },
      ],
    });

    expect(inspectNebulaScreenSdkCompatibility(createProject())).toEqual({ compatible: true });
    expect(inspectNebulaScreenSdkCompatibility(dynamicProject)).toMatchObject({
      compatible: false,
      code: 'UNSUPPORTED_DOCUMENT_FEATURE',
      diagnostics: [expect.objectContaining({ code: 'UNSUPPORTED_DATA_SOURCE' })],
    });
  });

  it('opens the existing authenticated preview route from a preview request', () => {
    const openWindow = vi.fn();

    openNebulaScreenEditorPreview({ projectId: 'screen/id' }, openWindow);

    expect(openWindow).toHaveBeenCalledWith(
      '/screen-editor-preview/screen%2Fid',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
