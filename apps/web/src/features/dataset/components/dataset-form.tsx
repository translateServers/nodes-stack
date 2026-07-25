/**
 * 数据集表单（Schema 驱动渲染，按 type 动态切换 config 区）
 *
 * 设计依据：`docs/specs/dataset-management/ui-design.md` §2
 *
 * DatasetSchema 是判别联合，不适用 react-hook-form；用本地草稿状态管理，
 * 提交时经 CreateDatasetSchema/UpdateDatasetSchema.safeParse() 校验。
 */

import { useCallback, useState } from 'react';
import type { Dataset, DatasetType } from '@nebula/shared';
import { CreateDatasetSchema, UpdateDatasetSchema } from '@nebula/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  type DatasetDraft,
  createDefaultDraft,
  datasetToDraft,
  draftToCreateParams,
} from '../types';

const textareaClass =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 font-mono';

interface DatasetFormProps {
  dataset?: Dataset;
  onSubmit: (params: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  onDraftChange?: (draft: DatasetDraft) => void;
}

export function DatasetForm({
  dataset,
  onSubmit,
  onCancel,
  isSubmitting,
  onDraftChange,
}: DatasetFormProps) {
  const [draft, setDraft] = useState<DatasetDraft>(
    dataset ? datasetToDraft(dataset) : createDefaultDraft(),
  );
  const [errors, setErrors] = useState<string[]>([]);

  const update = useCallback(
    (patch: Partial<DatasetDraft>) => {
      setDraft((prev) => {
        const next = { ...prev, ...patch };
        onDraftChange?.(next);
        return next;
      });
    },
    [onDraftChange],
  );

  const handleSubmit = async () => {
    setErrors([]);
    try {
      const params = draftToCreateParams(draft);
      const schema = dataset ? UpdateDatasetSchema : CreateDatasetSchema;
      const result = schema.safeParse(params);
      if (!result.success) {
        setErrors(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
        return;
      }
      await onSubmit(result.data);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : '表单校验失败']);
    }
  };

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <SectionTitle>基本信息</SectionTitle>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="dataset-name">名称</FieldLabel>
          <Input
            id="dataset-name"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="数据集名称（项目内唯一）"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dataset-description">描述</FieldLabel>
          <Input
            id="dataset-description"
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="可选描述"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="dataset-type">类型</FieldLabel>
            <Select value={draft.type} onValueChange={(v) => update({ type: v as DatasetType })}>
              <SelectTrigger id="dataset-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static">静态数据</SelectItem>
                <SelectItem value="api">API 接口</SelectItem>
                <SelectItem value="sql">SQL 查询</SelectItem>
                <SelectItem value="websocket">WebSocket</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="dataset-category">分类</FieldLabel>
            <Input
              id="dataset-category"
              value={draft.category}
              onChange={(e) => update({ category: e.target.value })}
              placeholder="如：销售"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="dataset-tags">标签</FieldLabel>
          <Input
            id="dataset-tags"
            value={draft.tags}
            onChange={(e) => update({ tags: e.target.value })}
            placeholder="逗号分隔，如：销售, 日报"
          />
        </Field>
      </FieldGroup>

      {/* 类型特定配置 */}
      <ConfigSection draft={draft} update={update} />

      {/* 数据形态 */}
      <SectionTitle>数据形态</SectionTitle>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="dataset-datapath">数据路径 (dataPath)</FieldLabel>
          <Input
            id="dataset-datapath"
            value={draft.dataPath}
            onChange={(e) => update({ dataPath: e.target.value })}
            placeholder="如 data.list"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="dataset-dimension">维度字段</FieldLabel>
            <Input
              id="dataset-dimension"
              value={draft.dimension}
              onChange={(e) => update({ dimension: e.target.value })}
              placeholder="如 name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dataset-value">数值字段</FieldLabel>
            <Input
              id="dataset-value"
              value={draft.value}
              onChange={(e) => update({ value: e.target.value })}
              placeholder="如 value"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="dataset-filter">filter 表达式 (JSONata)</FieldLabel>
          <textarea
            id="dataset-filter"
            className={textareaClass}
            rows={2}
            value={draft.filter}
            onChange={(e) => update({ filter: e.target.value })}
            placeholder="如 $filter(items, function($v) { $v.value > 0 })"
          />
        </Field>
      </FieldGroup>

