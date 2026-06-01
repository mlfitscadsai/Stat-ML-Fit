import { describe, expect, it } from 'vitest';
import { manualChunkFor } from '../../vite/chunks.js';

describe('build chunk strategy', () => {
    it('groups heavyweight ML and visualization dependencies into named chunks', () => {
        expect(manualChunkFor('/node_modules/plotly.js/dist/plotly.js')).toBe('viz-plotly');
        expect(manualChunkFor('/node_modules/@tensorflow/tfjs/dist/tf.js')).toBe('ml-tensorflow');
        expect(manualChunkFor('/node_modules/danfojs/dist/index.js')).toBe('data-danfo');
        expect(manualChunkFor('/node_modules/@huggingface/transformers/dist/index.js')).toBe('assistant-gemma');
        expect(manualChunkFor('/node_modules/vue/dist/vue.runtime.esm-bundler.js')).toBe('vendor-vue');
    });
});
