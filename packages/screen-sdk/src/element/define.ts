import { NebulaScreenEditorElement } from './nebula-screen-editor-element.js';

export const NEBULA_SCREEN_EDITOR_TAG_NAME = 'nebula-screen-editor';

export function defineNebulaScreenEditor(
  registry: CustomElementRegistry | undefined = globalThis.customElements,
): void {
  if (registry === undefined || registry.get(NEBULA_SCREEN_EDITOR_TAG_NAME) !== undefined) return;
  registry.define(NEBULA_SCREEN_EDITOR_TAG_NAME, NebulaScreenEditorElement);
}
