import type { ComponentDefinition, ScreenComponent } from '@nebula/shared';

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    type: 'text',
    name: '文本',
    category: 'text',
    icon: 'Type',
    defaultProps: { content: '请输入文本' },
    defaultSize: { width: 200, height: 60 },
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
];

export function getDefinitionByType(type: string): ComponentDefinition | undefined {
  return COMPONENT_DEFINITIONS.find((d) => d.type === type);
}

export function createComponentInstance(
  type: string,
  x: number,
  y: number,
  zIndex: number,
  existingComponents: ScreenComponent[],
): ScreenComponent | null {
  const def = getDefinitionByType(type);
  if (!def) return null;

  const sameTypeCount = existingComponents.filter((c) => c.type === type).length;
  const name = sameTypeCount > 0 ? `${def.name} ${sameTypeCount + 1}` : def.name;

  return {
    id: crypto.randomUUID(),
    type: def.type,
    name,
    position: { x, y, width: def.defaultSize.width, height: def.defaultSize.height },
    style: {
      opacity: 1,
      borderWidth: 0,
      borderRadius: 0,
      overflow: 'hidden',
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
