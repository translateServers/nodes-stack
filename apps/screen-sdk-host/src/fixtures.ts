import type { ScreenProjectEnvelopeInput, StaticScreenComponent } from '@nebula/screen-sdk';

const COMPONENT_STATUS = { hidden: false, locked: false } as const;

function createComponents(prefix: string): StaticScreenComponent[] {
  return [
    {
      id: `${prefix}-text`,
      name: '标题文字',
      type: 'text',
      position: { x: 72, y: 60, width: 520, height: 92 },
      props: { content: `${prefix.toUpperCase()} 静态运营看板` },
      style: {
        color: '#17212b',
        fontSize: 34,
        fontWeight: '700',
        lineHeight: 1.2,
        textAlign: 'left',
      },
      status: COMPONENT_STATUS,
      zIndex: 1,
    },
    {
      id: `${prefix}-bar-chart`,
      name: '季度销售额',
      type: 'bar-chart',
      position: { x: 72, y: 190, width: 620, height: 390 },
      props: { title: '季度销售额' },
      style: { backgroundColor: '#ffffff', borderRadius: 6 },
      dataSource: {
        type: 'static',
        staticData: [
          { name: 'Q1', value: 148 },
          { name: 'Q2', value: 196 },
          { name: 'Q3', value: 224 },
          { name: 'Q4', value: 281 },
        ],
        fieldMapping: { dimension: 'name', value: 'value' },
      },
      status: COMPONENT_STATUS,
      zIndex: 2,
    },
    {
      id: `${prefix}-rect`,
      name: '指标底板',
      type: 'rect',
      position: { x: 742, y: 190, width: 260, height: 180 },
      props: {},
      style: {
        backgroundColor: '#dff3e8',
        borderColor: '#4c956c',
        borderRadius: 6,
        borderWidth: 2,
      },
      status: COMPONENT_STATUS,
      zIndex: 3,
    },
    {
      id: `${prefix}-ellipse`,
      name: '状态圆',
      type: 'ellipse',
      position: { x: 1050, y: 190, width: 180, height: 180 },
      props: {},
      style: { backgroundColor: '#f7d774', borderColor: '#a96f13', borderWidth: 2 },
      status: COMPONENT_STATUS,
      zIndex: 4,
    },
    {
      id: `${prefix}-image`,
      name: '品牌图形',
      type: 'image',
      position: { x: 742, y: 420, width: 260, height: 160 },
      props: {
        alt: 'Nebula fixture',
        src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="260" height="160"%3E%3Crect width="260" height="160" fill="%2317212b"/%3E%3Ccircle cx="92" cy="80" r="42" fill="%234c956c"/%3E%3Cpath d="M134 42h68v76h-68z" fill="%23f7d774"/%3E%3C/svg%3E',
      },
      style: { objectFit: 'cover', borderRadius: 6 },
      status: COMPONENT_STATUS,
      zIndex: 5,
    },
    {
      id: `${prefix}-button`,
      name: '查看详情',
      type: 'button',
      position: { x: 1050, y: 450, width: 180, height: 64 },
      props: { text: '查看详情' },
      style: {
        backgroundColor: '#17212b',
        borderRadius: 6,
        color: '#ffffff',
        fontSize: 18,
      },
      status: COMPONENT_STATUS,
      zIndex: 6,
    },
  ];
}

function createFixtureProject(
  id: string,
  name: string,
  backgroundColor: string,
): ScreenProjectEnvelopeInput {
  return {
    id,
    name,
    description: 'Vanilla TypeScript reference host',
    status: 'draft',
    revision: `seed:${id}`,
    document: {
      schemaVersion: 1,
      canvas: {
        width: 1320,
        height: 680,
        backgroundColor,
        scaleMode: 'fit',
      },
      components: createComponents(id),
      blueprint: { version: 2, nodes: [], edges: [] },
      globalVariables: [
        {
          id: `${id}-region`,
          name: 'region',
          type: 'static',
          value: id === 'project-a' ? '华东' : '华南',
          description: '区域筛选值',
        },
      ],
    },
  };
}

export function createFixtureProjects(): ScreenProjectEnvelopeInput[] {
  return [
    createFixtureProject('project-a', '华东运营看板', '#eef5f1'),
    createFixtureProject('project-b', '华南运营看板', '#f7f2df'),
  ];
}
