import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BizCode, BusinessError, type ScreenProject } from '@nebula/shared';

// Mock ./api 模块：避免真实 HTTP 副作用，仅 updateScreenProject 需要可控返回值
vi.mock('./api', () => ({
  getScreenProjects: vi.fn(),
  getScreenProject: vi.fn(),
  createScreenProject: vi.fn(),
  updateScreenProject: vi.fn(),
  publishScreenProject: vi.fn(),
  deleteScreenProject: vi.fn(),
  getScreenPreview: vi.fn(),
}));

import * as api from './api';
import { useUpdateScreenProject, usePublishScreenProject } from './hooks';
import { useScreenEditorStore } from './stores/editor-store';

const mockedUpdateScreenProject = vi.mocked(api.updateScreenProject);
const mockedPublishScreenProject = vi.mocked(api.publishScreenProject);

const BASELINE_UPDATED_AT = '2025-06-01 10:30:45';
const SERVER_UPDATED_AT_V1 = '2025-06-01 11:00:00';
const SERVER_UPDATED_AT_V2 = '2025-06-01 12:00:00';

/** 构造最小可用 ScreenProject */
function makeProject(overrides: Partial<ScreenProject> = {}): ScreenProject {
  return {
    id: 'screen-1',
    name: '测试大屏',
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
    createdAt: '2025-06-01 10:00:00',
    updatedAt: BASELINE_UPDATED_AT,
    ...overrides,
  };
}

