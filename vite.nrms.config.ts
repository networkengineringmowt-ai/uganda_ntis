/**
 * Standalone build config for the full Uganda National Roads Management System.
 *   npx vite build --config vite.nrms.config.ts
 * Outputs to dist-nrms/ with base /uganda_nrms/ for GitHub Pages at
 * networkengineringmowt-ai.github.io/uganda_nrms/. This is the FULL platform
 * (all sections + sidebar) — NOT a single-section standalone, so VITE_STANDALONE
 * is intentionally NOT set (cross-section nav stays). The HTML entry is
 * index.nrms.html (renamed to index.html in the deploy step).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/uganda_nrms/' : '/',
  define: {
    'import.meta.env.VITE_APP_ID': JSON.stringify('nrms'),
  },
  build: {
    outDir: 'dist-nrms',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.nrms.html'),
    },
  },
});
