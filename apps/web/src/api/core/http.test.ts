import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BizCode, BusinessError, getBizMessage } from '@nebula/shared';
import { z } from 'zod';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

// ── hoisted mocks ─────────────────────────────────────────
// axios.create 在 http.ts 顶层被调用两次（http 与 refreshClient），
// 每次返回一个 callable mock 实例，捕获拦截器 handler。
const mocks = vi.hoisted(() => {
  type MockInstance = {
    (config: unknown): Promise<unknown>;
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    interceptors: {
      request: { use: ReturnType<typeof vi.fn> };
      response: { use: ReturnType<typeof vi.fn> };
    };
  };

  const createdInstances: MockInstance[] = [];

  const createInstance = (): MockInstance => {
    const instance = vi.fn() as unknown as MockInstance;
    instance.get = vi.fn();
    instance.post = vi.fn();
    instance.patch = vi.fn();
    instance.delete = vi.fn();
    instance.interceptors = {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    };
    createdInstances.push(instance);
    return instance;
  };

  return {
    createdInstances,
    axiosMock: { create: vi.fn(createInstance) },
    useAuthStoreMock: {
      getState: vi.fn(() => ({
        accessToken: null as string | null,
        refreshToken: null as string | null,
        setTokens: vi.fn(),
        clearAuth: vi.fn(),
      })),
    },
    emitApiErrorMock: vi.fn(),
  };
});

vi.mock('axios', () => ({ default: mocks.axiosMock }));
vi.mock('@/store/auth', () => ({ useAuthStore: mocks.useAuthStoreMock }));
// 注意：http.ts 从 './api-error' 仅导入 emitApiError（BusinessError 等来自 @nebula/shared）。
// 因此 mock 工厂只需提供 emitApiError，不应引用未 hoist 的顶层 import 绑定（如 BusinessError），
// 否则 vitest 会将其视为 undefined 并导致 instanceof 校验失败。
vi.mock('./api-error', () => ({
  emitApiError: mocks.emitApiErrorMock,
}));

// 副作用导入：在 vi.mock（已被 hoist 到顶部）生效后加载 http.ts，
// 触发 axios.create() 两次调用以填充 createdInstances。
// 不使用 vi.resetModules() + 动态 import，否则会重新加载 @nebula/shared 产生新的
// BusinessError 类，导致 instanceof 校验与测试文件静态导入的 BusinessError 不一致。
import './http';

// ── helpers ───────────────────────────────────────────────
function makeHeaders(): { set: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> } {
  const store: Record<string, string> = {};
  return {
    set: vi.fn((name: string, value: string) => {
      store[name] = value;
    }),
    get: vi.fn((name: string) => store[name] ?? null),
  };
}

function makeConfig(extra: Record<string, unknown> = {}): InternalAxiosRequestConfig {
  return {
    headers: makeHeaders(),
    ...extra,
  } as unknown as InternalAxiosRequestConfig;
}

interface MockResponse {
  data: unknown;
  config: { meta?: Record<string, unknown>; [k: string]: unknown };
}

function makeResponse(data: unknown, configExtra: Record<string, unknown> = {}): MockResponse {
  return {
    data,
    config: {
      meta: {},
      ...configExtra,
    },
  };
}

// ── 在模块加载时捕获 axios 实例与拦截器（vi.mock 已 hoist，import './http' 已执行）──────
expect(mocks.createdInstances.length).toBeGreaterThanOrEqual(2);
const httpInstance = mocks.createdInstances[0];
const refreshInstance = mocks.createdInstances[1];

const requestInterceptor = httpInstance.interceptors.request.use.mock.calls[0][0] as (
  config: InternalAxiosRequestConfig,
) => InternalAxiosRequestConfig;
const responseSuccess = httpInstance.interceptors.response.use.mock.calls[0][0] as (
  response: MockResponse,
) => unknown;
const responseError = httpInstance.interceptors.response.use.mock.calls[0][1] as (
  error: AxiosError,
) => unknown;

