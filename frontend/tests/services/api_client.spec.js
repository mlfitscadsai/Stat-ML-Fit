import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl, getApiBase, NGINX_API_PREFIX } from '../../src/services/api/client.js';

describe('API client configuration', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('builds endpoint URLs from VITE_API_BASE (absolute)', () => {
        vi.stubEnv('VITE_API_BASE', 'http://127.0.0.1:5001');
        expect(apiUrl('/upload')).toBe('http://127.0.0.1:5001/upload');
        expect(apiUrl('progress?job_id=abc')).toBe('http://127.0.0.1:5001/progress?job_id=abc');
    });

    it('builds same-origin URLs when VITE_API_BASE is /api', () => {
        vi.stubEnv('VITE_API_BASE', '/api');
        expect(getApiBase()).toBe('/api');
        expect(apiUrl('/upload')).toBe('/api/upload');
        expect(apiUrl('/jobs/abc')).toBe('/api/jobs/abc');
    });

    it('exposes nginx API prefix constant', () => {
        expect(NGINX_API_PREFIX).toBe('/api');
    });
});
