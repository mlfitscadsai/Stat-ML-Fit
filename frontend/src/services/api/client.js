/** Local dev: direct Flask. Production behind nginx: use `/api` (same-origin). */
export const DEFAULT_API_BASE = 'http://127.0.0.1:5001';
export const NGINX_API_PREFIX = '/api';

export function getApiBase() {
    const configuredBase = import.meta.env.VITE_API_BASE;
    if (configuredBase !== undefined && String(configuredBase).trim() !== '') {
        const base = String(configuredBase).trim().replace(/\/+$/, '');
        if (base.startsWith('/')) {
            return base;
        }
        return base;
    }
    if (import.meta.env.PROD && typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${NGINX_API_PREFIX}`;
    }
    return DEFAULT_API_BASE;
}

export function apiUrl(path) {
    const normalizedPath = String(path || '').replace(/^\/+/, '');
    return `${getApiBase()}/${normalizedPath}`;
}
