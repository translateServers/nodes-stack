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
 *
 * UI/UX 优化：
 * - 容器透明化：自身不再携带 border/background，由外层浮动卡片（sheet-v2）统一承载视觉
 * - 头部带节点类型徽章（与节点卡片配色体系一致），快速确认当前配置对象
 * - 表单控件统一 focus ring / transition / hover，提高可用性
 */

import type { JSX, ChangeEvent } from 'react';
import type { Node } from '@xyflow/react';
import { Settings2 } from 'lucide-react';
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

/** 表单控件统一类名：聚焦环 + 过渡 + hover */
const controlClassName =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm transition-colors hover:border-border focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

/** 节点类型徽章元信息（与节点卡片配色体系一致） */
const KIND_BADGE: Record<string, { label: string; className: string }> = {
  component: {
    label: '组件节点',
    className: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
  },
  global: {
    label: '全局节点',
    className:
      'bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400',
  },
  condition: {
    label: '条件分支',
    className: 'bg-sky-500/10 text-sky-600 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400',
  },
  delay: {
    label: '延时节点',
    className:
      'bg-violet-500/10 text-violet-600 ring-1 ring-inset ring-violet-500/20 dark:text-violet-400',
  },
  comment: {
    label: '注释节点',
    className: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
  },
};

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
  const kindBadge = KIND_BADGE[rfType] ?? KIND_BADGE.component;

  return (
    <div
      className="px-3 py-3"
      data-testid="v2-node-config-panel"
      data-node-kind={rfType}
      data-node-global-type={data.globalType}
    >
      {/* 头部：图标 + 标题 + 节点类型徽章 */}
      <div className="mb-2.5 flex items-center gap-1.5">
        <Settings2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-xs font-medium text-foreground">节点配置</h3>
        <span
          className={`ml-auto inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${kindBadge.className}`}
          data-testid="v2-node-config-kind-badge"
        >
          {kindBadge.label}
        </span>
      </div>
      <div className="space-y-2.5">
        {rfType === 'component' && (
          <ComponentIdSelect
            value={data.componentId ?? ''}
            components={components}
            onChange={(componentId) => onChange({ kind: 'component-id', componentId })}
          />
        )}

        {rfType === 'global' && data.globalType === 'pageLoad' && (
          <p className="rounded-md bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
            页面加载触发器无需配置。
          </p>
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
        className={controlClassName}
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
    <div className="space-y-2.5">
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
          className={controlClassName}
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
          className={controlClassName}
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
    <div className="space-y-2.5">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">HTTP 方法</span>
        <select
          value={config.method}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...config, method: e.target.value as GlobalRequestApiConfig['method'] })
          }
          className={controlClassName}
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
          className={controlClassName}
          data-testid="v2-config-request-api-url"
        />
      </label>
      <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
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
        className={controlClassName}
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
        className={controlClassName}
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
        className={controlClassName}
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
        className={`${controlClassName} resize-y`}
        data-testid="v2-config-comment-text"
      />
    </label>
  );
}
