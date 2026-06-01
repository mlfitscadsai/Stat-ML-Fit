import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { analyzer } from 'vite-bundle-analyzer'
import { manualChunkFor, DEFERRED_PRELOAD_CHUNKS } from './vite/chunks.js'

// In CI/Docker, disable analyzer (no xdg-open) or use static mode without opening browser
const isCI = process.env.CI === 'true' || process.env.DOCKER_BUILD === 'true'
const analyzerPlugin = isCI
    ? analyzer({ enabled: false })
    : analyzer({ openAnalyzer: false })

export default defineConfig({
    plugins: [vue(), analyzerPlugin],
    // Important: Set the root directory
    root: process.cwd(),

    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    },

    server: {
        port: 3000,
        open: true // automatically open browser
    },

    build: {
        outDir: 'dist',
        emptyOutDir: true,
        modulePreload: {
            resolveDependencies(_filename, deps) {
                return deps.filter((dep) =>
                    !DEFERRED_PRELOAD_CHUNKS.some((name) => dep.includes(name))
                );
            },
        },
        chunkSizeWarningLimit: 6000,
        rollupOptions: {
            output: {
                manualChunks: manualChunkFor,
            },
        },
    }
})