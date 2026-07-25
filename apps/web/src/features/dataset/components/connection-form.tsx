/**
 * 数据源连接编辑表单
 *
 * 设计依据：`docs/specs/dataset-management/ui-design.md` §5.2
 *
 * 按 type 动态渲染：
 * - mysql / postgres: host / port / database / username / password / ssl
 * - http-api: baseUrl / defaultHeaders / authType / authConfig
 *
 * 密码字段编辑时为空，留空表示不修改。
 */

import { useCallback, useState } from 'react';
import type { DataSourceConnection, DataSourceConnectionType } from '@nebula/shared';
import { CreateDataSourceConnectionSchema, UpdateDataSourceConnectionSchema } from '@nebula/shared';
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

const textareaClass =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 font-mono';

interface ConnectionDraft {
  name: string;
  description: string;
  type: DataSourceConnectionType;
  // database config
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  // http-api config
  baseUrl: string;
  defaultHeaders: string;
  authType: string;
  authConfig: string;
}

function createDefaultDraft(): ConnectionDraft {
  return {
    name: '',
    description: '',
    type: 'http-api',
    host: '',
    port: '3306',
    database: '',
    username: '',
    password: '',
    ssl: false,
    baseUrl: '',
    defaultHeaders: '{}',
    authType: 'none',
    authConfig: '',
  };
}

function connectionToDraft(conn: DataSourceConnection): ConnectionDraft {
  const draft = createDefaultDraft();
  draft.name = conn.name;
  draft.description = conn.description ?? '';
  draft.type = conn.type;
  if (conn.type === 'mysql' || conn.type === 'postgres') {
    draft.host = conn.config.host;
    draft.port = String(conn.config.port);
    draft.database = conn.config.database;
    draft.username = conn.config.username;
    draft.password = '';
    draft.ssl = conn.config.ssl ?? false;
  } else if (conn.type === 'http-api') {
    draft.baseUrl = conn.config.baseUrl;
    draft.defaultHeaders = JSON.stringify(conn.config.defaultHeaders ?? {}, null, 2);
    draft.authType = conn.config.authType ?? 'none';
    draft.authConfig = '';
  }
  return draft;
}

function buildConfig(draft: ConnectionDraft): Record<string, unknown> {
  if (draft.type === 'mysql' || draft.type === 'postgres') {
    const config: Record<string, unknown> = {
      host: draft.host,
      port: Number.parseInt(draft.port, 10),
      database: draft.database,
      username: draft.username,
      ssl: draft.ssl,
    };
    if (draft.password) config.password = draft.password;
    return config;
  }
  // http-api
  const config: Record<string, unknown> = { baseUrl: draft.baseUrl };
  const headers = draft.defaultHeaders.trim();
  if (headers && headers !== '{}') {
    config.defaultHeaders = JSON.parse(headers);
  }
  if (draft.authType !== 'none') {
    config.authType = draft.authType;
    if (draft.authConfig) config.authConfig = draft.authConfig;
  }
  return config;
}

interface ConnectionFormProps {
  connection?: DataSourceConnection;
  onSubmit: (params: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ConnectionForm({
  connection,
  onSubmit,
  onCancel,
  isSubmitting,
}: ConnectionFormProps) {
  const [draft, setDraft] = useState<ConnectionDraft>(
    connection ? connectionToDraft(connection) : createDefaultDraft(),
  );
  const [errors, setErrors] = useState<string[]>([]);

  const update = useCallback((patch: Partial<ConnectionDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSubmit = async () => {
    setErrors([]);
    try {
      const config = buildConfig(draft);
      const params = {
        name: draft.name,
        ...(draft.description ? { description: draft.description } : {}),
        type: draft.type,
        config,
      };
      const schema = connection
        ? UpdateDataSourceConnectionSchema
        : CreateDataSourceConnectionSchema;
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

  const isDatabase = draft.type === 'mysql' || draft.type === 'postgres';

  return (
    <div className="space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="conn-name">名称</FieldLabel>
          <Input
            id="conn-name"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="连接名称（项目内唯一）"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="conn-description">描述</FieldLabel>
          <Input
            id="conn-description"
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="可选描述"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="conn-type">类型</FieldLabel>
          <Select
            value={draft.type}
            onValueChange={(v) => update({ type: v as DataSourceConnectionType })}
            disabled={Boolean(connection)}
          >
            <SelectTrigger id="conn-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mysql">MySQL</SelectItem>
              <SelectItem value="postgres">PostgreSQL</SelectItem>
              <SelectItem value="http-api">HTTP API</SelectItem>
            </SelectContent>
          </Select>
          {connection && (
            <p className="text-xs text-muted-foreground">类型不可修改，如需变更请重建连接</p>
          )}
        </Field>
      </FieldGroup>

      {isDatabase ? (
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="conn-host">主机</FieldLabel>
              <Input
                id="conn-host"
                value={draft.host}
                onChange={(e) => update({ host: e.target.value })}
                placeholder="localhost"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="conn-port">端口</FieldLabel>
              <Input
                id="conn-port"
                type="number"
                value={draft.port}
                onChange={(e) => update({ port: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="conn-database">数据库</FieldLabel>
              <Input
                id="conn-database"
                value={draft.database}
                onChange={(e) => update({ database: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="conn-username">用户名</FieldLabel>
              <Input
                id="conn-username"
                value={draft.username}
                onChange={(e) => update({ username: e.target.value })}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="conn-password">
              密码{connection && '（留空表示不修改）'}
            </FieldLabel>
            <Input
              id="conn-password"
              type="password"
              value={draft.password}
              onChange={(e) => update({ password: e.target.value })}
              placeholder={connection ? '留空不修改' : '请输入密码'}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={draft.ssl} onCheckedChange={(v) => update({ ssl: v })} />
            启用 SSL
          </label>
        </FieldGroup>
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="conn-baseurl">Base URL</FieldLabel>
            <Input
              id="conn-baseurl"
              value={draft.baseUrl}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder="https://api.example.com"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="conn-headers">默认请求头 (JSON)</FieldLabel>
            <textarea
              id="conn-headers"
              className={textareaClass}
              rows={4}
              value={draft.defaultHeaders}
              onChange={(e) => update({ defaultHeaders: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="conn-authtype">鉴权类型</FieldLabel>
            <Select value={draft.authType} onValueChange={(v) => update({ authType: v })}>
              <SelectTrigger id="conn-authtype">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="api-key">API Key</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {draft.authType !== 'none' && (
            <Field>
              <FieldLabel htmlFor="conn-authconfig">
                鉴权配置{connection && '（留空表示不修改）'}
              </FieldLabel>
              <Input
                id="conn-authconfig"
                type="password"
                value={draft.authConfig}
                onChange={(e) => update({ authConfig: e.target.value })}
                placeholder={connection ? '留空不修改' : '请输入鉴权信息'}
              />
            </Field>
          )}
        </FieldGroup>
      )}

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
          {isSubmitting ? '保存中...' : connection ? '更新' : '创建'}
        </Button>
      </div>
    </div>
  );
}
