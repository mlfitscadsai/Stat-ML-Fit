import axios from 'axios';
import { apiUrl } from '@/services/api/client';

export async function fetchHpcHealth() {
    const { data } = await axios.get(apiUrl('/health'));
    return data;
}

export function buildCsvBlobFromRawRows(rawData) {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return null;
    }
    const cols = Object.keys(rawData[0]);
    const escape = (value) => {
        if (value == null) return '';
        const s = String(value);
        if (/[",\n\r]/.test(s)) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };
    const lines = [
        cols.join(','),
        ...rawData.map((row) => cols.map((c) => escape(row[c])).join(',')),
    ];
    return new Blob([lines.join('\n')], { type: 'text/csv' });
}

export async function buildCsvBlobFromDataframe(dfd, dataframe) {
    if (!dfd?.toCSV || !dataframe) {
        return null;
    }
    const csv = dfd.toCSV(dataframe, { filePath: 'main.csv' });
    return new Blob([csv], { type: 'text/csv' });
}

export async function uploadDatasetBlob(blob, filename = 'main.csv') {
    const formdata = new FormData();
    formdata.append('file', blob, filename);
    const response = await axios.post(apiUrl('/upload'), formdata, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
}

export async function submitHpcRun({
    fileName,
    jobId,
    target,
    seed,
    methodName = '',
    explain = true,
}) {
    const params = new URLSearchParams({
        file_name: fileName,
        job_id: String(jobId),
        target: String(target),
        seed: String(seed),
        explain: explain ? 'true' : 'false',
    });
    if (methodName) {
        params.set('method_name', methodName);
    }
    return axios.get(apiUrl(`/run?${params.toString()}`));
}
