import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'chrome120',
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
