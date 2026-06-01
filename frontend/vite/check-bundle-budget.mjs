import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_LIMIT_KB = Number(process.env.BUNDLE_BUDGET_KB || 4500);
const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url));

async function collectFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
        else files.push(fullPath);
    }
    return files;
}

try {
    const files = await collectFiles(assetsDir);
    const oversized = [];
    for (const file of files) {
        if (!file.endsWith('.js')) continue;
        const info = await stat(file);
        const sizeKb = info.size / 1024;
        if (sizeKb > DEFAULT_LIMIT_KB) {
            oversized.push({ file, sizeKb: Math.round(sizeKb) });
        }
    }

    if (oversized.length) {
        console.warn(`[bundle-budget] ${oversized.length} chunk(s) exceed ${DEFAULT_LIMIT_KB} KB:`);
        for (const item of oversized) {
            console.warn(`- ${item.file}: ${item.sizeKb} KB`);
        }
    } else {
        console.log(`[bundle-budget] All JS chunks are under ${DEFAULT_LIMIT_KB} KB.`);
    }
} catch (error) {
    console.warn(`[bundle-budget] Skipped: ${error.message}`);
}
