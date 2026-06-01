import axios from 'axios';
import { apiUrl } from '@/services/api/client';

export function normalizeJob(payload = {}) {
    const manifest = payload.manifest || {};
    return {
        id: payload.job_id || payload.id,
        status: payload.status || 'unknown',
        slurmJobId: payload.slurm_job_id || manifest.slurm_job_id || null,
        target: payload.target || manifest.target,
        methodName: payload.method_name || manifest.method_name,
        result: payload.result || null,
        logs: payload.logs || {
            stdout: payload.stdout || payload.slurm_output || '',
            stderr: payload.stderr || payload.slurm_error || '',
        },
        artifacts: payload.artifacts || [],
        manifest,
    };
}

export async function createJob(payload, { http = axios } = {}) {
    const response = await http.post(apiUrl('/jobs'), payload);
    return normalizeJob(response.data);
}

export async function pollJob(jobId, { http = axios } = {}) {
    const response = await http.get(apiUrl(`/jobs/${encodeURIComponent(jobId)}`));
    return normalizeJob(response.data);
}

export async function fetchJobLogs(jobId, { http = axios } = {}) {
    const response = await http.get(apiUrl(`/jobs/${encodeURIComponent(jobId)}/logs`));
    return normalizeJob(response.data);
}

export async function cancelJob(jobId, slurmJobId, { http = axios } = {}) {
    const response = await http.post(apiUrl(`/jobs/${encodeURIComponent(jobId)}/cancel`), {
        slurm_job_id: slurmJobId,
    });
    return normalizeJob(response.data);
}

export async function fetchJobArtifacts(jobId, { http = axios } = {}) {
    const response = await http.get(apiUrl(`/jobs/${encodeURIComponent(jobId)}/artifacts`));
    return normalizeJob(response.data);
}
