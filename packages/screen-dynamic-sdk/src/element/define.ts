/**
 * screen-dynamic-sdk 元素注册。
 */

import { NebulaScreenDesignerElement } from './nebula-screen-designer-element.js';
import { NebulaScreenViewerElement } from './nebula-screen-viewer-element.js';

export const NEBULA_SCREEN_DESIGNER_TAG_NAME = 'nebula-screen-designer';
export const NEBULA_SCREEN_VIEWER_TAG_NAME = 'nebula-screen-viewer';

export function defineNebulaScreenDesigner(
  registry: CustomElementRegistry | undefined = globalThis.customElements,
): void {
  if (registry === undefined || registry.get(NEBULA_SCREEN_DESIGNER_TAG_NAME) !== undefined) return;
  registry.define(NEBULA_SCREEN_DESIGNER_TAG_NAME, NebulaScreenDesignerElement);
}

export function defineNebulaScreenViewer(
  registry: CustomElementRegistry | undefined = globalThis.customElements,
): void {
  if (registry === undefined || registry.get(NEBULA_SCREEN_VIEWER_TAG_NAME) !== undefined) return;
  registry.define(NEBULA_SCREEN_VIEWER_TAG_NAME, NebulaScreenViewerElement);
}

export function defineNebulaScreenDynamicElements(
  registry: CustomElementRegistry | undefined = globalThis.customElements,
): void {
  defineNebulaScreenDesigner(registry);
  defineNebulaScreenViewer(registry);
}

export function isNebulaScreenDynamicElement(value: unknown): boolean {
  return value instanceof NebulaScreenDesignerElement || value instanceof NebulaScreenViewerElement;
}