/** 创建 QueryClientProvider wrapper，用于 renderHook */
function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }): ReactNode => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useUpdateScreenProject', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockedUpdateScreenProject.mockReset();
    mockedPublishScreenProject.mockReset();
    // gcTime: Infinity 避免无 observer 的详情查询在 onSuccess 的 await 期间被立即 GC
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    // 重置 Store 到初始基线
    useScreenEditorStore.getState().loadProject(makeProject());
  });

  describe('onSuccess 回写缓存与列表', () => {
    it('用响应更新详情缓存（含新 updatedAt 与 draft 状态）', async () => {
      const initial = makeProject({ updatedAt: BASELINE_UPDATED_AT });
      const response = makeProject({
        updatedAt: SERVER_UPDATED_AT_V1,
        name: '新名称',
        status: 'draft',
      });
      queryClient.setQueryData(['screen-projects', 'screen-1'], initial);

      mockedUpdateScreenProject.mockResolvedValue(response);

      const { result } = renderHook(() => useUpdateScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'screen-1',
          params: {
            name: '新名称',
            expectedUpdatedAt: BASELINE_UPDATED_AT,
          },
        });
      });

      const cached = queryClient.getQueryData<ScreenProject>(['screen-projects', 'screen-1']);
      expect(cached).toEqual(response);
      expect(cached?.updatedAt).toBe(SERVER_UPDATED_AT_V1);
      expect(cached?.status).toBe('draft');
    });

    it('失效列表查询（exact 匹配，不重复 refetch 详情）', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const response = makeProject({ updatedAt: SERVER_UPDATED_AT_V1 });
      mockedUpdateScreenProject.mockResolvedValue(response);

      const { result } = renderHook(() => useUpdateScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'screen-1',
          params: {
            name: '新名称',
            expectedUpdatedAt: BASELINE_UPDATED_AT,
          },
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['screen-projects'],
          exact: true,
        }),
      );
    });
  });

  describe('第二次保存使用第一次响应的新基线', () => {
    it('保存成功后 Store 的 updatedAt 被更新为响应值，第二次保存使用新基线', async () => {
      const store = useScreenEditorStore;
      store.getState().loadProject(makeProject({ updatedAt: BASELINE_UPDATED_AT }));

      // 第一次响应 V1，第二次响应 V2
      mockedUpdateScreenProject
        .mockResolvedValueOnce(makeProject({ updatedAt: SERVER_UPDATED_AT_V1 }))
        .mockResolvedValueOnce(makeProject({ updatedAt: SERVER_UPDATED_AT_V2 }));

      const { result } = renderHook(() => useUpdateScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      // 第一次保存：基线 = BASELINE
      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        const response = await result.current.mutateAsync({
          id: 'screen-1',
          params: { name: '第一次', expectedUpdatedAt: project.updatedAt },
        });
        // 模拟 handleSave 的 onSuccess：用响应回写 Store
        store.getState().loadProject(response);
      });

      expect(store.getState().project?.updatedAt).toBe(SERVER_UPDATED_AT_V1);

      // 第二次保存：基线应为 V1（第一次响应的新值）
      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        const response = await result.current.mutateAsync({
          id: 'screen-1',
          params: { name: '第二次', expectedUpdatedAt: project.updatedAt },
        });
        store.getState().loadProject(response);
      });

      // 断言第一次保存使用的基线 = BASELINE
      const firstCallParams = mockedUpdateScreenProject.mock.calls[0]?.[1];
      expect(firstCallParams?.expectedUpdatedAt).toBe(BASELINE_UPDATED_AT);

      // 关键断言：第二次保存使用了第一次响应的新基线 V1，而非旧基线 BASELINE
      const secondCallParams = mockedUpdateScreenProject.mock.calls[1]?.[1];
      expect(secondCallParams?.expectedUpdatedAt).toBe(SERVER_UPDATED_AT_V1);

      // 第二次保存后 Store 更新为 V2
      expect(store.getState().project?.updatedAt).toBe(SERVER_UPDATED_AT_V2);
    });
  });

  describe('任务 8.2：保存请求字段集合与已发布回写为 draft', () => {
    /**
     * 模拟 screen-editor.tsx handleSave 的 params 构造：
     * 只提交当前可编辑字段与基线，不提交 status（由服务端控制）。
     */
    function buildSaveParams(project: ScreenProject) {
      return {
        id: project.id,
        params: {
          name: project.name,
          description: project.description ?? undefined,
          canvas: project.canvas,
          components: project.components,
          expectedUpdatedAt: project.updatedAt,
        },
      };
    }

    it('保存请求包含可编辑字段与 expectedUpdatedAt，不包含 status', async () => {
      const store = useScreenEditorStore;
      // 加载已发布项目，验证即使源状态为 published 也不在请求中提交 status
      store
        .getState()
        .loadProject(makeProject({ status: 'published', updatedAt: BASELINE_UPDATED_AT }));

      mockedUpdateScreenProject.mockResolvedValue(
        makeProject({ updatedAt: SERVER_UPDATED_AT_V1, status: 'draft' }),
      );

      const { result } = renderHook(() => useUpdateScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        await result.current.mutateAsync(buildSaveParams(project));
      });

      const requestBody = mockedUpdateScreenProject.mock.calls[0]?.[1];
      // 包含全部可编辑字段与基线
      const anyObject: unknown = expect.any(Object);
      const anyArray: unknown = expect.any(Array);
      expect(requestBody).toEqual(
        expect.objectContaining({
          name: '测试大屏',
          canvas: anyObject,
          components: anyArray,
          expectedUpdatedAt: BASELINE_UPDATED_AT,
        }),
      );
      // 关键断言：请求体不包含 status 字段（由服务端控制）
      expect(requestBody).not.toHaveProperty('status');
    });

    it('expectedUpdatedAt 来源是 Store 的 updatedAt', async () => {
      const store = useScreenEditorStore;
      const CUSTOM_BASELINE = '2025-07-01 09:00:00';
      store.getState().loadProject(makeProject({ updatedAt: CUSTOM_BASELINE }));

      mockedUpdateScreenProject.mockResolvedValue(makeProject({ updatedAt: SERVER_UPDATED_AT_V1 }));

      const { result } = renderHook(() => useUpdateScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        await result.current.mutateAsync(buildSaveParams(project));
      });

      const requestBody = mockedUpdateScreenProject.mock.calls[0]?.[1];
      // 严格断言：expectedUpdatedAt 等于 Store 中的 updatedAt，而非本地时间或其他来源
      expect(requestBody?.expectedUpdatedAt).toBe(CUSTOM_BASELINE);
      expect(requestBody?.expectedUpdatedAt).toBe(store.getState().project?.updatedAt);
    });

    it('已发布项目保存成功后 Store 和详情缓存均回写为 draft', async () => {
      const store = useScreenEditorStore;
      // 1. 加载已发布项目到 Store
      store
        .getState()
        .loadProject(makeProject({ status: 'published', updatedAt: BASELINE_UPDATED_AT }));
      expect(store.getState().project?.status).toBe('published');

      // 2. 预置详情缓存为 published 状态
      queryClient.setQueryData(
        ['screen-projects', 'screen-1'],
        makeProject({ status: 'published', updatedAt: BASELINE_UPDATED_AT }),
      );
      expect(queryClient.getQueryData<ScreenProject>(['screen-projects', 'screen-1'])?.status).toBe(
        'published',
      );

      // 3. 服务端保存响应：状态变为 draft，updatedAt 更新为新基线
      const serverResponse = makeProject({
        status: 'draft',
        updatedAt: SERVER_UPDATED_AT_V1,
        name: '已保存',
      });
      mockedUpdateScreenProject.mockResolvedValue(serverResponse);

      const { result } = renderHook(() => useUpdateScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      // 4. 模拟 handleSave：用 Store 字段构造请求
      let mutateResponse: ScreenProject | undefined;
      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        mutateResponse = await result.current.mutateAsync(buildSaveParams(project));
      });

      // 5. 详情缓存由 hook 的 onSuccess 回写为 draft
      const cached = queryClient.getQueryData<ScreenProject>(['screen-projects', 'screen-1']);
      expect(cached?.status).toBe('draft');
      expect(cached?.updatedAt).toBe(SERVER_UPDATED_AT_V1);

      // 6. handleSave 的 onSuccess：loadProject(response) 回写 Store
      act(() => {
        if (mutateResponse) store.getState().loadProject(mutateResponse);
      });

      // 7. Store 回写为 draft，updatedAt 更新为新基线
      expect(store.getState().project?.status).toBe('draft');
      expect(store.getState().project?.updatedAt).toBe(SERVER_UPDATED_AT_V1);
      expect(store.getState().project?.name).toBe('已保存');
    });
  });
});

