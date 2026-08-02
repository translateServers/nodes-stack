import type { ApiDataSourceConfig, ScreenComponent } from '@nebula/shared';
import {
  DYNAMIC_SCREEN_EDITOR_RUNTIME_FALLBACK,
  type ScreenEditorApiPreviewResult,
  type ScreenEditorRequestApiInput,
  type ScreenEditorRequestApiResult,
  type ScreenEditorRuntimeProfile,
} from '@nebula/screen-editor-core';
import { DatasetConfigForm } from '../components/dataset-config-section';
import {
  API_REQUEST_TIMEOUT_MS,
  buildUrlWithParams,
  useApiDataSource,
} from '../hooks/use-api-data-source';
import { useDatasetSource } from '../hooks/use-dataset-source';

function filterHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (headers === undefined) return undefined;
  const filtered = Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== '[REDACTED]'),
  );
  return Object.keys(filtered).length === 0 ? undefined : filtered;
}

async function previewApi(
  config: ApiDataSourceConfig,
  signal: AbortSignal,
): Promise<ScreenEditorApiPreviewResult> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(API_REQUEST_TIMEOUT_MS)]);
  let response: Response;
  try {
    response = await fetch(buildUrlWithParams(config.url, config.params), {
      method: 'GET',
      headers: filterHeaders(config.headers),
      signal: requestSignal,
    });
  } catch {
    if (requestSignal.aborted && !signal.aborted) {
      throw new Error('请求超时，请检查网络或接口可用性');
    }
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
}

async function refreshComponentData(
  component: ScreenComponent,
  signal: AbortSignal,
): Promise<unknown> {
  const dataSource = component.dataSource;
  if (dataSource?.type !== 'api') return undefined;
  const response = await fetch(
    buildUrlWithParams(dataSource.apiConfig.url, dataSource.apiConfig.params),
    {
      method: 'GET',
      headers: filterHeaders(dataSource.apiConfig.headers),
      signal,
    },
  );
  if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`);
  return (await response.json()) as unknown;
}

async function requestApi(
  input: ScreenEditorRequestApiInput,
): Promise<ScreenEditorRequestApiResult> {
  const response = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body,
    signal: input.signal,
  });
  const text = await response.text();
  return {
    status: response.status,
    bodyPreview: text.slice(0, 500),
    ok: response.ok,
  };
}

export const DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE: ScreenEditorRuntimeProfile = {
  ...DYNAMIC_SCREEN_EDITOR_RUNTIME_FALLBACK,
  dataRuntime: {
    DatasetConfigForm,
    previewApi,
    refreshComponentData,
    requestApi,
    useApiDataSource,
    useDatasetSource,
  },
};
