const DB_NAME = 'stat-ml-fit-experiments';
const DB_VERSION = 1;
const STORE_NAME = 'experiments';

function hashString(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index++) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}

export function datasetFingerprint({ name = '', rows = [], columns = [] } = {}) {
    const sample = rows.slice(0, 25).map((row) => (
        columns.map((column) => row?.[column]).join('|')
    )).join('\n');
    return hashString(JSON.stringify({
        name,
        rows: rows.length,
        columns,
        sample,
    }));
}

export function createExperimentRecord({ result = {}, datasetName = '', rawData = [], config = {} } = {}) {
    const columns = rawData[0] ? Object.keys(rawData[0]) : [];
    return {
        id: result.id,
        runId: result.runId || `run-${result.id ?? Date.now()}`,
        model: result.name || result.modelName || 'Unknown model',
        datasetName,
        datasetFingerprint: datasetFingerprint({ name: datasetName, rows: rawData, columns }),
        target: result.target || config.target || null,
        taskMode: result.modelTask === false ? 'regression' : 'classification',
        executionBackend: result.useHPC ? 'hpc' : 'browser',
        status: result.status || 'completed',
        seed: result.seed ?? config.seed ?? null,
        config,
        metrics: result.metrics || {},
        warnings: result.warnings || [],
        artifacts: result.artifacts || [],
        startedAt: result.startedAt || null,
        finishedAt: result.finishedAt || new Date().toISOString(),
    };
}

function openDb() {
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'runId' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveExperiment(record) {
    const db = await openDb();
    if (!db) return record;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadExperiments() {
    const db = await openDb();
    if (!db) return [];
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export function exportExperimentJson(record) {
    return JSON.stringify(record, null, 2);
}
