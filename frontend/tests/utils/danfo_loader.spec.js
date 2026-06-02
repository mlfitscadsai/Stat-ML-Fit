import { describe, it, expect } from 'vitest';
import { getDanfo } from '../../src/utils/danfo_loader';

describe('danfo_loader.js', () => {
    it('getDanfo resolves to a namespace with DataFrame', async () => {
        const danfo = await getDanfo();
        expect(danfo).toBeDefined();
        expect(typeof danfo.DataFrame).toBe('function');

        const df = new danfo.DataFrame({ a: [1, 2], b: [3, 4] });
        expect(df.shape).toEqual([2, 2]);
    });

    it('getDanfo returns the same cached instance', async () => {
        const first = await getDanfo();
        const second = await getDanfo();
        expect(first).toBe(second);
    });
});
