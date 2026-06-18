// watcher.mjs — auto build-and-deploy watcher for the Uganda NRMS platform.
// Watches the G: project, debounces, runs a full build, then deploys dist/ to
// gh-pages. Build + deploy happen entirely within this project folder (G:) —
// outDir is ./dist and gh-pages publishes from ./dist; no C:\tmp, no D:\.
//
//   node watcher.mjs            (foreground)
//   npm run watch               (same)
//   start-watcher.ps1           (background + log tail)
//
// Every attempt/result/deploy is appended to uganda-roads-watcher.log.
import chokidar from 'chokidar';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(ROOT, 'uganda-roads-watcher.log');
const DEBOUNCE_MS = 2000;

// Optional Drive data sources synced into public/data before each build.
const DATA_SOURCES = [path.join(ROOT, '..', 'data'), path.join(ROOT, '..', 'assets')];
const PUBLIC_DATA = path.join(ROOT, 'public', 'data');

const WATCH = ['src', 'public', 'index.html', 'vite.config.ts', 'package.json', 'tsconfig.json',
  'tsconfig.app.json', 'tsconfig.node.json'].map(p => path.join(ROOT, p));
const IGNORE = [/node_modules/, /[/\\]dist/, /\.git/, /\.log$/, /uganda-roads-watcher/];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(LOG, line); } catch { /* ignore */ }
}

function run(cmd, args) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { cwd: ROOT, shell: true });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    p.on('close', code => resolve({ code, out }));
    p.on('error', e => resolve({ code: 1, out: String(e) }));
  });
}

// Copy any newer data files from G:\data / G:\assets into public/data.
function syncDriveData() {
  let copied = 0;
  for (const srcDir of DATA_SOURCES) {
    if (!fs.existsSync(srcDir)) continue;
    fs.mkdirSync(PUBLIC_DATA, { recursive: true });
    for (const f of fs.readdirSync(srcDir)) {
      if (!/\.(geojson|json|csv|xlsx)$/i.test(f)) continue;
      const s = path.join(srcDir, f), d = path.join(PUBLIC_DATA, f);
      try {
        if (!fs.existsSync(d) || fs.statSync(s).mtimeMs > fs.statSync(d).mtimeMs) {
          fs.copyFileSync(s, d); copied++;
        }
      } catch { /* ignore individual file */ }
    }
  }
  if (copied) log(`Synced ${copied} data file(s) into public/data from Drive sources.`);
}

let building = false, pending = false, timer = null;

async function build() {
  if (building) { pending = true; return; }       // coalesce overlapping triggers
  building = true;
  try {
    syncDriveData();
    log('BUILD START — npm run build (cwd=G: project)');
    const b = await run('npm', ['run', 'build']);
    if (b.code !== 0) {
      log(`BUILD FAILED (exit ${b.code}) — ${b.out.split('\n').slice(-12).join(' | ').slice(0, 1200)}`);
      return;
    }
    log('BUILD SUCCESS — deploying dist/ to gh-pages…');
    const d = await run('npx', ['gh-pages', '-d', 'dist', '-b', 'gh-pages', '-f',
      '-m', 'Auto-deploy via watcher']);
    log(d.code === 0 ? 'DEPLOY SUCCESS — gh-pages updated.'
                     : `DEPLOY FAILED (exit ${d.code}) — ${d.out.split('\n').slice(-8).join(' | ').slice(0, 800)}`);
  } finally {
    building = false;
    if (pending) { pending = false; trigger('queued change'); }
  }
}

function trigger(reason) {
  if (timer) clearTimeout(timer);
  log(`CHANGE DETECTED (${reason}) — debouncing ${DEBOUNCE_MS}ms…`);
  timer = setTimeout(() => { timer = null; void build(); }, DEBOUNCE_MS);
}

const watcher = chokidar.watch(WATCH, {
  ignored: IGNORE, ignoreInitial: true, persistent: true,
  awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
});
watcher
  .on('add', p => trigger(`add ${path.relative(ROOT, p)}`))
  .on('change', p => trigger(`change ${path.relative(ROOT, p)}`))
  .on('unlink', p => trigger(`remove ${path.relative(ROOT, p)}`))
  .on('ready', () => log(`Watcher started. Watching: ${WATCH.map(p => path.relative(ROOT, p) || '.').join(', ')}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { log('Watcher stopped.'); watcher.close().finally(() => process.exit(0)); });
}
