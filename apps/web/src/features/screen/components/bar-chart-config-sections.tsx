/**
 * bar-chart 四层配置分组（阶段 2 任务 4.1-4.5、5.2）
 *
 * 按"数据、逻辑、视觉、交互"四层组织 bar-chart 的属性面板配置：
 * - 数据层（datasource-section）：数据源类型切换（静态/API）；静态数据编辑
 *   （共享 Schema + 结构校验，替代原 props.data 裸 JSON textarea）与字段映射下拉（4.2/4.3）；
 *   API 配置表单（5.2：URL、查询参数、请求头、刷新间隔，共享 Schema 校验）；
 *   首次提交遗留组件时经 buildDataSourceMigration 一次性迁移 props.data
 * - 逻辑层（logic-section）：排序字段、排序方向、条数限制（4.4）
 * - 视觉层（visual-section）：标题与既有样式编辑（行为不回退）
 * - 交互层（interaction-section）：悬停提示开关（4.5）
 *
 * 分层约束：每层修改只写目标层字段；取消、无变化、失败不产生空历史。
 * testid / 可访问名称遵循 baseline.md §0.3 的 E2E 定位契约。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type ApiDataSourceConfig,
  DataSourceConfigSchema,
  type DataSourceConfig,
  type FieldMapping,
  type InteractionConfig,
  type LogicConfig,
  type ScreenComponent,
} from '@nebula/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { buildDataSourceMigration } from '../lib/data-source-migration';
import { extractDataByPath } from '../lib/chart-data-parser';
import { buildUrlWithParams, API_REQUEST_TIMEOUT_MS } from '../hooks/use-api-data-source';
import { StyleFields, TextInput, textareaClass } from './panel-fields';
import { PanelSection } from './ui-primitives';

interface SectionProps {
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}

// ===== 数据层：生效数据读取 =====

/**
 * 数据层静态数据读取：已配置数据层时取 staticData（不论当前数据源类型，
 * 切换类型时静态数据保留在配置中不丢失，编辑静态表单时据此预填）；
 * 未配置数据层时回退遗留 props.data。
 */
function getEffectiveStaticData(component: ScreenComponent): unknown {
  if (component.dataSource !== undefined) {
    return component.dataSource.staticData;
  }
  if ('data' in component.props) {
    return component.props.data;
  }
  return undefined;
}

function serializeData(data: unknown): string {
  if (data === undefined) return '';
  return JSON.stringify(data, null, 2);
}

/**
 * 静态数据结构校验（共享 Schema 之外的结构约束）：
 * 必须是数组，且每个条目都是 plain object。
 */
function validateStaticDataStructure(data: unknown): string | null {
  if (!Array.isArray(data)) {
    return '数据结构错误：静态数据需要是对象数组，如 [{"name":"一月","value":30}]';
  }
  for (let i = 0; i < data.length; i++) {
    const item: unknown = data[i];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return `数据结构错误：第 ${i + 1} 条数据必须是对象`;
    }
  }
  return null;
}

// ===== 数据层：字段推断（任务 4.3） =====

/** 从静态数据样本推断的可选字段集合（区分字符串/数值类型） */
export interface InferredFields {
  stringFields: string[];
  numberFields: string[];
}

/**
 * 基于静态数据样本（经可选数据路径提取后的数组）推断可选字段。
 * 取所有对象条目的键集合，按出现过的值类型分类：字符串字段可作维度，数值字段可作数值。
 */
export function inferFieldsFromSample(rawData: unknown, dataPath?: string): InferredFields {
  const stringFields = new Set<string>();
  const numberFields = new Set<string>();

  const extracted = extractDataByPath(rawData, dataPath);
  if (extracted.ok && Array.isArray(extracted.value)) {
    for (const item of extracted.value as readonly unknown[]) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'string') stringFields.add(key);
        if (typeof value === 'number') numberFields.add(key);
      }
    }
  }

  return { stringFields: [...stringFields], numberFields: [...numberFields] };
}

/** 未配置字段映射时的默认推断（与解析器默认规则 name→维度、value→数值一致） */
function inferDefaultDimensionField(fields: InferredFields): string {
  if (fields.stringFields.includes('name')) return 'name';
  return fields.stringFields[0] ?? 'name';
}

function inferDefaultValueField(fields: InferredFields): string {
  if (fields.numberFields.includes('value')) return 'value';
  return fields.numberFields[0] ?? 'value';
}

