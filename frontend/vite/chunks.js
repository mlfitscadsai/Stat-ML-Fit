const CHUNK_RULES = [
    { chunk: 'assistant-gemma', match: ['@huggingface/transformers', '@kessler/gemma-agent', 'onnxruntime'] },
    // Keep @tensorflow separate from danfojs — one mega-chunk causes TDZ init errors (IB/MR).
    { chunk: 'ml-tensorflow', match: ['@tensorflow'] },
    { chunk: 'ml-danfo', match: ['danfojs'] },
    { chunk: 'viz-plotly', match: ['plotly.js'] },
    { chunk: 'viz-highcharts', match: ['highcharts'] },
    { chunk: 'vendor-vue', match: ['vue', 'pinia', 'buefy', 'bulma'] },
];

export function manualChunkFor(id = '') {
    if (!id.includes('node_modules')) return undefined;
    const normalized = id.replace(/\\/g, '/');
    const rule = CHUNK_RULES.find(({ match }) =>
        match.some((name) => normalized.includes(`/node_modules/${name}`))
    );
    return rule?.chunk || 'vendor';
}

/** Chunks that must not be modulepreloaded from index.html (load on demand). */
export const DEFERRED_PRELOAD_CHUNKS = ['ml-tensorflow', 'ml-danfo'];
