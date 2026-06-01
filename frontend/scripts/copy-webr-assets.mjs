/**
 * Copy webr WASM/worker assets into public/ for same-origin loading (avoids CDN CORS/Content-Encoding issues).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const src = path.join(frontendRoot, 'node_modules', 'webr', 'dist');
const dest = path.join(frontendRoot, 'public', 'webr', 'dist');

if (!fs.existsSync(src)) {
  console.warn('[copy-webr-assets] webr not installed, skipping');
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });

// Service worker must live under serviceWorkerUrl prefix (/webr/)
const swDest = path.join(frontendRoot, 'public', 'webr');
for (const file of ['webr-serviceworker.js', 'webr-worker.js']) {
  fs.copyFileSync(path.join(src, file), path.join(swDest, file));
}

console.log(`[copy-webr-assets] Copied webr dist → public/webr/dist (${dest})`);