describe('usePublishScreenProject', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockedPublishScreenProject.mockReset();
    // gcTime: Infinity 避免无 observer 的详情查询在 onSuccess 的 await 期间被立即 GC
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    // 重置 Store 到初始基线
    useScreenEditorStore.getState().loadProject(makeProject());
  });

  describe('onSuccess 回写缓存与列表', () => {
    it('用响应更新详情缓存（含新 updatedAt 与 published 状态）', async () => {
      const initial = makeProject({ updatedAt: BASELINE_UPDATED_AT, status: 'draft' });
      const response = makeProject({
        updatedAt: SERVER_UPDATED_AT_V1,
        status: 'published',
      });
      queryClient.setQueryData(['screen-projects', 'screen-1'], initial);

      mockedPublishScreenProject.mockResolvedValue(response);

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'screen-1',
          expectedUpdatedAt: BASELINE_UPDATED_AT,
        });
      });

      const cached = queryClient.getQueryData<ScreenProject>(['screen-projects', 'screen-1']);
      expect(cached).toEqual(response);
      expect(cached?.updatedAt).toBe(SERVER_UPDATED_AT_V1);
      expect(cached?.status).toBe('published');
    });

    it('失效列表查询（exact 匹配，不重复 refetch 详情）', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const response = makeProject({ updatedAt: SERVER_UPDATED_AT_V1, status: 'published' });
      mockedPublishScreenProject.mockResolvedValue(response);

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'screen-1',
          expectedUpdatedAt: BASELINE_UPDATED_AT,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['screen-projects'],
          exact: true,
        }),
      );
    });

    it('失效公开预览查询，确保发布后匿名预览立即拉取新内容（任务 8.5）', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const response = makeProject({ updatedAt: SERVER_UPDATED_AT_V1, status: 'published' });
      mockedPublishScreenProject.mockResolvedValue(response);

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'screen-1',
          expectedUpdatedAt: BASELINE_UPDATED_AT,
        });
      });

      // 关键断言：发布成功后失效 ['screen-preview', id]，避免公开预览继续展示旧缓存
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['screen-preview', 'screen-1'],
        }),
      );
    });
  });

  describe('发布成功后 Store 的 updatedAt 更新为新值', () => {
    it('发布成功后调用 loadProject(response) 回写 Store，第二次发布使用新基线', async () => {
      const store = useScreenEditorStore;
      store.getState().loadProject(makeProject({ updatedAt: BASELINE_UPDATED_AT }));

      // 第一次响应 V1，第二次响应 V2
      mockedPublishScreenProject
        .mockResolvedValueOnce(
          makeProject({ updatedAt: SERVER_UPDATED_AT_V1, status: 'published' }),
        )
        .mockResolvedValueOnce(
          makeProject({ updatedAt: SERVER_UPDATED_AT_V2, status: 'published' }),
        );

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      // 第一次发布：基线 = BASELINE
      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        const response = await result.current.mutateAsync({
          id: 'screen-1',
          expectedUpdatedAt: project.updatedAt,
        });
        // 模拟 handlePublish 的 onSuccess：用响应回写 Store
        store.getState().loadProject(response);
      });

      expect(store.getState().project?.updatedAt).toBe(SERVER_UPDATED_AT_V1);
      expect(store.getState().project?.status).toBe('published');

      // 第二次发布：基线应为 V1（第一次响应的新值）
      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        const response = await result.current.mutateAsync({
          id: 'screen-1',
          expectedUpdatedAt: project.updatedAt,
        });
        store.getState().loadProject(response);
      });

      // 断言第一次发布使用的基线 = BASELINE
      const firstCallArgs = mockedPublishScreenProject.mock.calls[0]?.[1];
      expect(firstCallArgs?.expectedUpdatedAt).toBe(BASELINE_UPDATED_AT);

      // 关键断言：第二次发布使用了第一次响应的新基线 V1，而非旧基线 BASELINE
      const secondCallArgs = mockedPublishScreenProject.mock.calls[1]?.[1];
      expect(secondCallArgs?.expectedUpdatedAt).toBe(SERVER_UPDATED_AT_V1);

      // 第二次发布后 Store 更新为 V2
      expect(store.getState().project?.updatedAt).toBe(SERVER_UPDATED_AT_V2);
      expect(store.getState().project?.status).toBe('published');
    });
  });

  /**
   * 任务 8.3：未保存修改时阻止直接发布
   * 模拟 screen-editor.tsx handlePublish 的 isDirty 检查逻辑：
   * - isDirty=true：不调用发布 mutation，提示用户先保存
   * - isDirty=false：正常发送发布请求（含 expectedUpdatedAt）
   */
  describe('任务 8.3：未保存修改时阻止直接发布', () => {
    it('isDirty=true 时发布 mutation 未调用', async () => {
      const store = useScreenEditorStore;
      store.getState().loadProject(makeProject({ updatedAt: BASELINE_UPDATED_AT }));
      // 通过 updateCanvas 模拟用户修改，触发 isDirty=true（须为实际变化：无变化提交不入栈不置脏）
      store.getState().updateCanvas({ width: 1280 });
      expect(store.getState().isDirty).toBe(true);

      const response = makeProject({ updatedAt: SERVER_UPDATED_AT_V1, status: 'published' });
      mockedPublishScreenProject.mockResolvedValue(response);

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      // 模拟 handlePublish：检查 isDirty 后决定是否调用 mutateAsync
      await act(async () => {
        const state = store.getState();
        const project = state.project;
        if (!project) throw new Error('project should be loaded');
        // 与 screen-editor.tsx handlePublish 一致：isDirty=true 时阻止发布
        if (state.isDirty) {
          // toast.warning('请先保存修改后再发布'); 真实代码会显示 toast
          return;
        }
        await result.current.mutateAsync({
          id: project.id,
          expectedUpdatedAt: project.updatedAt,
        });
      });

      // 关键断言：存在本地脏状态时，发布 API 未被调用
      expect(mockedPublishScreenProject).not.toHaveBeenCalled();
      // Store 基线保持不变，未被响应覆盖
      expect(store.getState().project?.updatedAt).toBe(BASELINE_UPDATED_AT);
      expect(store.getState().project?.status).toBe('draft');
    });

    it('isDirty=false 时发布 mutation 正常调用', async () => {
      const store = useScreenEditorStore;
      store.getState().loadProject(makeProject({ updatedAt: BASELINE_UPDATED_AT }));
      expect(store.getState().isDirty).toBe(false);

      const response = makeProject({ updatedAt: SERVER_UPDATED_AT_V1, status: 'published' });
      mockedPublishScreenProject.mockResolvedValue(response);

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      // 模拟 handlePublish：isDirty=false 时正常发送发布请求
      await act(async () => {
        const state = store.getState();
        const project = state.project;
        if (!project) throw new Error('project should be loaded');
        // 与 screen-editor.tsx handlePublish 一致：isDirty=false 时正常发布
        if (state.isDirty) {
          return;
        }
        const mutateResponse = await result.current.mutateAsync({
          id: project.id,
          expectedUpdatedAt: project.updatedAt,
        });
        // onSuccess：用响应回写 Store
        store.getState().loadProject(mutateResponse);
      });

      // 关键断言：干净状态下发布 API 被调用一次，参数包含 expectedUpdatedAt 基线
      expect(mockedPublishScreenProject).toHaveBeenCalledTimes(1);
      expect(mockedPublishScreenProject).toHaveBeenCalledWith('screen-1', {
        expectedUpdatedAt: BASELINE_UPDATED_AT,
      });
      // Store 回写为新基线与 published 状态
      expect(store.getState().project?.updatedAt).toBe(SERVER_UPDATED_AT_V1);
      expect(store.getState().project?.status).toBe('published');
    });
  });

  /**
   * 任务 8.4：干净状态发布使用当前保存基线
   * 模拟 screen-editor.tsx handlePublish 的完整流程：
   * - isDirty=false 时发送发布请求，参数为 { id, expectedUpdatedAt: storeProject.updatedAt }
   * - 成功：loadProject(response) 回写 Store（任务 7.4 已实现）
   * - 冲突/失败：不调用 loadProject，Store 保持原基线，不误报成功
   */
  describe('任务 8.4：干净状态发布使用当前保存基线', () => {
    it('干净状态下发布请求包含正确的 expectedUpdatedAt', async () => {
      const store = useScreenEditorStore;
      const CUSTOM_BASELINE = '2025-08-01 08:00:00';
      store.getState().loadProject(makeProject({ updatedAt: CUSTOM_BASELINE }));
      // 显式断言干净状态
      expect(store.getState().isDirty).toBe(false);

      mockedPublishScreenProject.mockResolvedValue(
        makeProject({ updatedAt: SERVER_UPDATED_AT_V1, status: 'published' }),
      );

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      // 模拟 handlePublish：读取 Store 的 updatedAt 作为 expectedUpdatedAt
      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        await result.current.mutateAsync({
          id: project.id,
          expectedUpdatedAt: project.updatedAt,
        });
      });

      // 关键断言：发布请求参数为 (当前项目 ID, { expectedUpdatedAt: Store 中的 updatedAt })
      expect(mockedPublishScreenProject).toHaveBeenCalledTimes(1);
      expect(mockedPublishScreenProject).toHaveBeenCalledWith('screen-1', {
        expectedUpdatedAt: CUSTOM_BASELINE,
      });
      // 严格断言：expectedUpdatedAt 等于 Store 中的 updatedAt（当前保存基线）
      const callArgs = mockedPublishScreenProject.mock.calls[0];
      expect(callArgs?.[0]).toBe('screen-1');
      expect(callArgs?.[1]).toEqual({ expectedUpdatedAt: CUSTOM_BASELINE });
      expect(callArgs?.[1]?.expectedUpdatedAt).toBe(store.getState().project?.updatedAt);
    });

    it('发布成功后 Store 更新为新基线', async () => {
      const store = useScreenEditorStore;
      store.getState().loadProject(makeProject({ updatedAt: BASELINE_UPDATED_AT }));
      expect(store.getState().isDirty).toBe(false);

      const serverResponse = makeProject({
        updatedAt: SERVER_UPDATED_AT_V1,
        status: 'published',
        name: '已发布',
      });
      mockedPublishScreenProject.mockResolvedValue(serverResponse);

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      // 模拟 handlePublish 完整流程：mutate + onSuccess(loadProject(response))
      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        const response = await result.current.mutateAsync({
          id: project.id,
          expectedUpdatedAt: project.updatedAt,
        });
        // 与 screen-editor.tsx handlePublish 的 onSuccess 一致：回写 Store
        store.getState().loadProject(response);
      });

      // 关键断言：Store 更新为服务端响应的新基线与 published 状态
      expect(store.getState().project?.updatedAt).toBe(SERVER_UPDATED_AT_V1);
      expect(store.getState().project?.status).toBe('published');
      expect(store.getState().project?.name).toBe('已发布');
      // loadProject 会重置 isDirty 为 false（保持干净状态）
      expect(store.getState().isDirty).toBe(false);
    });

    it('发布失败时 Store 不被更新（不误报成功）', async () => {
      const store = useScreenEditorStore;
      store.getState().loadProject(makeProject({ updatedAt: BASELINE_UPDATED_AT }));
      expect(store.getState().isDirty).toBe(false);

      // 模拟发布失败（普通业务错误）
      mockedPublishScreenProject.mockRejectedValue(
        new BusinessError(BizCode.INTERNAL_ERROR, '服务器内部错误'),
      );

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      // 模拟 handlePublish：失败时不调用 loadProject（screen-editor.tsx 未实现 onError）
      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        try {
          await result.current.mutateAsync({
            id: project.id,
            expectedUpdatedAt: project.updatedAt,
          });
        } catch {
          // 与 screen-editor.tsx handlePublish 一致：未实现 onError，错误由全局拦截器处理
          // 不调用 loadProject，保持本地 Store/基线不变
        }
      });

      // 关键断言：发布失败时 Store 保持原基线，不误报成功
      expect(store.getState().project?.updatedAt).toBe(BASELINE_UPDATED_AT);
      expect(store.getState().project?.status).toBe('draft');
    });

    it('发布冲突时 Store 不被更新（不误报成功）', async () => {
      const store = useScreenEditorStore;
      store.getState().loadProject(makeProject({ updatedAt: BASELINE_UPDATED_AT }));
      expect(store.getState().isDirty).toBe(false);

      // 模拟发布冲突（SCREEN_SAVE_CONFLICT，任务 9.4 会接入冲突对话框）
      mockedPublishScreenProject.mockRejectedValue(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再发布'),
      );

      const { result } = renderHook(() => usePublishScreenProject(), {
        wrapper: createWrapper(queryClient),
      });

      // 模拟 handlePublish：冲突时不调用 loadProject（screen-editor.tsx 当前未实现 onError）
      await act(async () => {
        const project = store.getState().project;
        if (!project) throw new Error('project should be loaded');
        try {
          await result.current.mutateAsync({
            id: project.id,
            expectedUpdatedAt: project.updatedAt,
          });
        } catch {
          // 与 screen-editor.tsx handlePublish 一致：未实现 onError
          // 冲突时保持本地 Store/基线不变，任务 9.4 会接入冲突对话框
        }
      });

      // 关键断言：发布冲突时 Store 保持原基线，不误报成功
      expect(store.getState().project?.updatedAt).toBe(BASELINE_UPDATED_AT);
      expect(store.getState().project?.status).toBe('draft');
    });
  });
});
