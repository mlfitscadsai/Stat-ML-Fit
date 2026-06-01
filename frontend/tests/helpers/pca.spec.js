import { describe, it, expect, vi } from 'vitest';
import PCA from '../../src/helpers/dimensionality-reduction/pca.js';
import { asyncRun } from '../../src/helpers/py-worker.js';

vi.mock('../../src/helpers/py-worker.js', () => {
    return {
        asyncRun: vi.fn()
    };
});

describe('PCA Helper', () => {
    it('should fit PCA correctly and return structured results', async () => {
        const mockResults = [
            [[1.0, 2.0], [-1.0, -2.0]], // pca coords
            [1, 2], // component indices
            [0.7, 0.3], // explained variance ratio
            [[0.9, 0.1], [-0.9, -0.1]], // ccircle
            [0.905, 0.905], // distances
            [] // pca_test
        ];
        vi.mocked(asyncRun).mockResolvedValue({ results: mockResults, error: null });

        const pca = new PCA();
        const results = await pca.predict([[1, 2], [3, 4]], 2, 42, [], true);

        expect(results).toEqual(mockResults);
        expect(asyncRun).toHaveBeenCalled();
    });

    it('should throw error when Pyodide returns an error', async () => {
        vi.mocked(asyncRun).mockResolvedValue({ results: null, error: 'StandardScaler failed' });

        const pca = new PCA();
        await expect(pca.predict([[1, 2]], 2)).rejects.toThrow('PCA Python error: StandardScaler failed');
    });
});
