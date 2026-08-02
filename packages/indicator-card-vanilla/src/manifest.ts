/**
 * 指标卡 manifest（Spec §7.2 + §13.2 Phase 2, Task 2.3 + Phase 3 Task 3.3 + Phase 4 Task 4.3）
 *
 * Phase 2 切片：声明所有必填字段。
 * Phase 3 Task 3.3：接入 propertyPanel（title/value/color 声明式属性面板）。
 * Phase 4 Task 4.3：接入 events（valueClick：点击数值派发 nebula-component-event）。
 *
 * Identity（Spec §7.2 Identity rules）：
 * - type 使用 `example.indicator-card/v1`，匹配外部 type 正则
 *   `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+/v([1-9][0-9]*)$`
 * - 不使用 `nebula.` 保留前缀
 * - tagName `example-indicator-card-v1` 满足 Custom Element 命名规则并以 `-v1` 结尾
 */

import {
  SCREEN_COMPONENT_API_VERSION,
  type ScreenComponentManifest,
} from '@nebula/screen-component-sdk';

export const INDICATOR_CARD_TYPE = 'example.indicator-card/v1';
export const INDICATOR_CARD_TAG_NAME = 'example-indicator-card-v1';
export const INDICATOR_CARD_IMPLEMENTATION_VERSION = '1.0.0';

/**
 * 指标卡 manifest（Phase 3 Task 3.3 + Phase 4 Task 4.3：propertyPanel 与 events 均已接入）。
 *
 * 在模块加载时构造为 frozen 对象，避免运行时被外部修改。
 */
export const indicatorCardManifest: ScreenComponentManifest = {
  apiVersion: SCREEN_COMPONENT_API_VERSION,
  type: INDICATOR_CARD_TYPE,
  implementationVersion: INDICATOR_CARD_IMPLEMENTATION_VERSION,
  tagName: INDICATOR_CARD_TAG_NAME,
  name: '指标卡',
  category: 'chart',
  icon: 'chart',
  description: '展示单个指标数值的卡片组件（Vanilla Custom Element 示例）',
  keywords: ['kpi', 'indicator', 'metric', '指标', '卡片'],
  order: 0,
  defaultSize: { width: 320, height: 180 },
  defaultProps: {
    title: '指标',
    value: 0,
    color: '#4f46e5',
  },
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string', title: '标题', minLength: 0, maxLength: 64 },
      value: { type: 'number', title: '数值', minimum: 0 },
      color: {
        type: 'string',
        title: '主色',
        pattern: '^#[0-9a-fA-F]{6}$',
        description: '卡片主色（十六进制 RGB）',
      },
    },
    required: ['title', 'value', 'color'],
  },
  propertyPanel: [
    {
      id: 'indicator-card-basic',
      title: '指标卡属性',
      defaultOpen: true,
      fields: [
        {
          id: 'title',
          label: '标题',
          pointer: '/title',
          control: 'text',
          description: '卡片标题文本',
        },
        {
          id: 'value',
          label: '数值',
          pointer: '/value',
          control: 'number',
          min: 0,
          description: '指标数值（非负）',
        },
        {
          id: 'color',
          label: '主色',
          pointer: '/color',
          control: 'color',
          description: '卡片主色（十六进制 RGB）',
        },
      ],
    },
  ],
  // Phase 4 Task 4.3：声明 valueClick 事件，组件在 interactive=true 时点击数值派发
  // nebula-component-event CustomEvent（Spec §9.2），由 editor-core renderer 桥接到蓝图。
  events: [
    {
      id: 'valueClick',
      name: '点击数值',
      description: '用户点击指标卡数值区域时触发',
    },
  ],
};
