/**
 * 数据集表单草稿状态类型与辅助函数
 *
 * DatasetSchema 是判别联合（按 type 分发），无法直接用于 react-hook-form。
 * 这里用扁平的草稿状态管理表单输入，提交时组装为 CreateDatasetParams/UpdateDatasetParams。
 */

import type {
  CreateDatasetParams,
  Dataset,
  DatasetCacheStrategy,
  DatasetMockConfig,
  DatasetShape,
  DatasetType,
  FieldMapping,
  RefreshStrategy,
  UpdateDatasetParams,
} from '@nebula/shared';

// ===== 草稿状态 =====

export interface DatasetDraft {
  name: string;
  description: string;
  category: string;
  tags: string; // 逗号分隔
  type: DatasetType;
  // static config
  staticData: string; // JSON 字符串
  // api config
  apiConnectionId: string;
  apiPath: string;
  apiMethod: string;
  apiHeaders: string; // JSON 字符串
  apiParams: string; // JSON 字符串
  apiBody: string; // JSON 字符串
  apiContentType: string;
  // sql config
  sqlConnectionId: string;
  sqlSql: string;
  // websocket config
  wsUrl: string;
  wsProtocol: string; // 逗号分隔
  wsMessageFormat: string;
  // shape
  dataPath: string;
  dimension: string;
  value: string;
  filter: string;
  // refresh
  refreshEnabled: boolean;
  refreshInterval: string;
  refreshIntervalUnit: string;
  refreshStopOnHidden: boolean;
  // cache
  cacheEnabled: boolean;
  cacheTtl: string;
  cacheTags: string; // 逗号分隔
  // mock
  mockEnabled: boolean;
  mockGenerator: string;
  mockData: string; // JSON 字符串
  mockTemplate: string;
}

// ===== 默认值 =====

export function createDefaultDraft(): DatasetDraft {
  return {
    name: '',
    description: '',
    category: '',
    tags: '',
    type: 'static',
    staticData: '[\n  { "name": "一月", "value": 30 }\n]',
    apiConnectionId: '',
    apiPath: '',
    apiMethod: 'GET',
    apiHeaders: '{}',
    apiParams: '{}',
    apiBody: '',
    apiContentType: 'json',
    sqlConnectionId: '',
    sqlSql: '',
    wsUrl: '',
    wsProtocol: '',
    wsMessageFormat: 'json',
    dataPath: '',
    dimension: '',
    value: '',
    filter: '',
    refreshEnabled: false,
    refreshInterval: '30',
    refreshIntervalUnit: 'second',
    refreshStopOnHidden: true,
    cacheEnabled: false,
    cacheTtl: '60',
    cacheTags: '',
    mockEnabled: false,
    mockGenerator: 'static',
    mockData: '[\n  { "name": "示例", "value": 100 }\n]',
    mockTemplate: '',
  };
}

// ===== 草稿 → 提交参数 =====

function parseJSON(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return JSON.parse(trimmed);
}

function parseTags(value: string): string[] | undefined {
  const tags = value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function buildShape(draft: DatasetDraft): DatasetShape | undefined {
  const hasShape = draft.dataPath || draft.dimension || draft.value || draft.filter;
  if (!hasShape) return undefined;
  const shape: DatasetShape = {};
  if (draft.dataPath) shape.dataPath = draft.dataPath;
  if (draft.dimension && draft.value) {
    const mapping: FieldMapping = { dimension: draft.dimension, value: draft.value };
    shape.fieldMapping = mapping;
  }
  if (draft.filter) shape.filter = draft.filter;
  return shape;
}

function buildRefresh(draft: DatasetDraft): RefreshStrategy | undefined {
  if (!draft.refreshEnabled) return undefined;
  const interval = Number.parseInt(draft.refreshInterval, 10);
  if (Number.isNaN(interval) || interval < 0) return undefined;
  return {
    interval,
    intervalUnit: draft.refreshIntervalUnit as RefreshStrategy['intervalUnit'],
    stopOnHidden: draft.refreshStopOnHidden,
  };
}

function buildCache(draft: DatasetDraft): DatasetCacheStrategy | undefined {
  if (!draft.cacheEnabled) return undefined;
  const ttl = Number.parseInt(draft.cacheTtl, 10);
  if (Number.isNaN(ttl) || ttl <= 0) return undefined;
  const tags = parseTags(draft.cacheTags);
  return { enabled: true, ttl, ...(tags !== undefined ? { tags } : {}) };
}

function buildMock(draft: DatasetDraft): DatasetMockConfig | undefined {
  if (!draft.mockEnabled) return undefined;
  const base = {
    enabled: true,
    generator: draft.mockGenerator as DatasetMockConfig['generator'],
  };
  if (draft.mockGenerator === 'static') {
    return { ...base, data: parseJSON(draft.mockData) };
  }
  if (draft.mockGenerator === 'faker-template') {
    return { ...base, template: draft.mockTemplate };
  }
  return base;
}

function buildConfig(draft: DatasetDraft): CreateDatasetParams['config'] {
  switch (draft.type) {
    case 'static':
      return { staticData: parseJSON(draft.staticData) ?? [] };
    case 'api':
      return {
        path: draft.apiPath,
        method: draft.apiMethod as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        contentType: draft.apiContentType as 'json' | 'form-data' | 'x-www-form-urlencoded',
        ...(draft.apiConnectionId ? { connectionId: draft.apiConnectionId } : {}),
        ...(draft.apiHeaders.trim() && draft.apiHeaders !== '{}'
          ? { headers: parseJSON(draft.apiHeaders) as Record<string, string> }
          : {}),
        ...(draft.apiParams.trim() && draft.apiParams !== '{}'
          ? { params: parseJSON(draft.apiParams) as Record<string, unknown> }
          : {}),
        ...(draft.apiBody.trim() ? { body: parseJSON(draft.apiBody) } : {}),
      };
    case 'sql':
      return {
        connectionId: draft.sqlConnectionId,
        sql: draft.sqlSql,
      };
    case 'websocket':
      return {
        url: draft.wsUrl,
        messageFormat: draft.wsMessageFormat as 'json' | 'text',
        ...(draft.wsProtocol
          ? {
              protocol: draft.wsProtocol
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean),
            }
          : {}),
      };
  }
}