// ===== 数据层：键值对编辑（任务 5.2 查询参数 / 请求头） =====

interface KeyValueRow {
  id: string;
  key: string;
  value: string;
}

let kvRowSeq = 0;
function createKvRow(key = '', value = ''): KeyValueRow {
  kvRowSeq += 1;
  return { id: `kv-${kvRowSeq}`, key, value };
}

/** API 查询参数（unknown 值）转编辑行：非字符串值 JSON 序列化展示 */
function paramsToRows(record: Record<string, unknown> | undefined): KeyValueRow[] {
  if (record === undefined) return [];
  return Object.entries(record).map(([key, value]) =>
    createKvRow(key, typeof value === 'string' ? value : JSON.stringify(value)),
  );
}

function recordToRows(record: Record<string, string> | undefined): KeyValueRow[] {
  if (record === undefined) return [];
  return Object.entries(record).map(([key, value]) => createKvRow(key, value));
}

/** 编辑行转 record：忽略空键行；全部为空时返回 undefined（不写入空对象） */
function rowsToRecord(rows: readonly KeyValueRow[]): Record<string, string> | undefined {
  const record: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key === '') continue;
    record[key] = row.value;
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

function KeyValueEditor({
  testId,
  rows,
  onChange,
  addLabel,
  keyLabel,
  valueLabel,
}: {
  testId: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  addLabel: string;
  keyLabel: string;
  valueLabel: string;
}) {
  const updateRow = (id: string, patch: Partial<Pick<KeyValueRow, 'key' | 'value'>>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <div data-testid={testId} className="space-y-1">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-1">
          <Input
            aria-label={keyLabel}
            className="h-7 px-2 py-1 text-sm"
            placeholder="键"
            value={row.key}
            onChange={(e) => updateRow(row.id, { key: e.target.value })}
          />
          <Input
            aria-label={valueLabel}
            className="h-7 px-2 py-1 text-sm"
            placeholder="值"
            value={row.value}
            onChange={(e) => updateRow(row.id, { value: e.target.value })}
          />
          <Button
            variant="ghost"
            size="sm"
            aria-label={`删除${addLabel.replace('添加', '')}行`}
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
          >
            ×
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange([...rows, createKvRow()])}>
        {addLabel}
      </Button>
    </div>
  );
}

// ===== 数据层分组 =====

/** Radix Select 不接受空字符串值，用哨兵值表示"默认推断" */
const DEFAULT_MAPPING_OPTION = '__default__';

function FieldMappingControls({
  component,
  onUpdate,
  apiSample,
}: SectionProps & { apiSample?: unknown }) {
  const isApiType = component.dataSource?.type === 'api';
  const effectiveData = isApiType ? (apiSample ?? null) : getEffectiveStaticData(component);
  const dataPath = component.dataSource?.dataPath;
  const fields = useMemo(
    () => inferFieldsFromSample(effectiveData, dataPath),
    [effectiveData, dataPath],
  );
  const mapping = component.dataSource?.fieldMapping;

  const commitMapping = (nextMapping: FieldMapping | undefined) => {
    const base: DataSourceConfig = component.dataSource ?? {
      type: 'static',
      staticData: effectiveData,
    };
    const next: DataSourceConfig = { ...base, fieldMapping: nextMapping };
    // 字段映射只写数据层（含一次性迁移），不动逻辑/视觉/交互层
    onUpdate(buildDataSourceMigration(component, next));
  };

  const handleDimensionChange = (value: string) => {
    if (value === DEFAULT_MAPPING_OPTION) {
      if (mapping === undefined) return;
      commitMapping(undefined);
      return;
    }
    if (mapping?.dimension === value) return;
    commitMapping({ dimension: value, value: mapping?.value ?? inferDefaultValueField(fields) });
  };

  const handleValueChange = (value: string) => {
    if (value === DEFAULT_MAPPING_OPTION) {
      if (mapping === undefined) return;
      commitMapping(undefined);
      return;
    }
    if (mapping?.value === value) return;
    commitMapping({ dimension: mapping?.dimension ?? inferDefaultDimensionField(fields), value });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs text-muted-foreground">维度</span>
        <Select
          value={mapping?.dimension ?? DEFAULT_MAPPING_OPTION}
          onValueChange={handleDimensionChange}
        >
          <SelectTrigger size="sm" className="h-7 w-full text-sm" aria-label="维度字段">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_MAPPING_OPTION}>默认推断</SelectItem>
            {fields.stringFields.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs text-muted-foreground">数值</span>
        <Select value={mapping?.value ?? DEFAULT_MAPPING_OPTION} onValueChange={handleValueChange}>
          <SelectTrigger size="sm" className="h-7 w-full text-sm" aria-label="数值字段">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_MAPPING_OPTION}>默认推断</SelectItem>
            {fields.numberFields.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {mapping === undefined && (
        <p className="text-xs text-muted-foreground">
          未配置字段映射，按默认规则推断：name → 维度、value → 数值
        </p>
      )}
    </div>
  );
}

