const CHUNK_RULES = [
    { chunk: 'assistant-gemma', match: ['@huggingface/transformers', '@kessler/gemma-agent', 'onnxruntime'] },
    { chunk: 'data-danfo', match: ['danfojs'] },
    { chunk: 'viz-plotly', match: ['plotly.js'] },
    { chunk: 'viz-highcharts', match: ['highcharts'] },
    { chunk: 'vendor-vue', match: ['vue', 'pinia', 'buefy', 'bulma'] },
];

/** Packages that must not be merged into the shared vendor entry (TDZ / size). */
const DEFER_TO_ROLLUP = ['@tensorflow/'];

export function manualChunkFor(id = '') {
    if (!id.includes('node_modules')) return undefined;
    const normalized = id.replace(/\\/g, '/');
    if (DEFER_TO_ROLLUP.some((pkg) => normalized.includes(`/node_modules/${pkg}`))) {
        return undefined;
    }
    const rule = CHUNK_RULES.find(({ match }) =>
        match.some((name) => normalized.includes(`/node_modules/${name}`))
    );
    return rule?.chunk || 'vendor';
}

/** Heavy optional chunks — never modulepreload from index.html. */
export const DEFERRED_PRELOAD_CHUNKS = ['assistant-gemma', 'data-danfo', 'tensorflow', 'viz-plotly'];
