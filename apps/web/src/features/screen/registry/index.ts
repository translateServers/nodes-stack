import type { ComponentDefinition, ScreenComponent } from '@nebula/shared';

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    type: 'text',
    name: '文本',
    category: 'text',
    icon: 'Type',
    defaultProps: { content: '请输入文本' },
    defaultSize: { width: 200, height: 60 },
    defaultStyle: { color: '#ffffff', fontSize: 14 },
  },
  {
    type: 'bar-chart',
    name: '柱状图',
    category: 'chart',
    icon: 'BarChart3',
    defaultProps: {
      title: '柱状图',
      data: [
        { name: 'A', value: 120 },
        { name: 'B', value: 200 },
        { name: 'C', value: 150 },
        { name: 'D', value: 80 },
        { name: 'E', value: 170 },
      ],
    },
    defaultSize: { width: 400, height: 300 },
  },
  // 任务 6.2：矩形与椭圆组件定义
  {
    type: 'rect',
    name: '矩形',
    category: 'decoration',
    icon: 'Square',
    defaultProps: {},
    defaultSize: { width: 200, height: 120 },
    defaultStyle: {
      backgroundColor: '#3b82f6',
      borderWidth: 0,
      borderColor: '#1e40af',
      borderRadius: 0,
    },
  },
  {
    type: 'ellipse',
    name: '椭圆',
    category: 'decoration',
    icon: 'Circle',
    defaultProps: {},
    defaultSize: { width: 200, height: 200 },
    defaultStyle: {
      backgroundColor: '#10b981',
      borderWidth: 0,
      borderColor: '#047857',
    },
  },
  // 任务 7.2：图片组件定义
  {
    type: 'image',
    name: '图片',
    category: 'media',
    icon: 'Image',
    defaultProps: { src: '', alt: '' },
    defaultSize: { width: 320, height: 240 },
    defaultStyle: {},
  },
];

export function getDefinitionByType(type: string): ComponentDefinition | undefined {
  return COMPONENT_DEFINITIONS.find((d) => d.type === type);
}

/**
 * 创建组件实例的选项。
 *
 * - `customSize`：拖拽创建时传入自定义尺寸，覆盖 defaultSize（任务 6.3/6.4 使用）
 */
export interface CreateComponentInstanceOptions {
  /** 自定义尺寸（拖拽创建时传入，覆盖默认尺寸） */
  readonly customSize?: { readonly width: number; readonly height: number };
}

export function createComponentInstance(
  type: string,
  x: number,
  y: number,
  zIndex: number,
  existingComponents: ScreenComponent[],
  options?: CreateComponentInstanceOptions,
): ScreenComponent | null {
  const def = getDefinitionByType(type);
  if (!def) return null;

  const sameTypeCount = existingComponents.filter((c) => c.type === type).length;
  const name = sameTypeCount > 0 ? `${def.name} ${sameTypeCount + 1}` : def.name;

  // 拖拽创建时使用 customSize，组件库拖入时使用 defaultSize
  const width = options?.customSize?.width ?? def.defaultSize.width;
  const height = options?.customSize?.height ?? def.defaultSize.height;

  return {
    id: crypto.randomUUID(),
    type: def.type,
    name,
    position: { x, y, width, height },
    style: {
      opacity: 1,
      borderWidth: 0,
      borderRadius: 0,
      overflow: 'hidden',
      ...def.defaultStyle,
    },
    props: structuredClone(def.defaultProps),
    status: { locked: false, hidden: false },
    zIndex,
    parentId: null,
  };
}

export function getDefinitionsByCategory(category: string): ComponentDefinition[] {
  return COMPONENT_DEFINITIONS.filter((d) => d.category === category);
}

export const CATEGORY_LABELS: Record<string, string> = {
  chart: '图表',
  text: '文本',
  media: '媒体',
  decoration: '装饰',
  table: '表格',
  container: '容器',
};
