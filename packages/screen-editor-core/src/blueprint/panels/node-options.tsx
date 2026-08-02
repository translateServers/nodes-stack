import type { JSX } from 'react';
import {
  Boxes,
  Clock,
  FileText,
  GitBranch,
  MessageSquare,
  MousePointerClick,
  Navigation,
  Send,
  Square,
  Timer,
  Type,
} from 'lucide-react';
import { GLOBAL_COMPONENT_ID, type ScreenComponent } from '@nebula/shared';

export type BlueprintNodeKind = 'component' | 'condition' | 'delay' | 'comment';
export type GlobalNodeType = 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
export type NodeOptionGroup = 'canvas-component' | 'global' | 'logic';

export interface NodeOption {
  readonly id: string;
  readonly kind: BlueprintNodeKind;
  readonly subtype: string;
  readonly globalType?: GlobalNodeType;
  readonly group: NodeOptionGroup;
  readonly componentId?: string;
  readonly label: string;
  readonly description: string;
  readonly icon: JSX.Element;
}

export const NODE_OPTIONS: readonly NodeOption[] = [
  {
    id: 'global.pageLoad',
    kind: 'component',
    subtype: 'globalPageLoad',
    globalType: 'pageLoad',
    group: 'global',
    label: '页面加载触发',
    description: '页面加载完成时触发执行',
    icon: <FileText className="size-4" />,
  },
  {
    id: 'global.navigate',
    kind: 'component',
    subtype: 'globalNavigate',
    globalType: 'navigate',
    group: 'global',
    label: '导航跳转',
    description: '跳转到指定 URL',
    icon: <Navigation className="size-4" />,
  },
  {
    id: 'global.requestApi',
    kind: 'component',
    subtype: 'globalRequestApi',
    globalType: 'requestApi',
    group: 'global',
    label: '请求接口',
    description: '发起 HTTP 请求',
    icon: <Send className="size-4" />,
  },
  {
    id: 'global.scrollTo',
    kind: 'component',
    subtype: 'globalScrollTo',
    globalType: 'scrollTo',
    group: 'global',
    label: '滚动定位',
    description: '滚动到指定组件位置',
    icon: <MousePointerClick className="size-4" />,
  },
  {
    id: 'global.interval',
    kind: 'component',
    subtype: 'globalInterval',
    globalType: 'interval',
    group: 'global',
    label: '定时触发',
    description: '按固定间隔循环触发执行',
    icon: <Timer className="size-4" />,
  },
  {
    id: 'condition',
    kind: 'condition',
    subtype: 'condition',
    group: 'logic',
    label: '条件分支',
    description: '根据条件表达式选择分支执行',
    icon: <GitBranch className="size-4" />,
  },
  {
    id: 'delay',
    kind: 'delay',
    subtype: 'delay',
    group: 'logic',
    label: '延时',
    description: '延时指定毫秒后继续执行',
    icon: <Clock className="size-4" />,
  },
  {
    id: 'comment',
    kind: 'comment',
    subtype: 'comment',
    group: 'logic',
    label: '注释',
    description: '注释节点不参与执行流',
    icon: <MessageSquare className="size-4" />,
  },
];

const componentIcons: Record<string, JSX.Element> = {
  'bar-chart': <Boxes className="size-4" />,
  'line-chart': <Boxes className="size-4" />,
  'pie-chart': <Boxes className="size-4" />,
  table: <Boxes className="size-4" />,
  text: <Type className="size-4" />,
};

export function buildComponentOptions(components: readonly ScreenComponent[]): NodeOption[] {
  return components
    .filter((component) => component.id !== '' && component.id !== GLOBAL_COMPONENT_ID)
    .map((component) => ({
      id: `component.${component.id}`,
      kind: 'component',
      subtype: 'component',
      group: 'canvas-component',
      componentId: component.id,
      label: component.name,
      description: `${component.type} 组件`,
      icon: componentIcons[component.type] ?? <Square className="size-4" />,
    }));
}

export function buildAllNodeOptions(
  components: readonly ScreenComponent[],
  capabilityProfile: 'dynamic' | 'static' = 'dynamic',
): NodeOption[] {
  const staticOptions =
    capabilityProfile === 'static'
      ? NODE_OPTIONS.filter((option) => option.globalType !== 'requestApi')
      : NODE_OPTIONS;
  return [...buildComponentOptions(components), ...staticOptions];
}

export interface PendingConnection {
  readonly sourceNodeId: string;
  readonly sourceHandle: string;
}

export type SearchPanelMode = 'create' | 'connect';

export function isConnectableTarget(option: NodeOption): boolean {
  return (
    option.kind !== 'comment' &&
    option.globalType !== 'pageLoad' &&
    option.globalType !== 'interval'
  );
}
