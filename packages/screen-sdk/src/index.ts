export * from '@nebula/screen-editor-core/sdk-public';
export * from './element/index.js';

import type { NebulaScreenEditorElement } from './element/nebula-screen-editor-element.js';

declare global {
  interface HTMLElementTagNameMap {
    'nebula-screen-editor': NebulaScreenEditorElement;
  }
}
