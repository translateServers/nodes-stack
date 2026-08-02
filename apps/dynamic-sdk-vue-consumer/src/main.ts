/**
 * Vue 3 Consumer：验证 @nebula/screen-dynamic-sdk 在 Vue 3 + Vite 8 应用中
 * 真实挂载 designer 与 viewer 并执行 fake 数据 smoke（A1-GATE）。
 */

import { createApp } from 'vue';
import '@nebula/screen-dynamic-sdk/auto-register';
import App from './App.vue';

createApp(App).mount('#app');
