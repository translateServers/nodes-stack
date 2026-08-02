import type { ScreenSdkComponentType, StaticDataSourceConfig } from '../contracts/document.js';

export interface ScreenSdkComponentDefinition {
  actions: readonly ['show', 'hide', 'toggleVisibility'];
  defaultDataSource?: StaticDataSourceConfig;
  defaultProps: Record<string, unknown>;
  defaultSize: { height: number; width: number };
  events: readonly ['click', 'hover'];
  name: string;
  type: ScreenSdkComponentType;
}

const DEFAULT_EVENTS = ['click', 'hover'] as const;
const DEFAULT_ACTIONS = ['show', 'hide', 'toggleVisibility'] as const;

function defineComponent(
  definition: Omit<ScreenSdkComponentDefinition, 'actions' | 'events'>,
): ScreenSdkComponentDefinition {
  return { ...definition, events: DEFAULT_EVENTS, actions: DEFAULT_ACTIONS };
}

export const SCREEN_SDK_COMPONENT_DEFINITIONS: readonly ScreenSdkComponentDefinition[] = [
  defineComponent({
    type: 'text',
    name: '文本',
    defaultProps: { content: '请输入文本' },
    defaultSize: { width: 200, height: 60 },
  }),
  defineComponent({
    type: 'bar-chart',
    name: '柱状图',
    defaultProps: { title: '柱状图' },
    defaultDataSource: {
      type: 'static',
      staticData: [
        { name: 'A', value: 120 },
        { name: 'B', value: 200 },
        { name: 'C', value: 150 },
        { name: 'D', value: 80 },
        { name: 'E', value: 170 },
      ],
    },
    defaultSize: { width: 400, height: 300 },
  }),
  defineComponent({
    type: 'rect',
    name: '矩形',
    defaultProps: {},
    defaultSize: { width: 200, height: 120 },
  }),
  defineComponent({
    type: 'ellipse',
    name: '椭圆',
    defaultProps: {},
    defaultSize: { width: 200, height: 200 },
  }),
  defineComponent({
    type: 'image',
    name: '图片',
    defaultProps: { src: '', alt: '' },
    defaultSize: { width: 320, height: 240 },
  }),
  defineComponent({
    type: 'button',
    name: '按钮',
    defaultProps: { text: '按钮' },
    defaultSize: { width: 120, height: 48 },
  }),
];

export function getScreenSdkComponentDefinition(
  type: ScreenSdkComponentType,
): ScreenSdkComponentDefinition {
  const definition = SCREEN_SDK_COMPONENT_DEFINITIONS.find((candidate) => candidate.type === type);
  if (definition === undefined) throw new Error(`Missing SDK component definition: ${type}`);
  return definition;
}