interface DataSourceFormProps extends SectionProps {
  /** 提交成功或取消后回调（用于落定数据源类型切换草稿） */
  onSettled: () => void;
}

function StaticDataForm({ component, onUpdate, onSettled }: DataSourceFormProps) {
  const effectiveData = getEffectiveStaticData(component);
  const [draft, setDraft] = useState<string>(() => serializeData(effectiveData));
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // 未编辑时外部数据变化（如撤销）同步刷新草稿；切换组件时由父级 key 重建本组件
  useEffect(() => {
    if (!dirty) {
      setDraft(serializeData(effectiveData));
    }
  }, [effectiveData, dirty]);

  const handleApply = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setError('JSON 格式错误，请检查输入');
      return;
    }

    const structureError = validateStaticDataStructure(parsed);
    if (structureError !== null) {
      setError(structureError);
      return;
    }

    const nextDataSource: DataSourceConfig = {
      ...(component.dataSource ?? {}),
      type: 'static',
      staticData: parsed,
    };
    const schemaResult = DataSourceConfigSchema.safeParse(nextDataSource);
    if (!schemaResult.success) {
      setError(schemaResult.error.issues[0]?.message ?? '数据源配置不合法');
      return;
    }

    setError(null);
    setDirty(false);
    // 无实际变化不写入（不产生空历史）；类型切换（api → static）视为变化需写入
    const typeUnchanged =
      component.dataSource === undefined || component.dataSource.type === 'static';
    if (typeUnchanged && serializeData(effectiveData) === serializeData(parsed)) {
      onSettled();
      return;
    }
    // 首次提交遗留组件时一次性迁移 props.data（合并为一次更新 = 一条历史）
    onUpdate(buildDataSourceMigration(component, schemaResult.data));
    onSettled();
  };

  const handleCancel = () => {
    setDraft(serializeData(effectiveData));
    setError(null);
    setDirty(false);
    onSettled();
  };

  return (
    <div className="space-y-1">
      <textarea
        data-testid="static-data-editor"
        aria-label="静态数据"
        className={`${textareaClass} font-mono text-xs`}
        rows={6}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
      />
      {error !== null && (
        <p role="alert" data-testid="datasource-error" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          取消
        </Button>
        <Button size="sm" onClick={handleApply}>
          应用
        </Button>
      </div>
    </div>
  );
}

// ===== 数据层：请求测试与响应预览（任务 5.3） =====

/** 响应预览最大展示字符数 */
const RESPONSE_PREVIEW_MAX_LENGTH = 500;

type TestRequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; httpStatus: number; preview: string }
  | { status: 'error'; message: string };

function truncatePreview(data: unknown): string {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  if (text.length <= RESPONSE_PREVIEW_MAX_LENGTH) return text;
  return `${text.slice(0, RESPONSE_PREVIEW_MAX_LENGTH)}…`;
}

/**
 * 请求测试面板：使用当前草稿值发起一次性 GET 请求，展示响应状态码与截断预览。
 * 不写入组件配置、不产生本地编辑历史。
 */
