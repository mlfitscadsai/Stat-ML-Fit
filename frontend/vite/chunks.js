const CHUNK_RULES = [
    { chunk: 'assistant-gemma', match: ['@huggingface/transformers', '@kessler/gemma-agent', 'onnxruntime'] },
    { chunk: 'viz-plotly', match: ['plotly.js'] },
    { chunk: 'viz-highcharts', match: ['highcharts'] },
    { chunk: 'vendor-vue', match: ['vue', 'pinia', 'buefy', 'bulma'] },
];

/** Never bundle danfo/tensorflow through Vite (TDZ / white screen). Loaded via public/vendor/danfo.bundle.js */
const EXCLUDE_FROM_BUNDLE = ['danfojs/', '@tensorflow/'];

export function manualChunkFor(id = '') {
    if (!id.includes('node_modules')) return undefined;
    const normalized = id.replace(/\\/g, '/');
    if (EXCLUDE_FROM_BUNDLE.some((pkg) => normalized.includes(`/node_modules/${pkg}`))) {
        return undefined;
    }
    const rule = CHUNK_RULES.find(({ match }) =>
        match.some((name) => normalized.includes(`/node_modules/${name}`))
    );
    return rule?.chunk || 'vendor';
}

/** Heavy optional chunks — never modulepreload from index.html. */
export const DEFERRED_PRELOAD_CHUNKS = ['assistant-gemma', 'tensorflow', 'viz-plotly'];
