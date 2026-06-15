/**
 * Standalone build config for the Uganda National Bridge Management System.
 *   npx vite build --config vite.nbms.config.ts
 * Outputs to dist-nbms/ with base /uganda_nbms/ for GitHub Pages at
 * networkengineringmowt-ai.github.io/uganda_nbms/. The HTML entry is
 * index.nbms.html (renamed to index.html in the deploy step).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/uganda_nbms/' : '/',
  define: {
    'import.meta.env.VITE_STANDALONE_NBMS': JSON.stringify('1'),
  },
  build: {
    outDir: 'dist-nbms',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.nbms.html'),
    },
  },
});
