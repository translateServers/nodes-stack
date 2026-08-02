import { GLOBAL_COMPONENT_ID, type BlueprintNode } from '@nebula/shared';

export function getNodeLocateComponentId(node: BlueprintNode): string | undefined {
  if (node.kind !== 'component') {
    return undefined;
  }
  if (node.config?.globalType === 'scrollTo') {
    return node.config.targetComponentId || undefined;
  }
  return node.componentId === GLOBAL_COMPONENT_ID ? undefined : node.componentId || undefined;
}
