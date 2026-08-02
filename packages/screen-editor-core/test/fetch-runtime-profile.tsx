import { useEffect, useState } from 'react';
import type { ApiDataSourceConfig, ScreenComponent } from '@nebula/shared';
import type {
  ScreenEditorDataRequestState,
  ScreenEditorRequestApiInput,
  ScreenEditorRuntimeProfile,
} from '../src/runtime-profile.js';

let datasetState: ScreenEditorDataRequestState = { status: 'idle' };

export function setTestDatasetState(state: ScreenEditorDataRequestState): void {
  datasetState = state;
}

function buildUrl(config: ApiDataSourceConfig): string {
  const url = new URL(config.url);
  for (const [key, value] of Object.entries(config.params ?? {})) {
    if (value === null || value === undefined) continue;
    const serialized =
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
        ? String(value)
        : (JSON.stringify(value) ?? '');
    url.searchParams.set(key, serialized);
  }
  return url.toString();
}

function headers(config: ApiDataSourceConfig): Record<string, string> | undefined {
  if (config.headers === undefined) return undefined;
  return Object.fromEntries(
    Object.entries(config.headers).filter(([, value]) => value !== '[REDACTED]'),
  );
}

function useTestApiDataSource(
  config: ApiDataSourceConfig | undefined,
): ScreenEditorDataRequestState {
  const [state, setState] = useState<ScreenEditorDataRequestState>({ status: 'idle' });
  useEffect(() => {
    if (config === undefined) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    let disposed = false;
    setState({ status: 'loading' });
    const run = async (): Promise<void> => {
      try {
        const response = await fetch(buildUrl(config), {
          method: 'GET',
          headers: headers(config),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!disposed) {
            setState({
              status: 'error',
              error: {
                reason: 'http',
                message: `请求失败（HTTP ${response.status}）`,
                httpStatus: response.status,
              },
            });
          }
          return;
        }
        let data: unknown;
        try {
          data = (await response.json()) as unknown;
        } catch {
          if (!disposed) {
            setState({
              status: 'error',
              error: { reason: 'parse', message: '响应不是合法 JSON，无法解析' },
            });
          }
          return;
        }
        if (!disposed && !controller.signal.aborted) setState({ status: 'success', data });
      } catch {
        if (!disposed && !controller.signal.aborted) {
          setState({
            status: 'error',
            error: { reason: 'network', message: '网络请求失败（可能是网络异常或跨域限制）' },
          });
        }
      }
    };
    void run();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [config]);
  return state;
}

async function refreshComponentData(
  component: ScreenComponent,
  signal: AbortSignal,
): Promise<unknown> {
  const config = component.dataSource?.type === 'api' ? component.dataSource.apiConfig : undefined;
  if (config === undefined) return undefined;
  const response = await fetch(buildUrl(config), {
    method: 'GET',
    headers: headers(config),
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as unknown;
}

async function requestApi(input: ScreenEditorRequestApiInput) {
  const response = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body,
    signal: input.signal,
  });
  const text = await response.text();
  return { status: response.status, bodyPreview: text.slice(0, 500), ok: response.ok };
}

export const TEST_DYNAMIC_RUNTIME_PROFILE: ScreenEditorRuntimeProfile = {
  blueprintCapabilities: { requestApi: true, refreshDataSource: true },
  capabilityProfile: 'dynamic',
  componentRegistry: {
    componentTypes: ['text', 'bar-chart', 'rect', 'ellipse', 'image', 'button'],
  },
  dataRuntime: {
    previewApi: async (config, signal) => {
      let response: Response;
      try {
        response = await fetch(buildUrl(config), {
          method: 'GET',
          headers: headers(config),
          signal,
        });
      } catch {
        throw new Error('网络请求失败（可能是网络异常或跨域限制）');
      }
      if (!response.ok) return { data: undefined, status: response.status };
      let data: unknown;
      try {
        data = (await response.json()) as unknown;
      } catch {
        throw new Error('响应不是合法 JSON，无法预览');
      }
      return { data, status: response.status };
    },
    refreshComponentData,
    requestApi,
    useApiDataSource: useTestApiDataSource,
    useDatasetSource: () => datasetState,
  },
  notifications: { instanceScoped: true },
  propertySchemas: { supportsDynamicDataSources: true },
};
