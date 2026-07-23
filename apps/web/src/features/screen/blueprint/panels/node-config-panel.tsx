/**
 * 节点参数配置面板（任务 4.8 - M1 补遗）
 *
 * 选中单个节点时展示，按节点 kind 与 config.type 渲染对应表单：
 * - trigger.componentClick：组件单选
 * - trigger.pageLoad：无组件字段
 * - action.setVisibility：组件单选 + show/hide/toggle
 * - action.navigate：URL 输入 + target
 * - action.scrollToComponent / refreshDataSource：组件单选
 * - comment：纯文本域
 * - condition：复用 ConditionBuilder
 *
 * 组件下拉显示 name、值为 id；当前 id 不在组件列表时显示 dangling 态并保留原值。
 * 写回经 onChange 回调，由调用方经 setNodes 更新 data.config -> updateBlueprint 单条历史。
 */

import type { JSX, ChangeEvent } from 'react';
import type {
  BlueprintActionConfig,
  BlueprintTriggerConfig,
  CommentNodeConfig,
  ConditionNodeConfig,
  ScreenComponent,
} from '@nebula/shared';
import { ConditionBuilder } from './condition-builder';

export interface NodeConfigPanelProps {
  /** 选中节点的 kind */
  kind: 'trigger' | 'condition' | 'action' | 'comment';
  /** 选中节点的 config（判别联合类型） */
  config: BlueprintTriggerConfig | BlueprintActionConfig | CommentNodeConfig | ConditionNodeConfig;
  /** 项目组件列表（用于组件下拉） */
  components: readonly ScreenComponent[];
  /** 配置变更回调，返回新 config 由调用方写回 */
  onChange: (
    next: BlueprintTriggerConfig | BlueprintActionConfig | CommentNodeConfig | ConditionNodeConfig,
  ) => void;
}

/** 组件选择下拉框（共用组件） */
function ComponentSelect({
  value,
  components,
  onChange,
  testId,
}: {
  value: string;
  components: readonly ScreenComponent[];
  onChange: (id: string) => void;
  testId: string;
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
        data-testid={testId}
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

/** trigger 配置表单 */
function TriggerConfigForm({
  config,
  components,
  onChange,
}: {
  config: BlueprintTriggerConfig;
  components: readonly ScreenComponent[];
  onChange: (next: BlueprintTriggerConfig) => void;
}): JSX.Element {
  if (config.type !== 'componentClick') {
    return <p className="text-xs text-muted-foreground">该触发器类型无需配置组件。</p>;
  }

  // componentClick
  return (
    <ComponentSelect
      value={config.componentId}
      components={components}
      onChange={(id) => onChange({ type: 'componentClick', componentId: id })}
      testId="config-component-id"
    />
  );
}

/** action 配置表单 */
function ActionConfigForm({
  config,
  components,
  onChange,
}: {
  config: BlueprintActionConfig;
  components: readonly ScreenComponent[];
  onChange: (next: BlueprintActionConfig) => void;
}): JSX.Element {
  switch (config.type) {
    case 'setVisibility':
      return (
        <div className="space-y-2">
          <ComponentSelect
            value={config.targetComponentId}
            components={components}
            onChange={(id) => onChange({ ...config, targetComponentId: id })}
            testId="config-target-component-id"
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">显隐模式</span>
            <select
              value={config.visible}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                onChange({
                  ...config,
                  visible: e.target.value as 'show' | 'hide' | 'toggle',
                })
              }
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              data-testid="config-visible"
            >
              <option value="show">显示</option>
              <option value="hide">隐藏</option>
              <option value="toggle">切换</option>
            </select>
          </label>
        </div>
      );

    case 'navigate':
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
              data-testid="config-url"
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
              data-testid="config-target"
            >
              <option value="_blank">新窗口</option>
              <option value="_self">当前窗口</option>
            </select>
          </label>
        </div>
      );

    case 'scrollToComponent':
      return (
        <ComponentSelect
          value={config.targetComponentId}
          components={components}
          onChange={(id) => onChange({ ...config, targetComponentId: id })}
          testId="config-target-component-id"
        />
      );

    case 'refreshDataSource':
      return (
        <ComponentSelect
          value={config.targetComponentId}
          components={components}
          onChange={(id) => onChange({ ...config, targetComponentId: id })}
          testId="config-target-component-id"
        />
      );

    case 'requestApi':
      // requestApi 配置较为复杂，M3 高级动作暂不在本面板编辑
      return (
        <p className="text-xs text-muted-foreground">requestApi 动作参数请通过高级配置编辑。</p>
      );
  }
}

/** comment 配置表单 */
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
        data-testid="config-comment-text"
      />
    </label>
  );
}

/** 节点参数配置面板 */
export function NodeConfigPanel({
  kind,
  config,
  components,
  onChange,
}: NodeConfigPanelProps): JSX.Element {
  return (
    <div
      className="border-t border-border bg-background px-3 py-3"
      data-testid="node-config-panel"
      data-node-kind={kind}
    >
      <h3 className="mb-2 text-xs font-medium text-foreground">节点配置</h3>
      <div className="space-y-2">
        {kind === 'trigger' ? (
          <TriggerConfigForm
            config={config as BlueprintTriggerConfig}
            components={components}
            onChange={onChange}
          />
        ) : null}
        {kind === 'action' ? (
          <ActionConfigForm
            config={config as BlueprintActionConfig}
            components={components}
            onChange={onChange}
          />
        ) : null}
        {kind === 'comment' ? (
          <CommentConfigForm config={config as CommentNodeConfig} onChange={onChange} />
        ) : null}
        {kind === 'condition' ? (
          <ConditionBuilder
            config={config as ConditionNodeConfig}
            onChange={onChange}
            components={components}
          />
        ) : null}
      </div>
    </div>
  );
}
