const CHUNK_RULES = [
    { chunk: 'assistant-gemma', match: ['@huggingface/transformers', '@kessler/gemma-agent', 'onnxruntime'] },
    // Keep danfojs + tensorflow in one chunk (splitting causes TDZ/circular init errors).
    { chunk: 'ml-tensorflow', match: ['@tensorflow', 'danfojs', 'scikitjs'] },
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
