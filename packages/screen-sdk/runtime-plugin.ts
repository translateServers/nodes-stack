import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const VIRTUAL_RUNTIME_ID = 'virtual:nebula-screen-editor-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = `\0${VIRTUAL_RUNTIME_ID}`;

export function screenEditorRuntimePlugin(mode: 'build' | 'test'): Plugin {
  const runtimePath =
    mode === 'build'
      ? resolve(
          import.meta.dirname,
          '../../apps/web/src/features/screen/sdk/screen-sdk-runtime.tsx',
        )
      : resolve(import.meta.dirname, './test/element-runtime-fixture.tsx');

  return {
    name: 'nebula-screen-editor-runtime',
    resolveId(id) {
      return id === VIRTUAL_RUNTIME_ID ? RESOLVED_VIRTUAL_RUNTIME_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_RUNTIME_ID) return undefined;
      return `export { mountNebulaScreenEditorRuntime } from ${JSON.stringify(runtimePath.replaceAll('\\', '/'))};`;
    },
  };
}