function RequestTestPanel({
  getUrl,
  getParams,
  getHeaders,
  onSampleReceived,
}: {
  getUrl: () => string;
  getParams: () => Record<string, string> | undefined;
  getHeaders: () => Record<string, string> | undefined;
  onSampleReceived?: (data: unknown) => void;
}) {
  const [state, setState] = useState<TestRequestState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const handleTest = () => {
    const url = getUrl();
    if (url === '') {
      setState({ status: 'error', message: '请先填写请求地址' });
      return;
    }

    let fullUrl: string;
    try {
      fullUrl = buildUrlWithParams(url, getParams());
    } catch {
      setState({ status: 'error', message: '请求地址格式不正确' });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    let timedOut = false;

    setState({ status: 'loading' });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, API_REQUEST_TIMEOUT_MS);

    const run = async (): Promise<void> => {
      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: getHeaders(),
          signal: controller.signal,
        });

        if (!response.ok) {
          if (requestId === requestIdRef.current) {
            setState({
              status: 'error',
              message: `请求失败（HTTP ${response.status}）`,
            });
          }
          return;
        }

        let data: unknown;
        try {
          data = (await response.json()) as unknown;
        } catch {
          if (requestId === requestIdRef.current) {
            setState({ status: 'error', message: '响应不是合法 JSON，无法预览' });
          }
          return;
        }

        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setState({
            status: 'success',
            httpStatus: response.status,
            preview: truncatePreview(data),
          });
          onSampleReceived?.(data);
        }
      } catch {
        if (requestId !== requestIdRef.current) return;
        if (controller.signal.aborted) {
          if (timedOut) {
            setState({ status: 'error', message: '请求超时，请检查网络或接口可用性' });
          }
          return;
        }
        setState({ status: 'error', message: '网络请求失败（可能是网络异常或跨域限制）' });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    void run();
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className="space-y-1" data-testid="request-test-panel">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={state.status === 'loading'}
        aria-label="测试请求"
      >
        {state.status === 'loading' ? '请求中…' : '测试请求'}
      </Button>
      {state.status === 'success' && (
        <div data-testid="request-test-result" className="space-y-1">
          <p className="text-xs text-green-500">状态码：{state.httpStatus}</p>
          <pre
            data-testid="request-test-preview"
            className="max-h-32 overflow-auto rounded border border-border bg-muted/50 p-2 text-xs"
          >
            {state.preview}
          </pre>
        </div>
      )}
      {state.status === 'error' && (
        <p role="alert" data-testid="request-test-error" className="text-xs text-red-400">
          {state.message}
        </p>
      )}
    </div>
  );
}

// ===== 数据层：API 配置表单（任务 5.2） =====

/** 规范化 API 配置用于变更检测：固定键顺序、忽略空集合 */
function normalizeApiConfig(config: ApiDataSourceConfig): ApiDataSourceConfig {
  const normalized: ApiDataSourceConfig = { url: config.url, method: config.method };
  if (config.headers !== undefined && Object.keys(config.headers).length > 0) {
    normalized.headers = config.headers;
  }
  if (config.params !== undefined && Object.keys(config.params).length > 0) {
    normalized.params = config.params;
  }
  if (config.refreshInterval !== undefined) {
    normalized.refreshInterval = config.refreshInterval;
  }
  return normalized;
}

function serializeApiConfig(config: ApiDataSourceConfig | undefined): string {
  return config === undefined ? '' : JSON.stringify(normalizeApiConfig(config));
}

