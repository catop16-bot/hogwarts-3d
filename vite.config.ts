import { defineConfig } from 'vite';

// base: './' 讓打包結果可以直接放到 GitHub Pages 的任何子路徑
export default defineConfig({
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
