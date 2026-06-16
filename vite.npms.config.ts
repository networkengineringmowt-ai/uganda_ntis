/**
 * Standalone build config for the Uganda National Pavement Management System.
 *   npx vite build --config vite.npms.config.ts
 * Outputs to dist-npms/ with base /uganda_npms/ for GitHub Pages at
 * networkengineringmowt-ai.github.io/uganda_npms/. The HTML entry is
 * index.npms.html (renamed to index.html in the deploy step).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/uganda_npms/' : '/',
  define: {
    'import.meta.env.VITE_STANDALONE': JSON.stringify('1'),
    'import.meta.env.VITE_APP_ID': JSON.stringify('npms'),
  },
  build: {
    outDir: 'dist-npms',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.npms.html'),
    },
  },
});