function ApiConfigForm({
  component,
  onUpdate,
  onSettled,
  onSampleReceived,
}: DataSourceFormProps & { onSampleReceived?: (data: unknown) => void }) {
  // 外部配置变化（撤销 / 切换组件）由父级 key 重建本组件，草稿从当前配置重新初始化
  const existingApiConfig = component.dataSource?.apiConfig;

  const [urlDraft, setUrlDraft] = useState(() => existingApiConfig?.url ?? '');
  const [paramRows, setParamRows] = useState<KeyValueRow[]>(() =>
    paramsToRows(existingApiConfig?.params),
  );
  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>(() =>
    recordToRows(existingApiConfig?.headers),
  );
  const [intervalDraft, setIntervalDraft] = useState(() =>
    existingApiConfig?.refreshInterval === undefined
      ? ''
      : String(existingApiConfig.refreshInterval),
  );
  const [dataPathDraft, setDataPathDraft] = useState(() => component.dataSource?.dataPath ?? '');
  const [error, setError] = useState<string | null>(null);
  // 初始草稿快照：供取消恢复与无变化检测（表单语义：草稿相对挂载时未编辑即无变化，
  // 与既有配置中参数值原始类型无关——非字符串值经编辑行往返不改变 URL 拼接结果）
  const initialDraftRef = useRef({
    url: urlDraft,
    params: paramRows,
    headers: headerRows,
    interval: intervalDraft,
    dataPath: dataPathDraft,
  });
  const initialSnapshotRef = useRef(
    JSON.stringify({
      url: urlDraft.trim(),
      headers: rowsToRecord(headerRows) ?? null,
      params: rowsToRecord(paramRows) ?? null,
      interval: intervalDraft.trim(),
      dataPath: dataPathDraft.trim(),
    }),
  );

  const handleApply = () => {
    const url = urlDraft.trim();
    if (url === '') {
      setError('请求地址不能为空');
      return;
    }

    let refreshInterval: number | undefined;
    const intervalInput = intervalDraft.trim();
    if (intervalInput !== '') {
      const parsed = Number(intervalInput);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError('刷新间隔需要是不小于 0 的整数（秒），留空表示不自动刷新');
        return;
      }
      refreshInterval = parsed;
    }

    const headers = rowsToRecord(headerRows);
    const params = rowsToRecord(paramRows);
    const apiConfig: ApiDataSourceConfig = {
      url,
      // 阶段 2 仅支持 GET（5.1 请求能力契约），不暴露方法选择
      method: 'GET',
      ...(headers !== undefined ? { headers } : {}),
      ...(params !== undefined ? { params } : {}),
      ...(refreshInterval !== undefined ? { refreshInterval } : {}),
    };

    // 遗留组件（无数据层配置）首次提交时，遗留 props.data 保留为数据层静态数据，
    // 切换到 API 类型不丢失原数据（切回静态时仍可生效）
    const baseDataSource: DataSourceConfig =
      component.dataSource ??
      ('data' in component.props
        ? { type: 'static', staticData: component.props.data }
        : { type: 'static', staticData: [] });
    const dataPath = dataPathDraft.trim() || undefined;
    const nextDataSource: DataSourceConfig = {
      ...baseDataSource,
      type: 'api',
      apiConfig,
      dataPath,
    };

    const schemaResult = DataSourceConfigSchema.safeParse(nextDataSource);
    if (!schemaResult.success) {
      const urlIssue = schemaResult.error.issues.find(
        (issue) => issue.path.join('.') === 'apiConfig.url',
      );
      setError(
        urlIssue !== undefined
          ? '请求地址格式不正确，请输入合法 URL（如 https://example.com/api/chart）'
          : (schemaResult.error.issues[0]?.message ?? '数据源配置不合法'),
      );
      return;
    }

    setError(null);
    // 无实际变化不写入（不产生空历史）：类型未切换且草稿相对挂载时未编辑
    const unchanged =
      component.dataSource?.type === 'api' &&
      JSON.stringify({
        url,
        headers: headers ?? null,
        params: params ?? null,
        interval: intervalInput,
        dataPath: dataPath ?? '',
      }) === initialSnapshotRef.current;
    if (!unchanged) {
      // 首次提交遗留组件时一次性迁移 props.data（合并为一次更新 = 一条历史）
      onUpdate(buildDataSourceMigration(component, schemaResult.data));
    }
    onSettled();
  };

  const handleCancel = () => {
    setUrlDraft(initialDraftRef.current.url);
    setParamRows(initialDraftRef.current.params);
    setHeaderRows(initialDraftRef.current.headers);
    setIntervalDraft(initialDraftRef.current.interval);
    setDataPathDraft(initialDraftRef.current.dataPath);
    setError(null);
    onSettled();
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">请求地址</span>
        <Input
          aria-label="请求地址"
          className="h-7 px-2 py-1 text-sm"
          placeholder="https://example.com/api/chart"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs text-muted-foreground">方法</span>
        <span className="text-xs text-muted-foreground">GET（阶段 2 仅支持）</span>
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">查询参数</span>
        <KeyValueEditor
          testId="api-params-editor"
          rows={paramRows}
          onChange={setParamRows}
          addLabel="添加参数"
          keyLabel="参数名"
          valueLabel="参数值"
        />
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">请求头</span>
        <KeyValueEditor
          testId="api-headers-editor"
          rows={headerRows}
          onChange={setHeaderRows}
          addLabel="添加请求头"
          keyLabel="请求头名"
          valueLabel="请求头值"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs text-muted-foreground">间隔</span>
        <Input
          type="number"
          aria-label="刷新间隔"
          min={0}
          step={1}
          className="h-7 px-2 py-1 text-sm"
          placeholder="不刷新"
          value={intervalDraft}
          onChange={(e) => setIntervalDraft(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">秒</span>
      </div>
      <RequestTestPanel
        getUrl={() => urlDraft.trim()}
        getParams={() => rowsToRecord(paramRows)}
        getHeaders={() => rowsToRecord(headerRows)}
        onSampleReceived={onSampleReceived}
      />
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">数据路径</span>
        <Input
          aria-label="数据路径"
          className="h-7 px-2 py-1 text-sm"
          placeholder="如 data.list（留空取根级数组）"
          value={dataPathDraft}
          onChange={(e) => setDataPathDraft(e.target.value)}
        />
      </div>
      {error !== null && (
        <p role="alert" data-testid="datasource-error" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          取消
        </Button>
        <Button size="sm" onClick={handleApply}>
          应用
        </Button>
      </div>
    </div>
  );
}

function DataSourceSection({ component, onUpdate }: SectionProps) {
  const effectiveType = component.dataSource?.type === 'api' ? 'api' : 'static';
  // 类型切换为草稿态：只切换展示的表单，应用/取消后经 onSettled 落定；
  // 切换类型本身不写入组件，不产生历史
  const [draftType, setDraftType] = useState<'static' | 'api' | null>(null);
  const shownType = draftType ?? effectiveType;
  // API 请求测试响应样本（任务 5.4：供字段映射推断可选字段）
  const [apiSample, setApiSample] = useState<unknown>(null);

  const handleTypeChange = (value: string) => {
    const next = value === 'api' ? 'api' : 'static';
    setDraftType(next === effectiveType ? null : next);
  };

  return (
    <PanelSection title="数据" collapsible testId="datasource-section" contentClassName="space-y-2">
      <RadioGroup
        className="flex gap-4"
        value={shownType}
        onValueChange={handleTypeChange}
        aria-label="数据源类型"
      >
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="static" aria-label="静态数据" id="datasource-type-static" />
          <label htmlFor="datasource-type-static" className="text-xs text-foreground">
            静态数据
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="api" aria-label="API" id="datasource-type-api" />
          <label htmlFor="datasource-type-api" className="text-xs text-foreground">
            API
          </label>
        </div>
      </RadioGroup>
      {shownType === 'static' ? (
        <StaticDataForm
          component={component}
          onUpdate={onUpdate}
          onSettled={() => setDraftType(null)}
        />
      ) : (
        <ApiConfigForm
          key={`${component.id}:${component.dataSource?.type ?? 'none'}:${serializeApiConfig(component.dataSource?.apiConfig)}`}
          component={component}
          onUpdate={onUpdate}
          onSettled={() => setDraftType(null)}
          onSampleReceived={setApiSample}
        />
      )}
      <FieldMappingControls component={component} onUpdate={onUpdate} apiSample={apiSample} />
    </PanelSection>
  );
}

// ===== 逻辑层分组（任务 4.4） =====

const NO_SORT_OPTION = '__none__';

function isLogicEmpty(logic: LogicConfig): boolean {
  return (
    logic.sortField === undefined && logic.sortDirection === undefined && logic.limit === undefined
  );
}

/**
 * 条数限制输入：正整数，可清空（清空 = 不限制）。
 * draft 提交语义（Enter / Blur 提交，Esc 取消），非法输入回退不写入。
 * 使用 type="number" 以满足 spinbutton 角色定位契约。
 */
function LimitInput({
  value,
  onCommit,
  syncKey,
}: {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  syncKey: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const prevSyncRef = useRef<{ syncKey: string; value: number | undefined }>({ syncKey, value });

  useEffect(() => {
    if (prevSyncRef.current.syncKey !== syncKey || prevSyncRef.current.value !== value) {
      prevSyncRef.current = { syncKey, value };
      setDraft(null);
    }
  }, [syncKey, value]);

  const displayValue = draft ?? (value === undefined ? '' : String(value));

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    if (trimmed === '') {
      if (value !== undefined) onCommit(undefined);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isInteger(parsed) && parsed > 0) {
      if (parsed !== value) onCommit(parsed);
    }
    // 非法输入（非正整数）直接回退，不写入
  };

  const skipNextBlurRef = useRef(false);

  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-muted-foreground">条数</span>
      <Input
        type="number"
        aria-label="条数限制"
        min={1}
        step={1}
        className="h-7 px-2 py-1 text-sm"
        placeholder="不限"
        value={displayValue}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          skipNextBlurRef.current = false;
          setDraft(value === undefined ? '' : String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            skipNextBlurRef.current = true;
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(null);
            skipNextBlurRef.current = true;
            e.currentTarget.blur();
          }
        }}
        onBlur={() => {
          if (skipNextBlurRef.current) {
            skipNextBlurRef.current = false;
            return;
          }
          commit();
        }}
      />
    </div>
  );
}

