/**
 * Standalone build config for the Uganda National Traffic Information System.
 *   npx vite build --config vite.ntis.config.ts
 * Outputs to dist-ntis/ with base /uganda_ntis/ for GitHub Pages at
 * networkengineringmowt-ai.github.io/uganda_ntis/. The HTML entry is
 * index.ntis.html (renamed to index.html in the deploy step).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/uganda_ntis/' : '/',
  define: {
    'import.meta.env.VITE_STANDALONE': JSON.stringify('1'),
    'import.meta.env.VITE_APP_ID': JSON.stringify('ntis'),
  },
  build: {
    outDir: 'dist-ntis',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.ntis.html'),
    },
  },
});
