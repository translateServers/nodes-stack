// Internal ambient declaration for the Vite virtual module.
// This file lives outside `src/` so the dts plugin (entryRoot: 'src') does not
// bundle it into the public declaration output, keeping the virtual runtime
// path private to the SDK build.
declare module 'virtual:nebula-screen-editor-runtime' {
  export const mountNebulaScreenEditorRuntime: import('../src/element/runtime.js').MountScreenEditorRuntime;
}