function LogicSection({ component, onUpdate }: SectionProps) {
  const logic = component.logic;

  const commitLogic = (next: LogicConfig) => {
    // 全部字段清空时移除逻辑层配置；无变化不写入（不产生空历史）
    const nextValue = isLogicEmpty(next) ? undefined : next;
    const current = logic ?? {};
    const currentValue = isLogicEmpty(current) ? undefined : current;
    if (JSON.stringify(nextValue ?? null) === JSON.stringify(currentValue ?? null)) return;
    onUpdate({ logic: nextValue });
  };

  const handleSortFieldChange = (value: string) => {
    commitLogic({
      ...logic,
      sortField: value === NO_SORT_OPTION ? undefined : (value as LogicConfig['sortField']),
    });
  };

  const handleSortDirectionChange = (value: string) => {
    commitLogic({
      ...logic,
      sortDirection: value === NO_SORT_OPTION ? undefined : (value as LogicConfig['sortDirection']),
    });
  };

  const handleLimitCommit = (limit: number | undefined) => {
    commitLogic({ ...logic, limit });
  };

  return (
    <PanelSection title="逻辑" collapsible testId="logic-section" contentClassName="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs text-muted-foreground">排序</span>
        <Select value={logic?.sortField ?? NO_SORT_OPTION} onValueChange={handleSortFieldChange}>
          <SelectTrigger size="sm" className="h-7 w-full text-sm" aria-label="排序字段">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SORT_OPTION}>不排序</SelectItem>
            <SelectItem value="dimension">维度</SelectItem>
            <SelectItem value="value">数值</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs text-muted-foreground">方向</span>
        <Select
          value={logic?.sortDirection ?? NO_SORT_OPTION}
          onValueChange={handleSortDirectionChange}
        >
          <SelectTrigger size="sm" className="h-7 w-full text-sm" aria-label="排序方向">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SORT_OPTION}>默认</SelectItem>
            <SelectItem value="asc">升序</SelectItem>
            <SelectItem value="desc">降序</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <LimitInput
        value={logic?.limit}
        onCommit={handleLimitCommit}
        syncKey={`${component.id}:logic.limit`}
      />
    </PanelSection>
  );
}

