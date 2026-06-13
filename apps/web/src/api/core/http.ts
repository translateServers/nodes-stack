import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { z, type ZodType } from 'zod';
import { BizCode, type ApiErrorResponse, type ApiResponse } from '@nebula/shared/types';
import { BusinessError, getBizMessage } from '@nebula/shared/errors';
import { API_BASE_URL, ENDPOINTS } from './endpoints';
import { useAuthStore } from '@/store/auth';

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
};

type PendingRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

type NebulaRequestConfig<TSchema extends ZodType | undefined = ZodType | undefined> =
  InternalAxiosRequestConfig & {
    meta?: {
      responseSchema?: TSchema;
      skipAuthRefresh?: boolean;
    };
    _retry?: boolean;
  };

let isRefreshing = false;
let pendingQueue: PendingRequest[] = [];

function processPendingQueue(error: unknown, token: string | null): void {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error || token === null) {
      reject(error ?? new BusinessError(BizCode.UNAUTHORIZED, getBizMessage(BizCode.UNAUTHORIZED)));
      return;
    }
    resolve(token);
  });
  pendingQueue = [];
}

function parseResponse<TSchema extends ZodType>(data: unknown, schema: TSchema): z.infer<TSchema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BusinessError(
      BizCode.INTERNAL_ERROR,
      '响应数据校验失败',
      result.error.issues.map((issue) => issue.message),
    );
  }

  return result.data;
}

const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function performRefreshToken(refreshToken: string): Promise<TokenResponse> {
  const response = await refreshClient.post<ApiResponse<TokenResponse>>(ENDPOINTS.auth.refresh, {
    refreshToken,
  });

  if (response.data.code !== BizCode.SUCCESS || !response.data.data) {
    throw new BusinessError(response.data.code, response.data.message);
  }

  return response.data.data;
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiResponse<unknown> | undefined;
    if (!payload || typeof payload.code !== 'number') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return response.data;
    }

    if (payload.code !== BizCode.SUCCESS) {
      throw new BusinessError(payload.code, payload.message);
    }

    const responseSchema = (response.config as NebulaRequestConfig).meta?.responseSchema;
    if (!responseSchema) {
      return payload.data;
    }

    return parseResponse(payload.data, responseSchema);
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const { response, config } = error;

    if (!response) {
      throw new BusinessError(-1, error.message || '网络异常');
    }

    const requestConfig = config as NebulaRequestConfig | undefined;
    const errorCode = response.data?.code ?? response.status;
    const errorMessage = response.data?.message ?? error.message ?? getBizMessage(errorCode);
    const errorDetails = response.data?.details;

    if (
      response.status === 401 &&
      requestConfig &&
      !requestConfig._retry &&
      !requestConfig.meta?.skipAuthRefresh
    ) {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().clearAuth();
        throw new BusinessError(errorCode, errorMessage, errorDetails);
      }

      if (isRefreshing) {
        return await new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              requestConfig._retry = true;
              requestConfig.headers.set('Authorization', `Bearer ${token}`);
              resolve(http(requestConfig));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const tokens = await performRefreshToken(refreshToken);
        useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
        processPendingQueue(null, tokens.accessToken);
        requestConfig._retry = true;
        requestConfig.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
        return await http(requestConfig);
      } catch (refreshError) {
        processPendingQueue(refreshError, null);
        useAuthStore.getState().clearAuth();
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }

    throw new BusinessError(errorCode, errorMessage, errorDetails);
  },
);

export async function get<TSchema extends ZodType>(
  url: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const config = {
    meta: { responseSchema: schema },
  } as NebulaRequestConfig<TSchema>;
  return http.get(url, config);
}

export async function post<TSchema extends ZodType, TBody = unknown>(
  url: string,
  body: TBody,
  schema: TSchema,
): Promise<z.infer<TSchema>>;
export async function post<TBody = unknown>(url: string, body?: TBody): Promise<undefined>;
export async function post<TSchema extends ZodType, TBody = unknown>(
  url: string,
  body?: TBody,
  schema?: TSchema,
): Promise<z.infer<TSchema> | undefined> {
  const config = {
    meta: { responseSchema: schema },
  } as NebulaRequestConfig<TSchema>;
  return http.post(url, body, config);
}

export async function patch<TSchema extends ZodType, TBody = unknown>(
  url: string,
  body: TBody,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const config = {
    meta: { responseSchema: schema },
  } as NebulaRequestConfig<TSchema>;
  return http.patch(url, body, config);
}

export async function del<TSchema extends ZodType>(
  url: string,
  schema: TSchema,
): Promise<z.infer<TSchema>>;
export async function del(url: string): Promise<undefined>;
export async function del<TSchema extends ZodType>(
  url: string,
  schema?: TSchema,
): Promise<z.infer<TSchema> | undefined> {
  const config = {
    meta: { responseSchema: schema },
  } as NebulaRequestConfig<TSchema>;
  return http.delete(url, config);
}

export { BusinessError };
export default http;
