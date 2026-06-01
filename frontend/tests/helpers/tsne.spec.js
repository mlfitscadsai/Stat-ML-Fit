import { describe, it, expect, vi } from 'vitest';
import TSNE from '../../src/helpers/dimensionality-reduction/tsne.js';
import { asyncRun } from '../../src/helpers/py-worker.js';

vi.mock('../../src/helpers/py-worker.js', () => {
    return {
        asyncRun: vi.fn()
    };
});

describe('t-SNE Helper', () => {
    it('should fit t-SNE correctly and cap perplexity', async () => {
        const mockResults = [[0.1, 0.2], [-0.1, -0.2]];
        vi.mocked(asyncRun).mockResolvedValue({ results: mockResults, error: null });

        const tsne = new TSNE();
        const results = await tsne.predict([[1, 2], [3, 4]], 2, 123, 30);

        expect(results).toEqual(mockResults);
        // Perplexity should be capped to n_samples - 1 = 1
        expect(vi.mocked(asyncRun).mock.calls[0][1].perplexity).toBe(1);
    });

    it('should throw correct t-SNE errors', async () => {
        vi.mocked(asyncRun).mockResolvedValue({ results: null, error: 'SVD failed' });

        const tsne = new TSNE();
        await expect(tsne.predict([[1, 2], [3, 4]], 2)).rejects.toThrow('Faced error fitting t-SNE: SVD failed');
    });
});
