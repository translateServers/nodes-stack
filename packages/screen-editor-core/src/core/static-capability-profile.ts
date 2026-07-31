export const SCREEN_SDK_COMPONENT_TYPES = [
  'text',
  'bar-chart',
  'rect',
  'ellipse',
  'image',
  'button',
] as const;

export const SCREEN_SDK_BLUEPRINT_NODE_KINDS = [
  'component',
  'condition',
  'delay',
  'comment',
] as const;

export const SCREEN_SDK_GLOBAL_COMPONENT_TYPES = [
  'pageLoad',
  'interval',
  'navigate',
  'scrollTo',
] as const;

export const SCREEN_SDK_COMPONENT_EVENT_HANDLES = ['evt:click', 'evt:hover'] as const;
export const SCREEN_SDK_COMPONENT_ACTION_HANDLES = [
  'act:show',
  'act:hide',
  'act:toggleVisibility',
] as const;

export const SCREEN_SDK_V1_TRIGGER_TYPES = [
  'componentClick',
  'componentHover',
  'pageLoad',
  'interval',
] as const;

export const SCREEN_SDK_V1_ACTION_TYPES = [
  'setVisibility',
  'navigate',
  'scrollToComponent',
] as const;

const NODE_KIND_SET: ReadonlySet<string> = new Set(SCREEN_SDK_BLUEPRINT_NODE_KINDS);
const GLOBAL_COMPONENT_TYPE_SET: ReadonlySet<string> = new Set(SCREEN_SDK_GLOBAL_COMPONENT_TYPES);
const V1_TRIGGER_TYPE_SET: ReadonlySet<string> = new Set(SCREEN_SDK_V1_TRIGGER_TYPES);
const V1_ACTION_TYPE_SET: ReadonlySet<string> = new Set(SCREEN_SDK_V1_ACTION_TYPES);

export function isScreenSdkBlueprintNodeKind(value: unknown): boolean {
  return typeof value === 'string' && NODE_KIND_SET.has(value);
}

export function isScreenSdkGlobalComponentType(value: unknown): boolean {
  return typeof value === 'string' && GLOBAL_COMPONENT_TYPE_SET.has(value);
}

export function isScreenSdkV1TriggerType(value: unknown): boolean {
  return typeof value === 'string' && V1_TRIGGER_TYPE_SET.has(value);
}

export function isScreenSdkV1ActionType(value: unknown): boolean {
  return typeof value === 'string' && V1_ACTION_TYPE_SET.has(value);
}

export interface ScreenSdkBlueprintNodeCapability {
  globalType?: string;
  kind: string;
}

export function getScreenSdkSourceHandles(
  node: ScreenSdkBlueprintNodeCapability,
): ReadonlySet<string> {
  if (node.kind === 'condition') return new Set(['then', 'else']);
  if (node.kind === 'delay') return new Set(['out']);
  if (node.kind === 'comment') return new Set();
  if (node.globalType === 'pageLoad') return new Set(['evt:pageLoad']);
  if (node.globalType === 'interval') return new Set(['evt:interval']);
  if (node.globalType !== undefined) return new Set();
  return new Set(SCREEN_SDK_COMPONENT_EVENT_HANDLES);
}

export function getScreenSdkTargetHandles(
  node: ScreenSdkBlueprintNodeCapability,
): ReadonlySet<string> {
  if (node.kind === 'condition' || node.kind === 'delay') return new Set(['in']);
  if (node.kind === 'comment') return new Set();
  if (node.globalType === 'navigate') return new Set(['act:navigate']);
  if (node.globalType === 'scrollTo') return new Set(['act:scrollTo']);
  if (node.globalType !== undefined) return new Set();
  return new Set(SCREEN_SDK_COMPONENT_ACTION_HANDLES);
}

export const SCREEN_SDK_STATIC_CAPABILITY_PROFILE = {
  componentTypes: SCREEN_SDK_COMPONENT_TYPES,
  blueprintNodeKinds: SCREEN_SDK_BLUEPRINT_NODE_KINDS,
  globalComponentTypes: SCREEN_SDK_GLOBAL_COMPONENT_TYPES,
  componentEventHandles: SCREEN_SDK_COMPONENT_EVENT_HANDLES,
  componentActionHandles: SCREEN_SDK_COMPONENT_ACTION_HANDLES,
  supportsBusinessFetch: false,
  supportsDynamicDataSources: false,
} as const;
