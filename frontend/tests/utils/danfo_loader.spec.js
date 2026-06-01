import { describe, it, expect } from 'vitest';
import { getDanfo } from '../../src/utils/danfo_loader';

describe('danfo_loader.js', () => {
    it('getDanfo should return a promise that resolves to danfo module', async () => {
        const promise1 = getDanfo();
        expect(promise1).toBeInstanceOf(Promise);

        const mod1 = await promise1;
        const mod2 = await getDanfo();
        expect(mod1).toBeDefined();
        expect(mod2).toBeDefined();
    });
});
