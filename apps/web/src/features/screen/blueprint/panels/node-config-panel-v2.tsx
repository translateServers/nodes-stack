/**
 * V2 节点参数配置面板（任务 5.6）
 *
 * 选中单个节点时展示，按节点 kind 与 globalType 渲染对应表单：
 * - component（普通组件节点）：组件选择下拉（锚点由组件注册表自动派生，无需配置）
 * - component + globalType=navigate：URL 输入 + target
 * - component + globalType=requestApi：method + URL（基础字段，高级字段由代码编辑器）
 * - component + globalType=scrollTo：目标组件选择
 * - component + globalType=pageLoad：无字段（提示文案）
 * - delay：delayMs 数字输入（0 ~ 60000）
 * - condition：复用 ConditionBuilder（V1 即有，结构不变）
 * - comment：纯文本域
 *
 * 设计为受控组件：node/onChange 由调用方传入，便于直接写入蓝图 store。
 * 写回通过 V2NodeConfigChange 判别联合，调用方按 kind 分发更新 node.data 字段。
 *
 * 从 blueprint-sheet-v2.tsx 抽出以独立测试，符合 spec 任务 5.6 的「重写 panels/node-config-panel」目标。
 */

import type { JSX, ChangeEvent } from 'react';
import type { Node } from '@xyflow/react';
import type {
  CommentNodeConfig,
  ConditionNodeConfig,
  GlobalIntervalConfig,
  GlobalNavigateConfig,
  GlobalNodeConfig,
  GlobalRequestApiConfig,
  GlobalScrollToConfig,
  ScreenComponent,
} from '@nebula/shared';
import { ConditionBuilder } from './condition-builder';

/** V2 配置变更联合类型（按节点 kind 判别） */
export type V2NodeConfigChange =
  | { kind: 'component-id'; componentId: string }
  | { kind: 'global-config'; config: GlobalNodeConfig }
  | { kind: 'delay-config'; config: { delayMs: number } }
  | { kind: 'condition-config'; config: ConditionNodeConfig }
  | { kind: 'comment-config'; config: CommentNodeConfig };

export interface V2NodeConfigPanelProps {
  /** 选中节点（ReactFlow Node，data 为 V2 节点数据） */
  node: Node;
  /** 项目组件列表（用于组件下拉） */
  components: readonly ScreenComponent[];
  /** 配置变更回调，返回判别联合由调用方写回 node.data */
  onChange: (next: V2NodeConfigChange) => void;
}

/**
 * V2 节点配置面板：根据节点 kind 与 globalType 分发渲染对应表单。
 */
export function V2NodeConfigPanel({
  node,
  components,
  onChange,
}: V2NodeConfigPanelProps): JSX.Element {
  const data = node.data as {
    componentId?: string;
    globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
    config?: unknown;
  };
  const rfType = node.type ?? 'component';

  return (
    <div
      className="border-t border-border bg-background px-3 py-3"
      data-testid="v2-node-config-panel"
      data-node-kind={rfType}
      data-node-global-type={data.globalType}
    >
      <h3 className="mb-2 text-xs font-medium text-foreground">节点配置</h3>
      <div className="space-y-2">
        {rfType === 'component' && (
          <ComponentIdSelect
            value={data.componentId ?? ''}
            components={components}
            onChange={(componentId) => onChange({ kind: 'component-id', componentId })}
          />
        )}

        {rfType === 'global' && data.globalType === 'pageLoad' && (
          <p className="text-xs text-muted-foreground">页面加载触发器无需配置。</p>
        )}

        {rfType === 'global' && data.globalType === 'navigate' && (
          <NavigateConfigForm
            config={data.config as GlobalNavigateConfig}
            onChange={(config) => onChange({ kind: 'global-config', config })}
          />
        )}

        {rfType === 'global' && data.globalType === 'requestApi' && (
          <RequestApiConfigForm
            config={data.config as GlobalRequestApiConfig}
            onChange={(config) => onChange({ kind: 'global-config', config })}
          />
        )}

        {rfType === 'global' && data.globalType === 'scrollTo' && (
          <ScrollToConfigForm
            config={data.config as GlobalScrollToConfig}
            components={components}
            onChange={(config) => onChange({ kind: 'global-config', config })}
          />
        )}

        {rfType === 'global' && data.globalType === 'interval' && (
          <IntervalConfigForm
            config={
              (data.config as GlobalIntervalConfig) ?? { globalType: 'interval', intervalMs: 1000 }
            }
            onChange={(config) => onChange({ kind: 'global-config', config })}
          />
        )}

        {rfType === 'delay' && (
          <DelayConfigForm
            config={(data.config as { delayMs: number }) ?? { delayMs: 500 }}
            onChange={(config) => onChange({ kind: 'delay-config', config })}
          />
        )}

        {rfType === 'condition' && (
          <ConditionBuilder
            config={data.config as ConditionNodeConfig}
            components={components}
            onChange={(config) => onChange({ kind: 'condition-config', config })}
          />
        )}

        {rfType === 'comment' && (
          <CommentConfigForm
            config={(data.config as CommentNodeConfig) ?? { text: '' }}
            onChange={(config) => onChange({ kind: 'comment-config', config })}
          />
        )}
      </div>
    </div>
  );
}

