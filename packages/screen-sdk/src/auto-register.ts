import { defineNebulaScreenEditor } from './element/define.js';
import type { NebulaScreenEditorElement } from './element/nebula-screen-editor-element.js';

defineNebulaScreenEditor();

declare global {
  interface HTMLElementTagNameMap {
    'nebula-screen-editor': NebulaScreenEditorElement;
  }
}