      {/* 刷新策略 */}
      <SectionTitle>刷新策略</SectionTitle>
      <FieldGroup>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.refreshEnabled}
            onCheckedChange={(v) => update({ refreshEnabled: v })}
          />
          启用定时刷新
        </label>
        {draft.refreshEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="dataset-refresh-interval">刷新间隔</FieldLabel>
              <Input
                id="dataset-refresh-interval"
                type="number"
                min={0}
                value={draft.refreshInterval}
                onChange={(e) => update({ refreshInterval: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dataset-refresh-unit">单位</FieldLabel>
              <Select
                value={draft.refreshIntervalUnit}
                onValueChange={(v) => update({ refreshIntervalUnit: v })}
              >
                <SelectTrigger id="dataset-refresh-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="second">秒</SelectItem>
                  <SelectItem value="minute">分钟</SelectItem>
                  <SelectItem value="hour">小时</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
        {draft.refreshEnabled && (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.refreshStopOnHidden}
              onCheckedChange={(v) => update({ refreshStopOnHidden: v })}
            />
            组件隐藏时停止刷新
          </label>
        )}
      </FieldGroup>

      {/* 缓存策略 */}
      <SectionTitle>缓存策略</SectionTitle>
      <FieldGroup>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.cacheEnabled}
            onCheckedChange={(v) => update({ cacheEnabled: v })}
          />
          启用缓存
        </label>
        {draft.cacheEnabled && (
          <>
            <Field>
              <FieldLabel htmlFor="dataset-cache-ttl">TTL（秒）</FieldLabel>
              <Input
                id="dataset-cache-ttl"
                type="number"
                min={1}
                value={draft.cacheTtl}
                onChange={(e) => update({ cacheTtl: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dataset-cache-tags">缓存标签</FieldLabel>
              <Input
                id="dataset-cache-tags"
                value={draft.cacheTags}
                onChange={(e) => update({ cacheTags: e.target.value })}
                placeholder="逗号分隔，如：销售, 日报"
              />
            </Field>
          </>
        )}
      </FieldGroup>

      {/* Mock 配置 */}
      <SectionTitle>Mock 配置</SectionTitle>
      <FieldGroup>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={draft.mockEnabled} onCheckedChange={(v) => update({ mockEnabled: v })} />
          启用 Mock
        </label>
        {draft.mockEnabled && (
          <>
            <Field>
              <FieldLabel htmlFor="dataset-mock-generator">生成器</FieldLabel>
              <Select
                value={draft.mockGenerator}
                onValueChange={(v) => update({ mockGenerator: v })}
              >
                <SelectTrigger id="dataset-mock-generator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">静态数据</SelectItem>
                  <SelectItem value="faker-template">Faker 模板</SelectItem>
                  <SelectItem value="echo-params">回显参数</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {draft.mockGenerator === 'static' && (
              <Field>
                <FieldLabel htmlFor="dataset-mock-data">Mock 数据 (JSON)</FieldLabel>
                <textarea
                  id="dataset-mock-data"
                  className={textareaClass}
                  rows={6}
                  value={draft.mockData}
                  onChange={(e) => update({ mockData: e.target.value })}
                />
              </Field>
            )}
            {draft.mockGenerator === 'faker-template' && (
              <Field>
                <FieldLabel htmlFor="dataset-mock-template">Faker 模板表达式</FieldLabel>
                <textarea
                  id="dataset-mock-template"
                  className={textareaClass}
                  rows={6}
                  value={draft.mockTemplate}
                  onChange={(e) => update({ mockTemplate: e.target.value })}
                  placeholder='{ "list|10": [{ "name": "{{faker.person.fullName}}", "value|0-1000": 1 }] }'
                />
              </Field>
            )}
          </>
        )}
      </FieldGroup>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <ul className="list-disc pl-4">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          取消
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
          {isSubmitting ? '保存中...' : dataset ? '更新' : '创建'}
        </Button>
      </div>
    </div>
  );
}

// ===== 子组件 =====

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="border-b pb-1 text-sm font-semibold text-foreground">{children}</h3>;
}

function ConfigSection({
  draft,
  update,
}: {
  draft: DatasetDraft;
  update: (patch: Partial<DatasetDraft>) => void;
}) {
  switch (draft.type) {
    case 'static':
      return (
        <>
          <SectionTitle>静态数据配置</SectionTitle>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dataset-static-data">静态数据 (JSON)</FieldLabel>
              <textarea
                id="dataset-static-data"
                className={textareaClass}
                rows={8}
                value={draft.staticData}
                onChange={(e) => update({ staticData: e.target.value })}
              />
            </Field>
          </FieldGroup>
        </>
      );
    case 'api':
      return (
        <>
          <SectionTitle>API 配置</SectionTitle>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dataset-api-path">路径</FieldLabel>
              <Input
                id="dataset-api-path"
                value={draft.apiPath}
                onChange={(e) => update({ apiPath: e.target.value })}
                placeholder="/api/sales 或完整 URL"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="dataset-api-method">方法</FieldLabel>
                <Select value={draft.apiMethod} onValueChange={(v) => update({ apiMethod: v })}>
                  <SelectTrigger id="dataset-api-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="dataset-api-content-type">Content-Type</FieldLabel>
                <Select
                  value={draft.apiContentType}
                  onValueChange={(v) => update({ apiContentType: v })}
                >
                  <SelectTrigger id="dataset-api-content-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">application/json</SelectItem>
                    <SelectItem value="form-data">multipart/form-data</SelectItem>
                    <SelectItem value="x-www-form-urlencoded">
                      application/x-www-form-urlencoded
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="dataset-api-headers">Headers (JSON)</FieldLabel>
              <textarea
                id="dataset-api-headers"
                className={textareaClass}
                rows={3}
                value={draft.apiHeaders}
                onChange={(e) => update({ apiHeaders: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dataset-api-params">Params (JSON)</FieldLabel>
              <textarea
                id="dataset-api-params"
                className={textareaClass}
                rows={3}
                value={draft.apiParams}
                onChange={(e) => update({ apiParams: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dataset-api-body">Body (JSON)</FieldLabel>
              <textarea
                id="dataset-api-body"
                className={textareaClass}
                rows={4}
                value={draft.apiBody}
                onChange={(e) => update({ apiBody: e.target.value })}
              />
            </Field>
          </FieldGroup>
        </>
      );
    case 'sql':
      return (
        <>
          <SectionTitle>SQL 配置</SectionTitle>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dataset-sql-connection">数据库连接</FieldLabel>
              <Input
                id="dataset-sql-connection"
                value={draft.sqlConnectionId}
                onChange={(e) => update({ sqlConnectionId: e.target.value })}
                placeholder="连接 ID（第二阶段启用连接选择器）"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dataset-sql">SQL 语句</FieldLabel>
              <textarea
                id="dataset-sql"
                className={textareaClass}
                rows={6}
                value={draft.sqlSql}
                onChange={(e) => update({ sqlSql: e.target.value })}
                placeholder="SELECT * FROM sales LIMIT 100"
              />
            </Field>
          </FieldGroup>
        </>
      );
    case 'websocket':
      return (
        <>
          <SectionTitle>WebSocket 配置</SectionTitle>
          <Alert variant="default" className="text-xs">
            WebSocket 类型在第一阶段尚未实现，执行时将返回 DATASET_TYPE_NOT_SUPPORTED（80007）。
          </Alert>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dataset-ws-url">URL</FieldLabel>
              <Input
                id="dataset-ws-url"
                value={draft.wsUrl}
                onChange={(e) => update({ wsUrl: e.target.value })}
                placeholder="wss://example.com/ws"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dataset-ws-protocol">子协议</FieldLabel>
              <Input
                id="dataset-ws-protocol"
                value={draft.wsProtocol}
                onChange={(e) => update({ wsProtocol: e.target.value })}
                placeholder="逗号分隔"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dataset-ws-format">消息格式</FieldLabel>
              <Select
                value={draft.wsMessageFormat}
                onValueChange={(v) => update({ wsMessageFormat: v })}
              >
                <SelectTrigger id="dataset-ws-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </>
      );
  }
}
