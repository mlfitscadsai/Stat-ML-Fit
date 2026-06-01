import { describe, it, expect } from 'vitest';
import UMAPReducer from '../../src/helpers/dimensionality-reduction/umap.js';

describe('UMAP Reducer Helper', () => {
    it('should standardize data correctly', () => {
        const reducer = new UMAPReducer();
        const data = [
            [2, 10],
            [4, 20],
            [6, 30]
        ];
        const standardized = reducer._standardize(data);

        // Means of columns: [4, 20]
        // Check that first column values standardize to approx [-1.22, 0, 1.22]
        expect(standardized[0][0]).toBeLessThan(0);
        expect(standardized[1][0]).toBeCloseTo(0, 5);
        expect(standardized[2][0]).toBeGreaterThan(0);
    });

    it('should fit UMAP on dummy dataset', async () => {
        const reducer = new UMAPReducer();
        const data = [
            [1.0, 2.0, 3.0],
            [1.1, 2.1, 3.1],
            [2.0, 5.0, 8.0],
            [2.2, 5.2, 8.2],
            [9.0, 9.0, 9.0],
            [9.5, 9.5, 9.5]
        ];

        const embedding = await reducer.predict(data, 2, 2, 0.1, 1.0, 42);
        expect(embedding).toHaveLength(6);
        expect(embedding[0]).toHaveLength(2);
    });

    it('should throw error when sample size is less than 4', async () => {
        const reducer = new UMAPReducer();
        await expect(reducer.predict([[1, 2], [3, 4]], 2)).rejects.toThrow('UMAP requires at least 4 samples.');
    });
});
