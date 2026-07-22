import type { ComponentDefinition, ScreenComponent } from '@nebula/shared';

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    type: 'text',
    name: '文本',
    category: 'text',
    icon: 'Type',
    keywords: ['文本', '文字', 'text', 'title', '标题', '段落'],
    description: '可编辑的文本段落，支持字号、字色、对齐等样式',
    defaultProps: { content: '请输入文本' },
    defaultSize: { width: 200, height: 60 },
    defaultStyle: { color: '#ffffff', fontSize: 14 },
    order: 1,
  },
  {
    type: 'bar-chart',
    name: '柱状图',
    category: 'chart',
    icon: 'BarChart3',
    keywords: ['柱状图', '图表', 'chart', 'bar', '数据图', '可视化', '统计图'],
    description: '柱状图，支持静态数据 / API 数据源、字段映射与排序',
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
    order: 1,
  },
  // 任务 6.2：矩形与椭圆组件定义
  {
    type: 'rect',
    name: '矩形',
    category: 'decoration',
    icon: 'Square',
    keywords: ['矩形', '方形', 'rect', 'rectangle', '框', '色块'],
    description: '矩形装饰元素，支持背景色 / 边框 / 圆角',
    defaultProps: {},
    defaultSize: { width: 200, height: 120 },
    defaultStyle: {
      backgroundColor: '#3b82f6',
      borderWidth: 0,
      borderColor: '#1e40af',
      borderRadius: 0,
    },
    order: 1,
  },
  {
    type: 'ellipse',
    name: '椭圆',
    category: 'decoration',
    icon: 'Circle',
    keywords: ['椭圆', '圆形', '圆', 'ellipse', 'circle', '球'],
    description: '椭圆装饰元素，常用于头像/标记位',
    defaultProps: {},
    defaultSize: { width: 200, height: 200 },
    defaultStyle: {
      backgroundColor: '#10b981',
      borderWidth: 0,
      borderColor: '#047857',
    },
    order: 2,
  },
  // 任务 7.2：图片组件定义
  {
    type: 'image',
    name: '图片',
    category: 'media',
    icon: 'Image',
    keywords: ['图片', '图像', 'image', 'img', '照片', 'picture', 'logo'],
    description: '图片组件，支持 src / alt 与圆角裁剪',
    defaultProps: { src: '', alt: '' },
    defaultSize: { width: 320, height: 240 },
    defaultStyle: {},
    order: 1,
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
  return COMPONENT_DEFINITIONS.filter((d) => d.category === category).sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });
}

/**
 * 按 name / type / keywords 模糊匹配（大小写不敏感）。
 *
 * 用于组件库搜索：用户输入 'zhexian' / '趋势' 等别名时可命中。
 * 空关键词返回全部定义。
 */
export function searchComponentDefinitions(keyword: string): ComponentDefinition[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return COMPONENT_DEFINITIONS;
  return COMPONENT_DEFINITIONS.filter((d) => {
    if (d.name.toLowerCase().includes(kw)) return true;
    if (d.type.toLowerCase().includes(kw)) return true;
    if (d.keywords !== undefined && d.keywords.some((k) => k.toLowerCase().includes(kw))) {
      return true;
    }
    return false;
  });
}

export const CATEGORY_LABELS: Record<string, string> = {
  chart: '图表',
  text: '文本',
  media: '媒体',
  decoration: '装饰',
  table: '表格',
  container: '容器',
};