// ===== 交互层分组（任务 4.5） =====

function InteractionSection({ component, onUpdate }: SectionProps) {
  const tooltipOnHover = component.interaction?.tooltipOnHover ?? false;

  const handleCheckedChange = (checked: boolean) => {
    if (checked === tooltipOnHover) return;
    // 只写交互层，不动其他层
    const next: InteractionConfig = { ...component.interaction, tooltipOnHover: checked };
    onUpdate({ interaction: next });
  };

  return (
    <PanelSection
      title="交互"
      collapsible
      testId="interaction-section"
      contentClassName="space-y-2"
    >
      <div className="flex items-center gap-2">
        <Switch
          size="sm"
          aria-label="悬停提示"
          checked={tooltipOnHover}
          onCheckedChange={handleCheckedChange}
        />
        <span className="text-xs text-muted-foreground">悬停提示</span>
      </div>
    </PanelSection>
  );
}

// ===== 四层分组入口（任务 4.1） =====

export function BarChartConfigSections({ component, onUpdate }: SectionProps) {
  return (
    <>
      <DataSourceSection component={component} onUpdate={onUpdate} />
      <LogicSection component={component} onUpdate={onUpdate} />
      <PanelSection title="视觉" collapsible testId="visual-section" contentClassName="space-y-2">
        <TextInput
          label="标题"
          value={(component.props.title as string) ?? ''}
          onChange={(v) => onUpdate({ props: { ...component.props, title: v } })}
        />
        {/* StyleFields 不自带标题（标题由 PanelSection 统一提供），此处无重复标题 */}
        <StyleFields component={component} onUpdate={onUpdate} />
      </PanelSection>
      <InteractionSection component={component} onUpdate={onUpdate} />
    </>
  );
}