/** 将草稿组装为 CreateDatasetParams，供 CreateDatasetSchema.parse() 校验 */
export function draftToCreateParams(draft: DatasetDraft): CreateDatasetParams {
  const common = {
    name: draft.name,
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.category ? { category: draft.category } : {}),
    ...(parseTags(draft.tags) ? { tags: parseTags(draft.tags) } : {}),
    ...(buildShape(draft) ? { shape: buildShape(draft) } : {}),
    ...(buildRefresh(draft) ? { refresh: buildRefresh(draft) } : {}),
    ...(buildCache(draft) ? { cache: buildCache(draft) } : {}),
    ...(buildMock(draft) ? { mock: buildMock(draft) } : {}),
  };
  return {
    ...common,
    type: draft.type,
    config: buildConfig(draft),
  } as CreateDatasetParams;
}

/** 将草稿组装为 UpdateDatasetParams */
export function draftToUpdateParams(draft: DatasetDraft): UpdateDatasetParams {
  return draftToCreateParams(draft) as unknown as UpdateDatasetParams;
}

// ===== Dataset → 草稿（编辑时预填） =====

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  return JSON.stringify(value, null, 2);
}

export function datasetToDraft(dataset: Dataset): DatasetDraft {
  const draft = createDefaultDraft();
  draft.name = dataset.name;
  draft.description = dataset.description ?? '';
  draft.category = dataset.category ?? '';
  draft.tags = dataset.tags?.join(', ') ?? '';
  draft.type = dataset.type;

  // config
  if (dataset.type === 'static') {
    draft.staticData = safeStringify(dataset.config.staticData);
  } else if (dataset.type === 'api') {
    draft.apiConnectionId = dataset.config.connectionId ?? '';
    draft.apiPath = dataset.config.path;
    draft.apiMethod = dataset.config.method;
    draft.apiHeaders = safeStringify(dataset.config.headers ?? {});
    draft.apiParams = safeStringify(dataset.config.params ?? {});
    draft.apiBody = safeStringify(dataset.config.body);
    draft.apiContentType = dataset.config.contentType;
  } else if (dataset.type === 'sql') {
    draft.sqlConnectionId = dataset.config.connectionId;
    draft.sqlSql = dataset.config.sql;
  } else if (dataset.type === 'websocket') {
    draft.wsUrl = dataset.config.url;
    draft.wsProtocol = dataset.config.protocol?.join(', ') ?? '';
    draft.wsMessageFormat = dataset.config.messageFormat;
  }

  // shape
  if (dataset.shape) {
    draft.dataPath = dataset.shape.dataPath ?? '';
    draft.dimension = dataset.shape.fieldMapping?.dimension ?? '';
    draft.value = dataset.shape.fieldMapping?.value ?? '';
    draft.filter = dataset.shape.filter ?? '';
  }

  // refresh
  if (dataset.refresh) {
    draft.refreshEnabled = true;
    draft.refreshInterval = String(dataset.refresh.interval);
    draft.refreshIntervalUnit = dataset.refresh.intervalUnit;
    draft.refreshStopOnHidden = dataset.refresh.stopOnHidden;
  }

  // cache
  if (dataset.cache) {
    draft.cacheEnabled = dataset.cache.enabled;
    draft.cacheTtl = String(dataset.cache.ttl);
    draft.cacheTags = dataset.cache.tags?.join(', ') ?? '';
  }

  // mock
  if (dataset.mock) {
    draft.mockEnabled = dataset.mock.enabled;
    draft.mockGenerator = dataset.mock.generator;
    draft.mockData = dataset.mock.data !== undefined ? safeStringify(dataset.mock.data) : '';
    draft.mockTemplate = dataset.mock.template ?? '';
  }

  return draft;
}