/** 组件选择下拉框（共用组件，dangling 态保留原值并提示） */
function ComponentIdSelect({
  value,
  components,
  onChange,
}: {
  value: string;
  components: readonly ScreenComponent[];
  onChange: (id: string) => void;
}): JSX.Element {
  const isDangling = value !== '' && !components.some((c) => c.id === value);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {isDangling ? <span className="text-destructive">目标组件（悬空引用）</span> : '目标组件'}
      </span>
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
        data-testid="v2-config-component-id"
      >
        <option value="">请选择组件</option>
        {isDangling ? <option value={value}>{`（悬空）${value}`}</option> : null}
        {components.map((comp) => (
          <option key={comp.id} value={comp.id}>
            {comp.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 全局 navigate 配置表单：URL + 打开方式 */
function NavigateConfigForm({
  config,
  onChange,
}: {
  config: GlobalNavigateConfig;
  onChange: (next: GlobalNavigateConfig) => void;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          目标 URL（仅 http/https）
        </span>
        <input
          type="text"
          value={config.url}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ ...config, url: e.target.value })
          }
          placeholder="https://example.com"
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          data-testid="v2-config-navigate-url"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">打开方式</span>
        <select
          value={config.target}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...config, target: e.target.value as '_blank' | '_self' })
          }
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          data-testid="v2-config-navigate-target"
        >
          <option value="_blank">新窗口</option>
          <option value="_self">当前窗口</option>
        </select>
      </label>
    </div>
  );
}

/** 全局 requestApi 配置表单：method + URL（高级字段提示由代码编辑器编辑） */
function RequestApiConfigForm({
  config,
  onChange,
}: {
  config: GlobalRequestApiConfig;
  onChange: (next: GlobalRequestApiConfig) => void;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">HTTP 方法</span>
        <select
          value={config.method}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...config, method: e.target.value as GlobalRequestApiConfig['method'] })
          }
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          data-testid="v2-config-request-api-method"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          请求 URL（仅 http/https）
        </span>
        <input
          type="text"
          value={config.url}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ ...config, url: e.target.value })
          }
          placeholder="https://api.example.com"
          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          data-testid="v2-config-request-api-url"
        />
      </label>
      <p className="text-[10px] text-muted-foreground">
        高级字段（headers / body / 脱敏键名 / 超时）请通过代码编辑器配置。
      </p>
    </div>
  );
}

/** 全局 scrollTo 配置表单：目标组件选择 */
function ScrollToConfigForm({
  config,
  components,
  onChange,
}: {
  config: GlobalScrollToConfig;
  components: readonly ScreenComponent[];
  onChange: (next: GlobalScrollToConfig) => void;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">目标组件</span>
      <select
        value={config.targetComponentId}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          onChange({ ...config, targetComponentId: e.target.value })
        }
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
        data-testid="v2-config-scroll-to-target"
      >
        <option value="">请选择组件</option>
        {components.map((comp) => (
          <option key={comp.id} value={comp.id}>
            {comp.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 全局 interval 配置表单：intervalMs 数字输入（100 ~ 86400000） */
function IntervalConfigForm({
  config,
  onChange,
}: {
  config: GlobalIntervalConfig;
  onChange: (next: GlobalIntervalConfig) => void;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        触发间隔（毫秒，100 ~ 86400000）
      </span>
      <input
        type="number"
        min={100}
        max={86400000}
        value={config.intervalMs}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const value = Number.parseInt(e.target.value, 10);
          if (Number.isNaN(value)) return;
          onChange({ ...config, intervalMs: value });
        }}
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
        data-testid="v2-config-interval-ms"
      />
    </label>
  );
}

/** delay 节点配置表单：delayMs 数字输入（0 ~ 60000） */
function DelayConfigForm({
  config,
  onChange,
}: {
  config: { delayMs: number };
  onChange: (next: { delayMs: number }) => void;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        延时时长（毫秒，0 ~ 60000）
      </span>
      <input
        type="number"
        min={0}
        max={60000}
        value={config.delayMs}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const value = Number.parseInt(e.target.value, 10);
          if (Number.isNaN(value)) return;
          onChange({ delayMs: value });
        }}
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
        data-testid="v2-config-delay-ms"
      />
    </label>
  );
}

/** comment 节点配置表单：纯文本域 */
function CommentConfigForm({
  config,
  onChange,
}: {
  config: CommentNodeConfig;
  onChange: (next: CommentNodeConfig) => void;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">注释文本</span>
      <textarea
        value={config.text}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ text: e.target.value })}
        placeholder="输入注释..."
        rows={3}
        className="w-full resize-y rounded border border-border bg-background px-2 py-1 text-sm"
        data-testid="v2-config-comment-text"
      />
    </label>
  );
}
