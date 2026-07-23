/**
 * 条件表达式构建器（任务 10.2）
 *
 * 属性面板子组件：在选中 condition 节点时显示，用于编辑条件表达式。
 *
 * 表单字段：
 * - 字段来源（source.kind）：componentProp / componentData
 * - 组件 ID（source.componentId）
 * - 属性键 / 数据路径（source.key / source.path）
 * - 比较运算符（operator）：eq/ne/gt/gte/lt/lte/contains/empty/notEmpty
 * - 比较值（value）：string/number/boolean；empty/notEmpty 不显示
 *
 * 设计为受控组件：value/onChange 由调用方传入，便于直接写入蓝图 store。
 * 不嵌入节点视图本身，避免节点高度膨胀。
 */

import type { JSX, ChangeEvent } from 'react';
import type {
  ConditionExpression,
  ConditionNodeConfig,
  ConditionOperator,
  ConditionValueSource,
} from '@nebula/shared';
import type { ScreenComponent } from '@nebula/shared';

export interface ConditionBuilderProps {
  /** 当前条件配置 */
  config: ConditionNodeConfig;
  /** 配置变更回调（返回新 config，调用方写回 store） */
  onChange: (next: ConditionNodeConfig) => void;
  /** 项目组件列表（用于 componentId 下拉） */
  components: readonly ScreenComponent[];
  /** 自定义类名 */
  className?: string;
}

const OPERATOR_OPTIONS: ReadonlyArray<{ value: ConditionOperator; label: string }> = [
  { value: 'eq', label: '等于 (=)' },
  { value: 'ne', label: '不等于 (≠)' },
  { value: 'gt', label: '大于 (>)' },
  { value: 'gte', label: '大于等于 (≥)' },
  { value: 'lt', label: '小于 (<)' },
  { value: 'lte', label: '小于等于 (≤)' },
  { value: 'contains', label: '包含' },
  { value: 'empty', label: '为空' },
  { value: 'notEmpty', label: '非空' },
];

const VALUELESS_OPERATORS: ReadonlySet<ConditionOperator> = new Set(['empty', 'notEmpty']);

/** 是否需要 value 字段（empty / notEmpty 不需要） */
export function needsValue(operator: ConditionOperator): boolean {
  return !VALUELESS_OPERATORS.has(operator);
}

/** 条件表达式构建器组件 */
export function ConditionBuilder({
  config,
  onChange,
  components,
  className,
}: ConditionBuilderProps): JSX.Element {
  const { expression } = config;
  const sourceKind = expression.source.kind;
  const showValue = needsValue(expression.operator);

  function updateSource(partial: Partial<ConditionValueSource>): void {
    const nextSource: ConditionValueSource = {
      ...expression.source,
      ...partial,
    } as ConditionValueSource;
    // discriminatedUnion 校验由 Zod 在持久化时执行，UI 层不做强制重置
    const next: ConditionNodeConfig = {
      ...config,
      expression: { ...expression, source: nextSource },
    };
    onChange(next);
  }

  function updateOperator(operator: ConditionOperator): void {
    const nextExpr: ConditionExpression = { ...expression, operator };
    // 切换到 empty/notEmpty 时移除 value（schema 仍允许保留，但 UI 不展示输入）
    if (!needsValue(operator)) {
      delete nextExpr.value;
    } else if (nextExpr.value === undefined) {
      nextExpr.value = '';
    }
    onChange({ ...config, expression: nextExpr });
  }

  function updateValue(value: string): void {
    // 自动推断类型：纯数字 → number；'true'/'false' → boolean；其他 string
    let typedValue: string | number | boolean = value;
    if (value === 'true') typedValue = true;
    else if (value === 'false') typedValue = false;
    else if (/^-?\d+(\.\d+)?$/.test(value) && value !== '') typedValue = Number(value);
    onChange({
      ...config,
      expression: { ...expression, value: typedValue },
    });
  }

  function handleSourceKindChange(event: ChangeEvent<HTMLSelectElement>): void {
    const nextKind = event.target.value as 'componentProp' | 'componentData';
    // 切换 kind 时重置对应字段
    if (nextKind === 'componentProp') {
      onChange({
        ...config,
        expression: {
          ...expression,
          source: { kind: 'componentProp', componentId: '', key: '' },
        },
      });
    } else {
      onChange({
        ...config,
        expression: {
          ...expression,
          source: { kind: 'componentData', componentId: '', path: '' },
        },
      });
    }
  }

  function handleComponentIdChange(event: ChangeEvent<HTMLSelectElement>): void {
    updateSource({ componentId: event.target.value });
  }

  function handleKeyChange(event: ChangeEvent<HTMLInputElement>): void {
    updateSource({ key: event.target.value });
  }

  function handlePathChange(event: ChangeEvent<HTMLInputElement>): void {
    updateSource({ path: event.target.value });
  }

  function handleOperatorChange(event: ChangeEvent<HTMLSelectElement>): void {
    updateOperator(event.target.value as ConditionOperator);
  }

  function handleValueChange(event: ChangeEvent<HTMLInputElement>): void {
    updateValue(event.target.value);
  }

  // value 显示值：boolean 显示为 'true'/'false'；number 显示原值；string 原样
  const valueDisplay =
    typeof expression.value === 'boolean'
      ? expression.value
        ? 'true'
        : 'false'
      : typeof expression.value === 'number'
        ? String(expression.value)
        : (expression.value ?? '');

  return (
    <div
      className={className}
      data-testid="condition-builder"
      data-condition-source-kind={sourceKind}
      data-condition-operator={expression.operator}
    >
      <div className="space-y-2">
        {/* 字段来源类型 */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">字段来源</span>
          <select
            value={sourceKind}
            onChange={handleSourceKindChange}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            data-testid="condition-source-kind"
          >
            <option value="componentProp">组件属性</option>
            <option value="componentData">组件数据</option>
          </select>
        </label>

        {/* 组件 ID */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">目标组件</span>
          <select
            value={expression.source.componentId}
            onChange={handleComponentIdChange}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            data-testid="condition-component-id"
          >
            <option value="">请选择组件</option>
            {components.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name}
              </option>
            ))}
          </select>
        </label>

        {/* 属性键 / 数据路径 */}
        {sourceKind === 'componentProp' ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">属性键</span>
            <input
              type="text"
              value={expression.source.kind === 'componentProp' ? expression.source.key : ''}
              onChange={handleKeyChange}
              placeholder="例如：value / props.label"
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              data-testid="condition-source-key"
            />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">数据路径</span>
            <input
              type="text"
              value={expression.source.kind === 'componentData' ? expression.source.path : ''}
              onChange={handlePathChange}
              placeholder="例如：list.0.value"
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              data-testid="condition-source-path"
            />
          </label>
        )}

        {/* 比较运算符 */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">比较运算符</span>
          <select
            value={expression.operator}
            onChange={handleOperatorChange}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            data-testid="condition-operator"
          >
            {OPERATOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* 比较值（empty/notEmpty 不显示） */}
        {showValue ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              比较值（自动识别 number / boolean / string）
            </span>
            <input
              type="text"
              value={valueDisplay}
              onChange={handleValueChange}
              placeholder="输入文本、true/false 或数字"
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              data-testid="condition-value"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
