import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createReadStream, existsSync, statSync } from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';

// ── Map: survey year → UNC base path ────────────────────────────────────────
const ROMDAS_ROOTS: Record<string, string> = {
  '2021-22': '//unrarmssrv/ROADS_VIDEOS/ROMDAS Videos 2021-22',
  '2022-23': '//unrarmssrv/ROADS_VIDEOS/ROMDAS Videos 2022-23',
  '2023-24': '//unrarmssrv/ROADS_VIDEOS_2/ROMDAS Videos 2023-24',
  '2025-26': '//unrarmssrv/ROADS_VIDEOS_3/ROMDAS Videos 2025-26',
};

function serveFile(filePath: string, res: ServerResponse, next: () => void) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.statusCode = 404; res.end(); return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
             : ext === '.png' ? 'image/png'
             : ext === '.bmp' ? 'image/bmp'
             : 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    createReadStream(filePath).pipe(res as unknown as NodeJS.WritableStream);
  } catch { next(); }
}

type MiddlewareServer = { middlewares: { use: (p: string, fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } };

// ─── Photos middleware (S:\PHOTOS → /s-photos/) ──────────────────────────────
const photosMiddlewarePlugin = {
  name: 'photos-server',
  configureServer(server: MiddlewareServer) {
    server.middlewares.use('/s-photos', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      try {
        const rel  = decodeURIComponent(req.url ?? '/').replace(/\.\./g, '');
        serveFile(path.join('S:\\PHOTOS', rel), res, next);
      } catch { next(); }
    });
  },
};

// ─── ROMDAS frames middleware (/romdas/{year}/{link}/{subdir}/{file}) ─────────
// e.g. GET /romdas/2025-26/A001_LINK01/PAVE-0/A001_LINK01-PAVE-0-00042.jpg
const romdasMiddlewarePlugin = {
  name: 'romdas-server',
  configureServer(server: MiddlewareServer) {
    server.middlewares.use('/romdas', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      try {
        const parts = decodeURIComponent(req.url ?? '/').replace(/\.\./g, '').replace(/^\//, '').split('/');
        if (parts.length < 4) { res.statusCode = 400; res.end('Bad Request'); return; }
        const [year, linkDir, subDir, ...rest] = parts;
        const root = ROMDAS_ROOTS[year];
        if (!root) { res.statusCode = 404; res.end('Unknown year'); return; }
        const filePath = path.join(root, linkDir, subDir, rest.join('/'));
        serveFile(filePath, res, next);
      } catch { next(); }
    });
  },
};

export default defineConfig({
  plugins: [react(), photosMiddlewarePlugin, romdasMiddlewarePlugin],
  // GitHub Pages: set base to match the repo name so assets resolve correctly.
  // Change 'BMS_System' here if you name the GitHub repo differently.
  base: process.env.NODE_ENV === 'production' ? '/uganda-roads/' : '/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    open: false,
    fs: { allow: ['..'] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-leaflet':  ['leaflet', 'react-leaflet'],
          'vendor-recharts': ['recharts'],
          'vendor-uuid':     ['uuid'],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
