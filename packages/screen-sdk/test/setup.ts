vi.mock('../src/runtime/static-runtime.tsx', () => import('./element-runtime-fixture.js'));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
