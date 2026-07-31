import '@testing-library/jest-dom/vitest';
import { TEST_DYNAMIC_RUNTIME_PROFILE } from './fetch-runtime-profile.js';

vi.mock('../src/runtime-profile.tsx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/runtime-profile.js')>()),
  DYNAMIC_SCREEN_EDITOR_RUNTIME_FALLBACK: TEST_DYNAMIC_RUNTIME_PROFILE,
}));

if (typeof document.elementsFromPoint !== 'function') {
  document.elementsFromPoint = () => [];
}
