import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// Vue SPA · 极简部署：不用 SW · 全部缓存交给 nginx (index.html no-cache + hashed assets immutable)
// 老用户的 SW 由 public/sw.js（kill-switch）一次性 unregister
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 7110,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:7100',
        changeOrigin: true,
      },
    },
  },
  plugins: [vue()],
});
