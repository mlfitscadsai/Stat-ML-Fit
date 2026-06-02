/**
 * Copy danfo's prebuilt webpack bundle for classic script loading.
 * Avoids Vite/Rollup circular-init errors (Cannot access 'mR' before initialization).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const src = path.join(frontendRoot, 'node_modules', 'danfojs', 'lib', 'bundle.js');
const destDir = path.join(frontendRoot, 'public', 'vendor');
const dest = path.join(destDir, 'danfo.bundle.js');

if (!fs.existsSync(src)) {
  console.warn('[copy-danfo-bundle] danfojs not installed, skipping');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[copy-danfo-bundle] Copied → public/vendor/danfo.bundle.js`);
