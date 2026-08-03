import { defineNebulaScreenEditor } from './element/define.js';
import { configureRuntimeMountLoader } from './element/runtime-loader.js';

configureRuntimeMountLoader(() => import('./runtime/react-runtime.js'));
defineNebulaScreenEditor();
