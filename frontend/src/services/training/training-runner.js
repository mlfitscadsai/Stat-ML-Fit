import { recommendModels } from '@/services/recommendations/recommendation-service';
import { pollJob } from '@/services/jobs/job-client';
import { hasLoadedDataset } from '@/utils/dataset_source';

const PERCENTAGE_METRICS = new Set([
    'accuracy',
    'f1_micro',
    'f1_macro',
    'precision',
    'recall',
    'auc',
    'auc_roc',
]);

export function validateConfig(config = {}) {
    if (!hasLoadedDataset({ rawData: config.rawData, getDataset: config.dataframe, df: config.dataframe })) {
        return { valid: false, message: 'Please upload/select a dataset before training.' };
    }
    if (!config.target) {
        return { valid: false, message: 'Please select a target column before training.' };
    }
    if (config.algoId == null) {
        return { valid: false, message: 'Please choose a model before training.' };
    }
    return { valid: true };
}

function formatMetricName(key) {
    return String(key).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetricValue(key, value) {
    if (typeof value !== 'number') return String(value);
    if (PERCENTAGE_METRICS.has(String(key).toLowerCase())) {
        return `${(value * 100).toFixed(1)}%`;
    }
    return Number(value).toFixed(4);
}

export function normalizeResult(result = {}) {
    const rawMetrics = result.metrics || {};
    return {
        modelId: result.id != null ? result.id.toString(16) : '',
        metrics: Object.entries(rawMetrics).map(([key, value]) => ({
            name: formatMetricName(key),
            value,
            display: formatMetricValue(key, value),
        })),
        raw: result,
    };
}

export async function runSidebarTraining({ sidebar, store, onProgress } = {}) {
    if (!sidebar?.train) {
        throw new Error('Training runner requires a sidebar training adapter.');
    }
    const progress = typeof onProgress === 'function' ? onProgress : () => {};
    progress(10, 'Validating dataset and model configuration...');
    progress(25, 'Preparing features and preprocessing steps...');
    await sidebar.train();
    progress(90, 'Normalizing training results...');
    const lastResult = store?.results?.[store.results.length - 1] || {};
    const normalized = normalizeResult(lastResult);
    progress(100, 'Training run completed.');
    return normalized;
}

export function recommend(data, options = {}) {
    return recommendModels(data, options);
}

export async function runQuickBenchmark({ candidates = [], runCandidate, signal, onProgress } = {}) {
    if (typeof runCandidate !== 'function') {
        throw new Error('Quick benchmark requires a runCandidate function.');
    }
    const progress = typeof onProgress === 'function' ? onProgress : () => {};
    const results = [];
    for (let index = 0; index < candidates.length; index++) {
        if (signal?.aborted) {
            break;
        }
        const candidate = candidates[index];
        progress(Math.round((index / Math.max(1, candidates.length)) * 100), `Benchmarking ${candidate.label || candidate.modelId}...`);
        const result = await runCandidate(candidate);
        results.push({ candidate, result });
    }
    progress(100, 'Quick benchmark complete.');
    return results;
}

export async function runHpc(payload, { jobClient } = {}) {
    if (!jobClient?.createJob) {
        throw new Error('HPC runner requires a job client with createJob.');
    }
    return jobClient.createJob(payload);
}

export async function pollProgress(jobId, { jobClient = { pollJob } } = {}) {
    return jobClient.pollJob(jobId);
}
