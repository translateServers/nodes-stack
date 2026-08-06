import { createRoot } from 'react-dom/client';
import { createMountScreenEditorRuntime } from './mount-runtime.js';

export const mountNebulaScreenEditorRuntime = createMountScreenEditorRuntime(createRoot);
