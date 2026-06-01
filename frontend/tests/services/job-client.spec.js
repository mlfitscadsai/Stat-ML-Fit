import { describe, expect, it, vi } from 'vitest';
import { normalizeJob, pollJob } from '../../src/services/jobs/job-client.js';

describe('job client', () => {
    it('normalizes backend job payloads for the Job Center', () => {
        expect(normalizeJob({ job_id: 'j1', status: 'completed', manifest: { target: 'y' } })).toMatchObject({
            id: 'j1',
            status: 'completed',
            target: 'y',
        });
    });

    it('polls job status through the API client', async () => {
        const http = { get: vi.fn().mockResolvedValue({ data: { job_id: 'j1', status: 'running' } }) };

        const job = await pollJob('j1', { http });

        expect(http.get).toHaveBeenCalledWith('http://127.0.0.1:5001/jobs/j1');
        expect(job.status).toBe('running');
    });
});
