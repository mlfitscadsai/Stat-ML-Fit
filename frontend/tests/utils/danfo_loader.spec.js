import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('danfo_loader.js', () => {
    beforeEach(() => {
        vi.resetModules();
        delete globalThis.dfd;
        if (typeof window !== 'undefined') {
            delete window.dfd;
        }
        document.querySelectorAll('script[data-danfo-bundle="1"]').forEach((el) => el.remove());
    });

    it('getDanfo resolves from global dfd when already loaded', async () => {
        globalThis.dfd = {
            DataFrame: class DataFrame {
                constructor(data) {
                    this.$data = Object.values(data)[0]?.map((_, i) =>
                        Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v[i]]))
                    ) ?? [];
                    this.columns = Object.keys(data);
                    this.shape = [this.$data.length, this.columns.length];
                }
            },
        };

        const { getDanfo } = await import('../../src/utils/danfo_loader');
        const danfo = await getDanfo();
        expect(typeof danfo.DataFrame).toBe('function');
        const df = new danfo.DataFrame({ a: [1, 2], b: [3, 4] });
        expect(df.shape[0]).toBe(2);
    });
});