// ── 测试套件 ──────────────────────────────────────────────
describe('api/core/http', () => {
  beforeEach(() => {
    // 仅清理调用记录与实现，不重置模块；拦截器函数引用在模块加载时已捕获，
    // 清理 interceptors.request.use.mock.calls 不会影响已捕获的函数引用。
    vi.clearAllMocks();
    mocks.useAuthStoreMock.getState.mockReturnValue({
      accessToken: null,
      refreshToken: null,
      setTokens: vi.fn(),
      clearAuth: vi.fn(),
    });
  });

  describe('请求拦截器', () => {
    it('有 accessToken 时注入 Authorization: Bearer {token}', () => {
      mocks.useAuthStoreMock.getState.mockReturnValueOnce({
        accessToken: 'token-123',
        refreshToken: null,
        setTokens: vi.fn(),
        clearAuth: vi.fn(),
      });

      const config = makeConfig();
      const result = requestInterceptor(config);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(result.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer token-123');
    });

    it('无 accessToken 时不设置 Authorization', () => {
      mocks.useAuthStoreMock.getState.mockReturnValueOnce({
        accessToken: null,
        refreshToken: null,
        setTokens: vi.fn(),
        clearAuth: vi.fn(),
      });

      const config = makeConfig();
      const result = requestInterceptor(config);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(result.headers.set).not.toHaveBeenCalledWith('Authorization', expect.anything());
    });
  });

  describe('响应拦截器-成功', () => {
    it('非标准 payload（无 code 字段）→ 直接返回 response.data', () => {
      const response = makeResponse({ foo: 'bar' });
      const result = responseSuccess(response);
      expect(result).toEqual({ foo: 'bar' });
    });

    it('payload.code !== SUCCESS → 调用 emitApiError 并抛出 BusinessError', () => {
      const response = makeResponse({ code: BizCode.NOT_FOUND, message: '不存在' });
      expect(() => responseSuccess(response)).toThrow(BusinessError);
      expect(mocks.emitApiErrorMock).toHaveBeenCalled();
    });

    it('payload.code === SUCCESS 且无 responseSchema → 返回 payload.data', () => {
      const response = makeResponse({
        code: BizCode.SUCCESS,
        data: { id: 1 },
        message: 'ok',
      });
      const result = responseSuccess(response);
      expect(result).toEqual({ id: 1 });
    });

    it('payload.code === SUCCESS 且有 responseSchema → 用 schema 校验后返回', () => {
      const schema = z.object({ id: z.number() });
      const response = makeResponse(
        { code: BizCode.SUCCESS, data: { id: 1 }, message: 'ok' },
        { meta: { responseSchema: schema } },
      );
      const result = responseSuccess(response);
      expect(result).toEqual({ id: 1 });
    });

    it('responseSchema 校验失败 → 抛出 INTERNAL_ERROR BusinessError', () => {
      const schema = z.object({ id: z.number() });
      const response = makeResponse(
        { code: BizCode.SUCCESS, data: { id: 'not-number' }, message: 'ok' },
        { meta: { responseSchema: schema } },
      );
      try {
        responseSuccess(response);
        expect.unreachable('应抛出 BusinessError');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessError);
        expect((err as BusinessError).code).toBe(BizCode.INTERNAL_ERROR);
      }
    });
  });

  describe('响应拦截器-失败', () => {
    it('无 response（网络错误）→ throwApiError(-1, message)', async () => {
      const error = {
        message: 'Network Error',
        config: {},
      } as unknown as AxiosError;

      await expect(responseError(error)).rejects.toThrow(BusinessError);
      expect(mocks.emitApiErrorMock).toHaveBeenCalled();
    });

    it('401 + _retry=true → 不刷新，直接 throwApiError', async () => {
      const error = {
        response: {
          status: 401,
          data: { code: BizCode.UNAUTHORIZED, message: '未授权' },
        },
        config: { _retry: true, headers: makeHeaders(), meta: {} },
      } as unknown as AxiosError;

      await expect(responseError(error)).rejects.toThrow(BusinessError);
      expect(refreshInstance.post).not.toHaveBeenCalled();
    });

    it('401 + skipAuthRefresh=true → 不刷新，直接 throwApiError', async () => {
      const error = {
        response: {
          status: 401,
          data: { code: BizCode.UNAUTHORIZED, message: '未授权' },
        },
        config: { headers: makeHeaders(), meta: { skipAuthRefresh: true } },
      } as unknown as AxiosError;

      await expect(responseError(error)).rejects.toThrow(BusinessError);
      expect(refreshInstance.post).not.toHaveBeenCalled();
    });

    it('401 + 无 refreshToken → clearAuth + throwApiError', async () => {
      const clearAuth = vi.fn();
      mocks.useAuthStoreMock.getState.mockReturnValue({
        accessToken: 'expired',
        refreshToken: null,
        setTokens: vi.fn(),
        clearAuth,
      });

      const error = {
        response: {
          status: 401,
          data: { code: BizCode.UNAUTHORIZED, message: '未授权' },
        },
        config: { headers: makeHeaders(), meta: {} },
      } as unknown as AxiosError;

      await expect(responseError(error)).rejects.toThrow(BusinessError);
      expect(clearAuth).toHaveBeenCalled();
      expect(refreshInstance.post).not.toHaveBeenCalled();
      expect(mocks.emitApiErrorMock).toHaveBeenCalled();
    });

    it('401 + 有 refreshToken + refresh 成功 → setTokens + 重发请求', async () => {
      const setTokens = vi.fn();
      const clearAuth = vi.fn();
      mocks.useAuthStoreMock.getState.mockReturnValue({
        accessToken: 'expired-access',
        refreshToken: 'valid-refresh',
        setTokens,
        clearAuth,
      });

      refreshInstance.post.mockResolvedValue({
        data: {
          code: BizCode.SUCCESS,
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
          message: 'ok',
        },
      });
      (httpInstance as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'retried' });

      const error = {
        response: {
          status: 401,
          data: { code: BizCode.UNAUTHORIZED, message: '未授权' },
        },
        config: { headers: makeHeaders(), meta: {} },
      } as unknown as AxiosError;

      const result = await responseError(error);

      expect(refreshInstance.post).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'valid-refresh',
      });
      expect(setTokens).toHaveBeenCalledWith('new-access', 'new-refresh');
      expect(httpInstance).toHaveBeenCalled();
      expect(clearAuth).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'retried' });
    });

    it('401 + 有 refreshToken + refresh 返回非 SUCCESS → clearAuth + emitApiError + throw', async () => {
      const clearAuth = vi.fn();
      mocks.useAuthStoreMock.getState.mockReturnValue({
        accessToken: 'expired-access',
        refreshToken: 'valid-refresh',
        setTokens: vi.fn(),
        clearAuth,
      });

      refreshInstance.post.mockResolvedValue({
        data: {
          code: BizCode.AUTH_INVALID_REFRESH_TOKEN,
          message: '刷新令牌无效',
        },
      });

      const error = {
        response: {
          status: 401,
          data: { code: BizCode.UNAUTHORIZED, message: '未授权' },
        },
        config: { headers: makeHeaders(), meta: {} },
      } as unknown as AxiosError;

      await expect(responseError(error)).rejects.toThrow();
      expect(clearAuth).toHaveBeenCalled();
      expect(mocks.emitApiErrorMock).toHaveBeenCalled();
    });

    it('401 + 有 refreshToken + refresh 网络失败 → clearAuth + emitApiError + throw', async () => {
      const clearAuth = vi.fn();
      mocks.useAuthStoreMock.getState.mockReturnValue({
        accessToken: 'expired-access',
        refreshToken: 'valid-refresh',
        setTokens: vi.fn(),
        clearAuth,
      });

      refreshInstance.post.mockRejectedValue(new Error('refresh network error'));

      const error = {
        response: {
          status: 401,
          data: { code: BizCode.UNAUTHORIZED, message: '未授权' },
        },
        config: { headers: makeHeaders(), meta: {} },
      } as unknown as AxiosError;

      await expect(responseError(error)).rejects.toThrow();
      expect(clearAuth).toHaveBeenCalled();
      expect(mocks.emitApiErrorMock).toHaveBeenCalled();
    });

    it('其他状态码（如 500）→ throwApiError', async () => {
      const error = {
        response: {
          status: 500,
          data: { code: BizCode.INTERNAL_ERROR, message: '服务器错误' },
        },
        config: { headers: makeHeaders(), meta: {} },
      } as unknown as AxiosError;

      await expect(responseError(error)).rejects.toThrow(BusinessError);
      expect(refreshInstance.post).not.toHaveBeenCalled();
      expect(mocks.emitApiErrorMock).toHaveBeenCalled();
    });

    it('error.response.data 缺失 code 时回退到 response.status', async () => {
      const error = {
        response: { status: 502, data: undefined },
        config: { headers: makeHeaders(), meta: {} },
        message: 'Bad Gateway',
      } as unknown as AxiosError;

      await expect(responseError(error)).rejects.toThrow(BusinessError);
      expect(mocks.emitApiErrorMock).toHaveBeenCalled();
    });
  });

  describe('getBizMessage 兜底', () => {
    it('response.data.message 与 error.message 均缺失时使用 getBizMessage', async () => {
      const error = {
        response: {
          status: 500,
          data: { code: BizCode.INTERNAL_ERROR },
        },
        config: { headers: makeHeaders(), meta: {} },
        // 故意不设置 message，触发 getBizMessage(errorCode) 兜底
      } as unknown as AxiosError;

      try {
        await responseError(error);
        expect.unreachable('应抛出异常');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessError);
        // getBizMessage(INTERNAL_ERROR) 返回 '服务器内部错误'
        expect((err as BusinessError).message).toBe(getBizMessage(BizCode.INTERNAL_ERROR));
      }
    });
  });
});
