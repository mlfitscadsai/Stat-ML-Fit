import { describe, it, expect } from 'vitest';
import Autoencoder from '../../src/helpers/dimensionality-reduction/autoencoder.js';

describe('Autoencoder Helper', () => {
    it('should normalize activation names', () => {
        const ae = new Autoencoder();
        expect(ae.normalizeActivation('RELU')).toBe('relu');
        expect(ae.normalizeActivation('invalid', 'relu')).toBe('relu');
        expect(ae.normalizeActivation('sigmoid')).toBe('sigmoid');
    });

    it('should fit Autoencoder on small numeric dataset', async () => {
        const ae = new Autoencoder();
        const data = [
            [1.0, 2.0, 3.0, 4.0],
            [1.5, 2.5, 3.5, 4.5],
            [2.0, 3.0, 4.0, 5.0],
            [2.5, 3.5, 4.5, 5.5],
            [3.0, 4.0, 5.0, 6.0]
        ];

        // 5 samples, 4 features. Reduce to latentSize=3.
        const result = await ae.predict(
            data,
            3, // latentSize
            5, // epochs
            [{ units: 8, activation: 'relu' }],
            'relu',
            'linear',
            123,
            0.01,
            'adam'
        );

        expect(result.encoded).toHaveLength(5);
        // latentDim should be 3 since inputDim=4 and requested latentSize=3.
        expect(result.latentDim).toBe(3);
        expect(result.encoded[0]).toHaveLength(3);
        expect(result.history.loss).toHaveLength(5);
    });

    it('should throw error when data size is too small', async () => {
        const ae = new Autoencoder();
        await expect(ae.predict([[1, 2]], 2, 5)).rejects.toThrow('Autoencoder needs at least 2 valid rows.');
    });
});
